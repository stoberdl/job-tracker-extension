// Standalone popup script without ES6 modules
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
    document.getElementById('save-local-btn')?.addEventListener('click', () => this.saveLocally());
    document.getElementById('save-sheets-btn')?.addEventListener('click', () => this.saveToSheets());
    document.getElementById('clear-history-btn')?.addEventListener('click', () => this.clearHistory());

    document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('test-connection-btn')?.addEventListener('click', () => this.testConnection());

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
      notes: document.getElementById('notes').value,
    };
  }

  showJobPreview() {
    const preview = document.getElementById('job-preview');
    preview.style.display = 'block';
  }

  async saveLocally() {
    if (!this.currentJobData) return;

    try {
      const result = await chrome.storage.local.get(['jobs']);
      const jobs = result.jobs || [];

      const jobWithId = {
        ...this.currentJobData,
        id: Date.now().toString(),
        savedAt: new Date().toISOString()
      };

      jobs.push(jobWithId);
      await chrome.storage.local.set({ jobs });

      this.showStatus('success', 'Job saved locally!');
      await this.loadJobHistory();
    } catch (error) {
      this.showStatus('error', 'Failed to save locally');
    }
  }

  async saveToSheets() {
    this.showStatus('error', 'Google Sheets integration requires additional setup. Use "Save Locally" for now.');
  }

  async loadJobHistory() {
    try {
      const result = await chrome.storage.local.get(['jobs']);
      const jobs = result.jobs || [];

      const jobList = document.getElementById('job-list');

      if (jobs.length === 0) {
        jobList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <p>No jobs saved yet</p>
          </div>
        `;
        return;
      }

      jobList.innerHTML = jobs
        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
        .map((job) => this.createJobItem(job))
        .join('');

    } catch (error) {
      console.error('Failed to load job history:', error);
    }
  }

  createJobItem(job) {
    const statusClass = job.applicationStatus.toLowerCase().replace(' ', '-');
    const savedDate = new Date(job.savedAt).toLocaleDateString();

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
          ${job.salary ? `Salary: ${job.salary} • ` : ''}
          Saved: ${savedDate}
          ${job.linkToJobReq ? `• <a href="${job.linkToJobReq}" target="_blank">View Job</a>` : ''}
        </div>
      </div>
    `;
  }

  async clearHistory() {
    const confirm = window.confirm('Are you sure you want to clear all saved jobs?');
    if (!confirm) return;

    try {
      await chrome.storage.local.set({ jobs: [] });
      await this.loadJobHistory();
      this.showStatus('success', 'Job history cleared');
    } catch (error) {
      this.showStatus('error', 'Failed to clear history');
    }
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
    this.showSettingsStatus('error', 'Google Sheets integration coming soon. Settings saved for future use.');
  }

  loadSupportedSites() {
    const sites = ['LinkedIn', 'Indeed', 'Glassdoor', 'AngelList', 'Greenhouse', 'Lever', 'Generic (Fallback)'];
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});