// プリセットを読み込んで表示
async function loadPresets() {
  const presetsList = document.getElementById('presets-list');
  const noPresets = document.getElementById('no-presets');
  
  try {
    const presets = await browser.runtime.sendMessage({ action: 'getPresets' });
    
    if (presets.length === 0) {
      noPresets.style.display = 'block';
      return;
    }
    
    noPresets.style.display = 'none';
    
    // プリセットを表示
    presetsList.innerHTML = '';
    presets.forEach(preset => {
      const presetItem = document.createElement('div');
      presetItem.className = 'preset-item';
      presetItem.innerHTML = `
        <div class="preset-name">${preset.name}</div>
        <div class="preset-info">${preset.width}×${preset.height} @ (${preset.left}, ${preset.top})</div>
      `;
      
      presetItem.addEventListener('click', () => applyPreset(preset));
      presetsList.appendChild(presetItem);
    });
  } catch (err) {
    console.error('プリセット読み込みエラー:', err);
    presetsList.innerHTML = '<div class="preset-empty">プリセットの読み込みに失敗しました</div>';
  }
}

// プリセットを適用する関数（変換確認）
async function applyPreset(preset) {
  try {
    // 物理ピクセルフラグを確実に設定
    const presetWithFlag = {
      ...preset,
      isPhysicalPixels: true // この値が確実に設定されていることを確認
    };
    
    console.log('プリセット適用:', {
      名前: preset.name,
      サイズ: `${preset.width}x${preset.height}`,
      位置: `(${preset.left},${preset.top})`,
      物理ピクセル: presetWithFlag.isPhysicalPixels
    });
    
    await browser.runtime.sendMessage({
      action: 'applyPreset',
      preset: presetWithFlag
    });
    
    window.close(); // 適用後にポップアップを閉じる
  } catch (err) {
    console.error('プリセット適用エラー:', err);
    // エラーがあっても閉じる
    window.close();
  }
}

// 設定画面を開く
function openSettings() {
  browser.runtime.openOptionsPage();
  window.close();
}

// イベントリスナー
document.addEventListener('DOMContentLoaded', () => {
  loadPresets();
  document.getElementById('settings-button').addEventListener('click', openSettings);
});