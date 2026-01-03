import { google, sheets_v4 } from "googleapis";

// Google Sheets API client
function getGoogleSheetsClient(): sheets_v4.Sheets {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  return google.sheets({ version: "v4", auth });
}

function getGoogleDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  return google.drive({ version: "v3", auth });
}

function extractSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input;
}

const tools = {
  list_spreadsheets: {
    description: "List all Google Spreadsheets accessible by the service account",
    parameters: {},
    handler: async () => {
      const drive = getGoogleDriveClient();
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: "files(id, name, modifiedTime, webViewLink)",
        pageSize: 50,
        orderBy: "modifiedTime desc",
      });
      return response.data.files || [];
    }
  },
  get_spreadsheet_info: {
    description: "Get metadata and sheet names for a spreadsheet",
    parameters: { spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" } },
    handler: async (args: { spreadsheet_id: string }) => {
      const sheets = getGoogleSheetsClient();
      const id = extractSpreadsheetId(args.spreadsheet_id);
      const response = await sheets.spreadsheets.get({
        spreadsheetId: id,
        fields: "properties,sheets.properties",
      });
      return response.data;
    }
  },
  read_range: {
    description: "Read data from a specific range in a spreadsheet",
    parameters: {
      spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
      range: { type: "string", description: "A1 notation range (e.g., 'Sheet1!A1:D10')" }
    },
    handler: async (args: { spreadsheet_id: string; range: string }) => {
      const sheets = getGoogleSheetsClient();
      const id = extractSpreadsheetId(args.spreadsheet_id);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: args.range,
      });
      return response.data.values || [];
    }
  },
  write_range: {
    description: "Write data to a specific range in a spreadsheet",
    parameters: {
      spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
      range: { type: "string", description: "A1 notation range (e.g., 'Sheet1!A1')" },
      values: { type: "array", description: "2D array of values to write" }
    },
    handler: async (args: { spreadsheet_id: string; range: string; values: unknown[][] }) => {
      const sheets = getGoogleSheetsClient();
      const id = extractSpreadsheetId(args.spreadsheet_id);
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: id,
        range: args.range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: args.values },
      });
      return { updatedCells: response.data.updatedCells, updatedRange: response.data.updatedRange };
    }
  },
  append_data: {
    description: "Append rows to the end of a sheet",
    parameters: {
      spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
      range: { type: "string", description: "Sheet name or A1 range to append to" },
      values: { type: "array", description: "2D array of rows to append" }
    },
    handler: async (args: { spreadsheet_id: string; range: string; values: unknown[][] }) => {
      const sheets = getGoogleSheetsClient();
      const id = extractSpreadsheetId(args.spreadsheet_id);
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: id,
        range: args.range,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: args.values },
      });
      return { updatedRows: response.data.updates?.updatedRows, tableRange: response.data.tableRange };
    }
  },
  clear_range: {
    description: "Clear data from a specific range",
    parameters: {
      spreadsheet_id: { type: "string", description: "Spreadsheet ID or URL" },
      range: { type: "string", description: "A1 notation range to clear" }
    },
    handler: async (args: { spreadsheet_id: string; range: string }) => {
      const sheets = getGoogleSheetsClient();
      const id = extractSpreadsheetId(args.spreadsheet_id);
      await sheets.spreadsheets.values.clear({ spreadsheetId: id, range: args.range });
      return { cleared: args.range };
    }
  },
  create_spreadsheet: {
    description: "Create a new Google Spreadsheet",
    parameters: {
      title: { type: "string", description: "Title for the new spreadsheet" },
      sheet_titles: { type: "array", description: "Optional list of sheet names to create" }
    },
    handler: async (args: { title: string; sheet_titles?: string[] }) => {
      const sheets = getGoogleSheetsClient();
      const requestBody: sheets_v4.Schema$Spreadsheet = { properties: { title: args.title } };
      if (args.sheet_titles?.length) {
        requestBody.sheets = args.sheet_titles.map(t => ({ properties: { title: t } }));
      }
      const response = await sheets.spreadsheets.create({ requestBody });
      return {
        spreadsheetId: response.data.spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl,
        sheets: response.data.sheets?.map(s => s.properties?.title)
      };
    }
  }
};

type ToolName = keyof typeof tools;

export default async function handler(req: { method: string; body: unknown }, res: {
  status: (code: number) => { json: (data: unknown) => void };
  setHeader: (name: string, value: string) => void;
}) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  if (req.method === "GET") {
    // Return available tools
    const toolList = Object.entries(tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      parameters: tool.parameters
    }));
    return res.status(200).json({ tools: toolList });
  }

  if (req.method === "POST") {
    const body = req.body as { tool?: string; arguments?: Record<string, unknown> };
    const toolName = body.tool as ToolName;
    const args = body.arguments || {};

    if (!toolName || !tools[toolName]) {
      return res.status(400).json({ error: `Unknown tool: ${toolName}` });
    }

    try {
      const result = await tools[toolName].handler(args as never);
      return res.status(200).json({ result });
    } catch (error) {
      return res.status(500).json({ error: String(error) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
