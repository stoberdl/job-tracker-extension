import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';
import { SalaryDetector } from '../utils/SalaryDetector';
import { CompanyDetector } from '../utils/CompanyDetector';

export class GlassdoorParser extends BaseParser {
  siteName = 'Glassdoor';
  urlPatterns = ['glassdoor.com/job-listing', 'glassdoor.com/jobs/view'];

  parse(): JobData {
    const jobData = this.getDefaultJobData();

    jobData.companyName = this.extractCompanyName();
    jobData.role = this.extractJobTitle();
    jobData.salary = this.extractSalary();
    jobData.notes = `Extracted from ${this.siteName}`;

    return jobData;
  }

  private extractCompanyName(): string {
    // Strategy 1: JSON-LD structured data (most reliable)
    const jsonLdResult = CompanyDetector.extractFromJsonLd(document);
    if (jsonLdResult) {
      return this.cleanText(jsonLdResult.name);
    }

    // Strategy 2: Glassdoor-specific selectors
    const selectors = [
      '[data-test="employer-name"]',
      '[data-test="employerName"]',
      '.employerName',
      '.job-details-header .employerName',
      'a[data-test="employer-name"]',
      '.JobDetails_companyName__',
      '.EmployerProfile_profileContainer .employerName',
      '[class*="EmployerProfile"] [class*="name"]'
    ];

    let companyName = this.extractBySelectors(selectors);

    // Strategy 3: Company header link fallback
    if (!companyName) {
      const companyHeader = document.querySelector('.job-details-header');
      if (companyHeader) {
        const companyLink = companyHeader.querySelector('a');
        if (companyLink) {
          companyName = companyLink.textContent?.trim() || '';
        }
      }
    }

    // Filter out ATS names
    if (companyName && CompanyDetector.isAtsPlatformName(companyName)) {
      companyName = '';
    }

    return this.cleanText(companyName);
  }

  private extractJobTitle(): string {
    const selectors = [
      '[data-test="job-title"]',
      '.jobTitle',
      '.job-details-header .jobTitle',
      'h1[data-test="job-title"]',
      '.JobDetails_jobTitle__'
    ];

    return this.cleanText(this.extractBySelectors(selectors));
  }

  private extractSalary(): string {
    // Use SalaryDetector for robust extraction
    const salary = SalaryDetector.extractSalaryString(document);
    if (salary) {
      return this.cleanText(salary);
    }

    // Fallback to selector-based extraction
    const selectors = [
      '[data-test="salary-estimate"]',
      '.salaryEstimate',
      '.SalaryEstimate',
      '[data-test="detailSalary"]',
      '.JobDetails_salary__'
    ];

    const selectorResult = this.extractBySelectors(selectors);
    if (selectorResult) {
      return this.cleanText(selectorResult);
    }

    return '';
  }

  isValidJobPage(): boolean {
    const url = window.location.href;
    const hasJobUrl = this.urlPatterns.some(pattern => url.includes(pattern));
    const hasJobTitle = document.querySelector('[data-test="job-title"], .jobTitle') !== null;
    const hasCompany = document.querySelector('[data-test="employer-name"], .employerName') !== null;

    return hasJobUrl && (hasJobTitle || hasCompany);
  }
}