// Standalone content script without ES6 modules
class JobTracker {
  constructor() {
    this.init();
  }

  init() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'extractJobData') {
        try {
          const extractor = new SimpleJobExtractor();
          const extractedData = extractor.extractJobData();
          sendResponse({
            success: true,
            data: extractedData,
            error: null
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
}

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

// Initialize the job tracker
new JobTracker();