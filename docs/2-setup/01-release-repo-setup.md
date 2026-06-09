# リリースリポジトリのセットアップ手順

**対象:** プラットフォームオーナー（Keith）
**目的:** ライセンシー向けリリースリポジトリを作成し、開発リポジトリから自動同期できるようにする
**所要時間:** 約 30〜45 分（初回のみ）

---

## 全体の仕組み

```
開発リポジトリ（現在）                 リリースリポジトリ（新規）
madbarbarian/                   →    madbarbarian/
CommunityMerch-Fundraising-          CommunityMerch-PF-release
Platform                                  ↓ フォーク
（開発ファイル全て含む）                 ライセンシーA / ライセンシーB
                                          ↓ Vercel にデプロイ
```

`main` ブランチにプッシュするたびに、GitHub Actions が自動的にリリースリポジトリへ
必要なファイルだけをコピーします。CLAUDE.md などの開発専用ファイルは含まれません。

---

## Step 1: リリースリポジトリを GitHub で作成する

1. ブラウザで **https://github.com/new** を開く

2. 以下の通り入力する：

   | 項目 | 入力内容 |
   |------|---------|
   | Repository name | `CommunityMerch-PF-release` |
   | Description | CommunityMerch Platform — Licensee Release |
   | Public / Private | **Public**（ライセンシーがフォークできるように） |

3. **「Add a README file」などのチェックは全て外す**（空のリポジトリにする）

4. **「Create repository」** をクリック

> ✅ 空のリポジトリページが表示されれば完了です

---

## Step 2: SSH Deploy Key を生成する

「Deploy Key（デプロイキー）」とは、GitHub Actions がリリースリポジトリへ
自動書き込みするための専用の鍵です。

### 2-1. ターミナルを開く

Mac の場合: `Cmd + Space` →「ターミナル」と入力 → Enter

> 💡 ターミナルはどのフォルダで開いても構いません。
> 鍵ファイルはプロジェクトフォルダではなく `~/.ssh/` に保存されます。

### 2-2. 鍵を生成するコマンドを実行する

```bash
ssh-keygen -t ed25519 -C "release-repo-sync" -f ~/.ssh/release_deploy_key -N ""
```

> このコマンドが行うこと: 公開鍵と秘密鍵のペアを作成します（パスワードなし）

実行すると以下のように表示されます（正常）：
```
Your identification has been saved in /Users/ユーザー名/.ssh/release_deploy_key
Your public key has been saved in /Users/ユーザー名/.ssh/release_deploy_key.pub
```

### 2-3. 公開鍵の内容をコピーする

```bash
cat ~/.ssh/release_deploy_key.pub
```

表示された `ssh-ed25519 AAAA...` から始まる 1 行を**全部**コピーしておく。

---

## Step 3: 公開鍵をリリースリポジトリに登録する

1. ブラウザで以下の URL を開く：
   `https://github.com/madbarbarian/CommunityMerch-PF-release/settings/keys`

2. **「Add deploy key」** をクリック

3. 以下の通り入力する：

   | 項目 | 入力内容 |
   |------|---------|
   | Title | `Sync from Dev Repo` |
   | Key | Step 2-3 でコピーした公開鍵（`ssh-ed25519 AAAA...`）を貼り付け |
   | Allow write access | **必ずチェックを入れる** ← 重要！ |

4. **「Add key」** をクリック

> ✅ これで GitHub Actions がリリースリポジトリへ書き込めるようになります

---

## Step 4: 秘密鍵を開発リポジトリの Secrets に登録する

### 4-1. 秘密鍵の内容をコピーする

ターミナルで以下を実行：
```bash
cat ~/.ssh/release_deploy_key
```

`-----BEGIN OPENSSH PRIVATE KEY-----` から始まり
`-----END OPENSSH PRIVATE KEY-----` で終わる複数行を**全部**コピーする。

> ⚠️ 先頭・末尾に余分な空白や改行が入らないよう注意してください

### 4-2. 開発リポジトリの Secrets に登録する

1. ブラウザで以下の URL を開く：
   `https://github.com/madbarbarian/CommunityMerch-Fundraising-Platform/settings/secrets/actions`

2. **「New repository secret」** をクリック

3. 以下の通り入力する：

   | 項目 | 入力内容 |
   |------|---------|
   | Name | `RELEASE_REPO_DEPLOY_KEY` |
   | Secret | Step 4-1 でコピーした秘密鍵（`-----BEGIN...` から全部） |

4. **「Add secret」** をクリック

> ✅ シークレットが登録されます。これで準備は完了です

---

## Step 5: ワークフローのリポジトリ名を確認する

開発リポジトリの以下のファイルを確認してください：
`.github/workflows/sync-to-release.yml`

以下の行にリリースリポジトリの正しい URL が入っているか確認する：

```yaml
git clone git@github.com:madbarbarian/CommunityMerch-PF-release.git /tmp/release
```

リポジトリ名を変更した場合はこの行を修正し、コミット・プッシュしてください。

---

## Step 6: 初回の手動同期を実行する

