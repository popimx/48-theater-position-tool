async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ① データ読み込み
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const positions = await positionsRes.json();
  const experienceData = await experienceRes.json();

  // ② 経験回数マップ
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

  // ③ メンバー → ポジション逆引きマップ
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

  // ④ 固定割り当て（スコア70）
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

  // ⑤ 候補スコア付きリスト
  const candidates = [];
  positions.forEach((pos, posIndex) => {
    const base = pos.firstDayMember;
    const experienced = experienceData[base] || [];
    inputMembers.forEach((member, memberIndex) => {
      const isFirstDay = base === member;
      const isExperienced = experienced.includes(member);
      const expCount = experienceCountMap[member] || 0;

      let score = 25;
      if (isFirstDay && expCount === 1) score = 100;
      else if (!isFirstDay && isExperienced && expCount === 1) score = 75;
      else if ((isFirstDay || isExperienced) && expCount >= 2) score = 50;

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

  // ⑥ 割り当て状態
  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  // ⑦ スコア100
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

  // ⑧ スコア75（選べるポジ数が少ない順）
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

  // ⑧.5 固定割り当て（スコア70）
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

  // ⑨ スコア50候補を整理
  const score50Candidates = candidates.filter(c =>
    c.score === 50 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );
  const posTo50Candidates = {};
  score50Candidates.forEach(c => {
    if (!posTo50Candidates[c.positionName]) posTo50Candidates[c.positionName] = [];
    posTo50Candidates[c.positionName].push(c.member);
  });

  // ⑩ バックトラック（経験数が少ない順にソート）
  const pos50List = Object.keys(posTo50Candidates);
  pos50List.sort((a, b) => {
    const aMin = Math.min(...(posTo50Candidates[a] || []).map(m => memberToPositions[m].size));
    const bMin = Math.min(...(posTo50Candidates[b] || []).map(m => memberToPositions[m].size));
    return aMin - bMin;
  });

  const assignment50 = {};
  const usedMembers50 = new Set();
  function backtrackAssign(index = 0) {
    if (index >= pos50List.length) return true;
    const pos = pos50List[index];
    const candidates = [...(posTo50Candidates[pos] || [])].sort(
      (a, b) => memberToPositions[a].size - memberToPositions[b].size
    );
    for (const member of candidates) {
      if (!usedMembers50.has(member)) {
        assignment50[pos] = member;
        usedMembers50.add(member);
        if (backtrackAssign(index + 1)) return true;
        delete assignment50[pos];
        usedMembers50.delete(member);
      }
    }
    return false;
  }
  backtrackAssign();

  // ⑪ スコア50割り当て反映
  for (const [posName, member] of Object.entries(assignment50)) {
    assignmentMap[posName] = { member, score: 50 };
    usedPositions.add(posName);
    usedMembers.add(member);
  }

  // ⑫ スコア25で埋める（スコア50で埋まらなかったポジ）
  const unassignedPos = pos50List.filter(p => !assignment50.hasOwnProperty(p));
  candidates
    .filter(c =>
      c.score === 25 &&
      unassignedPos.includes(c.positionName) &&
      !usedPositions.has(c.positionName) &&
      !usedMembers.has(c.member)
    )
    .sort((a, b) => a.memberIndex - b.memberIndex)
    .forEach(c => {
      assignmentMap[c.positionName] = { member: c.member, score: 25 };
      usedPositions.add(c.positionName);
      usedMembers.add(c.member);
    });

  // ⑬ 割り当て漏れチェック
  const unassignedMembers = inputMembers.filter(m => !usedMembers.has(m));
  if (unassignedMembers.length > 0) {
    throw new Error(`未割り当てのメンバーがいます: ${unassignedMembers.join(', ')}`);
  }

  // ⑭ 結果を元の順で返す
  return positions.map(pos => {
    const assigned = assignmentMap[pos.name];
    return {
      positionName: pos.name,
      member: assigned?.member || '―',
      score: assigned?.score || 0
    };
  });
}