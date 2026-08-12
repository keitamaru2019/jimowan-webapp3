# 地元ワンダーランド＝ジモワン v26

仕上げ版です。冒頭キャッチコピーと「ジモワンって何？」YouTubeボタンを追加しました。

# 地元ワンダーランド v18（都道府県付き区市町表示版） Webアプリ v5

地図表示安定版 v5です。`/app?version=v5` で開き、地図枠に「地図表示安定版 v5」と表示されることを確認してください。

## 起動

```powershell
node .\server.js
```

ブラウザ:

```text
http://localhost:3000/app?version=v5
```

ローカル初期パスワード: `jimowan`

## 注意

古いNodeが起動している場合は以下で停止してください。

```powershell
taskkill /F /IM node.exe
```

# 地元ワンダーランド Webアプリ MVP（パスワード付きRender対応版 v4）


プレゼン資料「地元ワンダーランド（ワンダーランド）」を具現化した、LP + 実アプリのプロトタイプです。
この版は **パスワード付き限定公開** と **Renderデプロイ** に対応しています。

Node.js 標準機能だけで動くため、追加ライブラリはありません。Renderでは `npm install` が実行されますが、依存パッケージはありません。

## できること

- LP表示：サービスコンセプト、機能説明、ランキング思想、サンプルマップ紹介
- パスワード付き限定公開：LP・アプリ・APIをまとめて保護
- ワンダーランド登録：タイトル、エリア、作者、スポット、緯度経度、滞在時間、徒歩時間を登録
- ワンダーランドマップ作成：登録スポットを地図に番号付き表示、タイムテーブルも自動表示
- PDF保存：ブラウザの印刷機能でA4横向きPDFとして保存
- ワンダーランドランキング：
  - 知らなかった！
  - 予想外だった！
  - 初体験したい！
  の3軸を1〜5点で投票し、総合点を逐次更新
- 添付ワンダーランドマップのサンプル登録：仙川、川越、中央区新川、朝霞、平和台・氷川台

## ローカル起動方法

```bash
cd jimowan_webapp
node server.js
```

ブラウザで以下を開いてください。

```text
http://localhost:3000
```

初期パスワードは以下です。

```text
jimowan
```

アプリ画面はログイン後に以下で開けます。

```text
http://localhost:3000/app
```

## パスワード設定

本番公開時は、必ず環境変数でパスワードを変更してください。

```text
JIMOWAN_PASSWORD=仲間に共有するパスワード
JIMOWAN_SESSION_SECRET=長いランダム文字列
```

Renderでは、管理画面の **Environment Variables** に上記を登録します。

## GitHubに入れるファイル

GitHubのリポジトリ直下が以下の構成になるようにアップロードしてください。

```text
jimowan-webapp/
  server.js
  package.json
  render.yaml
  README.md
  .gitignore
  .env.example
  data/
    db.json
  public/
    index.html
    login.html
    app.html
    styles.css
    app.js
    samples/
      *.png
```

ZIPの中にある `jimowan_webapp` フォルダの **中身** を、GitHubリポジトリの一番上に置くのがおすすめです。

## Renderデプロイ手順

Renderで以下の設定にしてください。

