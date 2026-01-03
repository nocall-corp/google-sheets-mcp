import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
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

// Extract spreadsheet ID from URL or return as-is
function extractSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input;
}

const handler = createMcpHandler(
  (server) => {
    // Tool: List spreadsheets
    server.tool(
      "list_spreadsheets",
      "List all Google Spreadsheets accessible by the service account",
      {},
      async () => {
        try {
          const drive = getGoogleDriveClient();
          const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            fields: "files(id, name, modifiedTime, webViewLink)",
            pageSize: 50,
            orderBy: "modifiedTime desc",
          });

          const files = response.data.files || [];
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(files, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Get spreadsheet info
    server.tool(
      "get_spreadsheet_info",
      "Get metadata and sheet names for a spreadsheet",
      {
        spreadsheet_id: z.string().describe("Spreadsheet ID or URL"),
      },
      async ({ spreadsheet_id }: { spreadsheet_id: string }) => {
        try {
          const sheets = getGoogleSheetsClient();
          const id = extractSpreadsheetId(spreadsheet_id);

          const response = await sheets.spreadsheets.get({
            spreadsheetId: id,
            fields: "properties,sheets.properties",
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Read range
    server.tool(
      "read_range",
      "Read data from a specific range in a spreadsheet",
      {
        spreadsheet_id: z.string().describe("Spreadsheet ID or URL"),
        range: z.string().describe("A1 notation range (e.g., 'Sheet1!A1:D10')"),
      },
      async ({ spreadsheet_id, range }: { spreadsheet_id: string; range: string }) => {
        try {
          const sheets = getGoogleSheetsClient();
          const id = extractSpreadsheetId(spreadsheet_id);

          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: id,
            range,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data.values || [], null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Write range
    server.tool(
      "write_range",
      "Write data to a specific range in a spreadsheet",
      {
        spreadsheet_id: z.string().describe("Spreadsheet ID or URL"),
        range: z.string().describe("A1 notation range (e.g., 'Sheet1!A1')"),
        values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe("2D array of values to write"),
      },
      async ({ spreadsheet_id, range, values }: { spreadsheet_id: string; range: string; values: (string | number | boolean | null)[][] }) => {
        try {
          const sheets = getGoogleSheetsClient();
          const id = extractSpreadsheetId(spreadsheet_id);

          const response = await sheets.spreadsheets.values.update({
            spreadsheetId: id,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: { values },
          });

          return {
            content: [
              {
                type: "text",
                text: `Updated ${response.data.updatedCells} cells in ${response.data.updatedRange}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Append data
    server.tool(
      "append_data",
      "Append rows to the end of a sheet",
      {
        spreadsheet_id: z.string().describe("Spreadsheet ID or URL"),
        range: z.string().describe("Sheet name or A1 range to append to (e.g., 'Sheet1')"),
        values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe("2D array of rows to append"),
      },
      async ({ spreadsheet_id, range, values }: { spreadsheet_id: string; range: string; values: (string | number | boolean | null)[][] }) => {
        try {
          const sheets = getGoogleSheetsClient();
          const id = extractSpreadsheetId(spreadsheet_id);

          const response = await sheets.spreadsheets.values.append({
            spreadsheetId: id,
            range,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values },
          });

          return {
            content: [
              {
                type: "text",
                text: `Appended ${response.data.updates?.updatedRows} rows to ${response.data.tableRange}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Clear range
    server.tool(
      "clear_range",
      "Clear data from a specific range",
      {
        spreadsheet_id: z.string().describe("Spreadsheet ID or URL"),
        range: z.string().describe("A1 notation range to clear (e.g., 'Sheet1!A1:D10')"),
      },
      async ({ spreadsheet_id, range }: { spreadsheet_id: string; range: string }) => {
        try {
          const sheets = getGoogleSheetsClient();
          const id = extractSpreadsheetId(spreadsheet_id);

          await sheets.spreadsheets.values.clear({
            spreadsheetId: id,
            range,
          });

          return {
            content: [
              {
                type: "text",
                text: `Cleared range: ${range}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Create spreadsheet
    server.tool(
      "create_spreadsheet",
      "Create a new Google Spreadsheet",
      {
        title: z.string().describe("Title for the new spreadsheet"),
        sheet_titles: z.array(z.string()).optional().describe("Optional list of sheet names to create"),
      },
      async ({ title, sheet_titles }: { title: string; sheet_titles?: string[] }) => {
        try {
          const sheets = getGoogleSheetsClient();

          const requestBody: sheets_v4.Schema$Spreadsheet = {
            properties: { title },
          };

          if (sheet_titles && sheet_titles.length > 0) {
            requestBody.sheets = sheet_titles.map((sheetTitle: string) => ({
              properties: { title: sheetTitle },
            }));
          }

          const response = await sheets.spreadsheets.create({
            requestBody,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  spreadsheetId: response.data.spreadsheetId,
                  spreadsheetUrl: response.data.spreadsheetUrl,
                  sheets: response.data.sheets?.map(s => s.properties?.title),
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true,
          };
        }
      }
    );

    // Tool: Batch update (for formatting, etc.)
    server.tool(
      "batch_update",
      "Perform batch updates (formatting, merging cells, etc.)",
      {
        spreadsheet_id: z.string().describe("Spreadsheet ID or URL"),
        requests: z.array(z.record(z.any())).describe("Array of update requests"),
      },
      async ({ spreadsheet_id, requests }: { spreadsheet_id: string; requests: Record<string, unknown>[] }) => {
        try {
          const sheets = getGoogleSheetsClient();
          const id = extractSpreadsheetId(spreadsheet_id);

          const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: id,
            requestBody: { requests },
          });

          return {
            content: [
              {
                type: "text",
                text: `Batch update completed. ${response.data.replies?.length || 0} operations executed.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${error}` }],
            isError: true,
          };
        }
      }
    );
  },
  {},
  {
    basePath: "/api",
  }
);

export { handler as GET, handler as POST };
