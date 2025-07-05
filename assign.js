async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // 初期データ読み込み（ポジション & 経験者）
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const positions = await positionsRes.json();

  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const experienceData = await experienceRes.json();

  // 初日メンバー一覧（重複なしのSet）
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // 経験者ごとの登場回数をカウント
  const allExperiencedMembers = Object.values(experienceData).flat();
  const experienceCountMap = {};
  allExperiencedMembers.forEach(name => {
    experienceCountMap[name] = (experienceCountMap[name] || 0) + 1;
  });

  // === 整合性チェック ===
  for (const member of inputMembers) {
    if (!firstDayMembersSet.has(member) && !experienceCountMap[member]) {
      throw new Error(`データ整合性エラー: "${member}" は初日メンバーにも経験者にも存在しません。`);
    }
  }

  // === スコア付き候補リスト作成 ===
  const combinations = [];

  positions.forEach((pos, posIndex) => {
    const baseName = pos.firstDayMember;
    const experienced = experienceData[baseName] || [];

    inputMembers.forEach((member, memberIndex) => {
      let score = 0;
      const isFirstDay = baseName === member;
      const isExperienced = experienced.includes(member);
      const totalExp = experienceCountMap[member] || 0;

      if (isFirstDay && totalExp === 0) {
        score = 100; // ① 完全初日
      } else if (isExperienced && totalExp === 1) {
        score = 75;  // ② 経験者でその1回だけ
      } else if (isFirstDay || isExperienced) {
        // ③ ④ 該当ポジションのみに登場 → 50、それ以上 → 49
        let relevantCount = 0;
        positions.forEach(p => {
          const fn = p.firstDayMember;
          const exp = experienceData[fn] || [];
          if (fn === member || exp.includes(member)) relevantCount++;
        });
        score = relevantCount === 1 ? 50 : 49;
      } else {
        score = 25; // ⑤ 完全未経験
      }

      combinations.push({
        positionName: pos.name,
        baseName,
        member,
        score,
        posIndex,
        memberIndex
      });
    });
  });

  // === ①② スコア100・75 優先で割り当て ===
  combinations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.posIndex !== b.posIndex) return a.posIndex - b.posIndex;
    return a.memberIndex - b.memberIndex;
  });

  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  for (const combo of combinations) {
    if ((combo.score === 100 || combo.score === 75) &&
        !usedPositions.has(combo.positionName) &&
        !usedMembers.has(combo.member)) {
      assignmentMap[combo.positionName] = {
        member: combo.member,
        score: combo.score
      };
      usedPositions.add(combo.positionName);
      usedMembers.add(combo.member);
    }
  }

  // === 🔍 スコア49・50 の候補抽出（ポジション単位） ===
  const score50Combos = combinations.filter(
    c => (c.score === 49 || c.score === 50) &&
         !usedPositions.has(c.positionName) &&
         !usedMembers.has(c.member)
  );

  // ポジションごとに候補を整理
  const posToCandidates = {};
  score50Combos.forEach(c => {
    if (!posToCandidates[c.positionName]) posToCandidates[c.positionName] = [];
    posToCandidates[c.positionName].push(c);
  });

  // メンバーごとの該当ポジション数
  const memberToPositions = {};
  score50Combos.forEach(c => {
    if (!memberToPositions[c.member]) memberToPositions[c.member] = new Set();
    memberToPositions[c.member].add(c.positionName);
  });

  // === ③④ 割り当て（経験者優先 → 該当ポジ数の少ない順） ===
  for (const [positionName, candidates] of Object.entries(posToCandidates)) {
    candidates.sort((a, b) => {
      const aExp = (experienceData[a.baseName] || []).includes(a.member);
      const bExp = (experienceData[b.baseName] || []).includes(b.member);

      if (aExp !== bExp) return bExp - aExp; // 経験者を優先
      return (memberToPositions[a.member].size - memberToPositions[b.member].size); // 少ない順
    });

    for (const candidate of candidates) {
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
  }

  // === 🔍 最終チェック：経験者欄にないスコア49以上は無効化 ===
  for (const [positionName, data] of Object.entries(assignmentMap)) {
    if (data.score >= 49) {
      const baseName = positions.find(p => p.name === positionName)?.firstDayMember;
      const expList = experienceData[baseName] || [];
      if (data.member !== baseName && !expList.includes(data.member)) {
        delete assignmentMap[positionName]; // 削除
        usedMembers.delete(data.member);
        usedPositions.delete(positionName);
      }
    }
  }

  // === ⑤ スコア25以下の割り当て ===
  for (const combo of combinations) {
    if (!assignmentMap[combo.positionName] &&
        !usedMembers.has(combo.member) &&
        combo.score <= 49) {
      assignmentMap[combo.positionName] = {
        member: combo.member,
        score: combo.score
      };
      usedMembers.add(combo.member);
    }
  }

  // === 最終出力形式に整形して返す ===
  return positions.map(pos => {
    if (assignmentMap[pos.name]) {
      return {
        positionName: pos.name,
        member: assignmentMap[pos.name].member,
        score: assignmentMap[pos.name].score
      };
    } else {
      return {
        positionName: pos.name,
        member: '―',
        score: 0
      };
    }
  });
}