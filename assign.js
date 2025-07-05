async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const positions = await positionsRes.json();

  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const experienceData = await experienceRes.json();

  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));
  const allExperiencedMembers = Object.values(experienceData).flat();
  const experienceCountMap = {};
  allExperiencedMembers.forEach(name => {
    experienceCountMap[name] = (experienceCountMap[name] || 0) + 1;
  });

  // 整合性チェック
  for (const member of inputMembers) {
    if (!firstDayMembersSet.has(member) && !experienceCountMap[member]) {
      throw new Error(`データ整合性エラー: "${member}" は初日メンバーにも経験者にも存在しません。`);
    }
  }

  // スコア付き候補リスト作成
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
        score = 100;
      } else if (isExperienced && totalExp === 1) {
        score = 75;
      } else if (isFirstDay || isExperienced) {
        let relevantCount = 0;
        positions.forEach(p => {
          const fn = p.firstDayMember;
          const exp = experienceData[fn] || [];
          if (fn === member || exp.includes(member)) relevantCount++;
        });
        score = relevantCount === 1 ? 50 : 49;
      } else {
        score = 25;
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

  // ① ② スコア100・75 の割り当て
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
        !usedPositions.has(combo.positionName) && !usedMembers.has(combo.member)) {
      assignmentMap[combo.positionName] = {
        member: combo.member,
        score: combo.score
      };
      usedPositions.add(combo.positionName);
      usedMembers.add(combo.member);
    }
  }

  // 🔍 スコア49・50のポジション候補抽出
  const score50Combos = combinations.filter(
    c => (c.score === 50 || c.score === 49) &&
         !usedPositions.has(c.positionName) &&
         !usedMembers.has(c.member)
  );

  // ポジションごとの候補をまとめる
  const posToCandidates = {};
  score50Combos.forEach(c => {
    if (!posToCandidates[c.positionName]) posToCandidates[c.positionName] = [];
    posToCandidates[c.positionName].push(c.member);
  });

  // メンバーごとの該当ポジション数
  const memberToPositions = {};
  score50Combos.forEach(c => {
    if (!memberToPositions[c.member]) memberToPositions[c.member] = new Set();
    memberToPositions[c.member].add(c.positionName);
  });

  // 候補をできるだけ綺麗に割り当て
  const assignedPos = new Set([...usedPositions]);
  const assignedMem = new Set([...usedMembers]);

  Object.entries(posToCandidates).forEach(([positionName, candidates]) => {
    // 候補を該当ポジション数の少ない順にソート
    candidates.sort((a, b) => {
      return (memberToPositions[a].size - memberToPositions[b].size);
    });

    for (const candidate of candidates) {
      if (!assignedMem.has(candidate) && !assignedPos.has(positionName)) {
        assignmentMap[positionName] = {
          member: candidate,
          score: 49
        };
        assignedMem.add(candidate);
        assignedPos.add(positionName);
        break;
      }
    }
  });

  // 残り（スコア25など）を割り当て
  for (const combo of combinations) {
    if (!assignmentMap[combo.positionName] &&
        !assignedMem.has(combo.member) &&
        combo.score <= 49) {
      assignmentMap[combo.positionName] = {
        member: combo.member,
        score: combo.score
      };
      assignedMem.add(combo.member);
    }
  }

  // 最終形式に整えて返却
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