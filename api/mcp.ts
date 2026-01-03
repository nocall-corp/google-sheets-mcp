import { google, sheets_v4 } from "googleapis";

// Google Sheets API client
function getGoogleSheetsClient(): sheets_v4.Sheets {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function getGoogleDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

function extractSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input;
}

// MCP Tool definitions
const toolDefinitions = [
  {
    name: "list_spreadsheets",
    description: "List all Google Spreadsheets accessible by the service account",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_spreadsheet_info",
    description: "Get metadata and sheet names for a spreadsheet",
    inputSchema: {
      type: "object",
      properties: { spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" } },
      required: ["spreadsheet_id"]
    }
  },
  {
    name: "read_range",
    description: "Read data from a specific range in a spreadsheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
        range: { type: "string", description: "A1 notation range (e.g., 'Sheet1!A1:D10')" }
      },
      required: ["spreadsheet_id", "range"]
    }
  },
  {
    name: "write_range",
    description: "Write data to a specific range in a spreadsheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
        range: { type: "string", description: "A1 notation range (e.g., 'Sheet1!A1')" },
        values: { type: "array", description: "2D array of values to write" }
      },
      required: ["spreadsheet_id", "range", "values"]
    }
  },
  {
    name: "append_data",
    description: "Append rows to the end of a sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
        range: { type: "string", description: "Sheet name or A1 range to append to" },
        values: { type: "array", description: "2D array of rows to append" }
      },
      required: ["spreadsheet_id", "range", "values"]
    }
  },
  {
    name: "clear_range",
    description: "Clear data from a specific range",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
        range: { type: "string", description: "A1 notation range to clear" }
      },
      required: ["spreadsheet_id", "range"]
    }
  },
  {
    name: "create_spreadsheet",
    description: "Create a new Google Spreadsheet",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title for the new spreadsheet" },
        sheet_titles: { type: "array", items: { type: "string" }, description: "Optional list of sheet names" }
      },
      required: ["title"]
    }
  },
  {
    name: "add_sheet",
    description: "Add a new sheet to a spreadsheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
        title: { type: "string", description: "Name for the new sheet" },
        index: { type: "number", description: "Optional position (0-based index)" }
      },
      required: ["spreadsheet_id", "title"]
    }
  },
  {
    name: "duplicate_sheet",
    description: "Duplicate/copy an existing sheet within a spreadsheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
        sheet_id: { type: "number", description: "Source sheet ID (get from get_spreadsheet_info)" },
        new_title: { type: "string", description: "Name for the duplicated sheet (optional)" },
        insert_index: { type: "number", description: "Position for the new sheet (optional)" }
      },
      required: ["spreadsheet_id", "sheet_id"]
    }
  }
];

// Tool handlers
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  const sheets = getGoogleSheetsClient();
  const drive = getGoogleDriveClient();

  switch (name) {
    case "list_spreadsheets": {
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: "files(id, name, modifiedTime, webViewLink)",
        pageSize: 50,
        orderBy: "modifiedTime desc",
      });
      return response.data.files || [];
    }
    case "get_spreadsheet_info": {
      const id = extractSpreadsheetId(args.spreadsheet_id as string);
      const response = await sheets.spreadsheets.get({
        spreadsheetId: id,
        fields: "properties,sheets.properties",
      });
      return response.data;
    }
    case "read_range": {
      const id = extractSpreadsheetId(args.spreadsheet_id as string);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: args.range as string,
      });
      return response.data.values || [];
    }
    case "write_range": {
      const id = extractSpreadsheetId(args.spreadsheet_id as string);
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: id,
        range: args.range as string,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: args.values as unknown[][] },
      });
      return { updatedCells: response.data.updatedCells, updatedRange: response.data.updatedRange };
    }
    case "append_data": {
      const id = extractSpreadsheetId(args.spreadsheet_id as string);
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: id,
        range: args.range as string,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: args.values as unknown[][] },
      });
      return { updatedRows: response.data.updates?.updatedRows, tableRange: response.data.tableRange };
    }
    case "clear_range": {
      const id = extractSpreadsheetId(args.spreadsheet_id as string);
      await sheets.spreadsheets.values.clear({ spreadsheetId: id, range: args.range as string });
      return { cleared: args.range };
    }
    case "create_spreadsheet": {
      const requestBody: sheets_v4.Schema$Spreadsheet = { properties: { title: args.title as string } };
      if (args.sheet_titles && (args.sheet_titles as string[]).length > 0) {
        requestBody.sheets = (args.sheet_titles as string[]).map(t => ({ properties: { title: t } }));
      }
      const response = await sheets.spreadsheets.create({ requestBody });
      return {
        spreadsheetId: response.data.spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl,
        sheets: response.data.sheets?.map(s => s.properties?.title)
      };
    }
    case "add_sheet": {
      const id = extractSpreadsheetId(args.spreadsheet_id as string);
      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: args.title as string,
                index: args.index as number | undefined
              }
            }
          }]
        }
      });
      const props = response.data.replies?.[0]?.addSheet?.properties;
      return { sheetId: props?.sheetId, title: props?.title, index: props?.index };
    }
    case "duplicate_sheet": {
      const id = extractSpreadsheetId(args.spreadsheet_id as string);
      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: {
          requests: [{
            duplicateSheet: {
              sourceSheetId: args.sheet_id as number,
              newSheetName: args.new_title as string | undefined,
              insertSheetIndex: args.insert_index as number | undefined
            }
          }]
        }
      });
      const props = response.data.replies?.[0]?.duplicateSheet?.properties;
      return { sheetId: props?.sheetId, title: props?.title, index: props?.index };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// MCP JSON-RPC handler
interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

function createResponse(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function createError(id: number | string | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export default async function handler(
  req: { method: string; body: unknown },
  res: { status: (code: number) => { json: (data: unknown) => void; end: () => void }; setHeader: (name: string, value: string) => void }
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json(createError(null, -32600, "Method not allowed"));
  }

  const request = req.body as JsonRpcRequest;

  if (!request.jsonrpc || request.jsonrpc !== "2.0") {
    return res.status(400).json(createError(request?.id ?? null, -32600, "Invalid JSON-RPC version"));
  }

  try {
    switch (request.method) {
      case "initialize":
        return res.status(200).json(createResponse(request.id, {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "google-sheets-mcp", version: "1.0.0" },
          capabilities: { tools: {} }
        }));

      case "notifications/initialized":
        return res.status(200).json(createResponse(request.id, {}));

      case "tools/list":
        return res.status(200).json(createResponse(request.id, { tools: toolDefinitions }));

      case "tools/call": {
        const params = request.params as { name: string; arguments?: Record<string, unknown> };
        if (!params?.name) {
          return res.status(400).json(createError(request.id, -32602, "Missing tool name"));
        }
        try {
          const result = await handleToolCall(params.name, params.arguments || {});
          return res.status(200).json(createResponse(request.id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
          }));
        } catch (error) {
          return res.status(200).json(createResponse(request.id, {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true
          }));
        }
      }

      default:
        return res.status(400).json(createError(request.id, -32601, `Method not found: ${request.method}`));
    }
  } catch (error) {
    return res.status(500).json(createError(request.id, -32603, `Internal error: ${error}`));
  }
}
