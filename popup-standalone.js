// Standalone popup script with service account authentication
class PopupController {
  constructor() {
    this.currentJobData = null;
    this.sheetsConfig = {
      spreadsheetId: '',
      sheetName: 'Job Applications'
    };
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupTabs();
    await this.loadSettings();
    await this.loadJobHistory();
    this.loadSupportedSites();
    this.updateStatus('Ready');
  }

  setupEventListeners() {
    document.getElementById('extract-btn')?.addEventListener('click', () => this.extractJobData());
    document.getElementById('track-job-btn')?.addEventListener('click', () => this.trackJob());
    document.getElementById('refresh-history-btn')?.addEventListener('click', () => this.loadJobHistory());

    document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('test-connection-btn')?.addEventListener('click', () => this.testConnection());
    document.getElementById('create-headers-btn')?.addEventListener('click', () => this.createHeaders());
    document.getElementById('save-service-account-btn')?.addEventListener('click', () => this.saveServiceAccount());
    document.getElementById('clear-service-account-btn')?.addEventListener('click', () => this.clearServiceAccount());

    document.getElementById('job-form')?.addEventListener('input', () => this.updateJobDataFromForm());
  }

  setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');

        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        button.classList.add('active');
        document.getElementById(`${tabName}-tab`)?.classList.add('active');
      });
    });
  }

  async extractJobData() {
    const extractBtn = document.getElementById('extract-btn');
    extractBtn.disabled = true;
    extractBtn.innerHTML = '<span class="loading"></span> Extracting...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error('No active tab found');
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractJobData'
      });

      if (response.success && response.data) {
        this.currentJobData = response.data;
        this.populateForm(response.data);
        this.showJobPreview();
        this.showStatus('success', 'Job data extracted successfully!');
      } else {
        throw new Error(response.error || 'Failed to extract job data');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      this.showStatus('error', error.message);
    } finally {
      extractBtn.disabled = false;
      extractBtn.innerHTML = '<span class="btn-icon">🔍</span> Extract Job Data';
    }
  }

  populateForm(jobData) {
    document.getElementById('company-name').value = jobData.companyName;
    document.getElementById('role').value = jobData.role;
    document.getElementById('salary').value = jobData.salary;
    document.getElementById('application-status').value = jobData.applicationStatus;
    document.getElementById('date-submitted').value = jobData.dateSubmitted;
    document.getElementById('job-url').value = jobData.linkToJobReq;
    document.getElementById('rejection-reason').value = jobData.rejectionReason;
    document.getElementById('notes').value = jobData.notes;
  }

  updateJobDataFromForm() {
    if (!this.currentJobData) return;

    const formData = new FormData(document.getElementById('job-form'));

    this.currentJobData = {
      companyName: formData.get('companyName'),
      role: formData.get('role'),
      salary: formData.get('salary'),
      applicationStatus: formData.get('applicationStatus'),
      dateSubmitted: formData.get('dateSubmitted'),
      linkToJobReq: formData.get('linkToJobReq'),
      rejectionReason: formData.get('rejectionReason'),
      notes: formData.get('notes'),
    };
  }

  showJobPreview() {
    const preview = document.getElementById('job-preview');
    preview.style.display = 'block';
  }

  async trackJob() {
    if (!this.currentJobData) return;

    const trackBtn = document.getElementById('track-job-btn');
    trackBtn.disabled = true;
    trackBtn.innerHTML = '<span class="loading"></span> Tracking Job...';

    try {
      if (!this.sheetsConfig.spreadsheetId) {
        throw new Error('Please configure Google Sheets settings first. Go to Settings tab.');
      }

      const duplicateCount = await this.getDuplicateJobs(this.sheetsConfig, this.currentJobData.linkToJobReq);

      if (duplicateCount > 0) {
        const proceed = confirm(
          `This job URL already exists ${duplicateCount} time(s) in your spreadsheet.\n\n` +
          `Continue tracking anyway?`
        );
        if (!proceed) return;
      }

      await this.appendJobData(this.currentJobData, this.sheetsConfig);

      this.showStatus('success', 'Job tracked successfully!');
      await this.loadJobHistory();

    } catch (error) {
      console.error('Job tracking error:', error);
      this.showStatus('error', error.message);
    } finally {
      trackBtn.disabled = false;
      trackBtn.innerHTML = 'Track Job';
    }
  }

  async loadJobHistory() {
    const jobList = document.getElementById('job-list');

    try {
      if (!this.sheetsConfig.spreadsheetId) {
        jobList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">⚙️</div>
            <p>Configure Google Sheets in Settings to view job history</p>
          </div>
        `;
        return;
      }

      jobList.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <span class="loading"></span> Loading jobs from Google Sheets...
        </div>
      `;

      const jobs = await this.getAllJobs(this.sheetsConfig);

      if (jobs.length === 0) {
        jobList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <p>No jobs tracked yet</p>
            <small style="color: #666;">Go to Extract tab to track your first job</small>
          </div>
        `;
        return;
      }

      jobList.innerHTML = jobs
        .map((job) => this.createJobItem(job))
        .join('');

    } catch (error) {
      console.error('Failed to load job history:', error);
      jobList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <p>Failed to load job history</p>
          <small style="color: #666;">${error.message}</small>
        </div>
      `;
    }
  }

  createJobItem(job) {
    const statusClass = job.applicationStatus.toLowerCase().replace(' ', '-');
    const submittedDate = job.dateSubmitted ? new Date(job.dateSubmitted).toLocaleDateString() : 'Not specified';

    return `
      <div class="job-item">
        <div class="job-item-header">
          <div>
            <div class="job-item-title">${job.role || 'Unknown Role'}</div>
            <div class="job-item-company">${job.companyName || 'Unknown Company'}</div>
          </div>
          <div class="job-item-status ${statusClass}">
            ${job.applicationStatus}
          </div>
        </div>
        <div class="job-item-details">
          ${job.salary ? `💰 ${job.salary} • ` : ''}
          📅 ${submittedDate}
          ${job.linkToJobReq ? ` • <a href="${job.linkToJobReq}" target="_blank" style="color: #007bff;">View Job</a>` : ''}
          ${job.notes ? ` • 📝 ${job.notes.slice(0, 50)}${job.notes.length > 50 ? '...' : ''}` : ''}
        </div>
      </div>
    `;
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['sheetsConfig', 'serviceAccountConfig']);
      if (result.sheetsConfig) {
        this.sheetsConfig = result.sheetsConfig;
        document.getElementById('spreadsheet-id').value = this.sheetsConfig.spreadsheetId;
        document.getElementById('sheet-name').value = this.sheetsConfig.sheetName;
      }

      // Show service account status
      if (result.serviceAccountConfig) {
        this.showSettingsStatus('success', `Service account loaded: ${result.serviceAccountConfig.client_email}`);
      } else {
        this.showSettingsStatus('info', 'No service account configured yet');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    const spreadsheetId = document.getElementById('spreadsheet-id').value.trim();
    const sheetName = document.getElementById('sheet-name').value.trim();

    if (!spreadsheetId || !sheetName) {
      this.showSettingsStatus('error', 'Please fill in all fields');
      return;
    }

    this.sheetsConfig = { spreadsheetId, sheetName };

    try {
      await chrome.storage.local.set({ sheetsConfig: this.sheetsConfig });
      this.showSettingsStatus('success', 'Settings saved successfully');
    } catch (error) {
      this.showSettingsStatus('error', 'Failed to save settings');
    }
  }

  async testConnection() {
    if (!this.sheetsConfig.spreadsheetId) {
      this.showSettingsStatus('error', 'Please configure spreadsheet ID first');
      return;
    }

    const testBtn = document.getElementById('test-connection-btn');
    testBtn.disabled = true;
    testBtn.innerHTML = '<span class="loading"></span> Testing...';

    try {
      const result = await this.testSheetsConnection(this.sheetsConfig);

      if (result.success) {
        this.showSettingsStatus('success', 'Connection successful!');
      } else {
        this.showSettingsStatus('error', `Connection failed: ${result.error}`);
      }
    } catch (error) {
      this.showSettingsStatus('error', 'Connection test failed');
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = 'Test Connection';
    }
  }

  async createHeaders() {
    if (!this.sheetsConfig.spreadsheetId) {
      this.showSettingsStatus('error', 'Please configure and test connection first');
      return;
    }

    const createBtn = document.getElementById('create-headers-btn');
    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="loading"></span> Creating...';

    try {
      await this.createSpreadsheetHeaders(this.sheetsConfig);
      this.showSettingsStatus('success', 'Headers created successfully!');
    } catch (error) {
      this.showSettingsStatus('error', 'Failed to create headers');
    } finally {
      createBtn.disabled = false;
      createBtn.innerHTML = 'Create Headers';
    }
  }

  async saveServiceAccount() {
    const serviceAccountJson = document.getElementById('service-account-json').value.trim();

    if (!serviceAccountJson) {
      this.showSettingsStatus('error', 'Please paste your service account JSON key');
      return;
    }

    const saveBtn = document.getElementById('save-service-account-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="loading"></span> Saving...';

    try {
      const config = JSON.parse(serviceAccountJson);

      // Validate required fields
      const requiredFields = ['type', 'project_id', 'private_key', 'client_email', 'token_uri'];
      for (const field of requiredFields) {
        if (!config[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      console.log('Service account config validation passed:', {
        type: config.type,
        project_id: config.project_id,
        client_email: config.client_email,
        hasPrivateKey: !!config.private_key
      });

      if (config.type !== 'service_account') {
        throw new Error('Invalid service account type. Expected "service_account"');
      }

      console.log('Attempting to save service account config...');
      const success = await this.saveServiceAccountConfig(config);
      console.log('Save result:', success);

      if (success) {
        this.showSettingsStatus('success', 'Service account saved successfully!');
        // Clear the textarea for security
        document.getElementById('service-account-json').value = '';

        // Test that it was actually saved
        const savedConfig = await chrome.storage.local.get(['serviceAccountConfig']);
        console.log('Verification - config was saved:', !!savedConfig.serviceAccountConfig);
      } else {
        this.showSettingsStatus('error', 'Failed to save service account configuration');
      }
    } catch (error) {
      console.error('Service account save error:', error);
      if (error instanceof SyntaxError) {
        this.showSettingsStatus('error', 'Invalid JSON format. Please check your service account key.');
      } else {
        this.showSettingsStatus('error', error.message);
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Save Service Account';
    }
  }

  async clearServiceAccount() {
    try {
      const success = await this.clearServiceAccountConfig();
      if (success) {
        this.showSettingsStatus('success', 'Service account configuration cleared');
        document.getElementById('service-account-json').value = '';
      } else {
        this.showSettingsStatus('error', 'Failed to clear service account configuration');
      }
    } catch (error) {
      this.showSettingsStatus('error', 'Failed to clear service account configuration');
    }
  }

  loadSupportedSites() {
    const sites = ['LinkedIn', 'Indeed', 'Glassdoor', 'AngelList', 'Generic (Fallback)'];
    const sitesList = document.getElementById('supported-sites');

    sitesList.innerHTML = sites
      .map(site => `<li>${site}</li>`)
      .join('');
  }

  showStatus(type, message) {
    const statusDiv = document.getElementById('extraction-status');
    statusDiv.className = `extraction-status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  showSettingsStatus(type, message) {
    const statusDiv = document.getElementById('settings-status');
    statusDiv.className = `settings-status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  updateStatus(status) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = status;
  }

  // Google Sheets Service Account Methods
  async getAccessToken() {
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

  async getServiceAccountConfig() {
    try {
      const result = await chrome.storage.local.get(['serviceAccountConfig']);
      return result.serviceAccountConfig || null;
    } catch (error) {
      console.error('Failed to load service account config:', error);
      return null;
    }
  }

  async generateJWTToken(config) {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: config.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
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

  async importPrivateKey(privateKeyPem) {
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

  async exchangeJWTForAccessToken(jwtToken, config) {
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

  base64URLEncode(data) {
    let base64;
    if (typeof data === 'string') {
      base64 = btoa(data);
    } else {
      base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async saveServiceAccountConfig(config) {
    try {
      await chrome.storage.local.set({ serviceAccountConfig: config });
      return true;
    } catch (error) {
      console.error('Failed to save service account config:', error);
      return false;
    }
  }

  async clearServiceAccountConfig() {
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

  async testSheetsConnection(config) {
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
        (sheet) => sheet.properties.title === config.sheetName
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
        error: error.message
      };
    }
  }

  async appendJobData(data, config) {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // First, find the last row with actual job data
      const lastRowWithData = await this.findLastJobRow(config, token);
      const insertRow = lastRowWithData + 1;

      console.log(`Inserting job at row ${insertRow}`);

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

      // Insert at specific row instead of using :append
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.sheetName}!A${insertRow}:H${insertRow}?valueInputOption=RAW`,
        {
          method: 'PUT',
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

      // Format the new row to prevent tall height from long URLs
      await this.formatJobRow(config, token, insertRow);

      const result = await response.json();
      console.log('Successfully added job to spreadsheet:', result);
      return true;

    } catch (error) {
      console.error('Failed to save to Google Sheets:', error);
      throw error;
    }
  }

  async findLastJobRow(config, token) {
    try {
      // Get all data to find the last row with actual job content
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.sheetName}!A:H`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) {
        // Fallback to row 2 if we can't read the sheet
        return 2;
      }

      const data = await response.json();
      if (!data.values || data.values.length <= 1) {
        // Only headers exist, next row should be 2
        return 1;
      }

      // Find the last row with actual job data (has company name OR role)
      let lastJobRow = 1; // Start after headers
      for (let i = 1; i < data.values.length; i++) {
        const row = data.values[i];
        if ((row[0] && row[0].trim()) || (row[2] && row[2].trim())) {
          lastJobRow = i + 1; // +1 because array is 0-indexed but sheets are 1-indexed
        }
      }

      return lastJobRow;
    } catch (error) {
      console.error('Error finding last job row:', error);
      return 2; // Fallback to row 2
    }
  }

  async formatJobRow(config, token, rowNumber) {
    try {
      const requests = [
        {
          updateDimensionProperties: {
            range: {
              sheetId: 0,
              dimension: 'ROWS',
              startIndex: rowNumber - 1, // 0-indexed
              endIndex: rowNumber
            },
            properties: {
              pixelSize: 60 // Set max row height to 60 pixels
            },
            fields: 'pixelSize'
          }
        },
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 0,
              endColumnIndex: 8
            },
            cell: {
              userEnteredFormat: {
                wrapStrategy: 'CLIP', // Clip long text instead of wrapping
                verticalAlignment: 'MIDDLE'
              }
            },
            fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
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

      console.log(`Formatted row ${rowNumber} with height limit`);
    } catch (error) {
      console.warn('Failed to format job row:', error);
    }
  }

  async createSpreadsheetHeaders(config) {
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

  async formatHeaders(config, token) {
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

  async getDuplicateJobs(config, jobUrl) {
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

      return data.values.filter((row) =>
        row[0] && row[0].trim() === jobUrl.trim()
      ).length;

    } catch (error) {
      console.error('Failed to check for duplicates:', error);
      return 0;
    }
  }

  async getAllJobs(config) {
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

      const jobs = data.values.slice(1)
        .filter((row) => {
          // Filter out empty rows - must have at least company name OR role
          return (row[0] && row[0].trim()) || (row[2] && row[2].trim());
        })
        .map((row, index) => ({
          companyName: row[0] || '',
          applicationStatus: row[1] || 'Not Applied',
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});