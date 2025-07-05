async function assignPositions(inputMembers) {
  // 公演ステージ名取得（例: 'kokokarada'）
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ポジション情報取得
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const positions = await positionsRes.json();

  // 経験者データ取得
  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const experienceData = await experienceRes.json();

  // 初日メンバーのセットを作成（チェック用）
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // 全経験者の出現回数マップ作成
  const allExperiencedMembers = Object.values(experienceData).flat();
  const experienceCountMap = {};
  allExperiencedMembers.forEach(name => {
    experienceCountMap[name] = (experienceCountMap[name] || 0) + 1;
  });

  // 整合性チェック：入力メンバーが初日メンバーか経験者に存在するか確認
  for (const member of inputMembers) {
    if (!firstDayMembersSet.has(member) && !experienceCountMap[member]) {
      throw new Error(`データ整合性エラー: "${member}" は初日メンバーにも経験者にも存在しません。`);
    }
  }

  // ①〜⑤スコア付き割り当て候補リスト作成
  const combinations = [];
  positions.forEach((pos, posIndex) => {
    const baseName = pos.firstDayMember;             // ポジションの初日メンバー名
    const experienced = experienceData[baseName] || []; // 経験者リスト（空配列防止）

    inputMembers.forEach((member, memberIndex) => {
      let score = 0;
      const isFirstDay = baseName === member;         // ①初日メンバーと一致
      const isExperienced = experienced.includes(member); // ②経験者欄にいるか
      const totalExp = experienceCountMap[member] || 0;    // 全経験回数

      if (isFirstDay && totalExp === 0) {
        score = 100;   // ① 初日メンバーかつ未経験者スコア最大
      } else if (isExperienced && totalExp === 1) {
        score = 75;    // ② 経験者かつ経験1回だけ
      } else if (isFirstDay || isExperienced) {
        // ③④ そのポジションの初日or経験者欄に名前あり、かつ複数ポジションに存在する場合は49か50
        let relevantCount = 0;
        positions.forEach(p => {
          const fn = p.firstDayMember;
          const exp = experienceData[fn] || [];
          if (fn === member || exp.includes(member)) relevantCount++;
        });
        score = relevantCount === 1 ? 50 : 49;
      } else {
        score = 25;    // ⑤ どれにも当てはまらない未経験者
      }

      combinations.push({
        positionName: pos.name,
        member,
        score,
        posIndex,
        memberIndex
      });
    });
  });

  // ①②（スコア100,75）割り当て部分のソート処理（スコア→ポジション順→入力順）
  combinations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.posIndex !== b.posIndex) return a.posIndex - b.posIndex;
    return a.memberIndex - b.memberIndex;
  });

  // 使用済みポジション・メンバー管理用Set
  const usedPositions = new Set();
  const usedMembers = new Set();

  // 最終割り当てマップ
  const assignmentMap = {};

  // ①②割り当て（スコア100か75）を優先的に割り当てる
  for (const combo of combinations) {
    if ((combo.score === 100 || combo.score === 75) &&
        !usedPositions.has(combo.positionName) && !usedMembers.has(combo.member)) {
      assignmentMap[combo.positionName] = {
        member: combo.member,
        score: combo.score
      };
      usedPositions.add(combo.positionName);
      usedMembers.add(combo.member);
    }
  }

  // ③④ スコア49,50の割り当て候補のみ抽出（未割り当てかつ未使用メンバー）
  const score49_50Combos = combinations.filter(
    c => (c.score === 49 || c.score === 50) &&
         !usedPositions.has(c.positionName) &&
         !usedMembers.has(c.member)
  );

  // ポジションごとに候補メンバーをまとめる
  const posToCandidates = {};
  score49_50Combos.forEach(c => {
    if (!posToCandidates[c.positionName]) posToCandidates[c.positionName] = [];
    posToCandidates[c.positionName].push(c);
  });

  // メンバーごとに該当ポジション数をカウント
  const memberToPositions = {};
  score49_50Combos.forEach(c => {
    if (!memberToPositions[c.member]) memberToPositions[c.member] = new Set();
    memberToPositions[c.member].add(c.positionName);
  });

  // スコア49,50の割り当て（経験者優先＆該当ポジション数少ない順で）
  Object.entries(posToCandidates).forEach(([positionName, candidates]) => {
    // そのポジションの初日メンバーと経験者リスト
    const baseName = positions.find(p => p.name === positionName)?.firstDayMember;
    const expList = experienceData[baseName] || [];

    // 初日メンバーか経験者欄にいる候補のみ残す
    const filteredCandidates = candidates.filter(c =>
      c.member === baseName || expList.includes(c.member)
    );

    // 該当ポジション数の少ない順にソート
    filteredCandidates.sort((a, b) =>
      (memberToPositions[a.member]?.size || 0) - (memberToPositions[b.member]?.size || 0)
    );

    // 割り当て可能なら割り当てる
    for (const candidate of filteredCandidates) {
      if (!usedMembers.has(candidate.member)) {
        assignmentMap[positionName] = {
          member: candidate.member,
          score: candidate.score
        };
        usedMembers.add(candidate.member);
        usedPositions.add(positionName);
        break;
      }
    }
  });

  // --- 整合性チェック関数 ---
  function validateAssignments() {
    const invalidPositions = [];

    // 割り当て済みポジションについて整合性チェック
    for (const [posName, { member }] of Object.entries(assignmentMap)) {
      const baseName = positions.find(p => p.name === posName)?.firstDayMember;
      const expList = experienceData[baseName] || [];
      // 初日 or 経験者リストに名前がなければ不整合
      if (member !== baseName && !expList.includes(member)) {
        invalidPositions.push(posName);
      }
    }
    return invalidPositions;
  }

  // 整合性チェックと割り当て再調整ループ
  const MAX_RETRIES = 10;
  let retryCount = 0;

  let invalidPositions = validateAssignments();

  while (invalidPositions.length > 0 && retryCount < MAX_RETRIES) {
    retryCount++;

    // 不整合のポジション割り当て解除し、メンバーとポジションを空きに戻す
    for (const posName of invalidPositions) {
      const member = assignmentMap[posName].member;
      delete assignmentMap[posName];
      usedPositions.delete(posName);
      usedMembers.delete(member);
    }

    // 不整合ポジションに対し、再度候補から割り当てを試みる
    for (const posName of invalidPositions) {
      const baseName = positions.find(p => p.name === posName)?.firstDayMember;
      const expList = experienceData[baseName] || [];

      const candidates = score49_50Combos.filter(c =>
        c.positionName === posName &&
        !usedMembers.has(c.member) &&
        (c.member === baseName || expList.includes(c.member))
      );

      candidates.sort((a, b) =>
        (memberToPositions[a.member]?.size || 0) - (memberToPositions[b.member]?.size || 0)
      );

      for (const candidate of candidates) {
        if (!usedMembers.has(candidate.member)) {
          assignmentMap[posName] = {
            member: candidate.member,
            score: candidate.score
          };
          usedMembers.add(candidate.member);
          usedPositions.add(posName);
          break;
        }
      }
    }

    invalidPositions = validateAssignments();
  }

  // ⑤ スコア25以下の残りメンバーを割り当て
  for (const combo of combinations) {
    if (!assignmentMap[combo.positionName] && !usedMembers.has(combo.member)) {
      assignmentMap[combo.positionName] = {
        member: combo.member,
        score: combo.score
      };
      usedMembers.add(combo.member);
      usedPositions.add(combo.positionName);
    }
  }

  // 最終的にポジション順で返す
  return positions.map(pos => {
    if (assignmentMap[pos.name]) {
      return {
        positionName: pos.name,
        member: assignmentMap[pos.name].member,
        score: assignmentMap[pos.name].score
      };
    }
    return {
      positionName: pos.name,
      member: '―',
      score: 0
    };
  });
}