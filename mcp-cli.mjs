#!/usr/bin/env node
/**
 * Google Sheets MCP CLI
 * デプロイ済みMCPサーバーを使ってスプレッドシートを操作
 *
 * 使い方:
 *   node mcp-cli.mjs <command> [options]
 *
 * コマンド:
 *   list                              - アクセス可能なスプレッドシート一覧
 *   info <spreadsheet_id>             - スプレッドシート情報を取得
 *   read <spreadsheet_id> <range>     - データを読み取り
 *   duplicate <spreadsheet_id>        - 1枚目のシートを複製
 *   duplicate <spreadsheet_id> <sheet_id> [new_title] - 指定シートを複製
 */

const MCP_URL = process.env.MCP_URL || "https://google-sheets-mcp-rho.vercel.app/api/mcp";

async function callMCP(toolName, args = {}) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args }
    })
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message || JSON.stringify(result.error));
  }
  return JSON.parse(result.result.content[0].text);
}

function extractSpreadsheetId(input) {
  const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input;
}

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command) {
    console.log(`
Google Sheets MCP CLI

使い方:
  node mcp-cli.mjs <command> [options]

コマンド:
  list                                    アクセス可能なスプレッドシート一覧
  info <spreadsheet_id|url>               スプレッドシート情報を取得
  read <spreadsheet_id|url> <range>       データを読み取り (例: "Sheet1!A1:D10")
  duplicate <spreadsheet_id|url>          1枚目のシートを複製
  duplicate <spreadsheet_id|url> <sheet_id> [new_title]  指定シートを複製

例:
  node mcp-cli.mjs list
  node mcp-cli.mjs info 1hHQypCoXxPJcIpuWede9pbA_TouSxF6JWSUOPk6uw3A
  node mcp-cli.mjs info "https://docs.google.com/spreadsheets/d/1hHQ.../edit"
  node mcp-cli.mjs read 1hHQyp... "📊サマリー!A1:D10"
  node mcp-cli.mjs duplicate 1hHQyp...
`);
    process.exit(0);
  }

  try {
    switch (command) {
      case "list": {
        console.log("スプレッドシート一覧を取得中...");
        const result = await callMCP("list_spreadsheets");
        const spreadsheets = Array.isArray(result) ? result : (result.spreadsheets || []);
        console.log("\nアクセス可能なスプレッドシート:");
        if (spreadsheets.length === 0) {
          console.log("  (なし - Service Accountにスプレッドシートを共有してください)");
        } else {
          spreadsheets.forEach(s => {
            console.log(`  - ${s.name}`);
            console.log(`    ID: ${s.id}`);
          });
        }
        break;
      }

      case "info": {
        const spreadsheetId = extractSpreadsheetId(args[0]);
        if (!spreadsheetId) {
          console.error("エラー: spreadsheet_id を指定してください");
          process.exit(1);
        }
        console.log("スプレッドシート情報を取得中...");
        const result = await callMCP("get_spreadsheet_info", { spreadsheet_id: spreadsheetId });
        console.log(`\nタイトル: ${result.properties.title}`);
        console.log(`ロケール: ${result.properties.locale}`);
        console.log(`タイムゾーン: ${result.properties.timeZone}`);
        console.log("\nシート:");
        result.sheets.forEach(s => {
          console.log(`  [${s.properties.index}] ${s.properties.title} (ID: ${s.properties.sheetId})`);
        });
        break;
      }

      case "read": {
        const spreadsheetId = extractSpreadsheetId(args[0]);
        const range = args[1];
        if (!spreadsheetId || !range) {
          console.error("エラー: spreadsheet_id と range を指定してください");
          process.exit(1);
        }
        console.log(`データを読み取り中: ${range}`);
        const result = await callMCP("read_range", { spreadsheet_id: spreadsheetId, range });
        console.log("\nデータ:");
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case "duplicate": {
        const spreadsheetId = extractSpreadsheetId(args[0]);
        if (!spreadsheetId) {
          console.error("エラー: spreadsheet_id を指定してください");
          process.exit(1);
        }

        let sheetId = args[1] ? parseInt(args[1]) : null;
        let newTitle = args[2];

        // sheet_idが指定されていない場合、1枚目のシートを取得
        if (sheetId === null) {
          console.log("スプレッドシート情報を取得中...");
          const info = await callMCP("get_spreadsheet_info", { spreadsheet_id: spreadsheetId });
          const firstSheet = info.sheets[0];
          sheetId = firstSheet.properties.sheetId;
          console.log(`1枚目のシート: ${firstSheet.properties.title} (ID: ${sheetId})`);
        }

        console.log("シートを複製中...");
        const duplicateArgs = { spreadsheet_id: spreadsheetId, sheet_id: sheetId };
        if (newTitle) duplicateArgs.new_title = newTitle;

        const result = await callMCP("duplicate_sheet", duplicateArgs);
        console.log("\n複製完了!");
        console.log(`  新しいシート: ${result.title}`);
        console.log(`  シートID: ${result.sheetId}`);
        console.log(`  位置: ${result.index}`);
        break;
      }

      default:
        console.error(`不明なコマンド: ${command}`);
        console.error("node mcp-cli.mjs --help でヘルプを表示");
        process.exit(1);
    }
  } catch (error) {
    console.error("エラー:", error.message);
    process.exit(1);
  }
}

main();
