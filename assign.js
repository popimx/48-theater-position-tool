async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ポジション・経験データ読み込み
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const positions = await positionsRes.json();

  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const experienceData = await experienceRes.json();

  // 初日メンバー一覧をSet化
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // 経験者の出現回数マップ作成
  const allExperiencedMembers = Object.values(experienceData).flat();
  const experienceCountMap = {};
  allExperiencedMembers.forEach(name => {
    experienceCountMap[name] = (experienceCountMap[name] || 0) + 1;
  });

  // 🔍 整合性チェック：入力メンバーが初日・経験に存在するか確認
  for (const member of inputMembers) {
    if (!firstDayMembersSet.has(member) && !experienceCountMap[member]) {
      throw new Error(`データ整合性エラー: "${member}" は初日メンバーにも経験者にも存在しません。`);
    }
  }

  // 🔢 各ポジションごとに、入力メンバーとスコアを割り出す
  const combinations = [];
  positions.forEach((pos, posIndex) => {
    const baseName = pos.firstDayMember;
    const experienced = experienceData[baseName] || [];

    inputMembers.forEach((member, memberIndex) => {
      let score = 0;
      const isFirstDay = baseName === member;
      const isExperienced = experienced.includes(member);
      const totalExp = experienceCountMap[member] || 0;

      // ①：完全な初日メンバーで他ポジ経験なし
      if (isFirstDay && totalExp === 0) {
        score = 100;

      // ②：このポジション経験者で、他ポジ経験が1つだけ
      } else if (isExperienced && totalExp === 1) {
        score = 75;

      // ③④：このポジションに関係あるが、他にも複数関与
      } else if (isFirstDay || isExperienced) {
        let relevantCount = 0;
        positions.forEach(p => {
          const fn = p.firstDayMember;
          const exp = experienceData[fn] || [];
          if (fn === member || exp.includes(member)) relevantCount++;
        });
        score = relevantCount === 1 ? 50 : 49;

      // ⑤：どのポジションにも関与していない完全未経験
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

  // スコア順でソート
  combinations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.posIndex !== b.posIndex) return a.posIndex - b.posIndex;
    return a.memberIndex - b.memberIndex;
  });

  // 🧩 スコア100・75の優先割り当て
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

  // 🧮 スコア49・50の候補抽出
  const score50Combos = combinations.filter(
    c => (c.score === 50 || c.score === 49) &&
         !usedPositions.has(c.positionName) &&
         !usedMembers.has(c.member)
  );

  // 🔁 ポジション→候補者マップ
  const posToCandidates = {};
  score50Combos.forEach(c => {
    if (!posToCandidates[c.positionName]) posToCandidates[c.positionName] = [];
    posToCandidates[c.positionName].push(c.member);
  });

  // 🔁 候補者→該当ポジション数マップ
  const memberToPositions = {};
  score50Combos.forEach(c => {
    if (!memberToPositions[c.member]) memberToPositions[c.member] = new Set();
    memberToPositions[c.member].add(c.positionName);
  });

  // 🧩 スコア49・50 割り当て（該当数が少ない順で）
  const assignedPos = new Set([...usedPositions]);
  const assignedMem = new Set([...usedMembers]);

  Object.entries(posToCandidates).forEach(([positionName, candidates]) => {
    // 候補を「関係ポジション数が少ない順」にソート
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

  // ⛳ 最後に残ったメンバー・ポジションに25以下で割り当て
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

  // 📦 出力整形
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