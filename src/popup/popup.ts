import { JobData, MessageRequest, MessageResponse } from '../types/JobData';
import { GoogleSheetsService, SheetsConfig } from '../services/GoogleSheetsService';

class PopupController {
  private currentJobData: JobData | null = null;
  private sheetsConfig: SheetsConfig = {
    spreadsheetId: '',
    sheetName: 'Job Applications'
  };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.setupEventListeners();
    this.setupTabs();
    await this.loadSettings();
    await this.loadJobHistory();
    this.loadSupportedSites();
    this.updateStatus('Ready');
  }

  private setupEventListeners(): void {
    document.getElementById('extract-btn')?.addEventListener('click', () => this.extractJobData());
    document.getElementById('save-local-btn')?.addEventListener('click', () => this.saveLocally());
    document.getElementById('save-sheets-btn')?.addEventListener('click', () => this.saveToSheets());
    document.getElementById('clear-history-btn')?.addEventListener('click', () => this.clearHistory());

    document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('test-connection-btn')?.addEventListener('click', () => this.testConnection());
    document.getElementById('create-headers-btn')?.addEventListener('click', () => this.createHeaders());
    document.getElementById('auth-btn')?.addEventListener('click', () => this.authorize());
    document.getElementById('revoke-auth-btn')?.addEventListener('click', () => this.revokeAuth());

    document.getElementById('job-form')?.addEventListener('input', () => this.updateJobDataFromForm());
  }

  private setupTabs(): void {
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

  private async extractJobData(): Promise<void> {
    const extractBtn = document.getElementById('extract-btn') as HTMLButtonElement;
    const statusDiv = document.getElementById('extraction-status') as HTMLDivElement;

    extractBtn.disabled = true;
    extractBtn.innerHTML = '<span class="loading"></span> Extracting...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error('No active tab found');
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractJobData'
      } as MessageRequest) as MessageResponse;

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
      this.showStatus('error', error instanceof Error ? error.message : 'Extraction failed');
    } finally {
      extractBtn.disabled = false;
      extractBtn.innerHTML = '<span class="btn-icon">🔍</span> Extract Job Data';
    }
  }

  private populateForm(jobData: JobData): void {
    (document.getElementById('company-name') as HTMLInputElement).value = jobData.companyName;
    (document.getElementById('role') as HTMLInputElement).value = jobData.role;
    (document.getElementById('salary') as HTMLInputElement).value = jobData.salary;
    (document.getElementById('application-status') as HTMLSelectElement).value = jobData.applicationStatus;
    (document.getElementById('date-submitted') as HTMLInputElement).value = jobData.dateSubmitted;
    (document.getElementById('job-url') as HTMLInputElement).value = jobData.linkToJobReq;
    (document.getElementById('rejection-reason') as HTMLInputElement).value = jobData.rejectionReason;
    (document.getElementById('notes') as HTMLTextAreaElement).value = jobData.notes;
  }

  private updateJobDataFromForm(): void {
    if (!this.currentJobData) return;

    const formData = new FormData(document.getElementById('job-form') as HTMLFormElement);

    this.currentJobData = {
      companyName: formData.get('companyName') as string,
      role: formData.get('role') as string,
      salary: formData.get('salary') as string,
      applicationStatus: formData.get('applicationStatus') as JobData['applicationStatus'],
      dateSubmitted: formData.get('dateSubmitted') as string,
      linkToJobReq: formData.get('linkToJobReq') as string,
      rejectionReason: formData.get('rejectionReason') as string,
      notes: formData.get('notes') as string,
    };
  }

  private showJobPreview(): void {
    const preview = document.getElementById('job-preview') as HTMLDivElement;
    preview.style.display = 'block';
  }

  private async saveLocally(): Promise<void> {
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

  private async saveToSheets(): Promise<void> {
    if (!this.currentJobData) return;

    const saveBtn = document.getElementById('save-sheets-btn') as HTMLButtonElement;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="loading"></span> Saving...';

    try {
      if (!this.sheetsConfig.spreadsheetId) {
        throw new Error('Please configure Google Sheets settings first');
      }

      const duplicateCount = await GoogleSheetsService.getDuplicateJobs(
        this.sheetsConfig,
        this.currentJobData.linkToJobReq
      );

      if (duplicateCount > 0) {
        const proceed = confirm(`This job URL already exists ${duplicateCount} time(s) in your spreadsheet. Continue anyway?`);
        if (!proceed) return;
      }

      await GoogleSheetsService.appendJobData(this.currentJobData, this.sheetsConfig);

      await this.saveLocally();
      this.showStatus('success', 'Job saved to Google Sheets!');

    } catch (error) {
      console.error('Sheets save error:', error);
      this.showStatus('error', error instanceof Error ? error.message : 'Failed to save to sheets');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Save to Sheets';
    }
  }

  private async loadJobHistory(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['jobs']);
      const jobs = result.jobs || [];

      const jobList = document.getElementById('job-list') as HTMLDivElement;

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
        .sort((a: any, b: any) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
        .map((job: any) => this.createJobItem(job))
        .join('');

    } catch (error) {
      console.error('Failed to load job history:', error);
    }
  }

  private createJobItem(job: any): string {
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

  private async clearHistory(): Promise<void> {
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

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['sheetsConfig']);
      if (result.sheetsConfig) {
        this.sheetsConfig = result.sheetsConfig;
        (document.getElementById('spreadsheet-id') as HTMLInputElement).value = this.sheetsConfig.spreadsheetId;
        (document.getElementById('sheet-name') as HTMLInputElement).value = this.sheetsConfig.sheetName;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    const spreadsheetId = (document.getElementById('spreadsheet-id') as HTMLInputElement).value.trim();
    const sheetName = (document.getElementById('sheet-name') as HTMLInputElement).value.trim();

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

  private async testConnection(): Promise<void> {
    if (!this.sheetsConfig.spreadsheetId) {
      this.showSettingsStatus('error', 'Please configure spreadsheet ID first');
      return;
    }

    const testBtn = document.getElementById('test-connection-btn') as HTMLButtonElement;
    testBtn.disabled = true;
    testBtn.innerHTML = '<span class="loading"></span> Testing...';

    try {
      const result = await GoogleSheetsService.testConnection(this.sheetsConfig);

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

  private async createHeaders(): Promise<void> {
    if (!this.sheetsConfig.spreadsheetId) {
      this.showSettingsStatus('error', 'Please configure and test connection first');
      return;
    }

    const createBtn = document.getElementById('create-headers-btn') as HTMLButtonElement;
    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="loading"></span> Creating...';

    try {
      await GoogleSheetsService.createSpreadsheetHeaders(this.sheetsConfig);
      this.showSettingsStatus('success', 'Headers created successfully!');
    } catch (error) {
      this.showSettingsStatus('error', 'Failed to create headers');
    } finally {
      createBtn.disabled = false;
      createBtn.innerHTML = 'Create Headers';
    }
  }

  private async authorize(): Promise<void> {
    try {
      const token = await GoogleSheetsService.getAuthToken();
      if (token) {
        this.showSettingsStatus('success', 'Authorization successful!');
      } else {
        this.showSettingsStatus('error', 'Authorization failed');
      }
    } catch (error) {
      this.showSettingsStatus('error', 'Authorization failed');
    }
  }

  private async revokeAuth(): Promise<void> {
    try {
      await GoogleSheetsService.revokeAuthToken();
      this.showSettingsStatus('success', 'Access revoked successfully');
    } catch (error) {
      this.showSettingsStatus('error', 'Failed to revoke access');
    }
  }

  private loadSupportedSites(): void {
    const sites = ['LinkedIn', 'Indeed', 'Glassdoor', 'AngelList', 'Generic (Fallback)'];
    const sitesList = document.getElementById('supported-sites') as HTMLUListElement;

    sitesList.innerHTML = sites
      .map(site => `<li>${site}</li>`)
      .join('');
  }

  private showStatus(type: 'success' | 'error' | 'info', message: string): void {
    const statusDiv = document.getElementById('extraction-status') as HTMLDivElement;
    statusDiv.className = `extraction-status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  private showSettingsStatus(type: 'success' | 'error', message: string): void {
    const statusDiv = document.getElementById('settings-status') as HTMLDivElement;
    statusDiv.className = `settings-status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  private updateStatus(status: string): void {
    const statusElement = document.getElementById('status') as HTMLDivElement;
    statusElement.textContent = status;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});