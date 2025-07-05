
document.addEventListener('DOMContentLoaded', () => {
  const assignBtn = document.getElementById('assign-btn');
  const resultDiv = document.getElementById('result');

  assignBtn.addEventListener('click', async () => {
    resultDiv.innerHTML = '割り当て中...';

    const input = document.getElementById('member-input').value;
    const members = input.split('・').map(name => name.trim()).filter(name => name);

    if (members.length !== 16) {
      resultDiv.innerHTML = '⚠️ 16人ちょうどで入力してください。現在: ' + members.length + '人';
      return;
    }

    try {
      const assignedPositions = await assignPositions(members);
      resultDiv.innerHTML = '';

      assignedPositions.forEach(({ positionName, member }) => {
        const p = document.createElement('p');
        p.textContent = `${positionName} → 出演メンバー: ${member}`;
        resultDiv.appendChild(p);
      });
    } catch (e) {
      resultDiv.textContent = 'エラーが発生しました。';
      console.error(e);
    }
  });
});
