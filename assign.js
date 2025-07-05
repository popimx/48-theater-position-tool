async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const positions = await positionsRes.json();

  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const experienceData = await experienceRes.json();

  // 全経験者出現カウント
  const allExperiencedMembers = Object.values(experienceData).flat();
  const experienceCountMap = {};
  allExperiencedMembers.forEach(name => {
    experienceCountMap[name] = (experienceCountMap[name] || 0) + 1;
  });

  // ポジションごとに候補メンバーをスコアリング
  const scoreMap = {}; // member -> { positions: [], score }
  inputMembers.forEach(member => {
    scoreMap[member] = { positions: [], score: 0 };
  });

  positions.forEach(pos => {
    const baseName = pos.name.replace('ポジ', '');
    inputMembers.forEach(member => {
      const isFirstDay = baseName === member;
      const isExperienced = (experienceData[baseName] || []).includes(member);
      const totalExperienceCount = experienceCountMap[member] || 0;

      if (isFirstDay && totalExperienceCount === 0) {
        scoreMap[member].positions.push({ positionName: pos.name, score: 100 });
      } else if (totalExperienceCount === 1) {
        scoreMap[member].positions.push({ positionName: pos.name, score: 75 });
      } else {
        scoreMap[member].positions.push({ positionName: pos.name, score: null }); // 一旦保留
      }
    });
  });

  // 未スコア部分に③ルール適用（出現回数カウント）
  const extraCount = {};
  positions.forEach(pos => {
    const baseName = pos.name.replace('ポジ', '');
    inputMembers.forEach(member => {
      const alreadyScored = scoreMap[member].positions.find(p => p.positionName === pos.name && p.score !== null);
      if (alreadyScored) return;

      const allPositionsWhereOnlyThisMemberAppears = positions.filter(p => {
        const names = inputMembers.filter(m => {
          const exp = experienceData[p.name.replace('ポジ', '')] || [];
          return (m === p.name.replace('ポジ', '') || exp.includes(m));
        });
        return names.includes(member);
      });

      extraCount[member] = (extraCount[member] || 0) + 1;
    });
  });

  inputMembers.forEach(member => {
    const count = extraCount[member] || 0;
    scoreMap[member].positions.forEach(p => {
      if (p.score === null) {
        if (count > 0) {
          p.score = Math.max(50 - (count - 1), 26); // 50, 49, 48...
        } else {
          p.score = 25; // 完全未経験
        }
      }
    });
  });

  // 全スコアを展開して割り当て候補を作成
  const combinations = [];
  positions.forEach((pos, posIndex) => {
    inputMembers.forEach((member, memberIndex) => {
      const entry = scoreMap[member].positions.find(p => p.positionName === pos.name);
      combinations.push({
        positionName: pos.name,
        member,
        score: entry?.score ?? 0,
        posIndex,
        memberIndex
      });
    });
  });

  // スコア・優先度順でソートして割り当て
  combinations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
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

  // 最終形式に揃えて返す
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