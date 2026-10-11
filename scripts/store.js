// 設定・プリセット・拡大率（DPR）の保存と、論理/物理ピクセルの変換を集約するモジュール。
// 背景スクリプト・ポップアップ・設定画面・プリセット編集・履歴サイドバーから共通で使う。
// （browser.storage.local のキー名や既定値を、ここ以外に書かない）
(function (root) {
  var KEY_PRESETS = 'presets';
  var KEY_SETTINGS = 'settings';
  var KEY_DPR = 'systemDpr';

  var DEFAULT_DPR_PERCENT = 100;
  var DEFAULT_SETTINGS = { defaultPresetId: null }; // defaultPresetId: ブラウザ起動時に適用するプリセットID
  var DEFAULT_PRESETS = [
    {
      id: 'preset-default',
      name: '新規プリセット',
      width: 1024,
      height: 768,
      left: 0,
      top: 0
    }
  ];

  function clonePresets(presets) {
    return presets.map(function (preset) {
      return Object.assign({}, preset);
    });
  }

  // ---- プリセット ----

  async function getPresets() {
    var data = await browser.storage.local.get(KEY_PRESETS);
    return Array.isArray(data[KEY_PRESETS]) ? data[KEY_PRESETS] : [];
  }

  async function savePresets(presets) {
    await browser.storage.local.set({ presets: presets });
  }

  // ---- 設定 ----

  async function getSettings() {
    var data = await browser.storage.local.get(KEY_SETTINGS);
    return Object.assign({}, DEFAULT_SETTINGS, data[KEY_SETTINGS] || {});
  }

  async function saveSettings(settings) {
    await browser.storage.local.set({ settings: settings });
  }

  // ---- 拡大率（DPR） ----

  // 拡大率（%）。未設定や不正な値は 100
  async function getDprPercent() {
    var data = await browser.storage.local.get(KEY_DPR);
    var value = data[KEY_DPR];
    return (typeof value === 'number' && isFinite(value) && value > 0) ? value : DEFAULT_DPR_PERCENT;
  }

  async function setDprPercent(percent) {
    await browser.storage.local.set({ systemDpr: percent });
  }

  // 拡大率の係数（150% なら 1.5）
  async function getDprFactor() {
    return (await getDprPercent()) / 100;
  }

  // ---- 論理/物理ピクセルの変換 ----

  function convert(values, apply) {
    return {
      width: Math.round(apply(values.width)),
      height: Math.round(apply(values.height)),
      left: Math.round(apply(values.left)),
      top: Math.round(apply(values.top))
    };
  }

  // 物理ピクセル → 論理ピクセル（ブラウザのウィンドウ API に渡す値）
  function toLogical(values, dprFactor) {
    return convert(values, function (v) { return v / dprFactor; });
  }

  // 論理ピクセル → 物理ピクセル（プリセットに保存する値）
  function toPhysical(values, dprFactor) {
    return convert(values, function (v) { return v * dprFactor; });
  }

  // ---- 初期化 ----

  // 初期データ（プリセット・設定・DPR）を用意する。何度呼んでも安全。
  // 既存プリセットに id がなければ付与する（起動時適用が id で検索するため）。
  // 何を行ったかを返す。
  async function ensureDefaults() {
    var data = await browser.storage.local.get([KEY_PRESETS, KEY_SETTINGS, KEY_DPR]);
    var result = { presetsInitialized: false, idsAssigned: false, settingsInitialized: false, dprInitialized: false };

    if (!Array.isArray(data[KEY_PRESETS])) {
      await savePresets(clonePresets(DEFAULT_PRESETS));
      result.presetsInitialized = true;
    } else if (data[KEY_PRESETS].some(function (preset) { return preset && !preset.id; })) {
      var presets = data[KEY_PRESETS].map(function (preset, index) {
        return (preset && !preset.id)
          ? Object.assign({}, preset, { id: 'preset-' + Date.now() + '-' + index })
          : preset;
      });
      await savePresets(presets);
      result.idsAssigned = true;
    }

    if (!data[KEY_SETTINGS]) {
      await saveSettings(Object.assign({}, DEFAULT_SETTINGS));
      result.settingsInitialized = true;
    }

    if (data[KEY_DPR] === undefined) {
      await setDprPercent(DEFAULT_DPR_PERCENT);
      result.dprInitialized = true;
    }

    return result;
  }

  var api = {
    DEFAULT_DPR_PERCENT: DEFAULT_DPR_PERCENT,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    DEFAULT_PRESETS: DEFAULT_PRESETS,
    getPresets: getPresets,
    savePresets: savePresets,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getDprPercent: getDprPercent,
    setDprPercent: setDprPercent,
    getDprFactor: getDprFactor,
    toLogical: toLogical,
    toPhysical: toPhysical,
    ensureDefaults: ensureDefaults
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FwrStore = api;
  }
})(typeof self !== 'undefined' ? self : this);
