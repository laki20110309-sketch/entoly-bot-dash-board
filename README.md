# Entry Bot Control Center

Discord大会エントリーボットをブラウザから管理するための、GitHub Pages向け静的ダッシュボードです。現在の試作版は、概要、エントリー設定、ロール管理、チャンネル管理、アクティビティの各画面と、画面内の操作フィードバックを備えています。

## 現在できること

- サーバー別の大会運営ダッシュボード表示
- エントリー受付のON/OFF切り替えUI
- ソロ・デュオ・トリオ・スクワッドの形式設定UI
- VC対象名、条件なしロール、条件付きロールの管理UI
- ボット作成チャンネルの一覧表示と安全な一括削除の導線
- 設定リセットの確認モーダル
- アクティビティログ表示
- レスポンシブ対応

## GitHub Pagesで公開する方法

このフォルダの `index.html`、`styles.css`、`app.js`、`README.md` をGitHubリポジトリのルートへアップロードします。GitHubの **Settings → Pages** で、公開元に対象ブランチのルートを選択すると静的サイトとして公開できます。

## VPSのボットとの接続について

GitHub Pagesは静的サイトなので、DiscordトークンやAPI用の秘密鍵を置いてはいけません。実運用では次の構成にします。

1. VPS上のNode.jsボットに、認証済みの管理APIを追加する。
2. APIはサーバーID単位で `settings.json` を読み書きする。
3. GitHub Pages側はAPI URLだけを利用し、秘密鍵はブラウザへ埋め込まない。
4. Discord OAuth2、またはVPS側で発行する短期トークンで運営者を認証する。
5. CORSは公開サイトのドメインだけに限定する。

VPSの `.env` には少なくとも次の値を設定します。`DASHBOARD_SECRET` はGitHubへ絶対にアップロードせず、長くランダムな文字列にしてください。`DASHBOARD_ORIGIN` はGitHub Pagesの公開URLに置き換えます。

```env
DISCORD_TOKEN=Discordボットのトークン
DASHBOARD_SECRET=十分に長いランダムな管理APIキー
DASHBOARD_ORIGIN=https://あなたのユーザー名.github.io/リポジトリ名
PORT=3000
```

現在のサンプルコードは秘密鍵が未設定でもボット自体は起動しますが、管理APIへのアクセスは拒否します。

`app.js` の末尾には、VPS API接続用の `window.EntryBotApi` クライアントを用意しています。次の段階で、ボット側に以下のAPIを追加して画面のモック値を実データへ置き換えます。

- `GET /api/guilds`
- `GET /api/guilds/:guildId/settings`
- `PATCH /api/guilds/:guildId/settings`
- `GET /api/guilds/:guildId/activity`
- `POST /api/guilds/:guildId/reset`
- `POST /api/guilds/:guildId/delete-teams`

## 注意

この試作版のボタンは、現時点では画面内の状態表示と通知までです。VPS APIを追加するまで、Discordサーバーの設定やチャンネルを実際に変更することはありません。実接続時は、リセットと一括削除に二重確認、管理者権限確認、操作ログを必ず実装します。
