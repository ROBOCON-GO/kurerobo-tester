# KureRobo Tester

呉ロボ用、ブラウザ完結型のロボットテストツール。
Arduino IDE も mingw もターミナルも不要で、機械班が誰でもロボットを動かせるようにするのが目的。

> 設計の全体像は [../設計プラン.md](../設計プラン.md) を参照。

## 📖 使い方ドキュメント(部員向け)

- [ドキュメント目次](docs/guide/README.md)
- [① ESP32への書き込み](docs/guide/01-書き込み.md)
- [② 手動テストの使い方](docs/guide/02-手動テスト.md)
- [③ 操縦と制御プログラム(control)](docs/guide/03-操縦.md)
- [困ったとき(トラブルシューティング)](docs/guide/04-トラブルシューティング.md)

> アプリ本体は `docs/`(GitHub Pages の公開フォルダ)に配置。デプロイ手順は [DEPLOY.md](DEPLOY.md)。

## できること

- **① 書き込みタブ**: `flash.bat` のダブルクリックで書き込み(Arduino IDE不要・COM自動検出・Hash検証あり)。
  - ※ブラウザ直接書き込み(esptool-js)はこのボードのUSBシリアル(CP2102)と相性が悪くフラッシュを破損させたため不採用。
- **② 手動テストタブ**(ノーコード): Bluetooth 仮想COM に接続し、スライダー/トグルで
  - ロボマスモーター 速度制御(ID1〜8)
  - GM6020 速度制御(ID1〜7)
  - 新モタドラ duty(-999〜999, 0=ブレーキ, ロリコン原点リセット)
  - PWM 出力(1〜6ch, 絶縁反転トグル)
  - GPIO 出力トグル
  - 全停止ボタン / 送信モニタ
- **③ 操縦タブ**: DualSense(Gamepad API)で操縦。編集できるのは `control(pad, motor)` 関数だけ(他はロック)。プロファイル保存/書出/読込、適用時にコンパイル&検証、実行時エラーは自動で送信停止。

すべての制御ロジック・COBSエンコードは**ブラウザ側**で実行。ESP32 は素通しブリッジ(再書き換え不要)。

## 動かし方(開発・ローカル)

Web Serial API は HTTPS か localhost でしか動かないため、ファイルを直接開く(`file://`)のは不可。
ローカルサーバ経由で開く:

**かんたん**: `start.bat` をダブルクリック(サーバ起動 + ブラウザ自動オープン)。

手動なら、アプリ本体がある `docs/` を配信する:

```powershell
cd kurerobo-tester\docs
python -m http.server 8080
```

→ ブラウザ(**Chrome / Edge**)で http://localhost:8080 を開く。

### 使う手順

1. ESP32 にブリッジファームを書き込む(下記)。
2. Windows の Bluetooth 設定で `ESP32_CTRL` をペアリング(一度だけ)。
3. アプリで「接続」→ ポート一覧から **Bluetooth 仮想COM** を選択。
4. ② 手動テストで行を有効化 → スライダーを動かす → 実機のモーターが回る。

## ブリッジファームの書き込み

中身は `firmware/bridge/bridge.ino`(BT↔UART 素通し、以後変更不要)。

### 配布用:ポータブル書き込みツール(インストール不要)

`flash-tool/`(= `flash-tool.zip`)に **esptool.exe + ビルド済みbin + flash.bat** を同梱。
配布先PCに何も入れなくても、解凍して `flash.bat` をダブルクリックするだけ:

1. `flash-tool.zip` をダウンロードして解凍
2. USBで ESP32 を接続
3. `flash.bat` をダブルクリック → COM自動検出 → 書き込み → `OK! Flash complete (hash verified)`

アプリの①書き込みタブからこのZIPをダウンロードできる(GitHub Pages でも静的配信なので動く)。
※ 署名なし esptool.exe のため、初回は Windows SmartScreen が「詳細情報→実行」を求める場合あり。

### 開発用:ソースから再ビルドして書き込み(制御班)

`bridge.ino` を変更したときだけ。`arduino-cli` が必要:

```powershell
# winget install ArduinoSA.CLI （初回のみ。ESP32コアは flash.bat 初回実行時に自動取得）
.\flash.bat          # コンパイル→書込→Hash検証(COM自動検出)
```

再ビルド後は `firmware/build/*.bin` を `flash-tool/` にコピーして `flash-tool.zip` を作り直す。

> ブラウザからの直接書き込み(esptool-js)は、このボードのCP2102と相性が悪く
> フラッシュを破損させたため不採用(esptool-js 0.6.0 は非圧縮書き込みも未対応)。
> 中身が同じ esptool でも、Python版/exe版は問題なく書ける。

## テスト(ロジック検証)

```powershell
node tests/test.js   # COBS と コマンド生成バイト列を検証
```

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `index.html` / `styles.css` | UI |
| `app.js` | 配線・50msハートビート送信・全停止・タブ |
| `transport.js` | Web Serial 接続/送受信 |
| `robomas.js` | mawarudokusute コマンド生成(0-71 / 72-79新モタドラ / 254) |
| `cobs.js` | COBS エンコード/デコード(ESP32版を忠実移植) |
| `firmware/bridge/bridge.ino` | 固定ブリッジファーム |
| `build_firmware.ps1` | ファームのビルドスクリプト |
| `tests/test.js` | ロジック検証 |

## 注意・制約

- **Chrome / Edge 専用**(Web Serial / Gamepad API)。
- **Bluetooth ペアリングは Windows 設定で一度だけ必要**(SPP は Web Bluetooth 非対応のため仮想COM経由)。
- 接続中は 50ms 周期で送信し続ける(メインボードの 800ms 安全リセット対策)。タブ非アクティブ時は送信停止。
- コマンド72番台(新モタドラ)の割り当ては仕様書からの推定実装。実機で要確認。
