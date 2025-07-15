async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ① ポジション・経験データ読み込み
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const positions = await positionsRes.json();
  const experienceData = await experienceRes.json();

  // ② 初日メンバーセット
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // ③ 各メンバーの経験ポジション数をカウント
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

  // ④ メンバー → 経験ポジションセット
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

  // ⑤ 固定割り当て（スコア70）
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

  // ⑥ 候補スコア計算
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
        score = 100;
      } else if (!isFirstDay && isExperienced && expCount === 1) {
        score = 75;
      } else if ((isFirstDay || isExperienced) && expCount >= 2) {
        score = 50;
      } else {
        score = 25;
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

  // ⑦ 状態管理
  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  // ⑧ スコア100 割り当て
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

  // ⑨ スコア75 割り当て（候補数少ない順）
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

  // ⑨.5 スコア70（固定割り当て）
  Object.entries(fixedAssignments).forEach(([pos, member]) => {
    if (
      inputMembers.includes(member) &&
      !usedPositions.has(pos) &&
      !usedMembers.has(member)
    ) {
      assignmentMap[pos] = { member, score: 70 };
      usedPositions.add(pos);
      usedMembers.add(member);
    }
  });

  // ⑩ スコア50候補整理
  const score50Candidates = candidates.filter(c =>
    c.score === 50 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );
  const posTo50Candidates = {};
  for (const c of score50Candidates) {
    if (!posTo50Candidates[c.positionName]) posTo50Candidates[c.positionName] = [];
    posTo50Candidates[c.positionName].push(c.member);
  }

  // ⑩.1 候補1人だけのポジションを確定
  for (const [pos, members] of Object.entries(posTo50Candidates)) {
    if (members.length === 1) {
      const member = members[0];
      if (!usedMembers.has(member)) {
        assignmentMap[pos] = { member, score: 50 };
        usedPositions.add(pos);
        usedMembers.add(member);
        delete posTo50Candidates[pos];
      }
    }
  }

  // ⑩.2 1ポジだけ経験のメンバーを確定
  const memberTo50Positions = {};
  for (const [pos, members] of Object.entries(posTo50Candidates)) {
    for (const member of members) {
      if (!memberTo50Positions[member]) memberTo50Positions[member] = [];
      memberTo50Positions[member].push(pos);
    }
  }
  for (const [member, posList] of Object.entries(memberTo50Positions)) {
    if (posList.length === 1) {
      const pos = posList[0];
      if (!usedPositions.has(pos) && !usedMembers.has(member)) {
        assignmentMap[pos] = { member, score: 50 };
        usedPositions.add(pos);
        usedMembers.add(member);
        delete posTo50Candidates[pos];
      }
    }
  }

  // ⑩.3 バックトラックで残りのスコア50を最適化割り当て
  function backtrackAssign(posList, usedMembersSet, assignment, index = 0) {
    if (index >= posList.length) return true;
    const pos = posList[index];
    const members = posTo50Candidates[pos] || [];
    for (const member of members) {
      if (!usedMembersSet.has(member)) {
        assignment[pos] = member;
        usedMembersSet.add(member);
        if (backtrackAssign(posList, usedMembersSet, assignment, index + 1)) return true;
        delete assignment[pos];
        usedMembersSet.delete(member);
      }
    }
    return false;
  }

  const pos50List = Object.keys(posTo50Candidates);
  const assignment50 = {};
  const usedMembers50 = new Set();
  backtrackAssign(pos50List, usedMembers50, assignment50, 0);

  for (const [pos, member] of Object.entries(assignment50)) {
    assignmentMap[pos] = { member, score: 50 };
    usedPositions.add(pos);
    usedMembers.add(member);
  }

  // ⑪ スコア25を残りに割り当て
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

  // ⑫ 割り当て漏れ確認
  const unassignedMembers = inputMembers.filter(m => !usedMembers.has(m));
  if (unassignedMembers.length > 0) {
    throw new Error(`未割り当てのメンバーがいます: ${unassignedMembers.join(', ')}`);
  }

  // ⑬ 最終出力
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