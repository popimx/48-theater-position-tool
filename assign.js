async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ① ポジション・経験データを読み込み
  const [positionsRes, experienceRes] = await Promise.all([
    fetch(`data/${stage}/positions.json`),
    fetch(`data/${stage}/experience.json`)
  ]);
  const positions = await positionsRes.json();
  const experienceData = await experienceRes.json();

  // ② 固定割り当てスコア70の設定（stage名に対応）
  const fixedAssignments = {
    mokugekisha: {
      '石橋颯ポジ': '渋井美奈',
      '市村愛里ポジ': '生野莉奈',
      '伊藤優絵瑠ポジ': '山内祐奈',
      '運上弘菜ポジ': '石橋颯',
      '小田彩加ポジ': '石松結菜',
      '栗原紗英ポジ': '栗原紗英',
      '堺萌香ポジ': '藤野心葉',
      '最上奈那華ポジ': '坂本りの',
      '矢吹奈子ポジ': '北川陽彩',
      '渡部愛加里ポジ': '市村愛里',
      '梁瀬鈴雅ポジ': '梁瀬鈴雅'
    },
    kokonidattetenshihairu: {
      '秋吉優花ポジ': '猪原絆愛',
      '今村麻莉愛ポジ': '田中伊桜莉',
      '栗山梨奈ポジ': '立花心良',
      '後藤陽菜乃ポジ': '福井可憐',
      '坂本愛玲菜ポジ': '森﨑冴彩',
      '武田智加ポジ': '秋吉優花',
      '田中伊桜莉ポジ': '安井妃奈',
      '馬場彩華ポジ': '大内梨果',
      '松岡はなポジ': '井澤美優',
      '村上和叶ポジ': '大庭凜咲',
      '本村碧唯ポジ': '江口心々華',
      '山下エミリーポジ': '栗山梨奈'
    }
  };

  // ③ 初日メンバーセットの構築
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // ④ 各メンバーの経験回数（初日も含む）を数える
  const experienceCountMap = {};
  for (const member of inputMembers) experienceCountMap[member] = 0;
  positions.forEach(pos => {
    const base = pos.firstDayMember;
    if (inputMembers.includes(base)) experienceCountMap[base]++;
    const experienced = experienceData[base] || [];
    for (const m of experienced) {
      if (inputMembers.includes(m)) experienceCountMap[m]++;
    }
  });

  // ⑤ メンバー→関連ポジションの逆引きマップ
  const memberToPositions = {};
  for (const m of inputMembers) memberToPositions[m] = new Set();
  positions.forEach(pos => {
    const base = pos.firstDayMember;
    const experienced = experienceData[base] || [];
    for (const m of inputMembers) {
      if (m === base || experienced.includes(m)) {
        memberToPositions[m].add(pos.name);
      }
    }
  });

  // ⑥ 候補者とスコアを計算
  const candidates = [];
  positions.forEach((pos, posIndex) => {
    const base = pos.firstDayMember;
    const experienced = experienceData[base] || [];

    inputMembers.forEach((member, memberIndex) => {
      const isFirstDay = base === member;
      const isExperienced = experienced.includes(member);
      const expCount = experienceCountMap[member] || 0;

      let score;
      if (isFirstDay && expCount === 1) {
        score = 100;
      } else if (!isFirstDay && isExperienced && expCount === 1) {
        score = 75;
      } else if ((isFirstDay || isExperienced) && expCount >= 2) {
        score = 50;
      } else {
        score = 25;
      }

      candidates.push({
        positionName: pos.name,
        baseName: base,
        member,
        score,
        posIndex,
        memberIndex
      });
    });
  });

  // ⑦ 割り当て初期化
  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  // ⑧ スコア100を優先割り当て
  candidates
    .filter(c => c.score === 100)
    .sort((a, b) => a.posIndex - b.posIndex)
    .forEach(c => {
      if (!usedPositions.has(c.positionName) && !usedMembers.has(c.member)) {
        assignmentMap[c.positionName] = { member: c.member, score: 100 };
        usedPositions.add(c.positionName);
        usedMembers.add(c.member);
      }
    });

  // ⑨ スコア75を候補ポジション数が少ない順に割り当て
  const score75Candidates = candidates.filter(c =>
    c.score === 75 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );
  const score75MemberToPosCount = {};
  score75Candidates.forEach(c => {
    score75MemberToPosCount[c.member] = memberToPositions[c.member].size;
  });
  score75Candidates
    .sort((a, b) => score75MemberToPosCount[a.member] - score75MemberToPosCount[b.member])
    .forEach(c => {
      if (!usedPositions.has(c.positionName) && !usedMembers.has(c.member)) {
        assignmentMap[c.positionName] = { member: c.member, score: 75 };
        usedPositions.add(c.positionName);
        usedMembers.add(c.member);
      }
    });

  // 🔃 ⑩ スコア70（固定ポジション）をここで割り当て（スコア100/75より低く）
  if (fixedAssignments[stage]) {
    for (const [posName, member] of Object.entries(fixedAssignments[stage])) {
      if (
        inputMembers.includes(member) &&
        !usedPositions.has(posName) &&
        !usedMembers.has(member)
      ) {
        assignmentMap[posName] = { member, score: 70 };
        usedPositions.add(posName);
        usedMembers.add(member);
      }
    }
  }

  // ⑪ スコア50をバックトラックで最適割り当て
  const score50Candidates = candidates.filter(c =>
    c.score === 50 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );
  const posTo50Candidates = {};
  const memberTo50Positions = {};
  score50Candidates.forEach(c => {
    const base = c.baseName;
    const experienced = experienceData[base] || [];
    if (c.member === base || experienced.includes(c.member)) {
      if (!posTo50Candidates[c.positionName]) posTo50Candidates[c.positionName] = [];
      posTo50Candidates[c.positionName].push(c.member);

      if (!memberTo50Positions[c.member]) memberTo50Positions[c.member] = new Set();
      memberTo50Positions[c.member].add(c.positionName);
    }
  });

  function backtrackAssign(posList, usedMembers, assignment, index = 0) {
    if (index >= posList.length) return true;
    const pos = posList[index];
    const candidates = posTo50Candidates[pos] || [];
    for (const member of candidates) {
      if (!usedMembers.has(member)) {
        assignment[pos] = member;
        usedMembers.add(member);
        if (backtrackAssign(posList, usedMembers, assignment, index + 1)) return true;
        delete assignment[pos];
        usedMembers.delete(member);
      }
    }
    return false;
  }

  const pos50List = Object.keys(posTo50Candidates);
  const assignment50 = {};
  const usedMembers50 = new Set();
  backtrackAssign(pos50List, usedMembers50, assignment50, 0);

  for (const [posName, member] of Object.entries(assignment50)) {
    assignmentMap[posName] = { member, score: 50 };
    usedPositions.add(posName);
    usedMembers.add(member);
  }

  // ⑫ 最後にスコア25（未経験）を割り当て
  candidates
    .filter(c =>
      c.score === 25 &&
      !usedPositions.has(c.positionName) &&
      !usedMembers.has(c.member)
    )
    .sort((a, b) => a.memberIndex - b.memberIndex)
    .forEach(c => {
      if (!usedPositions.has(c.positionName) && !usedMembers.has(c.member)) {
        assignmentMap[c.positionName] = { member: c.member, score: 25 };
        usedPositions.add(c.positionName);
        usedMembers.add(c.member);
      }
    });

  // ⑬ 未割り当てのメンバーがいたらエラー
  const unassignedMembers = inputMembers.filter(m => !usedMembers.has(m));
  if (unassignedMembers.length > 0) {
    throw new Error(`未割り当てのメンバーがいます: ${unassignedMembers.join(', ')}`);
  }

  // ⑭ 結果をポジション順に返却
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