// プリセットを表の行として表示するときの共通処理（ポップアップと設定画面で使う）。
// 表示用の文字列は scripts/store.js（FwrStore）の formatSize / formatPosition を使う。
(function (root) {
  function createCell(text, className) {
    var cell = document.createElement('td');
    if (className) {
      cell.className = className;
    }
    cell.textContent = text;
    return cell;
  }

  // 行に「プリセット名・サイズ・位置」の3つのセルを追加する。
  // classNames: { name, size, position } のセルに付けるクラス名（省略可）
  function appendInfoCells(row, preset, classNames) {
    var classes = classNames || {};
    row.appendChild(createCell(preset.name, classes.name));
    row.appendChild(createCell(FwrStore.formatSize(preset), classes.size));
    row.appendChild(createCell(FwrStore.formatPosition(preset), classes.position));
    return row;
  }

  root.FwrPresetView = {
    createCell: createCell,
    appendInfoCells: appendInfoCells
  };
})(typeof self !== 'undefined' ? self : this);
