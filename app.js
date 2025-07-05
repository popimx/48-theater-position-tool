
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

      // 初日ポジション順に取得
      const positionsRes = await fetch('data/positions.json');
      const positions = await positionsRes.json();

      // ポジション名 → メンバー のマッピング
      const positionMap = {};
      assignedPositions.forEach(({ positionName, member }) => {
        positionMap[positionName] = member;
      });

      // テーブル作成
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
            <th>ポジション名</th>
            <th>出演メンバー</th>
            <th>備考</th> <!-- 新しく追加 -->
          </tr>
        </thead>
        <tbody>
          ${positions.map(pos =>
            const assigned = positionMap[pos.name];
      const remark = assigned?.score === 20 ? '初' : '';
      return `
            <tr>
              <td>${pos.name}</td>
              <td>${positionMap[pos.name] || '―'}</td>
              <td>${remark}</td>
            </tr>
          `).join('')}
        </tbody>
      `;

      resultDiv.innerHTML = '';
      resultDiv.appendChild(table);
    } catch (e) {
      resultDiv.textContent = 'エラーが発生しました。';
      console.error(e);
    }
  });
});

