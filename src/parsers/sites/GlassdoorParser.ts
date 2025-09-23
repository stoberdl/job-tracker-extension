import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';

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
    const selectors = [
      '[data-test="employer-name"]',
      '.employerName',
      '.job-details-header .employerName',
      'a[data-test="employer-name"]',
      '.JobDetails_companyName__',
      '.EmployerProfile_profileContainer .employerName'
    ];

    let companyName = this.extractBySelectors(selectors);

    if (!companyName) {
      const companyHeader = document.querySelector('.job-details-header');
      if (companyHeader) {
        const companyLink = companyHeader.querySelector('a');
        if (companyLink) {
          companyName = companyLink.textContent?.trim() || '';
        }
      }
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
    const selectors = [
      '[data-test="salary-estimate"]',
      '.salaryEstimate',
      '.SalaryEstimate',
      '[data-test="detailSalary"]',
      '.JobDetails_salary__',
      '.css-1xe2xww'
    ];

    let salary = this.extractBySelectors(selectors);

    if (!salary) {
      const salaryElements = document.querySelectorAll('[class*="salary"], [class*="Salary"]');
      for (let i = 0; i < salaryElements.length; i++) {
        const element = salaryElements[i];
        if (!element) continue;
        const text = element.textContent || '';
        const extractedSalary = this.extractSalaryFromText(text);
        if (extractedSalary) {
          salary = extractedSalary;
          break;
        }
      }
    }

    if (!salary) {
      const bodyText = document.body.textContent || '';
      salary = this.extractSalaryFromText(bodyText);
    }

    return this.cleanText(salary);
  }

  isValidJobPage(): boolean {
    const url = window.location.href;
    const hasJobUrl = this.urlPatterns.some(pattern => url.includes(pattern));
    const hasJobTitle = document.querySelector('[data-test="job-title"], .jobTitle') !== null;
    const hasCompany = document.querySelector('[data-test="employer-name"], .employerName') !== null;

    return hasJobUrl && (hasJobTitle || hasCompany);
  }
}