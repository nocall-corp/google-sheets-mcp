# Google Sheets MCP Server (Vercel)

Vercelでホストする Google Sheets MCP サーバー

## セットアップ手順

### 1. Google Cloud Console で Service Account を作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成または選択
3. **APIs & Services > Library** から以下を有効化:
   - Google Sheets API
   - Google Drive API
4. **IAM & Admin > Service Accounts** で新規作成
5. **Keys** タブから JSON キーをダウンロード

### 2. スプレッドシートの共有設定

アクセスしたいスプレッドシートを、Service Account のメールアドレス（`xxx@xxx.iam.gserviceaccount.com`）に共有

### 3. Vercel にデプロイ

```bash
cd 4_MCPツール/google-sheets-mcp

# 依存関係インストール
npm install

# Vercel にデプロイ
npx vercel

# 環境変数を設定（Vercel Dashboard または CLI）
npx vercel env add GOOGLE_SERVICE_ACCOUNT_KEY

# 本番デプロイ
npx vercel --prod
```

### 4. Claude Code で使用

`~/.claude.json` に追加:

```json
{
  "mcpServers": {
    "google-sheets": {
      "type": "url",
      "url": "https://your-project.vercel.app/mcp"
    }
  }
}
```

## 利用可能なツール

| ツール | 説明 |
|--------|------|
| `list_spreadsheets` | アクセス可能なスプレッドシート一覧 |
| `get_spreadsheet_info` | スプレッドシートのメタデータ取得 |
| `read_range` | 指定範囲のデータ読み取り |
| `write_range` | 指定範囲にデータ書き込み |
| `append_data` | シート末尾に行を追加 |
| `clear_range` | 指定範囲をクリア |
| `create_spreadsheet` | 新規スプレッドシート作成 |
| `batch_update` | バッチ更新（書式設定等） |

## 使用例

```
# データ読み取り
read_range("1U9FvtwSSp8Qa360e--hJqqpznzRKV9chc62p9H1OY-o", "Sheet1!A1:Z100")

# データ書き込み
write_range("spreadsheet_id", "Sheet1!A1", [["Name", "Value"], ["Test", 123]])
```

## エンドポイント

- **SSE/HTTP**: `https://your-project.vercel.app/mcp`
