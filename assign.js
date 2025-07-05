async function assignPositions(inputMembers) {
  // 初日ポジションデータ取得
  const positionsRes = await fetch('data/positions.json');
  const positions = await positionsRes.json();

  // 経験者マップ（ポジション名 → 経験者配列）
  const experienceRes = await fetch('data/experience.json');
  const experienceData = await experienceRes.json();

  // 全経験者名をフラット化して出現回数カウント
  const experienceAllMembers = Object.values(experienceData).flat();
  const nameCountMap = {};
  experienceAllMembers.forEach(name => {
    nameCountMap[name] = (nameCountMap[name] || 0) + 1;
  });

  // ポジションごとにメンバーのスコア計算用関数
  function calcScore(positionName, memberName) {
    if (!memberName) return 0;

    // 初日メンバーはスコア100
    if (positionName === memberName + 'ポジ' || positionName.startsWith(memberName)) {
      // positionName と memberName の対応は必要に応じ調整してください
      if (positionName.replace('ポジ', '') === memberName) return 100;
    }

    // 経験者にいるか確認
    const experienced = experienceData[positionName.replace('ポジ', '')] || [];
    if (experienced.includes(memberName)) {
      const count = nameCountMap[memberName] || 0;
      if (count === 1) return 75;
      if (count >= 2) return 50;
    }

    // 経験者にいなければ25
    return 25;
  }

  // 割り当て結果の初期化
  const assigned = [];

  // 使われたメンバーを記録（重複割り当て防止）
  const usedMembers = new Set();

  // ポジションごとにメンバーのスコアを計算し、高い順に並べて割り当て
  for (const pos of positions) {
    // そのポジションに最も高スコアをつけるメンバーを探す
    const candidates = inputMembers
      .filter(m => !usedMembers.has(m))
      .map(m => ({ member: m, score: calcScore(pos.name, m) }))
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0 && candidates[0].score > 0) {
      assigned.push({
        positionName: pos.name,
        member: candidates[0].member,
        score: candidates[0].score,
      });
      usedMembers.add(candidates[0].member);
    } else {
      // 割り当てられるメンバーなし → 空白で割り当て
      assigned.push({
        positionName: pos.name,
        member: '―',
        score: 0,
      });
    }
  }

  return assigned;
}