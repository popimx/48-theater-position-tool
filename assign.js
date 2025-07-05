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

  for (const member of inputMembers) {
    if (!firstDayMembersSet.has(member) && !experienceCountMap[member]) {
      throw new Error(`データ整合性エラー: "${member}" は初日メンバーにも経験者にも存在しません。`);
    }
  }

  // スコア付き候補作成
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

  // ①② 割り当て（スコア100, 75）
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

  // ③④ スコア49・50の割り当て候補抽出
  const score49_50Combos = combinations.filter(
    c => (c.score === 49 || c.score === 50) &&
         !usedPositions.has(c.positionName) &&
         !usedMembers.has(c.member)
  );

  const posToCandidates = {};
  score49_50Combos.forEach(c => {
    if (!posToCandidates[c.positionName]) posToCandidates[c.positionName] = [];
    posToCandidates[c.positionName].push(c);
  });

  const memberToPositions = {};
  score49_50Combos.forEach(c => {
    if (!memberToPositions[c.member]) memberToPositions[c.member] = new Set();
    memberToPositions[c.member].add(c.positionName);
  });

  // スコア49・50で割り当て（経験者優先＆被り少ない順）
  Object.entries(posToCandidates).forEach(([positionName, candidates]) => {
    const baseName = positions.find(p => p.name === positionName)?.firstDayMember;
    const expList = experienceData[baseName] || [];

    // 初日 or 経験者に限定
    const filteredCandidates = candidates.filter(c =>
      c.member === baseName || expList.includes(c.member)
    );

    filteredCandidates.sort((a, b) =>
      (memberToPositions[a.member]?.size || 0) - (memberToPositions[b.member]?.size || 0)
    );

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

  // ★ ここから整合性チェック開始 ★

  // 割り当ての検証＆不整合をリセットする関数
  function validateAssignments() {
    const invalidPositions = [];

    for (const [posName, { member }] of Object.entries(assignmentMap)) {
      const baseName = positions.find(p => p.name === posName)?.firstDayMember;
      const expList = experienceData[baseName] || [];
      if (member !== baseName && !expList.includes(member)) {
        // 初日 or 経験者に存在しないなら不整合
        invalidPositions.push(posName);
      }
    }
    return invalidPositions;
  }

  let invalidPositions = validateAssignments();

  // 不整合がある限りループで再調整（ループ数制限で無限ループ防止）
  const MAX_RETRIES = 10;
  let retryCount = 0;

  while (invalidPositions.length > 0 && retryCount < MAX_RETRIES) {
    retryCount++;

    for (const posName of invalidPositions) {
      // 不整合位置の割り当て解除
      const member = assignmentMap[posName].member;
      delete assignmentMap[posName];
      usedPositions.delete(posName);
      usedMembers.delete(member);
    }

    // 再度、空いているポジションにスコア49・50の候補から割り当て試行
    for (const posName of invalidPositions) {
      const baseName = positions.find(p => p.name === posName)?.firstDayMember;
      const expList = experienceData[baseName] || [];

      const candidates = score49_50Combos.filter(c =>
        c.positionName === posName &&
        !usedMembers.has(c.member) &&
        (c.member === baseName || expList.includes(c.member))
      );

      // 該当ポジション数が少ない順に並び替え
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

  // ⑤ スコア25以下の残り割り当て
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

  // 最終結果整形
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