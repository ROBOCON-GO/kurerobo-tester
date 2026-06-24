# GitHub Pages へのデプロイ手順

このリポジトリは **`docs/` フォルダにアプリ本体**が入っており、GitHub Pages の
「**Deploy from a branch → /docs**」設定でそのまま公開できます。

```
kurerobo-tester/            ← GitHubリポジトリのルート
├── docs/                   ← ★ここがGitHub Pagesで公開される(=アプリ本体)
│   ├── index.html          アプリ入口
│   ├── app.js / *.js / styles.css
│   ├── flash-tool.zip      ①タブの「書き込みツールDL」対象
│   ├── .nojekyll           Jekyll無効化(アプリをそのまま配信)
│   └── guide/              使い方ドキュメント(md)
├── firmware/  flash-tool/  flash.bat ...   ← 開発・書き込み用(公開されない)
└── README.md
```

## 初回セットアップ

1. **GitHubでリポジトリを作成**(例: `kurerobo-tester`)。Private/Public どちらでも可
   (Privateの場合 GitHub Pages は有料プラン/Organizationの制限に注意。基本は Public 推奨)。

2. **ローカルから push**(このフォルダで):
   ```powershell
   git remote add origin https://github.com/<ユーザー名>/kurerobo-tester.git
   git branch -M main
   git push -u origin main
   ```
   (`git init` と最初のコミットは済んでいます)

3. **GitHub の Settings → Pages** を開く:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / フォルダ `/docs` を選択 → Save

4. 1〜2分待つと、ページURLが表示されます:
   ```
   https://<ユーザー名>.github.io/kurerobo-tester/
   ```
   これを部員に共有すれば、**インストール不要**でアプリが使えます(Chrome/Edge)。

## 更新するとき

アプリ(`docs/` 内)を変更したら、コミットして push するだけで反映されます:

```powershell
git add -A
git commit -m "update app"
git push
```

## ファームを更新したとき(`flash-tool.zip` の作り直し)

`bridge.ino` を変えて再ビルドした場合のみ:

1. `flash.bat`(ルート)等で再ビルド → `firmware/build/*.bin` が更新される
2. 新しい bin を `flash-tool/` にコピー
3. `flash-tool/` を zip 化して **`docs/flash-tool.zip`** を上書き
   ```powershell
   Compress-Archive -Path flash-tool\* -DestinationPath docs\flash-tool.zip -Force
   ```
4. commit & push

## 注意

- **HTTPS で配信されるので Web Serial / Gamepad API が動きます**(GitHub Pages は常にHTTPS)。
- `docs/.nojekyll` があるため、アプリのファイルはそのまま配信されます。
  使い方md(`docs/guide/*.md`)は Pages 上では素のテキスト表示になります
  (GitHubのリポジトリ画面では綺麗にレンダリングされます)。
- **Bluetoothのペアリングと書き込みはローカル作業**です(Pagesからはできない)。
  書き込みは①タブからDLした `flash-tool.zip` をローカルで実行します。
