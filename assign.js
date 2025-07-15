async function assignPositions(inputMembers) {
  // ステージ選択（kokonidattetenshihairu に対応済み）
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  // ① ポジション・経験データを読み込み
  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const positions = await positionsRes.json();
  const experienceData = await experienceRes.json();

  // ② 初日メンバーセットを作成
  const firstDayMembersSet = new Set(positions.map(pos => pos.firstDayMember));

  // ③ 各メンバーの経験ポジション数（初日含む）をカウント
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

  // ④ 逆引きマップ：メンバー → 関連ポジション（初日・経験）
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

  // ★ 固定ポジション（スコア70）の設定（ステージごと）
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

  // ⑤ 全候補スコア付きリストを作成（expCountも保持）
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
        score = 100; // 初日＆そのポジしか経験なし
      } else if (!isFirstDay && isExperienced && expCount === 1) {
        score = 75; // 経験者だが1回だけ
      } else if ((isFirstDay || isExperienced) && expCount >= 2) {
        score = 50; // 複数回経験あり
      } else {
        score = 25; // 未経験
      }

      candidates.push({
        positionName: pos.name,
        baseName: base,
        member,
        score,
        posIndex,
        memberIndex,
        expCount
      });
    });
  });

  // ⑥ 割り当て状態管理
  const usedPositions = new Set();
  const usedMembers = new Set();
  const assignmentMap = {};

  // ⑦ スコア100 割り当て
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

  // ⑧ スコア75 割り当て（候補ポジション数が少ない順）
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

  // ⑧.5 スコア70：固定割り当てを反映
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

  // ⑨ スコア50候補（初日または経験者）をポジションごとに整理
  const score50Candidates = candidates.filter(c =>
    c.score === 50 &&
    !usedPositions.has(c.positionName) &&
    !usedMembers.has(c.member)
  );

  // ポジション別に配列を作り、経験回数の多い順にソート（経験者優先）
  const posTo50Candidates = {};
  score50Candidates.forEach(c => {
    if (!posTo50Candidates[c.positionName]) posTo50Candidates[c.positionName] = [];
    posTo50Candidates[c.positionName].push(c);
  });
  Object.keys(posTo50Candidates).forEach(pos => {
    posTo50Candidates[pos].sort((a, b) => b.expCount - a.expCount);
  });

  // ポジションリストを「候補者数が少ない順」にソート（割り当て困難なポジション優先）
  const pos50List = Object.keys(posTo50Candidates);
  pos50List.sort((a, b) => posTo50Candidates[a].length - posTo50Candidates[b].length);

  // ⑩ スコア50をバックトラックで重複なく割り当て
  function backtrackAssign(posList, usedMembers, assignment, index = 0) {
    if (index >= posList.length) return true;
    const pos = posList[index];
    const candidates = posTo50Candidates[pos] || [];
    for (const c of candidates) {
      const member = c.member;
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

  const assignment50 = {};
  const usedMembers50 = new Set();
  const success = backtrackAssign(pos50List, usedMembers50, assignment50, 0);

  // ⑪ スコア50割り当て反映（割り当て成功した分だけ）
  for (const [posName, member] of Object.entries(assignment50)) {
    assignmentMap[posName] = { member, score: 50 };
    usedPositions.add(posName);
    usedMembers.add(member);
  }

  // ⑫ バックトラックで割り当てできなかったポジションだけスコア25で割り当て
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

  // ⑬ 割り当て漏れチェック
  const unassignedMembers = inputMembers.filter(m => !usedMembers.has(m));
  if (unassignedMembers.length > 0) {
    throw new Error(`未割り当てのメンバーがいます: ${unassignedMembers.join(', ')}`);
  }

  // ⑭ 結果を元のポジション順で返す
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