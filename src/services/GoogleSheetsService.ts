import { JobData } from '../types/JobData';

export interface SheetsConfig {
  spreadsheetId: string;
  sheetName: string;
}

export class GoogleSheetsService {
  private static readonly SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
  private static readonly DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

  static async initialize(): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      return !!token;
    } catch (error) {
      console.error('Failed to initialize Google Sheets service:', error);
      return false;
    }
  }

  static async appendJobData(data: JobData, config: SheetsConfig): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const values = [
        [
          data.companyName,
          data.applicationStatus,
          data.role,
          data.salary,
          data.dateSubmitted,
          data.linkToJobReq,
          data.rejectionReason,
          data.notes
        ]
      ];

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.sheetName}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values,
            majorDimension: 'ROWS'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Sheets API error: ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('Successfully added job to spreadsheet:', result);
      return true;

    } catch (error) {
      console.error('Failed to save to Google Sheets:', error);
      throw error;
    }
  }

  static async createSpreadsheetHeaders(config: SheetsConfig): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const headers = [
        'Company Name',
        'Application Status',
        'Role',
        'Salary',
        'Date Submitted',
        'Link to Job Req',
        'Rejection Reason',
        'Notes'
      ];

      const checkResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.sheetName}!A1:H1`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (checkResponse.ok) {
        const data = await checkResponse.json();
        if (data.values && data.values.length > 0) {
          console.log('Headers already exist in spreadsheet');
          return true;
        }
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.sheetName}!A1:H1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [headers],
            majorDimension: 'ROWS'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create headers: ${errorData.error?.message || response.statusText}`);
      }

      await this.formatHeaders(config, token);
      return true;

    } catch (error) {
      console.error('Failed to create spreadsheet headers:', error);
      throw error;
    }
  }

  private static async formatHeaders(config: SheetsConfig, token: string): Promise<void> {
    try {
      const requests = [
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 8
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.6, blue: 1.0 },
                textFormat: {
                  foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                  bold: true
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        }
      ];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests })
        }
      );
    } catch (error) {
      console.warn('Failed to format headers:', error);
    }
  }

  static async getAuthToken(): Promise<string | null> {
    try {
      return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(token || null);
          }
        });
      });
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  static async revokeAuthToken(): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) return true;

      return new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          resolve(true);
        });
      });
    } catch (error) {
      console.error('Failed to revoke auth token:', error);
      return false;
    }
  }

  static async testConnection(config: SheetsConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, error: 'No authentication token' };
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || 'Failed to access spreadsheet'
        };
      }

      const spreadsheetData = await response.json();
      const sheetExists = spreadsheetData.sheets?.some(
        (sheet: any) => sheet.properties.title === config.sheetName
      );

      if (!sheetExists) {
        return {
          success: false,
          error: `Sheet "${config.sheetName}" not found in spreadsheet`
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async getDuplicateJobs(config: SheetsConfig, jobUrl: string): Promise<number> {
    try {
      const token = await this.getAuthToken();
      if (!token) return 0;

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.sheetName}!F:F`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) return 0;

      const data = await response.json();
      if (!data.values) return 0;

      return data.values.filter((row: string[]) =>
        row[0] && row[0].trim() === jobUrl.trim()
      ).length;

    } catch (error) {
      console.error('Failed to check for duplicates:', error);
      return 0;
    }
  }
}