1. ブラウザで以下の URL を開く：
   `https://github.com/madbarbarian/CommunityMerch-Fundraising-Platform/actions`

2. 左サイドバーの **「Sync to Release Repository」** をクリック

3. 右側に表示される **「Run workflow」** ボタンをクリック

4. Branch が `main` になっていることを確認して **「Run workflow」** をクリック

5. ページを更新すると実行中のジョブが表示される（⏳ 約 30 秒〜1 分）

### 実行結果の確認

| 表示 | 意味 |
|------|------|
| 🟢 緑のチェックマーク | 成功 |
| 🔴 赤の × マーク | 失敗（下のトラブルシューティングを参照） |

---

## Step 7: リリースリポジトリの内容を確認する

`https://github.com/madbarbarian/CommunityMerch-PF-release` を開いて、
以下のファイル・フォルダが存在することを確認する：

- ✅ `src/`
- ✅ `docs/2-setup/`
- ✅ `README.md`
- ✅ `.env`
- ✅ `vercel.json`
- ✅ `.env.local.sample`

> 🎉 これでセットアップ完了です！

---

## 今後の運用

### 開発リポジトリに変更をプッシュしたとき（自動）

GitHub Actions が自動的に起動し、リリースリポジトリへ同期します。手動操作は不要です。

```
開発リポジトリ（git push main）
    → GitHub Actions が自動起動（約 1 分）
    → リリースリポジトリへ差分だけ同期
    → 変更がなければ「No changes」で終了
```

確認方法: `https://github.com/madbarbarian/CommunityMerch-Fundraising-Platform/actions`

### ライセンシーへの案内手順

新しいライセンシーが加わったら、以下の順序で対応してください：

**1. リリースリポジトリの URL を共有する**

以下の URL をメール等でライセンシーに送る：
`https://github.com/madbarbarian/CommunityMerch-PF-release`

ライセンシーはこのページの **「Deploy with Vercel」** ボタンを押すと、
自分の GitHub アカウントに独立したリポジトリが自動的に作成され、Vercel にデプロイされます。
（ライセンシーは自分の GitHub アカウントを Vercel に連携する画面が表示されます）

**2. ライセンシーから GitHub リポジトリ URL を受け取る**

デプロイ完了後、ライセンシーにこの情報を送ってもらうよう依頼する：

| 情報 | 例 |
|------|-----|
| GitHub リポジトリ URL | `https://github.com/ライセンシー名/リポジトリ名` |
| Vercel アプリ URL（任意） | `https://xxx.vercel.app` |

受け取ったら手元のリストに記録しておく。将来のアップデート配布に必要。

### アップデートの仕組み（重要）

**Vercel の自動デプロイについて:**

Vercel はライセンシーの GitHub リポジトリを常に監視しています。
ライセンシーの GitHub リポジトリが更新されると、**Vercel が自動的に再デプロイ**します。
ライセンシーが Vercel の管理画面を操作する必要はありません。

```
ライセンシーの GitHub リポジトリが更新される
    → Vercel が自動検知（数秒以内）
    → 自動でビルド＆デプロイ（約 1〜2 分）
    → 新しいバージョンが公開される
```

**ただし「ライセンシーの GitHub リポジトリへの反映」は自動ではありません:**

Deploy ボタンで作成されたリポジトリはリリースリポジトリと独立しているため、
リリースリポジトリに更新があっても、ライセンシーのリポジトリには自動では届きません。

**アップデートをライセンシーに届ける方法（あなたが行う）:**

1. ライセンシーのリポジトリ URL（例: `github.com/licensee-name/their-repo`）を控えておく
2. アップデートをリリースしたら、各ライセンシーのリポジトリに対して Pull Request を作成する
   - ライセンシーのリポジトリを開く → 「Pull requests」→「New pull request」
   - 「compare across forks」→ head に `madbarbarian/CommunityMerch-PF-release` を指定
3. ライセンシーが Pull Request を「Merge」ボタンで承認する
4. Vercel が自動的に再デプロイする

> 💡 ライセンシーにとっての操作は GitHub 上で「Merge pull request」を押すだけです。
> git のコマンドや Vercel の操作は不要です。

---

## トラブルシューティング

### エラー「Permission denied (publickey)」

- Step 3 で **「Allow write access」** にチェックしたか確認する
- Step 4-1 でコピーした秘密鍵の先頭・末尾に余分な改行や空白が入っていないか確認する
- 秘密鍵の1行目が `-----BEGIN OPENSSH PRIVATE KEY-----` になっているか確認する

### エラー「Repository not found」

- Step 5 のワークフローファイルのリポジトリ名が正確か確認する
- Step 1 でリリースリポジトリが作成されているか確認する

### 同期後にリリースリポジトリが空になっている

- Step 3 で登録したのが「公開鍵（`.pub` ファイルの中身）」であることを確認する
- `cat ~/.ssh/release_deploy_key.pub` でもう一度中身を確認して登録し直す

### GitHub Actions が表示されない

`.github/workflows/sync-to-release.yml` がまだコミット・プッシュされていない可能性があります。
開発リポジトリのトップページで、`.github/` フォルダが存在するか確認してください。
