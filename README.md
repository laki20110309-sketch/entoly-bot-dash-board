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

このフォルダをGitHubリポジトリへアップロードしてください。`.github/workflows/pages.yml` が含まれているため、リポジトリの **Settings → Pages → Source** で **GitHub Actions** を選択すると、`main` または `master` へのpush時に自動公開されます。Actionsが完了すると、`https://ユーザー名.github.io/リポジトリ名/` でアクセスできます。

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

`app.js` にはVPS API接続用の`window.EntryBotApi`クライアントを用意しています。Discordログインボタンを押すと、VPSのOAuth設定を自動取得してDiscordへ遷移します。次のAPIが利用されます。

- `GET /api/auth/config`
- `POST /api/auth/discord`
- `GET /api/guilds`
- `GET /api/guilds/:guildId/settings`
- `PATCH /api/guilds/:guildId/settings`
- `GET /api/guilds/:guildId/activity`
- `POST /api/guilds/:guildId/reset`
- `POST /api/guilds/:guildId/delete-teams`

## 注意

この試作版のボタンは、現時点では画面内の状態表示と通知までです。VPS APIを追加するまで、Discordサーバーの設定やチャンネルを実際に変更することはありません。実接続時は、リセットと一括削除に二重確認、管理者権限確認、操作ログを必ず実装します。


## Discord OAuth2ログイン（VPS API連携）

この管理画面は、Discord OAuth2でログインした運営メンバーについて、AdministratorまたはManage Server権限を持ち、かつEntry Botが参加しているサーバーだけを選択肢に表示します。DiscordのClient SecretはGitHub Pagesへ置かず、VPSの`.env`だけに保存してください。

VPS側の`.env`には、既存の`DISCORD_TOKEN`に加えて次を設定します。

```env
DASHBOARD_SECRET=既存の管理API用秘密鍵
DASHBOARD_ORIGIN=https://ユーザー名.github.io/管理画面リポジトリ名
PORT=3000
DISCORD_CLIENT_ID=Discord Developer PortalのApplication ID
DISCORD_CLIENT_SECRET=Discord Developer Portalで発行したClient Secret
DISCORD_REDIRECT_URI=https://ユーザー名.github.io/管理画面リポジトリ名/
```

Discord Developer PortalのOAuth2設定で、Redirectsに`DISCORD_REDIRECT_URI`と完全一致するURLを登録します。OAuth2のスコープは`identify`と`guilds`を使用します。新しい管理画面ではClient IDをブラウザで入力せず、VPSの`GET /api/auth/config`から公開可能なClient IDだけを取得します。Client Secret、Discord Token、`DASHBOARD_SECRET`はGitHubリポジトリへコミットしないでください。ログイン後は、Discordの表示名とアバターが管理画面右上に表示されます。

GitHub PagesがHTTPSで公開されるため、VPS APIもHTTPSのURLで公開する必要があります。HTTPのIPアドレスをHTTPSページから直接呼び出すと、ブラウザのMixed Content制限で失敗することがあります。
