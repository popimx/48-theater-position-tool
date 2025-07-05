document.addEventListener('DOMContentLoaded', () => {
  const assignBtn = document.getElementById('assign-btn');
  const resultDiv = document.getElementById('result');

  assignBtn.addEventListener('click', async () => {
    resultDiv.innerHTML = '割り当て中...';

    // 改行も「・」も両方サポートして区切る
    const input = document.getElementById('member-input').value;
    const members = input
      .replace(/\n/g, '・')
      .split('・')
      .map(name => name.trim())
      .filter(name => name !== '');

    if (members.length === 0) {
      resultDiv.innerHTML = '⚠️ 出演メンバーを入力してください。';
      return;
    }

    try {
      const assignedPositions = await assignPositions(members);

      // 初日ポジション順データを取得
      const positionsRes = await fetch('data/positions.json');
      const positions = await positionsRes.json();

      // ポジション名 → { member, score } のマップを作成
      const positionMap = {};
      assignedPositions.forEach(({ positionName, member, score }) => {
        positionMap[positionName] = { member, score };
      });

      // 表生成
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
            <th>ポジション名</th>
            <th>出演メンバー</th>
            <th>備考</th>
          </tr>
        </thead>
        <tbody>
          ${positions.map(pos => {
            const assigned = positionMap[pos.name];
            const remark = assigned?.score === 25 ? '初' : '';
            return `...`;
            })
              <tr>
                <td>${pos.name}</td>
                <td>${assigned?.member || '―'}</td>
                <td>${remark}</td>
              </tr>
            `;
          }).join('')}
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