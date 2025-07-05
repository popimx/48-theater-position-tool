 async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ① データ読み込み
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const positions = await positionsRes.json();
  const experienceData = await experienceRes.json();

  // ② 初日メンバー一覧を作成
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // ③ 各メンバーの経験ポジション数（初日メンバー含む）
  const experienceCountMap = {};
  for (const member of inputMembers) {
    experienceCountMap[member] = 0;
  }
  positions.forEach(pos => {
    const base = pos.firstDayMember;
    if (inputMembers.includes(base)) experienceCountMap[base]++;
    const experienced = experienceData[base] || [];
    for (const name of experienced) {
      if (inputMembers.includes(name)) experienceCountMap[name]++;
    }
  });

  // ④ 逆引きマップ: 各メンバーに関連するポジション（初日・経験者両方）
  const memberToRelatedPositions = {};
  for (const member of inputMembers) {
    memberToRelatedPositions[member] = new Set();
  }
  positions.forEach(pos => {
    const base = pos.firstDayMember;
    const exp = experienceData[base] || [];
    for (const member of inputMembers) {
      if (base === member || exp.includes(member)) {
        memberToRelatedPositions[member].add(base);  // base は firstDayMember
      }
    }
  });

  // ⑤ スコア算出: 各ポジションごとにスコア付き候補を生成
  const combinations = [];
  positions.forEach((pos, posIndex) => {
    const base = pos.firstDayMember;
    const experienced = experienceData[base] || [];

    inputMembers.forEach((member, memberIndex) => {
      const isFirstDay = base === member;
      const isExperienced = experienced.includes(member);
      const expCount = experienceCountMap[member] || 0;

      let score = 0;
      if (isFirstDay && expCount === 1) {
        score = 100;  // 完全初日
      } else if (!isFirstDay && isExperienced && expCount === 1) {
        score = 75;  // 経験者1ポジ
      } else if ((isFirstDay || isExperienced) && expCount >= 2) {
        score = 50;  // 複数経験者
      } else {
        score = 25;  // 未経験
      }

      combinations.push({
        positionName: pos.name,
        baseName: base,
        member,
        score,
        posIndex,
        memberIndex
      });
    });
  });

  // ⑥ スコア順で割り当て
  const assignmentMap = {};
  const usedPositions = new Set();
  const usedMembers = new Set();

  // スコア100を優先して割り当て
  combinations
    .filter(c => c.score === 100)
    .sort((a, b) => a.posIndex - b.posIndex)
    .forEach(c => {
      if (!usedPositions.has(c.positionName) && !usedMembers.has(c.member)) {
        assignmentMap[c.positionName] = { member: c.member, score: c.score };
        usedPositions.add(c.positionName);
        usedMembers.add(c.member);
      }
    });

  // スコア75を、未割り当てかつ候補ポジ数が少ない順に割り当て
  const score75Combos = combinations.filter(
    c => c.score === 75 &&
      !usedPositions.has(c.positionName) &&
      !usedMembers.has(c.member)
  );
  const member75ToPosCount = {};
  score75Combos.forEach(c => {
    member75ToPosCount[c.member] = memberToRelatedPositions[c.member].size;
  });
  score75Combos
    .sort((a, b) =>
      member75ToPosCount[a.member] - member75ToPosCount[b.member]
    )
    .forEach(c => {
      if (!usedPositions.has(c.positionName) && !usedMembers.has(c.member)) {
        assignmentMap[c.positionName] = { member: c.member, score: c.score };
        usedPositions.add(c.positionName);
        usedMembers.add(c.member);
      }
    });

  // スコア50の候補（必ず経験者欄に載っているか初日かを確認）
  const score50Combos = combinations.filter(c =>
    c.score === 50 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );

  const posTo50Candidates = {};
  const member50ToPositions = {};
  score50Combos.forEach(c => {
    const base = c.baseName;
    const experienced = experienceData[base] || [];
    if (c.member === base || experienced.includes(c.member)) {
      if (!posTo50Candidates[c.positionName]) posTo50Candidates[c.positionName] = [];
      posTo50Candidates[c.positionName].push(c.member);
      if (!member50ToPositions[c.member]) member50ToPositions[c.member] = new Set();
      member50ToPositions[c.member].add(c.positionName);
    }
  });

  Object.entries(posTo50Candidates).forEach(([posName, candidates]) => {
    candidates.sort((a, b) =>
      (member50ToPositions[a]?.size || 99) - (member50ToPositions[b]?.size || 99)
    );
    for (const member of candidates) {
      if (!usedPositions.has(posName) && !usedMembers.has(member)) {
        assignmentMap[posName] = { member, score: 50 };
        usedPositions.add(posName);
        usedMembers.add(member);
        break;
      }
    }
  });

  // 残ったスコア25の人を補完
  combinations
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

  // 最終チェック: 割り当て漏れがあればエラー
  const unassigned = inputMembers.filter(m => !usedMembers.has(m));
  if (unassigned.length > 0) {
    throw new Error(`未割り当てのメンバーが存在します: ${unassigned.join(', ')}`);
  }

  // 結果出力
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