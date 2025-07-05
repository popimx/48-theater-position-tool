async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const positions = await positionsRes.json();

  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const experienceData = await experienceRes.json();

  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // 経験者出現回数カウント
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

  // スコア100〜25の候補を格納
  const highPriority = []; // score 100 or 75
  const mediumPriority = []; // score 49 or 50
  const lowPriority = []; // score 25

  // スコアの分類
  positions.forEach((pos, posIndex) => {
    const baseName = pos.firstDayMember;
    const experienced = experienceData[baseName] || [];

    inputMembers.forEach((member, memberIndex) => {
      let score = 0;

      const isFirstDayMatch = baseName === member;
      const isExperiencedMatch = experienced.includes(member);
      const totalExpCount = experienceCountMap[member] || 0;

      if (isFirstDayMatch && totalExpCount === 0) {
        score = 100;
        highPriority.push({ positionName: pos.name, member, score, posIndex, memberIndex });
      } else if (isExperiencedMatch && totalExpCount === 1) {
        score = 75;
        highPriority.push({ positionName: pos.name, member, score, posIndex, memberIndex });
      } else if (isFirstDayMatch || isExperiencedMatch) {
        // スコア50または49
        let relevantCount = 0;
        positions.forEach(p => {
          const name = p.firstDayMember;
          const exp = experienceData[name] || [];
          if (name === member || exp.includes(member)) {
            relevantCount++;
          }
        });
        score = relevantCount === 1 ? 50 : 49;
        mediumPriority.push({ positionName: pos.name, member, score, posIndex, memberIndex });
      } else {
        score = 25;
        lowPriority.push({ positionName: pos.name, member, score, posIndex, memberIndex });
      }
    });
  });

  // 割り当てセット
  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  const assign = (list) => {
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.posIndex !== b.posIndex) return a.posIndex - b.posIndex;
      return a.memberIndex - b.memberIndex;
    });

    for (const combo of list) {
      if (!usedPositions.has(combo.positionName) && !usedMembers.has(combo.member)) {
        assignmentMap[combo.positionName] = {
          member: combo.member,
          score: combo.score
        };
        usedPositions.add(combo.positionName);
        usedMembers.add(combo.member);
      }
    }
  };

  // スコア100・75を先に割り当て
  assign(highPriority);

  // スコア49・50：関連ポジションのみ
  const groupedMedium = {};
  mediumPriority.forEach(c => {
    if (!groupedMedium[c.member]) groupedMedium[c.member] = [];
    groupedMedium[c.member].push(c);
  });

  Object.entries(groupedMedium).forEach(([member, entries]) => {
    for (const entry of entries) {
      const { positionName } = entry;
      if (!usedPositions.has(positionName) && !usedMembers.has(member)) {
        assignmentMap[positionName] = {
          member,
          score: entry.score
        };
        usedPositions.add(positionName);
        usedMembers.add(member);
        break; // 1人1回のみ割り当て
      }
    }
  });

  // スコア25：残りの空きに入れる
  assign(lowPriority);

  // 最終出力（ポジション順）
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