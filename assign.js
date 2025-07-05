async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ① ポジション・経験データを読み込み
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const positions = await positionsRes.json();
  const experienceData = await experienceRes.json();

  // ② 初日メンバーセットを作成
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

  // ④ 逆引きマップ：メンバー → 関連ポジション（初日・経験両方）
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

  // ⑤ 全候補スコア付きリストを作成
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
        score = 100; // 初日メンバーかつ経験者欄なし
      } else if (!isFirstDay && isExperienced && expCount === 1) {
        score = 75;  // 経験者欄に1回だけ
      } else if ((isFirstDay || isExperienced) && expCount >= 2) {
        score = 50;  // 複数経験者
      } else {
        score = 25;  // 未経験者
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

  // ⑥ 割り当て用セット
  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  // ⑦ スコア100を優先的に割り当て確定
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

  // ⑧ スコア75は候補ポジション数が少ない順で割り当て
  const score75Candidates = candidates.filter(c =>
    c.score === 75 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );

  // 候補ポジ数をカウント
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

  // ⑨ スコア50の候補をポジションごとにまとめる（経験者欄 or 初日メンバーのみ）
  const score50Candidates = candidates.filter(c =>
    c.score === 50 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );

  const posTo50Candidates = {};
  const memberTo50Positions = {};
  score50Candidates.forEach(c => {
    const base = c.baseName;
    const experienced = experienceData[base] || [];
    if (c.member === base || experienced.includes(c.member)) {
      if (!posTo50Candidates[c.positionName]) posTo50Candidates[c.positionName] = [];
      posTo50Candidates[c.positionName].push(c.member);

      if (!memberTo50Positions[c.member]) memberTo50Positions[c.member] = new Set();
      memberTo50Positions[c.member].add(c.positionName);
    }
  });

  // ⑩ バックトラックでスコア50の割り当て最適化

  /**
   * posList: 割り当て対象ポジションリスト
   * usedMembers: 既に割り当て済みメンバーセット
   * assignment: ポジション→メンバー割り当て途中結果
   * index: 現在割り当て中のポジションのindex
   */
  function backtrackAssign(posList, usedMembers, assignment, index = 0) {
    if (index >= posList.length) return true; // 全割り当て完了

    const pos = posList[index];
    const candidates = posTo50Candidates[pos] || [];

    for (const member of candidates) {
      if (!usedMembers.has(member)) {
        assignment[pos] = member;
        usedMembers.add(member);

        if (backtrackAssign(posList, usedMembers, assignment, index + 1)) {
          return true;
        }

        // 戻す
        delete assignment[pos];
        usedMembers.delete(member);
      }
    }

    // 割り当てられなかった場合
    return false;
  }

  const pos50List = Object.keys(posTo50Candidates);
  const assignment50 = {};
  const usedMembers50 = new Set();

  // バックトラック開始
  backtrackAssign(pos50List, usedMembers50, assignment50, 0);

  // ⑪ バックトラック結果を割り当てに反映
  for (const [posName, member] of Object.entries(assignment50)) {
    assignmentMap[posName] = { member, score: 50 };
    usedPositions.add(posName);
    usedMembers.add(member);
  }

  // ⑫ スコア25を最後に割り当て（残りのポジション・メンバー）
  candidates
    .filter(c =>
      c.score === 25 &&
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

  // ⑬ 割り当て漏れチェック
  const unassignedMembers = inputMembers.filter(m => !usedMembers.has(m));
  if (unassignedMembers.length > 0) {
    throw new Error(`未割り当てのメンバーがいます: ${unassignedMembers.join(', ')}`);
  }

  // ⑭ 最終結果を元のポジション順で返す
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