```text
Service Type: Web Service
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Environment Variables に以下を設定します。

```text
NODE_ENV=production
JIMOWAN_PASSWORD=任意のパスワード
JIMOWAN_SESSION_SECRET=長いランダム文字列
```

`render.yaml` も入れているため、Render側で Blueprint として読み込ませることもできます。

## データ保存について重要

このMVPは、登録データと投票データをJSONファイルに保存します。

```text
data/db.json
```

ローカルPCでは問題ありませんが、Renderの通常環境では再デプロイや再起動でファイル変更が戻る場合があります。
デモで「見せるだけ」ならこのままで構いません。

仲間が登録・投票したデータを残したい場合は、Renderで Disk を追加し、Mount Path を以下にします。

```text
/var/data
```

そして Environment Variables に以下を追加します。

```text
JIMOWAN_DATA_PATH=/var/data/db.json
```

初回起動時に、サンプルデータ入りの `data/db.json` が `/var/data/db.json` にコピーされます。

## 本番化する場合の次ステップ

このMVPは「限定公開して仲間に見せる」ための版です。事業化に向けては、以下を追加するとよいです。

- 個人別ログイン
- 投稿者ごとのマイページ
- 投稿の承認制
- 画像アップロード
- コメント・部室機能
- 作者別ランキング
- 不正投票対策
- Supabase / PostgreSQL / Firebase などのDB化
- Google Maps API / OpenRouteService 連携による距離・徒歩時間の自動計算

## ファイル構成

```text
jimowan_webapp/
  server.js              # Node.js API + 静的ファイルサーバー + パスワード認証
  package.json           # 起動スクリプト
  render.yaml            # Render向け設定例
  data/db.json           # サンプルデータ + 保存先
  public/
    login.html           # 限定公開ログイン画面
    index.html           # LP
    app.html             # 実アプリ
    styles.css           # LP/アプリ/ログイン共通デザイン
    app.js               # アプリ側ロジック
    samples/*.png        # 添付PDFから生成したマッププレビュー
```

## v3 の修正点

- 外部のOpenStreetMapタイル表示を使わない「タイルなし印刷安定版」マップに変更しました。
- ネットワークや地図タイル読み込みの影響で、マップが歯抜け・白抜けになる問題を避けます。
- PDF保存／印刷時も、番号付きスポットとルート線が安定して表示されます。



## v4 修正メモ

- マップ描画をSVGからHTML/CSS描画に変更しました。
- 表示確認用にマップ右上へ「地図表示安定版 v4」を表示します。これが見えれば最新版です。
- 旧版が表示される場合は、PowerShellで既存Nodeプロセスを停止してから再起動してください。


## v6 update

- LP冒頭に「地元ワンダーランド」バナーアートを追加しました。
- バナー画像は `public/assets/jimowan-banner-art.jpg` に格納しています。


## v7 実地図タイル版

マップ作成画面は、HTML/CSSのダミー地図ではなく、国土地理院の地図タイルを直接読み込む実地図表示に変更しています。
ブラウザで `http://localhost:3000/app?version=v7` を開き、マップ画面に「実地図タイル版 v7」と表示されれば最新版です。
地図背景を表示するにはインターネット接続が必要です。


## v8 追加内容

- 添付された追加ワンダーランドマップをランキングとマップ作成画面に反映しました。
- フォーマットが異なるPDF（時刻表のみ、地図と時刻表が別ページ等）も、現行アプリの `wonderlands` / `spots` 形式へ変換しています。
- 既存の川越・平和台/氷川台は、重複登録ではなく最新版PDF・サムネイル・デモスコアに更新しています。
- アプリ画面は `/app?version=v8` で開いてください。


## v9 変更点

- 練馬中心のランキング表示を追加しました。ランキング画面で「練馬ランキング」「全国ランキング」「東京・近隣ランキング」を切り替えできます。
- 自由検索欄を追加しました。気分や関心を入れると、タグ・説明・スポット・3軸スコアから意外なワンダーランド候補を表示します。
- 添付Excel「練馬ワンダーランド用データ.xlsx」の組み合わせをワンダーランド形式に変換して登録しました。
- ねりま観光センター「練馬のカプセルコース」から、江古田サブカル、親子銭湯、高コスパ酒場、涼麺、石神井公園、牧野富太郎、都市農業、乗り物キッズを追加しました。

起動後は `http://localhost:3000/app?version=v9` を開いてください。


## v12更新
- 写真単独リンクを廃止し、各スポットのリンクを「地図/写真」に一本化しました。Googleマップ上で場所と写真を確認できます。


## v14 KML取込対応

- `http://localhost:3000/app?version=v14` を開きます。
- 左メニューの「KML取込」から `.kml` ファイルを選択します。
- KML内の `Folder` をワンダーランド、`Point` をスポット、`LineString` をルート線として取り込みます。
- 取り込んだコースは、区・市町フィルター、ランキング、自由検索、マップ作成に反映されます。
- この版では、添付の `TOKYO_WALKING_MAP_全コース.kml` 由来のコースを初期データとして同梱しています。


## v23 追加
東京都練馬区の全スポットを対象に、候補駅から概算周遊距離が最短になる起点駅を選び、出発駅へ戻る全網羅型周遊プランを追加しました。
