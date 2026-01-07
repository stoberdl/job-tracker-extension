import { JobData } from '../types/JobData';

export interface SheetsConfig {
  spreadsheetId: string;
  sheetName: string;
}

export interface ServiceAccountConfig {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export class GoogleSheetsService {
  private static readonly SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
  private static accessToken: string | null = null;
  private static tokenExpiry: number = 0;

  static async initialize(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      return !!token;
    } catch (error) {
      console.error('Failed to initialize Google Sheets service:', error);
      return false;
    }
  }

  static async appendJobData(data: JobData, config: SheetsConfig): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
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
      const token = await this.getAccessToken();
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
        // Format header row
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
        },
        // Data validation for Application Status column (column B)
        {
          setDataValidation: {
            range: {
              sheetId: 0,
              startRowIndex: 1,
              startColumnIndex: 1,
              endColumnIndex: 2
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'Have Not Applied' },
                  { userEnteredValue: 'Submitted - Pending Response' },
                  { userEnteredValue: 'Rejected' },
                  { userEnteredValue: 'Interviewing' },
                  { userEnteredValue: 'Offer Extended - In Progress' },
                  { userEnteredValue: 'Job Rec Removed/Deleted' },
                  { userEnteredValue: 'Ghosted' },
                  { userEnteredValue: 'Offer Extended - Did Not Accept' },
                  { userEnteredValue: 'Re-Applied With Updates' },
                  { userEnteredValue: 'Rescinded Application' },
                  { userEnteredValue: 'Not For Me' },
                  { userEnteredValue: 'Sent Follow Up Email' },
                  { userEnteredValue: 'N/A' }
                ]
              },
              showCustomUi: true,
              strict: true
            }
          }
        },
        // Data validation for Rejection Reason column (column G)
        {
          setDataValidation: {
            range: {
              sheetId: 0,
              startRowIndex: 1,
              startColumnIndex: 6,
              endColumnIndex: 7
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'Filled - Internal' },
                  { userEnteredValue: 'Generic "Not A Good Fit"' },
                  { userEnteredValue: 'No New Applicants' },
                  { userEnteredValue: 'Eliminated Role' },
                  { userEnteredValue: 'Changed Job Scope' },
                  { userEnteredValue: 'Applied Too Late' },
                  { userEnteredValue: 'Auto-Reject: No Feedback' },
                  { userEnteredValue: '1st Round Rejection' },
                  { userEnteredValue: 'Middle Round Rejection' },
                  { userEnteredValue: 'N/A' },
                  { userEnteredValue: 'Final Round Rejection' },
                  { userEnteredValue: 'No Response: Sent Email' },
                  { userEnteredValue: 'Post-Interview Follow-up' }
                ]
              },
              showCustomUi: true,
              strict: true
            }
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

      // Apply conditional formatting for colors
      await this.applyConditionalFormatting(config, token);
    } catch (error) {
      console.warn('Failed to format headers:', error);
    }
  }

  private static async applyConditionalFormatting(config: SheetsConfig, token: string): Promise<void> {
    try {
      const applicationStatusColors = {
        'Have Not Applied': { red: 0.85, green: 0.85, blue: 0.85 }, // Light Gray
        'Submitted - Pending Response': { red: 1.0, green: 1.0, blue: 0.0 }, // Yellow
        'Rejected': { red: 1.0, green: 0.0, blue: 0.0 }, // Red
        'Interviewing': { red: 0.56, green: 0.93, blue: 0.56 }, // Light Green
        'Offer Extended - In Progress': { red: 1.0, green: 0.85, blue: 0.7 }, // Peach
        'Job Rec Removed/Deleted': { red: 0.5, green: 0.0, blue: 0.5 }, // Purple
        'Ghosted': { red: 0.0, green: 0.0, blue: 1.0 }, // Blue
        'Offer Extended - Did Not Accept': { red: 0.0, green: 0.5, blue: 0.5 }, // Dark Teal
        'Re-Applied With Updates': { red: 0.68, green: 0.85, blue: 0.9 }, // Light Blue
        'Rescinded Application': { red: 1.0, green: 0.65, blue: 0.0 }, // Orange
        'Not For Me': { red: 1.0, green: 0.75, blue: 0.8 }, // Pink
        'Sent Follow Up Email': { red: 0.0, green: 0.5, blue: 0.0 }, // Green
        'N/A': { red: 0.0, green: 0.0, blue: 0.0 } // Black
      };

      const rejectionReasonColors = {
        'Filled - Internal': { red: 0.8, green: 0.6, blue: 0.8 }, // Light Purple
        'Generic "Not A Good Fit"': { red: 0.96, green: 0.87, blue: 0.7 }, // Beige
        'No New Applicants': { red: 0.65, green: 0.16, blue: 0.16 }, // Brown
        'Eliminated Role': { red: 1.0, green: 0.0, blue: 0.0 }, // Red
        'Changed Job Scope': { red: 1.0, green: 0.85, blue: 0.7 }, // Peach
        'Applied Too Late': { red: 1.0, green: 1.0, blue: 0.0 }, // Yellow
        'Auto-Reject: No Feedback': { red: 0.5, green: 0.5, blue: 0.5 }, // Gray
        '1st Round Rejection': { red: 0.85, green: 0.85, blue: 0.85 }, // Light Gray
        'Middle Round Rejection': { red: 0.0, green: 0.5, blue: 0.5 }, // Teal
        'N/A': { red: 0.0, green: 0.0, blue: 0.0 }, // Black
        'Final Round Rejection': { red: 0.0, green: 0.39, blue: 0.39 }, // Dark Teal
        'No Response: Sent Email': { red: 0.0, green: 0.39, blue: 0.39 }, // Dark Teal
        'Post-Interview Follow-up': { red: 1.0, green: 0.0, blue: 0.0 } // Red
      };

      const conditionalFormattingRequests: any[] = [];

      // Application Status conditional formatting
      Object.entries(applicationStatusColors).forEach(([status, color]) => {
        conditionalFormattingRequests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: 0,
                startRowIndex: 1,
                startColumnIndex: 1,
                endColumnIndex: 2
              }],
              booleanRule: {
                condition: {
                  type: 'TEXT_EQ',
                  values: [{ userEnteredValue: status }]
                },
                format: {
                  backgroundColor: color
                }
              }
            },
            index: 0
          }
        });
      });

      // Rejection Reason conditional formatting
      Object.entries(rejectionReasonColors).forEach(([reason, color]) => {
        conditionalFormattingRequests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: 0,
                startRowIndex: 1,
                startColumnIndex: 6,
                endColumnIndex: 7
              }],
              booleanRule: {
                condition: {
                  type: 'TEXT_EQ',
                  values: [{ userEnteredValue: reason }]
                },
                format: {
                  backgroundColor: color
                }
              }
            },
            index: 0
          }
        });
      });

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests: conditionalFormattingRequests })
        }
      );
    } catch (error) {
      console.warn('Failed to apply conditional formatting:', error);
    }
  }

  static async getAccessToken(): Promise<string | null> {
    try {
      // Check if we have a valid cached token
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Get service account config from storage
      const serviceAccountConfig = await this.getServiceAccountConfig();
      if (!serviceAccountConfig) {
        throw new Error('No service account configuration found');
      }

      // Generate JWT token
      const jwtToken = await this.generateJWTToken(serviceAccountConfig);

      // Exchange JWT for access token
      const accessToken = await this.exchangeJWTForAccessToken(jwtToken, serviceAccountConfig);

      // Cache the token
      this.accessToken = accessToken;
      this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour

      return accessToken;

    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  private static async getServiceAccountConfig(): Promise<ServiceAccountConfig | null> {
    try {
      const result = await chrome.storage.local.get(['serviceAccountConfig']);
      return result.serviceAccountConfig || null;
    } catch (error) {
      console.error('Failed to load service account config:', error);
      return null;
    }
  }

  private static async generateJWTToken(config: ServiceAccountConfig): Promise<string> {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: config.client_email,
      scope: this.SCOPES.join(' '),
      aud: config.token_uri,
      exp: now + 3600,
      iat: now
    };

    const encodedHeader = this.base64URLEncode(JSON.stringify(header));
    const encodedPayload = this.base64URLEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Convert private key to CryptoKey
    const privateKey = await this.importPrivateKey(config.private_key);

    // Sign the JWT
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(signingInput)
    );

    const encodedSignature = this.base64URLEncode(signature);
    return `${signingInput}.${encodedSignature}`;
  }

  private static async importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
    // Remove PEM headers and convert to binary
    const pemContents = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');

    const binaryKey = this.base64ToArrayBuffer(pemContents);

    return await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    );
  }

  private static async exchangeJWTForAccessToken(jwtToken: string, config: ServiceAccountConfig): Promise<string> {
    const response = await fetch(config.token_uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwtToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
    }

    const tokenData = await response.json();
    if (!tokenData.access_token) {
      throw new Error('No access token received from token exchange');
    }

    return tokenData.access_token;
  }

  private static base64URLEncode(data: string | ArrayBuffer): string {
    let base64: string;
    if (typeof data === 'string') {
      base64 = btoa(data);
    } else {
      base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  static async testConnection(config: SheetsConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAccessToken();
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
      const token = await this.getAccessToken();
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

  static async getAllJobs(config: SheetsConfig): Promise<JobData[]> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.sheetName}!A:H`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to fetch jobs: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      if (!data.values || data.values.length <= 1) {
        return [];
      }

      const jobs: JobData[] = data.values.slice(1).map((row: string[], index: number) => ({
        companyName: row[0] || '',
        applicationStatus: (row[1] as JobData['applicationStatus']) || 'Not Applied',
        role: row[2] || '',
        salary: row[3] || '',
        dateSubmitted: row[4] || '',
        linkToJobReq: row[5] || '',
        rejectionReason: row[6] || '',
        notes: row[7] || '',
        id: `sheet-${index + 2}`,
        savedAt: new Date().toISOString()
      }));

      return jobs.reverse();

    } catch (error) {
      console.error('Failed to fetch jobs from Google Sheets:', error);
      throw error;
    }
  }

  static async saveServiceAccountConfig(config: ServiceAccountConfig): Promise<boolean> {
    try {
      await chrome.storage.local.set({ serviceAccountConfig: config });
      return true;
    } catch (error) {
      console.error('Failed to save service account config:', error);
      return false;
    }
  }

  static async clearServiceAccountConfig(): Promise<boolean> {
    try {
      await chrome.storage.local.remove(['serviceAccountConfig']);
      this.accessToken = null;
      this.tokenExpiry = 0;
      return true;
    } catch (error) {
      console.error('Failed to clear service account config:', error);
      return false;
    }
  }
}