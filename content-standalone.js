// Standalone content script without ES6 modules
class SimpleJobExtractor {
  extractJobData() {
    const url = window.location.href;

    // Try LinkedIn extraction
    if (url.includes('linkedin.com/jobs')) {
      return this.extractLinkedIn();
    }

    // Try Indeed extraction
    if (url.includes('indeed.com')) {
      return this.extractIndeed();
    }

    // Try Glassdoor extraction
    if (url.includes('glassdoor.com')) {
      return this.extractGlassdoor();
    }

    // Generic extraction for other sites
    return this.extractGeneric();
  }

  extractLinkedIn() {
    const company = this.getTextFromSelectors([
      '.topcard__org-name-link',
      '.job-details-jobs-unified-top-card__company-name',
      'a[data-control-name="job_details_topcard_company_url"]'
    ]);

    const role = this.getTextFromSelectors([
      '.topcard__title',
      '.job-details-jobs-unified-top-card__job-title',
      'h1[data-test-id="job-title"]'
    ]);

    const salary = this.getTextFromSelectors([
      '[data-test-id="job-salary-info"]',
      '.job-details-preferences-and-skills__salary'
    ]);

    return {
      companyName: company,
      role: role,
      salary: salary,
      applicationStatus: 'Not Applied',
      dateSubmitted: new Date().toISOString().split('T')[0],
      linkToJobReq: window.location.href,
      rejectionReason: '',
      notes: 'Extracted from LinkedIn'
    };
  }

  extractIndeed() {
    const company = this.getTextFromSelectors([
      '[data-testid="company-name"]',
      '.jobsearch-InlineCompanyRating',
      '.jobsearch-CompanyInfoContainer a'
    ]);

    const role = this.getTextFromSelectors([
      '.jobsearch-JobInfoHeader-title',
      'h1[data-automation="job-title"]'
    ]);

    const salary = this.getTextFromSelectors([
      '.salary-snippet',
      '[data-testid="job-salary"]'
    ]);

    return {
      companyName: company,
      role: role,
      salary: salary,
      applicationStatus: 'Not Applied',
      dateSubmitted: new Date().toISOString().split('T')[0],
      linkToJobReq: window.location.href,
      rejectionReason: '',
      notes: 'Extracted from Indeed'
    };
  }

  extractGlassdoor() {
    const company = this.getTextFromSelectors([
      '[data-test="employer-name"]',
      '.employerName',
      '.job-details-header .employerName'
    ]);

    const role = this.getTextFromSelectors([
      '[data-test="job-title"]',
      '.jobTitle',
      '.job-details-header .jobTitle'
    ]);

    const salary = this.getTextFromSelectors([
      '[data-test="salary-estimate"]',
      '.salaryEstimate',
      '.SalaryEstimate'
    ]);

    return {
      companyName: company,
      role: role,
      salary: salary,
      applicationStatus: 'Not Applied',
      dateSubmitted: new Date().toISOString().split('T')[0],
      linkToJobReq: window.location.href,
      rejectionReason: '',
      notes: 'Extracted from Glassdoor'
    };
  }

  extractGeneric() {
    // Try to extract basic job information from any site
    const role = this.getTextFromSelectors([
      'h1',
      '.job-title',
      '[class*="job-title"]',
      '[class*="title"]'
    ]);

    const company = this.getTextFromSelectors([
      '.company',
      '.company-name',
      '[class*="company"]',
      'a[href*="/company/"]'
    ]) || this.extractCompanyFromTitle();

    return {
      companyName: company,
      role: role,
      salary: '',
      applicationStatus: 'Not Applied',
      dateSubmitted: new Date().toISOString().split('T')[0],
      linkToJobReq: window.location.href,
      rejectionReason: '',
      notes: 'Extracted using generic parser - please verify'
    };
  }

  getTextFromSelectors(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    return '';
  }

  extractCompanyFromTitle() {
    const title = document.title;
    const parts = title.split(/[\|\-\–]/);
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }
    return '';
  }
}

class JobTracker {
  constructor() {
    this.button = null;
    this.isProcessing = false;
    this.extractor = new SimpleJobExtractor();
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.addTrackButton());
    } else {
      this.addTrackButton();
    }

    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'extractJobData') {
        try {
          const jobData = this.extractor.extractJobData();
          sendResponse({
            success: true,
            data: jobData
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message || 'Extraction failed'
          });
        }
      }
      return true;
    });
  }

  addTrackButton() {
    if (document.querySelector('#job-tracker-btn') || this.button) {
      return;
    }

    this.button = document.createElement('button');
    this.button.id = 'job-tracker-btn';
    this.button.textContent = 'Track Job';
    this.button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: #007bff;
      color: white;
      border: none;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,123,255,0.3);
      transition: all 0.2s ease;
      min-width: 100px;
      text-align: center;
    `;

    this.button.addEventListener('click', () => this.handleTrackJob());

    document.body.appendChild(this.button);
  }

  async handleTrackJob() {
    if (this.isProcessing || !this.button) return;

    this.isProcessing = true;
    this.button.textContent = 'Extracting...';
    this.button.style.background = '#6c757d';

    try {
      const jobData = this.extractor.extractJobData();

      if (jobData.companyName || jobData.role) {
        this.showJobPreview(jobData);
      } else {
        this.showError('Could not extract job data from this page');
      }
    } catch (error) {
      this.showError(error.message || 'Unknown error occurred');
    } finally {
      this.isProcessing = false;
      this.button.textContent = 'Track Job';
      this.button.style.background = '#007bff';
    }
  }

  showJobPreview(jobData) {
    const modal = this.createPreviewModal(jobData);
    document.body.appendChild(modal);

    setTimeout(() => {
      modal.style.opacity = '1';
    }, 10);
  }

  createPreviewModal(jobData) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10001;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">Job Extracted Successfully</h3>
      <div style="margin-bottom: 16px;">
        <strong>Company:</strong> ${jobData.companyName || 'Not found'}
      </div>
      <div style="margin-bottom: 16px;">
        <strong>Role:</strong> ${jobData.role || 'Not found'}
      </div>
      <div style="margin-bottom: 16px;">
        <strong>Salary:</strong> ${jobData.salary || 'Not specified'}
      </div>
      <div style="margin-bottom: 20px;">
        <strong>URL:</strong> <a href="${jobData.linkToJobReq}" target="_blank" style="color: #007bff; text-decoration: none; word-break: break-all;">${jobData.linkToJobReq}</a>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
        <button id="save-btn" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 6px; cursor: pointer;">Save to Tracker</button>
      </div>
    `;

    overlay.appendChild(modal);

    const cancelBtn = modal.querySelector('#cancel-btn');
    const saveBtn = modal.querySelector('#save-btn');

    cancelBtn?.addEventListener('click', () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    });

    saveBtn?.addEventListener('click', () => {
      this.saveJobData(jobData);
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
      }
    });

    return overlay;
  }

  async saveJobData(jobData) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveJob',
        data: jobData
      });

      if (response.success) {
        this.button.textContent = 'Tracked!';
        this.button.style.background = '#28a745';
        setTimeout(() => {
          this.button.textContent = 'Track Job';
          this.button.style.background = '#007bff';
        }, 2000);
      } else {
        this.showError(response.error || 'Failed to save job data');
      }
    } catch (error) {
      this.showError('Failed to save job data');
    }
  }

  showError(message) {
    console.error('Job Tracker Error:', message);

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      z-index: 10002;
      max-width: 300px;
      word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize the job tracker
new JobTracker();