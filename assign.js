async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ① ポジションと経験データを取得
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const positions = await positionsRes.json();
  const experienceData = await experienceRes.json();

  // ② 初日メンバーセット
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // ③ 各メンバーの経験ポジション数を集計
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

  // ④ メンバー → 関連ポジションの逆引きマップ
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

  // ⑤ 固定ポジション設定（ステージごと）
  const fixedAssignmentsMap = {
    mokugekisha: {
      "石橋颯ポジ": "渋井美奈",
      "市村愛里ポジ": "生野莉奈",
      "伊藤優絵瑠ポジ": "山内祐奈",
      "運上弘菜ポジ": "石橋颯",
      "栗原紗英ポジ": "栗原紗英",
      "矢吹奈子ポジ": "北川陽彩",
      "渡部愛加里ポジ": "市村愛里",
      "梁瀬鈴雅ポジ": "梁瀬鈴雅"
    },
    kokonidattetenshihairu: {
      "今村麻莉愛ポジ": "田中伊桜莉",
      "栗山梨奈ポジ": "立花心良",
      "後藤陽菜乃ポジ": "福井可憐",
      "坂本愛玲菜ポジ": "森﨑冴彩",
      "武田智加ポジ": "秋吉優花",
      "田中美久ポジ": "今村麻莉愛",
      "馬場彩華ポジ": "大内梨果",
      "松岡はなポジ": "井澤美優",
      "村上和叶ポジ": "大庭凜咲",
      "本村碧唯ポジ": "江口心々華",
      "山下エミリーポジ": "栗山梨奈"
    }
  };
  const fixedAssignments = fixedAssignmentsMap[stage] || {};

  // ⑥ 候補者リスト（スコア付き）作成
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

  // ⑦ 状態管理用のセットと割当マップ
  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  // ⑧ スコア100の確定
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

  // ⑨ スコア75の割り当て（ポジション候補が少ない順）
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

  // ⑨.5 固定ポジションの反映（スコア70）
  Object.entries(fixedAssignments).forEach(([positionName, member]) => {
    if (
      inputMembers.includes(member) &&
      !usedPositions.has(positionName) &&
      !usedMembers.has(member)
    ) {
      assignmentMap[positionName] = { member, score: 70 };
      usedPositions.add(positionName);
      usedMembers.add(member);
    }
  });

  // ⑩ スコア50候補を整理
  const score50Candidates = candidates.filter(c =>
    c.score === 50 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );
  const posTo50Candidates = {};
  score50Candidates.forEach(c => {
    if (!posTo50Candidates[c.positionName]) posTo50Candidates[c.positionName] = [];
    posTo50Candidates[c.positionName].push(c);
  });

  // 各ポジションの候補を優先度順に並べる（経験者 → 候補数少ない → 入力順）
  for (const pos in posTo50Candidates) {
    posTo50Candidates[pos].sort((a, b) => {
      const aExp = (experienceData[a.baseName]?.includes(a.member) || a.baseName === a.member) ? 1 : 0;
      const bExp = (experienceData[b.baseName]?.includes(b.member) || b.baseName === b.member) ? 1 : 0;
      const aCount = memberToPositions[a.member].size;
      const bCount = memberToPositions[b.member].size;

      if (aExp !== bExp) return bExp - aExp;
      if (aCount !== bCount) return aCount - bCount;
      return a.memberIndex - b.memberIndex;
    });
  }

  // ⑪ スコア50ポジションを候補数が少ない順にソートしてからバックトラック
  const pos50List = Object.keys(posTo50Candidates).sort((a, b) =>
    posTo50Candidates[a].length - posTo50Candidates[b].length
  );

  const assignment50 = {};
  const usedMembers50 = new Set();

  function backtrackAssign(posList, usedMembersBT, assignmentBT, index = 0) {
    if (index >= posList.length) return true;
    const pos = posList[index];
    const candidatesForPos = posTo50Candidates[pos] || [];
    for (const candidate of candidatesForPos) {
      const member = candidate.member;
      if (!usedMembersBT.has(member)) {
        assignmentBT[pos] = member;
        usedMembersBT.add(member);
        if (backtrackAssign(posList, usedMembersBT, assignmentBT, index + 1)) return true;
        delete assignmentBT[pos];
        usedMembersBT.delete(member);
      }
    }
    return false;
  }

  const success = backtrackAssign(pos50List, usedMembers50, assignment50, 0);

  // 割り当て成功したスコア50だけ反映
  for (const [posName, member] of Object.entries(assignment50)) {
    assignmentMap[posName] = { member, score: 50 };
    usedPositions.add(posName);
    usedMembers.add(member);
  }

  // ⑫ 割り当てできなかったポジションにスコア25から候補を割り当て
  const unassignedPos = pos50List.filter(pos => !assignment50.hasOwnProperty(pos));
  candidates
    .filter(c =>
      c.score === 25 &&
      unassignedPos.includes(c.positionName) &&
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

  // ⑬ 未割り当てのメンバーがいたら例外を投げる
  const unassignedMembers = inputMembers.filter(m => !usedMembers.has(m));
  if (unassignedMembers.length > 0) {
    throw new Error(`未割り当てのメンバーがいます: ${unassignedMembers.join(', ')}`);
  }

  // ⑭ 最終結果をポジション順で返却
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