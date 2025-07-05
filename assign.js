async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const positions = await positionsRes.json();

  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const experienceData = await experienceRes.json();

  // 初日メンバー一覧
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // 全経験者の出現回数
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

  // 全割り当て候補（スコア付き）
  const combinations = [];

  positions.forEach((pos, posIndex) => {
    const baseName = pos.firstDayMember;
    const experienced = experienceData[baseName] || [];

    inputMembers.forEach((member, memberIndex) => {
      let score = 0;

      const isFirstDayMatch = baseName === member;
      const isExperiencedMatch = experienced.includes(member);
      const totalExpCount = experienceCountMap[member] || 0;

      if (isFirstDayMatch && totalExpCount === 0) {
        score = 100; // ① 完全初日
      } else if (isExperiencedMatch && totalExpCount === 1) {
        score = 75; // ② 経験者で1回だけ
      } else if (isFirstDayMatch || isExperiencedMatch) {
        // ③④：該当ポジションだけなら50、それ以上なら49
        let relevantCount = 0;
        positions.forEach(p => {
          const name = p.firstDayMember;
          const exp = experienceData[name] || [];
          if (name === member || exp.includes(member)) {
            relevantCount++;
          }
        });
        score = relevantCount === 1 ? 50 : 49;
      } else {
        score = 25; // ⑤ 完全未経験
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

  // スコア・ポジション順・入力順 でソート
  combinations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.posIndex !== b.posIndex) return a.posIndex - b.posIndex;
    return a.memberIndex - b.memberIndex;
  });

  // 割り当て
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

  // 出力整形（ポジション順）
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