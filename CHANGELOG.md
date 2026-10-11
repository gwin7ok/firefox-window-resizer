# Changelog

All notable changes to this project are recorded in this file.

The version in `manifest.json` is the single source of truth. Each release has a
`## [x.y.z] - YYYY-MM-DD` section; the GitHub Release notes are extracted from it.


## [Unreleased]


## [1.1.5] - 2026-10-11

- プリセット編集で入力検証エラー時にウィンドウが閉じる不具合を修正
- 画面スクリプトのテストを追加（ポップアップ・設定画面・プリセット編集）



## [1.1.4] - 2026-10-11

- Logger を console の薄いラッパーに簡素化（385行 → 85行）
- 背景スクリプトのテストを、manifest の読み込み順で評価する共通ヘルパーに載せ替え
- ウィンドウ/タブの操作を scripts/window-actions.js に分離
- コンテキストメニューを scripts/menus.js に分離
- 分割した背景スクリプトのテストとドキュメントを追加



## [1.1.3] - 2026-10-11

- 確認プロンプトの既定を Yes に変更（Enter のみで続行）
- 保存データのアクセスとDPR変換を scripts/store.js に集約
- プリセット表示の共通処理を集約



## [1.1.2] - 2026-10-11

- 開発・ビルド・リリース手順を DEVELOPMENT.md に分離
- 開発ドキュメントとスクリプトのメッセージから、環境依存のショートカット表記を除去
- インストール時に履歴サイドバーが自動で開かないようにする
- アイコン指定を icon-* に一本化し、起動時の setIcon を廃止
- ローカルビルドを tools/build-xpi.ps1 に置き換え（7-Zip 不要）
- 単体テストを tests/ に追加し、push/PR で自動実行する
- 履歴サイドバーに最終訪問日時を表示する
- 履歴サイドバーを日付ごとの開閉できるツリーにし、「さらに読み込む」を追加
- 履歴サイドバーが約400件で読み込みを止める不具合を修正し、「すべて読み込む」を追加
- 履歴サイドバーの読み込みを取得件数の引き上げ方式に変更し、ボタンを検索欄の直下に移動



## [1.1.1] - 2026-10-11

- *.xpi をリポジトリの追跡対象外にする（署名済みXPIは GitHub Releases から配布）
- 起動時プリセットの再適用を修正し、未使用コードを整理
- コンテキストメニューをプリセットID基準にし、メッセージ応答とウィンドウ解決を整理
- マニフェストを整理し、不要な権限・ファイルを削除
- リリースワークフローのアクションを更新（Node.js 20 非推奨警告の解消）



## [1.1.0] - 2026-10-11

Context menus
- Add "複製を別ウィンドウで開く" menu to the page background and tab context menus: the tab is duplicated and only the duplicate is moved to a new window with the chosen preset.
- Add "別ウィンドウで開く" menu to bookmark context menus (bookmarks toolbar / menu / sidebar / library). Adds the `bookmarks` permission.
- Add "履歴を別ウィンドウで開く" to the toolbar icon context menu; it opens the history sidebar.
- Fix: the tab context menu now moves the right-clicked tab instead of the window's active tab.

History sidebar
- Add a history sidebar (search + list). Choose a preset each time to open a history entry in a new window. Right-click an entry for a one-level preset menu. Adds the `history` permission.

Release process
- Add CHANGELOG-driven release workflow (tag `vX.Y.Z` -> signed XPI attached to a GitHub Release).

## [1.0.0] - 2025-10

- Add context menu feature (link / page / tab).
- Support multi-line preset names.
- Reorder presets by drag & drop.
- Improve preset table display.
- Improve tab handling (create an empty window, then move the tab to keep its state).
- Improve DPR support.
