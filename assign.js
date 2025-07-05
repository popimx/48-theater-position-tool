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

  for (const pos of positions) {
    // 割り当て候補をスコア順に並べる
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
      // 空き枠は「―」で割り当て
      assigned.push({
        positionName: pos.name,
        member: '―',
        score: 0,
      });
    }
  }

  // 入力メンバーがポジション数より多い場合は余りは割り当てなしで返す
  // （必要ならここで別途処理可能）

  return assigned;
}