# 開発ガイド

利用者向けの説明は [README.md](README.md) を参照してください。このドキュメントは開発者向けです（ビルド・動作確認・リリース手順）。

## ファイル構成

```
firefox-window-resizer/
├── manifest.json          # 拡張機能マニフェスト（version が正）
├── CHANGELOG.md           # 更新履歴（リリースノートの原本）
├── DEVELOPMENT.md         # このドキュメント
├── .github/workflows/     # リリース用 GitHub Actions
├── .vscode/tasks.json     # VS Code タスク（更新履歴・リリース・ローカルビルド）
├── tests/                 # 単体テスト（browser API をモックした Node テスト）
├── tools/                 # バージョン更新・タグ発行・ローカルビルドのスクリプト
├── scripts/
│   ├── background.js      # バックグラウンド処理
│   ├── store.js           # 保存データ(プリセット・設定・拡大率)の読み書きと論理/物理ピクセル変換
│   └── logger.js          # ログ機能
├── views/
│   ├── popup.html/js      # ポップアップUI
│   ├── settings.html/js   # 設定画面
│   ├── preset-editor.html/js  # プリセット編集
│   └── history-sidebar.html/js  # 履歴サイドバー
├── styles/                # CSS スタイルシート
└── assets/                # アイコン等のリソース
```

`scripts/` は拡張機能本体の JavaScript、`tools/` は開発用スクリプト（拡張機能には含まれません）です。

## ビルド方法

ローカル確認用（未署名）:

1. XPIを生成します（PowerShell 標準機能のみで動作します。7-Zip などは不要です）。

   ```powershell
   pwsh -NoProfile -File ./tools/build-xpi.ps1
   ```

   `dist/gwins-window-resizer.xpi` が作成されます（`dist/` は Git の追跡対象外です）。エクスプローラーからは `tools/build-xpi.bat` をダブルクリックしても実行できます。VS Code のタスクから実行する場合は、`Tasks: Run Task` で `Publish: (Release win-x64)` を選びます。
2. 署名のない XPI は通常の Firefox にはインストールできません。動作確認には `about:debugging` →「このFirefox」→「一時的なアドオンを読み込む」で `manifest.json` を選びます。

## テスト

背景スクリプト（`scripts/background.js`）を `browser` API のモックで読み込み、起動時の初期化・メニュー・メッセージの挙動を検証します。Node.js だけで動作し、追加のインストールは不要です。

```powershell
node tests/run.js
```

VS Code のタスクでは `Run Tests` です。`manifest.json` と各HTMLが参照するファイルの存在確認（`tests/manifest.test.js`）も含みます。`main` への push とプルリクエストで、GitHub Actions（`.github/workflows/test.yml`）が同じテストと `web-ext lint` を自動実行します。

## リリース手順

署名済みXPIは、`vX.Y.Z` タグの push をきっかけにGitHub Actionsが作成し、Releaseに添付します。

1. （任意）`CHANGELOG.md` の `## [Unreleased]` に変更内容を書く。空のままなら手順2で、前回タグ（なければ CHANGELOG の最終変更コミット）以降のコミット件名から自動生成されます
2. 更新履歴とバージョンを更新する:

   ```powershell
   pwsh -NoProfile -File ./tools/bump-version.ps1
   ```

   `[Unreleased]` が空なら生成内容を確認（y=書き込んで続行 / e=書き込んで編集 / N=中止）し、次のバージョン（パッチ/マイナー/メジャー）を選ぶと、`manifest.json` の `version` を更新し、CHANGELOG の `[Unreleased]` を `[x.y.z] - 日付` に切り出します。バージョンを直接指定する場合は `-Version 1.2.0`、内容の確認だけなら `-DryRun` を付けます。
3. リリースを生成する:

   ```powershell
   pwsh -NoProfile -File ./tools/release-tag.ps1 -CommitRelease
   ```

   `Release vX.Y.Z` をコミット → push → タグ発行までを行います（確認プロンプトあり。既存タグの再作成はしません）。事前に内容だけ確認する場合は `-DryRun` を付けます。
4. Actions が署名（AMO unlisted）して `gwins-window-resizer.xpi` を Release に添付します

### VS Code のタスク
上記のコマンドは、VS Code では `Tasks: Run Task` から次のタスク名で実行できます（`.vscode/tasks.json` で定義）。

| タスク名 | 実行内容 | 対応するコマンド |
|---|---|---|
| `Update Changelog` | バージョン更新と更新履歴の切り出し | `pwsh -NoProfile -File ./tools/bump-version.ps1` |
| `release-tag-and-push-short` | コミット・push・タグ発行 | `pwsh -NoProfile -File ./tools/release-tag.ps1 -CommitRelease` |
| `release-tag: dry run` | リリース内容の事前確認（何も実行しない） | `pwsh -NoProfile -File ./tools/release-tag.ps1 -CommitRelease -DryRun` |
| `Run Tests` | 単体テスト | `node tests/run.js` |
| `Publish: (Release win-x64)` | ローカル用の未署名XPI生成 | `pwsh -NoProfile -File ./tools/build-xpi.ps1` |

キーボードショートカットへの割り当ては、各自の VS Code 側の設定（`keybindings.json`）で行ってください。

### 事前準備（初回のみ）
GitHub の Secrets に、AMO の API キーを登録しておく必要があります。

- `AMO_JWT_ISSUER`: AMO の「JWT 発行者」
- `AMO_JWT_SECRET`: AMO の「JWT 秘密鍵」

発行場所は AMO 開発者ハブの「API 認証情報の管理」です。登録場所は、リポジトリの Settings → Secrets and variables → Actions → Repository secrets です。

### 注意事項
- AMO は**同一バージョンを再署名できません**。やり直す場合はバージョンを上げてください（既存タグの再作成もスクリプトが拒否します）。
- `manifest.json` の `version` が単一の情報源です。タグ名と一致しない場合、ワークフローは失敗します。
- 署名は自動処理ですが、数分かかることがあります。Actions の `Release (tag-triggered)` で結果を確認してください。
- 署名済みXPIは Releases で配布します。リポジトリには `*.xpi` を含めません（`.gitignore` 済み）。
