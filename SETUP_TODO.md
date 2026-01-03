# Google Sheets MCP Server - 残タスク

## 完了済み

- [x] プロジェクト作成 (`~/google-sheets-mcp/`)
- [x] MCPサーバー実装 (`api/mcp.ts`)
- [x] Vercelデプロイ (https://google-sheets-mcp-rho.vercel.app)
- [x] GitHub連携 (https://github.com/nocall-corp/google-sheets-mcp)
- [x] 自動デプロイ設定

---

## 残タスク

### 1. Google Cloud プロジェクト作成

1. https://console.cloud.google.com/projectcreate にアクセス
2. プロジェクト名を入力（例: `nocall-mcp`）
3. 「作成」をクリック

### 2. API 有効化

以下の2つのAPIを有効化:

- **Google Sheets API**: https://console.cloud.google.com/apis/library/sheets.googleapis.com
- **Google Drive API**: https://console.cloud.google.com/apis/library/drive.googleapis.com

各ページで「有効にする」をクリック

### 3. Service Account 作成

1. https://console.cloud.google.com/iam-admin/serviceaccounts/create にアクセス
2. 以下を入力:
   - サービスアカウント名: `sheets-mcp`
   - 説明: `MCP Server for Google Sheets`
3. 「作成して続行」→「完了」

### 4. JSON キー作成

1. 作成したService Accountをクリック
2. 「キー」タブ → 「鍵を追加」→「新しい鍵を作成」
3. 「JSON」を選択 → 「作成」
4. JSONファイルがダウンロードされる

### 5. Vercel 環境変数設定

```bash
# ダウンロードしたJSONファイルの内容を設定
npx vercel env add GOOGLE_SERVICE_ACCOUNT_KEY production --token WxD84H9L2r5KAqCEjeKBEgqG
```

または Vercel Dashboard から設定:
https://vercel.com/nocall-projects/google-sheets-mcp/settings/environment-variables

### 6. スプレッドシートの共有設定

アクセスしたいスプレッドシートを Service Account のメールアドレスに共有:
- メールアドレス: `sheets-mcp@YOUR_PROJECT.iam.gserviceaccount.com`
- 権限: 編集者

### 7. 再デプロイ

環境変数設定後、再デプロイが必要:

```bash
cd ~/google-sheets-mcp
npx vercel --prod --yes --token WxD84H9L2r5KAqCEjeKBEgqG
```

### 8. Claude Code に MCP 登録

`~/.claude.json` に追加:

```json
{
  "mcpServers": {
    "google-sheets": {
      "type": "url",
      "url": "https://google-sheets-mcp-rho.vercel.app/api/mcp"
    }
  }
}
```

---

## 動作確認

設定完了後、以下のツールが使用可能:

| ツール | 機能 |
|--------|------|
| `list_spreadsheets` | スプレッドシート一覧 |
| `get_spreadsheet_info` | メタデータ取得 |
| `read_range` | データ読み取り |
| `write_range` | データ書き込み |
| `append_data` | 行追加 |
| `clear_range` | 範囲クリア |
| `create_spreadsheet` | 新規作成 |
| `batch_update` | 書式設定等 |

---

## 参考URL

- GitHub: https://github.com/nocall-corp/google-sheets-mcp
- Vercel: https://google-sheets-mcp-rho.vercel.app
- MCP Endpoint: https://google-sheets-mcp-rho.vercel.app/api/mcp
