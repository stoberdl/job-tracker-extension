3// Standalone popup script without ES6 modules
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
      this.showStatus('error', error.message || 'Extraction failed');
    } finally {
      extractBtn.disabled = false;
      extractBtn.innerHTML = '<span class="btn-icon">🔍</span> Extract Job Data';
    }
  }

  populateForm(jobData) {
    document.getElementById('company-name').value = jobData.companyName || '';
    document.getElementById('role').value = jobData.role || '';
    document.getElementById('salary').value = jobData.salary || '';
    document.getElementById('application-status').value = jobData.applicationStatus || 'Not Applied';
    document.getElementById('date-submitted').value = jobData.dateSubmitted || '';
    document.getElementById('job-url').value = jobData.linkToJobReq || '';
    document.getElementById('rejection-reason').value = jobData.rejectionReason || '';
    document.getElementById('notes').value = jobData.notes || '';
  }

  updateJobDataFromForm() {
    if (!this.currentJobData) return;

    this.currentJobData = {
      companyName: document.getElementById('company-name').value,
      role: document.getElementById('role').value,
      salary: document.getElementById('salary').value,
      applicationStatus: document.getElementById('application-status').value,
      dateSubmitted: document.getElementById('date-submitted').value,
      linkToJobReq: document.getElementById('job-url').value,
      rejectionReason: document.getElementById('rejection-reason').value,
      notes: document.getElementById('notes').value
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

      const duplicateCount = await this.getDuplicateJobs(this.currentJobData.linkToJobReq);

      if (duplicateCount > 0) {
        const proceed = confirm(
          `This job URL already exists ${duplicateCount} time(s) in your spreadsheet.\n\n` +
          `Continue tracking anyway?`
        );
        if (!proceed) return;
      }

      await this.appendJobData(this.currentJobData);

      this.showStatus('success', 'Job tracked successfully!');
      await this.loadJobHistory();

    } catch (error) {
      console.error('Job tracking error:', error);
      this.showStatus('error', error.message || 'Failed to track job');
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

      const jobs = await this.getAllJobs();

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
          <small style="color: #666;">${error.message || 'Unknown error'}</small>
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
      const result = await chrome.storage.local.get(['sheetsConfig']);
      if (result.sheetsConfig) {
        this.sheetsConfig = result.sheetsConfig;
        document.getElementById('spreadsheet-id').value = this.sheetsConfig.spreadsheetId;
        document.getElementById('sheet-name').value = this.sheetsConfig.sheetName;
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
      const result = await this.testSheetsConnection();

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
      await this.createSpreadsheetHeaders();
      this.showSettingsStatus('success', 'Headers created successfully!');
    } catch (error) {
      this.showSettingsStatus('error', 'Failed to create headers');
    } finally {
      createBtn.disabled = false;
      createBtn.innerHTML = 'Create Headers';
    }
  }

  async authorize() {
    try {
      const token = await this.getAuthToken();
      if (token) {
        this.showSettingsStatus('success', 'Authorization successful!');
      } else {
        this.showSettingsStatus('error', 'Authorization failed - Check GOOGLE_SHEETS_SETUP.md');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      if (error.message.includes('OAuth2 not granted or revoked')) {
        this.showSettingsStatus('error', 'OAuth not configured - See GOOGLE_SHEETS_SETUP.md for setup instructions');
      } else if (error.message.includes('Authorization page could not be loaded') ||
                 error.message.includes('Both OAuth methods failed')) {
        this.showSettingsStatus('error', 'Brave browser OAuth issue - Try manual token method below');
        this.showManualTokenInstructions();
      } else {
        this.showSettingsStatus('error', 'Authorization failed - ' + error.message);
      }
    }
  }

  async revokeAuth() {
    try {
      await this.revokeAuthToken();
      this.showSettingsStatus('success', 'Access revoked successfully');
    } catch (error) {
      this.showSettingsStatus('error', 'Failed to revoke access');
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

  // Google Sheets API methods
  async getAuthToken() {
    console.log('🔐 Starting OAuth authentication process...');

    // First check for manually stored token
    const manualToken = localStorage.getItem('manual_oauth_token');
    if (manualToken) {
      console.log('🔑 Found manually stored token, validating...');
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
          headers: { 'Authorization': `Bearer ${manualToken}` }
        });
        if (response.ok) {
          console.log('✅ Manual token is valid');
          return manualToken;
        } else {
          console.log('❌ Manual token expired, removing...');
          localStorage.removeItem('manual_oauth_token');
        }
      } catch (error) {
        console.log('❌ Manual token validation failed:', error);
        localStorage.removeItem('manual_oauth_token');
      }
    }

    console.log('🌐 User Agent:', navigator.userAgent);
    console.log('🔍 Browser Environment:', {
      brave: navigator.brave,
      chromeWebstore: !!window.chrome?.webstore,
      chromeRuntime: !!chrome?.runtime,
      chromeIdentity: !!chrome?.identity
    });

    // Detect if we're in Brave browser
    const isBrave = this.isBraveBrowser();
    console.log(`🎯 Browser Detection: ${isBrave ? 'Brave' : 'Chrome/Other'}`);

    if (isBrave) {
      console.log('🦁 Brave browser detected, using alternative OAuth method...');
      return this.getBraveAuthToken();
    }

    // Use standard Chrome Identity API for Chrome browser
    console.log('🔑 Attempting Chrome Identity API (getAuthToken)...');
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.warn('❌ Chrome getAuthToken failed:', chrome.runtime.lastError.message);
          console.log('🔄 Falling back to Brave-compatible method...');
          this.getBraveAuthToken()
            .then(resolve)
            .catch(reject);
        } else {
          console.log('✅ Chrome getAuthToken succeeded');
          resolve(token || null);
        }
      });
    });
  }

  isBraveBrowser() {
    const checks = {
      userAgent: navigator.userAgent.includes('Brave'),
      navigatorBrave: !!(navigator.brave && navigator.brave.isBrave),
      noWebstore: window.chrome?.webstore === undefined,
      braveAPI: typeof navigator.brave !== 'undefined'
    };

    console.log('🔍 Brave Detection Checks:', checks);

    const isBrave = checks.userAgent || checks.navigatorBrave || checks.noWebstore;
    console.log(`🎯 Final Brave Detection Result: ${isBrave}`);

    return isBrave;
  }

  async getBraveAuthToken() {
    console.log('🦁 Starting Brave-compatible OAuth flow...');

    return new Promise(async (resolve, reject) => {
      try {
        const redirectUrl = chrome.identity.getRedirectURL();
        const clientId = '270587526348-ipo4ggtvjk3vc7ufks6g0ape6kd2dlob.apps.googleusercontent.com';
        const scopes = 'https://www.googleapis.com/auth/spreadsheets';

        console.log('📋 OAuth Configuration:', {
          redirectUrl,
          clientId,
          scopes,
          extensionId: chrome.runtime.id
        });

        const authUrl = `https://accounts.google.com/oauth/authorize?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `response_type=token&` +
          `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
          `scope=${encodeURIComponent(scopes)}&` +
          `prompt=consent`;

        console.log('🔗 Generated Auth URL:', authUrl);

        // Validate the OAuth URL before attempting to use it
        await this.validateOAuthURL(authUrl, clientId, redirectUrl);

        console.log('🚀 Launching WebAuthFlow...');
        console.log('⚙️ WebAuthFlow options:', { url: authUrl, interactive: true });

        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, (responseUrl) => {
          console.log('📥 WebAuthFlow callback triggered');
          console.log('🔄 Response URL received:', responseUrl || 'null');
          console.log('❌ Runtime error:', chrome.runtime.lastError?.message || 'none');

          if (chrome.runtime.lastError) {
            console.error('💥 Brave OAuth error details:', {
              message: chrome.runtime.lastError.message,
              redirectUrl,
              authUrl,
              timestamp: new Date().toISOString()
            });

            // Try alternative approach: manual tab opening
            console.log('🔄 Attempting manual OAuth as fallback...');
            this.attemptManualOAuth(authUrl, redirectUrl)
              .then(resolve)
              .catch(fallbackError => {
                console.error('💥 Manual OAuth also failed:', fallbackError);
                reject(new Error(`Both OAuth methods failed. WebAuthFlow: ${chrome.runtime.lastError.message}. Manual: ${fallbackError.message}`));
              });
            return;
          }

          if (responseUrl) {
            console.log('✅ Received response URL, parsing token...');
            try {
              const urlHash = responseUrl.split('#')[1];
              if (urlHash) {
                const urlParams = new URLSearchParams(urlHash);
                const accessToken = urlParams.get('access_token');
                const error = urlParams.get('error');

                console.log('🔍 URL Parameters:', {
                  hasToken: !!accessToken,
                  error: error || 'none',
                  allParams: Object.fromEntries(urlParams.entries())
                });

                if (accessToken) {
                  console.log('🎉 OAuth successful! Token acquired');
                  resolve(accessToken);
                  return;
                } else if (error) {
                  reject(new Error(`OAuth error: ${error}`));
                  return;
                }
              }
              reject(new Error('No access token found in response URL'));
            } catch (parseError) {
              console.error('💥 Error parsing response URL:', parseError);
              reject(new Error(`Failed to parse OAuth response: ${parseError.message}`));
            }
          } else {
            console.error('💥 No response URL received from WebAuthFlow');
            reject(new Error('No response URL received from OAuth flow'));
          }
        });

      } catch (setupError) {
        console.error('💥 Error setting up OAuth flow:', setupError);
        reject(setupError);
      }
    });
  }

  // Manual OAuth fallback method for when launchWebAuthFlow fails
  async attemptManualOAuth(authUrl, expectedRedirectUrl) {
    console.log('📝 Starting manual OAuth flow...');

    return new Promise((resolve, reject) => {
      // Create a new tab with the OAuth URL
      chrome.tabs.create({ url: authUrl, active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to create OAuth tab: ${chrome.runtime.lastError.message}`));
          return;
        }

        console.log('🆕 Created OAuth tab:', tab.id);

        // Set up tab update listener to catch the redirect
        const tabUpdateListener = (tabId, changeInfo, updatedTab) => {
          if (tabId === tab.id && changeInfo.url) {
            console.log('🔄 Tab URL changed:', changeInfo.url);

            // Check if this is our redirect URL
            if (changeInfo.url.startsWith(expectedRedirectUrl)) {
              console.log('✅ Caught OAuth redirect!');

              // Clean up listener
              chrome.tabs.onUpdated.removeListener(tabUpdateListener);

              // Close the tab
              chrome.tabs.remove(tab.id);

              // Parse the token from the URL
              try {
                const urlHash = changeInfo.url.split('#')[1];
                if (urlHash) {
                  const urlParams = new URLSearchParams(urlHash);
                  const accessToken = urlParams.get('access_token');
                  const error = urlParams.get('error');

                  if (accessToken) {
                    console.log('🎉 Manual OAuth successful!');
                    resolve(accessToken);
                  } else if (error) {
                    reject(new Error(`OAuth error: ${error}`));
                  } else {
                    reject(new Error('No access token found in manual OAuth redirect'));
                  }
                } else {
                  reject(new Error('No hash fragment found in redirect URL'));
                }
              } catch (parseError) {
                reject(new Error(`Failed to parse manual OAuth redirect: ${parseError.message}`));
              }
            }
          }
        };

        // Set up removal listener in case user closes the tab manually
        const tabRemoveListener = (tabId) => {
          if (tabId === tab.id) {
            console.log('❌ OAuth tab was closed by user');
            chrome.tabs.onUpdated.removeListener(tabUpdateListener);
            chrome.tabs.onRemoved.removeListener(tabRemoveListener);
            reject(new Error('OAuth cancelled by user'));
          }
        };

        chrome.tabs.onUpdated.addListener(tabUpdateListener);
        chrome.tabs.onRemoved.addListener(tabRemoveListener);

        // Set timeout to cleanup if no response in 5 minutes
        setTimeout(() => {
          console.log('⏰ Manual OAuth timeout');
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          chrome.tabs.onRemoved.removeListener(tabRemoveListener);
          chrome.tabs.remove(tab.id).catch(() => {}); // Tab might already be closed
          reject(new Error('OAuth timeout - no response received within 5 minutes'));
        }, 5 * 60 * 1000);
      });
    });
  }

  async validateOAuthURL(authUrl, clientId, redirectUrl) {
    console.log('🔍 Validating OAuth configuration...');

    try {
      // Test basic URL accessibility
      const testResponse = await fetch(authUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        redirect: 'manual'
      });
      console.log('📡 URL Test Response Status:', testResponse.status);
    } catch (error) {
      console.log('⚠️ URL accessibility test (expected to fail due to CORS):', error.message);
    }

    // Validate client ID format
    const clientIdPattern = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
    if (!clientIdPattern.test(clientId)) {
      console.error('❌ Invalid client ID format:', clientId);
      console.log('✅ Expected format: 123456789-abcdef.apps.googleusercontent.com');
    } else {
      console.log('✅ Client ID format is valid');
    }

    // Validate redirect URI format
    if (!redirectUrl.match(/^https:\/\/[a-z]+\.chromiumapp\.org\/$/)) {
      console.error('❌ Invalid redirect URI format:', redirectUrl);
      console.log('✅ Expected format: https://[extension-id].chromiumapp.org/');
    } else {
      console.log('✅ Redirect URI format is valid');
    }

    // Test OAuth endpoint availability
    try {
      console.log('🌐 Testing Google OAuth endpoint availability...');
      const oauthTest = await fetch('https://accounts.google.com/oauth/authorize', {
        method: 'HEAD',
        mode: 'no-cors'
      });
      console.log('✅ Google OAuth endpoint is accessible');
    } catch (error) {
      console.error('❌ Google OAuth endpoint test failed:', error);
    }

    // Provide troubleshooting information
    console.log('🔧 Troubleshooting Information:');
    console.log('1. Check Google Cloud Console → APIs & Services → Credentials');
    console.log('2. Ensure OAuth client type is "Web application" (NOT "Chrome app")');
    console.log('3. Verify redirect URI is added:', redirectUrl);
    console.log('4. Confirm client ID exists and is enabled:', clientId);
    console.log('5. Check if OAuth consent screen is configured');

    // Try a simplified OAuth URL for testing
    const simplifiedUrl = `https://accounts.google.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets')}`;
    console.log('🔄 Alternative OAuth URL (code flow):', simplifiedUrl);
    console.log('💡 Try this URL manually in browser to test client configuration');
  }

  async testOAuthConfiguration(authUrl, config) {
    console.log(`🧪 Testing OAuth configuration: ${config.name}`);

    try {
      // Create a simple test request to see if we get a 404
      const testResponse = await fetch(authUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        redirect: 'manual'
      });

      // If we get here without error, the URL might be valid
      console.log(`✅ Configuration ${config.name} - No immediate 404 error`);
      return true;

    } catch (error) {
      console.log(`⚠️ Configuration ${config.name} - Test inconclusive:`, error.message);
      // Even if this fails, it doesn't mean the config is bad (CORS restrictions)
      return true; // Continue with the test since fetch failures are expected
    }
  }

  async launchOAuthFlow(authUrl, redirectUrl) {
    console.log('🚀 Launching OAuth flow with validated configuration...');

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (responseUrl) => {
        console.log('📥 OAuth Flow Response:', {
          responseUrl: responseUrl || 'null',
          error: chrome.runtime.lastError?.message || 'none'
        });

        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          if (errorMsg.includes('Authorization page could not be loaded')) {
            reject(new Error(`OAuth 404 Error: Your Google Cloud Console OAuth client may be misconfigured. Error: ${errorMsg}`));
          } else {
            reject(new Error(`OAuth Error: ${errorMsg}`));
          }
          return;
        }

        if (responseUrl) {
          // Parse token from response
          const urlHash = responseUrl.split('#')[1];
          if (urlHash) {
            const urlParams = new URLSearchParams(urlHash);
            const accessToken = urlParams.get('access_token');
            if (accessToken) {
              console.log('🎉 OAuth successful!');
              resolve(accessToken);
              return;
            }
          }
          reject(new Error('No access token found in OAuth response'));
        } else {
          reject(new Error('No response URL received from OAuth'));
        }
      });
    });
  }

  showManualTokenInstructions() {
    const instructionsDiv = document.createElement('div');
    instructionsDiv.id = 'manual-token-instructions';
    instructionsDiv.style.cssText = `
      background: #f0f8ff;
      border: 1px solid #0066cc;
      border-radius: 4px;
      padding: 12px;
      margin-top: 10px;
      font-size: 12px;
      line-height: 1.4;
    `;

    const clientId = '270587526348-ipo4ggtvjk3vc7ufks6g0ape6kd2dlob.apps.googleusercontent.com';
    const redirectUrl = chrome.identity.getRedirectURL();
    const scopes = 'https://www.googleapis.com/auth/spreadsheets';

    const manualUrl = `https://accounts.google.com/oauth/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `prompt=consent`;

    instructionsDiv.innerHTML = `
      <h4 style="margin: 0 0 8px 0; color: #cc0000;">⚠️ OAuth Configuration Issue Detected</h4>
      <p style="margin: 4px 0; font-size: 11px; color: #cc0000;">
        The OAuth URL returns a 404 error, indicating a Google Cloud Console configuration problem.
      </p>

      <h5 style="margin: 8px 0 4px 0; color: #0066cc;">🔧 Required Fixes in Google Cloud Console:</h5>
      <ol style="margin: 4px 0; padding-left: 16px; font-size: 11px;">
        <li><strong>OAuth Client Type:</strong> Must be "Web application" (NOT "Chrome app")</li>
        <li><strong>Redirect URI:</strong> Add <code>${redirectUrl}</code></li>
        <li><strong>OAuth Consent Screen:</strong> Must be configured and published</li>
        <li><strong>Client Status:</strong> Ensure OAuth client is enabled</li>
      </ol>

      <h5 style="margin: 8px 0 4px 0; color: #0066cc;">🧪 Test Your Configuration:</h5>
      <p style="margin: 4px 0; font-size: 11px;">
        Try this OAuth URL manually in your browser to test:
      </p>
      <a href="${manualUrl}" target="_blank" style="color: #0066cc; word-break: break-all; font-size: 9px; display: block; margin: 4px 0;">${manualUrl}</a>

      <p style="margin: 4px 0; font-size: 11px;">
        If it works, copy the access_token from the redirected URL and paste below:
      </p>
      <input type="text" id="manual-token-input" placeholder="Paste access token here..."
             style="width: 100%; padding: 4px; margin: 4px 0; border: 1px solid #ccc; border-radius: 2px;">
      <button id="save-manual-token" style="background: #0066cc; color: white; border: none; padding: 6px 12px; border-radius: 2px; cursor: pointer;">
        Use Token
      </button>
      <button id="hide-instructions" style="background: #666; color: white; border: none; padding: 6px 12px; border-radius: 2px; cursor: pointer; margin-left: 8px;">
        Hide
      </button>
    `;

    // Remove existing instructions if any
    const existing = document.getElementById('manual-token-instructions');
    if (existing) existing.remove();

    // Add to settings tab
    const settingsTab = document.getElementById('settings-tab');
    settingsTab.appendChild(instructionsDiv);

    // Add event listeners
    document.getElementById('save-manual-token').addEventListener('click', () => {
      const token = document.getElementById('manual-token-input').value.trim();
      if (token) {
        this.testManualToken(token);
      } else {
        this.showSettingsStatus('error', 'Please enter a valid access token');
      }
    });

    document.getElementById('hide-instructions').addEventListener('click', () => {
      instructionsDiv.remove();
    });
  }

  async testManualToken(token) {
    try {
      // Test the token by making a simple API call
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const tokenInfo = await response.json();
        console.log('🎉 Manual token validated:', tokenInfo);

        // Store the token (we'll need to modify how tokens are stored/retrieved)
        localStorage.setItem('manual_oauth_token', token);

        this.showSettingsStatus('success', 'Manual token validated and saved!');
        document.getElementById('manual-token-instructions').remove();
      } else {
        this.showSettingsStatus('error', 'Invalid token - please check and try again');
      }
    } catch (error) {
      console.error('Manual token validation failed:', error);
      this.showSettingsStatus('error', 'Token validation failed: ' + error.message);
    }
  }

  async revokeAuthToken() {
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

  async appendJobData(data) {
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
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetsConfig.spreadsheetId}/values/${this.sheetsConfig.sheetName}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
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

  async getAllJobs() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetsConfig.spreadsheetId}/values/${this.sheetsConfig.sheetName}!A:H`,
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

      const jobs = data.values.slice(1).map((row, index) => ({
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

  async getDuplicateJobs(jobUrl) {
    try {
      const token = await this.getAuthToken();
      if (!token) return 0;

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetsConfig.spreadsheetId}/values/${this.sheetsConfig.sheetName}!F:F`,
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

  async testSheetsConnection() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { success: false, error: 'No authentication token' };
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetsConfig.spreadsheetId}`,
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
        (sheet) => sheet.properties.title === this.sheetsConfig.sheetName
      );

      if (!sheetExists) {
        return {
          success: false,
          error: `Sheet "${this.sheetsConfig.sheetName}" not found in spreadsheet`
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  async createSpreadsheetHeaders() {
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

      // Check if headers already exist
      const checkResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetsConfig.spreadsheetId}/values/${this.sheetsConfig.sheetName}!A1:H1`,
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
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetsConfig.spreadsheetId}/values/${this.sheetsConfig.sheetName}!A1:H1?valueInputOption=RAW`,
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

      await this.formatHeaders(token);
      return true;

    } catch (error) {
      console.error('Failed to create spreadsheet headers:', error);
      throw error;
    }
  }

  async formatHeaders(token) {
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
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetsConfig.spreadsheetId}:batchUpdate`,
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
}

// Initialize the popup controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});