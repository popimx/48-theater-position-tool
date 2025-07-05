// 割り当て関数
async function assignPositions(inputMembers) {
  // 公演の選択値を取得（デフォルト: kokokarada）
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // 初日ポジションデータを取得
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const positions = await positionsRes.json();

  // 経験者データを取得
  const experienceRes = await fetch(`data/${stage}/experience.json`);
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
    if (basePositionName === memberName) return 100;

    const experienced = experienceData[basePositionName] || [];
    if (experienced.includes(memberName)) {
      const count = nameCountMap[memberName] || 0;
      if (count === 1) return 75;
      if (count >= 2) return 50;
    }

    return 25;
  }

  // すべての組み合わせのスコアを生成
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

  // スコア → ポジション優先 → 入力順 でソート
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