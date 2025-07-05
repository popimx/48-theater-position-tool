async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const positions = await positionsRes.json();

  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const experienceData = await experienceRes.json();

  const experienceAllMembers = Object.values(experienceData).flat();
  const nameCountMap = {};
  experienceAllMembers.forEach(name => {
    nameCountMap[name] = (nameCountMap[name] || 0) + 1;
  });

  function calcScore(positionName, memberName) {
    if (!memberName || memberName === '―') return 0;
    const basePositionName = positionName.replace('ポジ', '');
    const experienced = experienceData[basePositionName] || [];
    const count = nameCountMap[memberName] || 0;

    if (basePositionName === memberName && count >= 1) return 50;
    if (basePositionName === memberName) return 100;
    if (experienced.includes(memberName)) return count === 1 ? 75 : 50;

    return 25;
  }

  const combinations = [];
  positions.forEach((pos, posIndex) => {
    inputMembers.forEach((member, memberIndex) => {
      const score = calcScore(pos.name, member);
      combinations.push({
        positionName: pos.name,
        member,
        score,
        posIndex,
        memberIndex
      });
    });
  });

  // 競合情報の構築
  const positionConflicts = {};
  const memberConflictCount = {};
  positions.forEach(pos => {
    const strongCandidates = inputMembers
      .map(member => ({
        member,
        score: calcScore(pos.name, member)
      }))
      .filter(({ score }) => score >= 50)
      .map(({ member }) => member);

    if (strongCandidates.length >= 2) {
      positionConflicts[pos.name] = strongCandidates;
      strongCandidates.forEach(member => {
        memberConflictCount[member] = (memberConflictCount[member] || 0) + 1;
      });
    }
  });

  combinations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aCount = memberConflictCount[a.member] || 0;
    const bCount = memberConflictCount[b.member] || 0;
    if (aCount !== bCount) return aCount - bCount;
    if (a.posIndex !== b.posIndex) return a.posIndex - b.posIndex;
    return a.memberIndex - b.memberIndex;
  });

  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  for (const combo of combinations) {
    if (!usedPositions.has(combo.positionName) && !usedMembers.has(combo.member)) {
      assignmentMap[combo.positionName] = {
        member: combo.member,
        score: combo.score
      };
      usedPositions.add(combo.positionName);
      usedMembers.add(combo.member);
    }
  }

  // ✅ 最後に「同じメンバーが複数ポジションに割り当てられていないか」チェックして調整
  const memberToPositions = {};
  for (const [posName, { member }] of Object.entries(assignmentMap)) {
    if (!memberToPositions[member]) {
      memberToPositions[member] = [];
    }
    memberToPositions[member].push(posName);
  }

  // ✅ 複数ポジションを担当しているメンバーがいれば、低スコア側を解除
  for (const [member, posList] of Object.entries(memberToPositions)) {
    if (posList.length > 1) {
      // スコアが低い順に並べて後ろから削除
      const sorted = posList.sort((a, b) =>
        assignmentMap[a].score - assignmentMap[b].score
      );
      for (let i = 1; i < sorted.length; i++) {
        const removedPos = sorted[i];
        delete assignmentMap[removedPos];
        usedPositions.delete(removedPos);
      }
    }
  }

  // 最終的に positions の順番に揃えて返却
  const assigned = positions.map(pos => {
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

  return assigned;
}