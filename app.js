document.addEventListener('DOMContentLoaded', () => {
  const assignBtn = document.getElementById('assign-btn');
  const resultDiv = document.getElementById('result');

  assignBtn.addEventListener('click', async () => {
    resultDiv.innerHTML = '割り当て中...';

    // 入力を改行、読点「、」、中黒「・」で区切る
    const input = document.getElementById('member-input').value;
    const members = input
      .split(/[\n、・]/)   // 改行、読点「、」、中黒「・」で分割
      .map(name => name.trim())
      .filter(name => name !== '');

    if (members.length === 0) {
      resultDiv.innerHTML = '⚠️ 出演メンバーを入力してください。';
      return;
    }

    try {
      // 公演を選択
      const stage = document.getElementById('stage-select')?.value || 'kokokarada';

      // 割り当て処理（assignPositions内も同じstageを参照する想定）
      const assignedPositions = await assignPositions(members);

      // 初日ポジション順データをstageに応じて取得
      const positionsRes = await fetch(`data/${stage}/positions.json`);
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
            const member = assigned?.member || '―';
            const remark = assigned?.score === 25 ? '初' : '';
            return `
              <tr>
                <td>${pos.name}</td>
                <td>${member}</td>
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