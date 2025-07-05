// 割り当て関数
async function assignPositions(inputMembers) {
  // 初日ポジションデータを取得
  const positionsRes = await fetch('data/positions.json');
  const positions = await positionsRes.json();

  // 経験者データを取得
  const experienceRes = await fetch('data/experience.json');
  const experienceData = await experienceRes.json();

  // 経験者全員の出現回数をカウント
  const experienceAllMembers = Object.values(experienceData).flat();
  const nameCountMap = {};
  experienceAllMembers.forEach(name => {
    nameCountMap[name] = (nameCountMap[name] || 0) + 1;
  });

  // スコア計算関数
  function calcScore(positionName, memberName) {
    if (!memberName || memberName === '―') return 0;

    const basePositionName = positionName.replace('ポジ', '');

    // 初日メンバーかどうか（ポジション名と同じ名前なら100点）
    if (basePositionName === memberName) return 100;

    // 経験者かどうか
    const experienced = experienceData[basePositionName] || [];
    if (experienced.includes(memberName)) {
      const count = nameCountMap[memberName] || 0;
      if (count === 1) return 75;
      if (count >= 2) return 50;
    }

    // 経験なしは25点
    return 25;
  }

  const assigned = [];
  const usedMembers = new Set();

  // 入力メンバーごとにスコアを事前計算
  const memberScores = inputMembers.map((member, index) => {
    return {
      name: member,
      index,
      scores: positions.map(pos => ({
        position: pos.name,
        score: calcScore(pos.name, member)
      }))
    };
  });

  for (const pos of positions) {
    // このポジションに対して、未使用メンバーの中から最適な人を探す
    const candidates = memberScores
      .filter(m => !usedMembers.has(m.name))
      .map(m => {
        const posScore = m.scores.find(s => s.position === pos.name);
        return {
          member: m.name,
          score: posScore ? posScore.score : 0,
          index: m.index
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index; // 同スコアなら入力順
      });

    if (candidates.length > 0 && candidates[0].score > 0) {
      const best = candidates[0];
      assigned.push({
        positionName: pos.name,
        member: best.member,
        score: best.score
      });
      usedMembers.add(best.member);
    } else {
      assigned.push({
        positionName: pos.name,
        member: '―',
        score: 0
      });
    }
  }

  return assigned;
}