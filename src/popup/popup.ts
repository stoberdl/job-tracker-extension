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
    document.getElementById('track-job-btn')?.addEventListener('click', () => this.trackJob());
    document.getElementById('refresh-history-btn')?.addEventListener('click', () => this.loadJobHistory());

    document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('test-connection-btn')?.addEventListener('click', () => this.testConnection());
    document.getElementById('create-headers-btn')?.addEventListener('click', () => this.createHeaders());
    document.getElementById('save-service-account-btn')?.addEventListener('click', () => this.saveServiceAccount());
    document.getElementById('clear-service-account-btn')?.addEventListener('click', () => this.clearServiceAccount());

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
      rejectionReason: (formData.get('rejectionReason') as JobData['rejectionReason']) || '',
      notes: formData.get('notes') as string,
    };
  }

  private showJobPreview(): void {
    const preview = document.getElementById('job-preview') as HTMLDivElement;
    preview.style.display = 'block';
  }

  private async trackJob(): Promise<void> {
    if (!this.currentJobData) return;

    const trackBtn = document.getElementById('track-job-btn') as HTMLButtonElement;
    trackBtn.disabled = true;
    trackBtn.innerHTML = '<span class="loading"></span> Tracking Job...';

    try {
      if (!this.sheetsConfig.spreadsheetId) {
        throw new Error('Please configure Google Sheets settings first. Go to Settings tab.');
      }

      const duplicateCount = await GoogleSheetsService.getDuplicateJobs(
        this.sheetsConfig,
        this.currentJobData.linkToJobReq
      );

      if (duplicateCount > 0) {
        const proceed = confirm(
          `This job URL already exists ${duplicateCount} time(s) in your spreadsheet.\n\n` +
          `Continue tracking anyway?`
        );
        if (!proceed) return;
      }

      await GoogleSheetsService.appendJobData(this.currentJobData, this.sheetsConfig);

      this.showStatus('success', 'Job tracked successfully!');
      await this.loadJobHistory();

    } catch (error) {
      console.error('Job tracking error:', error);
      this.showStatus('error', error instanceof Error ? error.message : 'Failed to track job');
    } finally {
      trackBtn.disabled = false;
      trackBtn.innerHTML = 'Track Job';
    }
  }

  private async loadJobHistory(): Promise<void> {
    const jobList = document.getElementById('job-list') as HTMLDivElement;

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

      const jobs = await GoogleSheetsService.getAllJobs(this.sheetsConfig);

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
        .map((job: any) => this.createJobItem(job))
        .join('');

    } catch (error) {
      console.error('Failed to load job history:', error);
      jobList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <p>Failed to load job history</p>
          <small style="color: #666;">${error instanceof Error ? error.message : 'Unknown error'}</small>
        </div>
      `;
    }
  }

  private createJobItem(job: any): string {
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


  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['sheetsConfig', 'serviceAccountConfig']);
      if (result.sheetsConfig) {
        this.sheetsConfig = result.sheetsConfig;
        (document.getElementById('spreadsheet-id') as HTMLInputElement).value = this.sheetsConfig.spreadsheetId;
        (document.getElementById('sheet-name') as HTMLInputElement).value = this.sheetsConfig.sheetName;
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

  private async saveServiceAccount(): Promise<void> {
    const serviceAccountJson = (document.getElementById('service-account-json') as HTMLTextAreaElement).value.trim();

    if (!serviceAccountJson) {
      this.showSettingsStatus('error', 'Please paste your service account JSON key');
      return;
    }

    const saveBtn = document.getElementById('save-service-account-btn') as HTMLButtonElement;
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
      const success = await GoogleSheetsService.saveServiceAccountConfig(config);
      console.log('Save result:', success);

      if (success) {
        this.showSettingsStatus('success', 'Service account saved successfully!');
        // Clear the textarea for security
        (document.getElementById('service-account-json') as HTMLTextAreaElement).value = '';

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
      } else if (error instanceof Error) {
        this.showSettingsStatus('error', error.message);
      } else {
        this.showSettingsStatus('error', 'Failed to save service account configuration');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Save Service Account';
    }
  }

  private async clearServiceAccount(): Promise<void> {
    try {
      const success = await GoogleSheetsService.clearServiceAccountConfig();
      if (success) {
        this.showSettingsStatus('success', 'Service account configuration cleared');
        (document.getElementById('service-account-json') as HTMLTextAreaElement).value = '';
      } else {
        this.showSettingsStatus('error', 'Failed to clear service account configuration');
      }
    } catch (error) {
      this.showSettingsStatus('error', 'Failed to clear service account configuration');
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

  private showSettingsStatus(type: 'success' | 'error' | 'info', message: string): void {
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