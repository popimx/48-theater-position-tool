async function assignPositions(inputMembers) {
  const stage = document.getElementById('stage-select')?.value || 'kokokarada';

  const positionsRes = await fetch(`data/${stage}/positions.json`);
  const experienceRes = await fetch(`data/${stage}/experience.json`);
  const positions = await positionsRes.json();
  const experienceData = await experienceRes.json();

  // 初日メンバー
  const firstDayMembersSet = new Set(positions.map(p => p.firstDayMember));

  // 経験数カウント
  const experienceCountMap = {};
  inputMembers.forEach(m => experienceCountMap[m] = 0);

  positions.forEach(pos => {
    const base = pos.firstDayMember;
    if (inputMembers.includes(base)) experienceCountMap[base]++;
    (experienceData[base] || []).forEach(m => {
      if (inputMembers.includes(m)) experienceCountMap[m]++;
    });
  });

  // メンバー→担当可能ポジション
  const memberToPositions = {};
  inputMembers.forEach(m => memberToPositions[m] = new Set());

  positions.forEach(pos => {
    const base = pos.firstDayMember;
    const exp = experienceData[base] || [];

    inputMembers.forEach(m => {
      if (m === base || exp.includes(m)) {
        memberToPositions[m].add(pos.name);
      }
    });
  });

  // ステージ固有の固定割り当て（スコア70）
  const fixedAssignmentsMap = {
    mokugekisha: {
      "運上弘菜ポジ": "石橋颯",
      "栗原紗英ポジ": "栗原紗英",
      "豊永阿紀ポジ": "豊永阿紀",
      "矢吹奈子ポジ": "北川陽彩",
      "渡部愛加里ポジ": "市村愛里"
    },
    kokonidattetenshihairu: {
      "今村麻莉愛ポジ": "田中伊桜莉",
      "栗山梨奈ポジ": "立花心良",
      "後藤陽菜乃ポジ": "福井可憐",
      "坂本愛玲菜ポジ": "森﨑冴彩",
      "武田智加ポジ": "秋吉優花",
      "田中美久ポジ": "今村麻莉愛",
      "松岡はなポジ": "井澤美優",
      "山下エミリーポジ": "栗山梨奈"
    }
  };

  const fixedAssignments = fixedAssignmentsMap[stage] || {};

  // スコア判定
  function getScore(member, posName, baseName) {
    const isFirstDay = member === baseName;
    const isExperienced = (experienceData[baseName] || []).includes(member);
    const expCount = experienceCountMap[member] || 0;

    if (fixedAssignments[posName] === member) return 70;

    if (isFirstDay && expCount === 1) return 100;
    if (!isFirstDay && isExperienced && expCount === 1) return 75;
    if ((isFirstDay || isExperienced) && expCount >= 2) return 50;

    return 25;
  }

  // 全候補
  const candidateMap = {}; // posName → [{member, score}]
  positions.forEach(pos => {
    const base = pos.firstDayMember;
    candidateMap[pos.name] = [];

    inputMembers.forEach(member => {
      if (memberToPositions[member].has(pos.name)) {
        const score = getScore(member, pos.name, base);
        candidateMap[pos.name].push({ member, score });
      }
    });
  });

  // ■■■ 全パターン列挙（バックトラック）■■■
  const allPatterns = [];

  function dfs(posIndex, usedMembers, currentAssignments) {
    if (posIndex >= positions.length) {
      allPatterns.push([...currentAssignments]);
      return;
    }

    const pos = positions[posIndex].name;
    const candidates = candidateMap[pos];

    for (const c of candidates) {
      if (!usedMembers.has(c.member)) {
        usedMembers.add(c.member);
        currentAssignments.push({
          positionName: pos,
          member: c.member,
          score: c.score
        });

        dfs(posIndex + 1, usedMembers, currentAssignments);

        usedMembers.delete(c.member);
        currentAssignments.pop();
      }
    }
  }

  dfs(0, new Set(), []);

  // ■■■ スコアまとめ（75→50→25 優先ソート）■■■
  function scoreSummary(pattern) {
    let s75 = 0, s50 = 0, s25 = 0;

    pattern.forEach(a => {
      if (a.score === 75) s75++;
      else if (a.score === 50) s50++;
      else if (a.score === 25) s25++;
    });

    return {
      s75,
      s50,
      s25,
      total: s75 * 75 + s50 * 50 + s25 * 25
    };
  }

  // ソート
  allPatterns.sort((a, b) => {
    const A = scoreSummary(a);
    const B = scoreSummary(b);

    if (A.s75 !== B.s75) return B.s75 - A.s75;
    if (A.s50 !== B.s50) return B.s50 - A.s50;
    if (A.s25 !== B.s25) return B.s25 - A.s25;
    return B.total - A.total;
  });

  // パターン1 / パターン2 / … の形で返却
  return allPatterns.map((pattern, idx) => ({
    patternName: `パターン${idx + 1}`,
    assignments: pattern
  }));
}