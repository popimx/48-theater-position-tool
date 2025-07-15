async function assignPositions(inputMembers) {
  // ステージ選択。kokonidattetenshihairu 等のステージに対応
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ① ポジションと経験データを取得
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const positions = await positionsRes.json();
  const experienceData = await experienceRes.json();

  // ② 初日メンバーセット作成（ポジションのfirstDayMember）
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // ③ 各メンバーの経験ポジション数（初日含む）をカウント
  const experienceCountMap = {};
  for (const member of inputMembers) experienceCountMap[member] = 0;
  positions.forEach(pos => {
    const base = pos.firstDayMember;
    if (inputMembers.includes(base)) experienceCountMap[base]++;
    const experienced = experienceData[base] || [];
    for (const m of experienced) {
      if (inputMembers.includes(m)) experienceCountMap[m]++;
    }
  });

  // ④ メンバー → 関連ポジションの逆引きマップ（初日・経験含む）
  const memberToPositions = {};
  for (const m of inputMembers) memberToPositions[m] = new Set();
  positions.forEach(pos => {
    const base = pos.firstDayMember;
    const experienced = experienceData[base] || [];
    for (const m of inputMembers) {
      if (m === base || experienced.includes(m)) {
        memberToPositions[m].add(pos.name);
      }
    }
  });

  // ★ 固定ポジション（スコア70）の割り当て候補（ステージごとに設定）
  const fixedAssignmentsMap = {
    mokugekisha: {
      "石橋颯ポジ": "渋井美奈",
      "市村愛里ポジ": "生野莉奈",
      "伊藤優絵瑠ポジ": "山内祐奈",
      "運上弘菜ポジ": "石橋颯",
      "栗原紗英ポジ": "栗原紗英",
      "矢吹奈子ポジ": "北川陽彩",
      "渡部愛加里ポジ": "市村愛里",
      "梁瀬鈴雅ポジ": "梁瀬鈴雅"
    },
    kokonidattetenshihairu: {
      "今村麻莉愛ポジ": "田中伊桜莉",
      "栗山梨奈ポジ": "立花心良",
      "後藤陽菜乃ポジ": "福井可憐",
      "坂本愛玲菜ポジ": "森﨑冴彩",
      "武田智加ポジ": "秋吉優花",
      "田中美久ポジ": "今村麻莉愛",
      "馬場彩華ポジ": "大内梨果",
      "松岡はなポジ": "井澤美優",
      "村上和叶ポジ": "大庭凜咲",
      "本村碧唯ポジ": "江口心々華",
      "山下エミリーポジ": "栗山梨奈"
    }
  };
  const fixedAssignments = fixedAssignmentsMap[stage] || {};

  // ⑤ 全候補者リストを作成（スコア100, 75, 50, 25 を割り当て）
  const candidates = [];
  positions.forEach((pos, posIndex) => {
    const base = pos.firstDayMember;
    const experienced = experienceData[base] || [];

    inputMembers.forEach((member, memberIndex) => {
      const isFirstDay = base === member;
      const isExperienced = experienced.includes(member);
      const expCount = experienceCountMap[member] || 0;

      let score;
      if (isFirstDay && expCount === 1) {
        score = 100; // 初日＆そのポジしか経験なし（特別優先）
      } else if (!isFirstDay && isExperienced && expCount === 1) {
        score = 75; // 経験者だが1回のみ
      } else if ((isFirstDay || isExperienced) && expCount >= 2) {
        score = 50; // 複数回経験者
      } else {
        score = 25; // 未経験者
      }

      candidates.push({
        positionName: pos.name,
        baseName: base,
        member,
        score,
        posIndex,
        memberIndex
      });
    });
  });

  // ⑥ 割り当て管理セット
  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  // ⑦ スコア100の割り当て（優先度最強）
  candidates
    .filter(c => c.score === 100)
    .sort((a, b) => a.posIndex - b.posIndex)
    .forEach(c => {
      if (!usedPositions.has(c.positionName) && !usedMembers.has(c.member)) {
        assignmentMap[c.positionName] = { member: c.member, score: 100 };
        usedPositions.add(c.positionName);
        usedMembers.add(c.member);
      }
    });

  // ⑧ スコア75の割り当て（ポジション候補数が少ない順に優先）
  const score75Candidates = candidates.filter(c =>
    c.score === 75 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );
  const score75MemberToPosCount = {};
  score75Candidates.forEach(c => {
    score75MemberToPosCount[c.member] = memberToPositions[c.member].size;
  });
  score75Candidates
    .sort((a, b) => score75MemberToPosCount[a.member] - score75MemberToPosCount[b.member])
    .forEach(c => {
      if (!usedPositions.has(c.positionName) && !usedMembers.has(c.member)) {
        assignmentMap[c.positionName] = { member: c.member, score: 75 };
        usedPositions.add(c.positionName);
        usedMembers.add(c.member);
      }
    });

  // ⑧.5 スコア70（固定割り当て）を優先的に確定
  Object.entries(fixedAssignments).forEach(([positionName, member]) => {
    if (
      inputMembers.includes(member) &&
      !usedPositions.has(positionName) &&
      !usedMembers.has(member)
    ) {
      assignmentMap[positionName] = { member, score: 70 };
      usedPositions.add(positionName);
      usedMembers.add(member);
    }
  });

  // ⑨ スコア50候補者をポジション別に整理（member情報も保持）
  const score50Candidates = candidates.filter(c =>
    c.score === 50 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );
  const posTo50Candidates = {};
  score50Candidates.forEach(c => {
    if (!posTo50Candidates[c.positionName]) posTo50Candidates[c.positionName] = [];
    posTo50Candidates[c.positionName].push(c);
  });

  // ★ スコア50候補の優先度で候補者をソート（経験者優先、候補ポジション数少ない順、memberIndex昇順）
  for (const pos in posTo50Candidates) {
    posTo50Candidates[pos].sort((a, b) => {
      const aExperienced = (experienceData[a.baseName]?.includes(a.member) || a.baseName === a.member) ? 1 : 0;
      const bExperienced = (experienceData[b.baseName]?.includes(b.member) || b.baseName === b.member) ? 1 : 0;

      const aPosCount = memberToPositions[a.member].size;
      const bPosCount = memberToPositions[b.member].size;

      if (aExperienced !== bExperienced) return bExperienced - aExperienced; // 経験者を優先
      if (aPosCount !== bPosCount) return aPosCount - bPosCount;             // ポジション候補が少ないほうを優先
      return a.memberIndex - b.memberIndex;                                 // 入力順昇順
    });
  }

  // ⑩ バックトラックで最大割当数の割り当てを探すロジック
  let bestAssignment = {};
  let bestCount = 0;

  function backtrackMaxAssign(posList, usedMembersBT, assignmentBT, index = 0) {
    if (index >= posList.length) {
      // 現時点の割り当て数チェック
      const assignedCount = Object.keys(assignmentBT).length;
      if (assignedCount > bestCount) {
        // 最大割当数更新
        bestCount = assignedCount;
        bestAssignment = { ...assignmentBT };
      }
      return;
    }

    const pos = posList[index];
    const candidatesForPos = posTo50Candidates[pos] || [];

    let assignedHere = false;
    for (const candidate of candidatesForPos) {
      const member = candidate.member;
      if (!usedMembersBT.has(member)) {
        // 割り当てて次へ
        assignmentBT[pos] = member;
        usedMembersBT.add(member);

        backtrackMaxAssign(posList, usedMembersBT, assignmentBT, index + 1);

        // 戻す
        delete assignmentBT[pos];
        usedMembersBT.delete(member);
        assignedHere = true;
      }
    }

    if (!assignedHere) {
      // このポジションはスキップして次へ（割り当てなし）
      backtrackMaxAssign(posList, usedMembersBT, assignmentBT, index + 1);
    }
  }

  const pos50List = Object.keys(posTo50Candidates);
  backtrackMaxAssign(pos50List, new Set(), {}, 0);

  // ⑪ 最大割当数のスコア50割り当て反映
  for (const [posName, member] of Object.entries(bestAssignment)) {
    assignmentMap[posName] = { member, score: 50 };
    usedPositions.add(posName);
    usedMembers.add(member);
  }

  // ⑫ スコア50割り当てで割れなかったポジションのみスコア25割り当て
  const unassignedPos = pos50List.filter(pos => !bestAssignment.hasOwnProperty(pos));
  candidates
    .filter(c =>
      c.score === 25 &&
      unassignedPos.includes(c.positionName) &&
      !usedPositions.has(c.positionName) &&
      !usedMembers.has(c.member)
    )
    .sort((a, b) => a.memberIndex - b.memberIndex)
    .forEach(c => {
      if (!usedPositions.has(c.positionName) && !usedMembers.has(c.member)) {
        assignmentMap[c.positionName] = { member: c.member, score: 25 };
        usedPositions.add(c.positionName);
        usedMembers.add(c.member);
      }
    });

  // ⑬ 割り当て漏れチェック（メンバーが未割り当てなら例外）
  const unassignedMembers = inputMembers.filter(m => !usedMembers.has(m));
  if (unassignedMembers.length > 0) {
    throw new Error(`未割り当てのメンバーがいます: ${unassignedMembers.join(', ')}`);
  }

  // ⑭ 最終結果をポジションの順で返却（割り当て無しは「―」）
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