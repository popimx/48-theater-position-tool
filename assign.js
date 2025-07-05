
async function assignPositions(members) {
  const positionsRes = await fetch('data/positions.json');
  const positions = await positionsRes.json();

  const experienceCount = {};
  positions.forEach(pos => {
    (pos.experiencedMembers || []).forEach(name => {
      experienceCount[name] = (experienceCount[name] || 0) + 1;
    });
  });

  let scoredPairs = [];
  positions.forEach(pos => {
    members.forEach(member => {
      let score = 25;
      if (pos.firstDayMember === member) {
        score = 100;
      } else if ((pos.experiencedMembers || []).includes(member)) {
        const count = experienceCount[member] || 0;
        score = count === 1 ? 75 : 50;
      }
      scoredPairs.push({ positionName: pos.name, candidate: member, score });
    });
  });

  scoredPairs.sort((a, b) => b.score - a.score);

  const assignedPositions = [];
  const usedPositions = new Set();
  const usedMembers = new Set();

  scoredPairs.forEach(({ positionName, candidate }) => {
    if (!usedPositions.has(positionName) && !usedMembers.has(candidate)) {
      assignedPositions.push({ positionName, member: candidate });
      usedPositions.add(positionName);
      usedMembers.add(candidate);
    }
  });

  return assignedPositions;
}
