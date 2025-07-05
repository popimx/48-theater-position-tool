
document.addEventListener('DOMContentLoaded', () => {
  const assignBtn = document.getElementById('assign-btn');
  const resultDiv = document.getElementById('result');

  assignBtn.addEventListener('click', async () => {
    resultDiv.innerHTML = '割り当て中...';

    const input = document.getElementById('member-input').value;
    const members = input
  .replace(/\\n/g, '・') // 改行を「・」に変換
  .split('・')
  .map(name => name.trim())
  .filter(name => name !== '');

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
