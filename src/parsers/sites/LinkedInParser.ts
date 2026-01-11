import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';
import { SalaryDetector } from '../utils/SalaryDetector';

export class LinkedInParser extends BaseParser {
  siteName = 'LinkedIn';
  urlPatterns = ['linkedin.com/jobs/view', 'linkedin.com/jobs/collections'];

  parse(): JobData {
    const jobData = this.getDefaultJobData();

    jobData.companyName = this.extractCompanyName();
    jobData.role = this.extractJobTitle();
    jobData.salary = this.extractSalary();
    jobData.notes = `Extracted from ${this.siteName}`;

    return jobData;
  }

  private extractCompanyName(): string {
    const selectors = [
      '.topcard__org-name-link',
      '.job-details-jobs-unified-top-card__company-name',
      'a[data-control-name="job_details_topcard_company_url"]',
      '.topcard__flavor--black-link',
      '.jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__company-name a'
    ];

    let companyName = this.extractBySelectors(selectors);

    if (!companyName) {
      const companyLink = document.querySelector('a[href*="/company/"]');
      if (companyLink) {
        companyName = companyLink.textContent?.trim() || '';
      }
    }

    return this.cleanText(companyName);
  }

  private extractJobTitle(): string {
    const selectors = [
      '.topcard__title',
      '.job-details-jobs-unified-top-card__job-title',
      'h1[data-test-id="job-title"]',
      '.jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title h1'
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
      '[data-test-id="job-salary-info"]',
      '.job-details-preferences-and-skills__salary',
      '.jobs-description__salary'
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
    const hasJobTitle = document.querySelector('.topcard__title, .job-details-jobs-unified-top-card__job-title') !== null;
    const hasCompany = document.querySelector('.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name') !== null;

    return hasJobUrl && (hasJobTitle || hasCompany);
  }
}