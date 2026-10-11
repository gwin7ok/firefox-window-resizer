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
├── tools/                 # バージョン更新・タグ発行スクリプト
├── scripts/
│   ├── background.js      # バックグラウンド処理
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

1. `makexpi_FWR.bat` を実行してXPIを生成します（VS Code では **Ctrl+Shift+4**）。
2. 署名のない XPI は通常の Firefox にはインストールできません。動作確認には `about:debugging` →「このFirefox」→「一時的なアドオンを読み込む」で `manifest.json` を選びます。

## リリース手順

署名済みXPIは、`vX.Y.Z` タグの push をきっかけにGitHub Actionsが作成し、Releaseに添付します。

1. （任意）`CHANGELOG.md` の `## [Unreleased]` に変更内容を書く。空のままなら手順2で、前回タグ（なければ CHANGELOG の最終変更コミット）以降のコミット件名から自動生成されます
2. **Ctrl+Shift+2**（タスク `Update Changelog`）: `[Unreleased]` が空なら生成内容を確認（y=書き込んで続行 / e=書き込んで編集 / N=中止）し、次のバージョン（パッチ/マイナー/メジャー）を選ぶと、`manifest.json` の `version` を更新し、CHANGELOG の `[Unreleased]` を `[x.y.z] - 日付` に切り出します
3. **Ctrl+Shift+3**（タスク `release-tag-and-push-short`）: `Release vX.Y.Z` をコミット → push → タグ発行までを行います（確認プロンプトあり。既存タグの再作成はしません）
4. Actions が署名（AMO unlisted）して `gwins-window-resizer.xpi` を Release に添付します

コマンドラインから実行する場合:

```powershell
pwsh ./tools/bump-version.ps1 [-Version 1.2.0]
pwsh ./tools/release-tag.ps1 -CommitRelease [-DryRun]
```

| キー | タスク | 内容 |
|---|---|---|
| Ctrl+Shift+2 | `Update Changelog` | バージョン更新と更新履歴の切り出し |
| Ctrl+Shift+3 | `release-tag-and-push-short` | コミット・push・タグ発行 |
| Ctrl+Shift+4 | `Publish: (Release win-x64)` | ローカル用の未署名XPI生成（`makexpi_FWR.bat`） |

タスクは `.vscode/tasks.json` で定義しています（キーバインドは利用者の VS Code 側の設定です）。

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
