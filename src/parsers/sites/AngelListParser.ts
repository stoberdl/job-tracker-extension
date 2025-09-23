import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';

export class AngelListParser extends BaseParser {
  siteName = 'AngelList';
  urlPatterns = ['angel.co/jobs', 'wellfound.com/jobs', 'angel.co/company'];

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
      '[data-test="StartupLink"]',
      '.company-name',
      '.startup-link',
      'a[href*="/company/"]',
      '.job-detail-header .company',
      '.JobDetail_companyName__'
    ];

    let companyName = this.extractBySelectors(selectors);

    if (!companyName) {
      const companyLink = document.querySelector('a[href*="/company/"], a[href*="/startup/"]');
      if (companyLink) {
        companyName = companyLink.textContent?.trim() || '';
      }
    }

    if (!companyName) {
      companyName = this.extractFromPageTitle();
    }

    return this.cleanText(companyName);
  }

  private extractJobTitle(): string {
    const selectors = [
      '[data-test="JobTitle"]',
      '.job-title',
      'h1.job-detail-title',
      '.JobDetail_title__',
      'h1[data-test="job-title"]'
    ];

    let jobTitle = this.extractBySelectors(selectors);

    if (!jobTitle) {
      const h1Elements = document.querySelectorAll('h1');
      for (let i = 0; i < h1Elements.length; i++) {
        const h1 = h1Elements[i];
        if (!h1) continue;
        const text = h1.textContent?.trim() || '';
        if (text && !text.toLowerCase().includes('angel') && !text.toLowerCase().includes('wellfound')) {
          jobTitle = text;
          break;
        }
      }
    }

    return this.cleanText(jobTitle);
  }

  private extractSalary(): string {
    const selectors = [
      '[data-test="salary"]',
      '.salary-range',
      '.compensation',
      '[class*="salary"]',
      '[class*="Salary"]'
    ];

    let salary = this.extractBySelectors(selectors);

    if (!salary) {
      const compensationElements = document.querySelectorAll('[class*="compensation"], [class*="Compensation"]');
      for (let i = 0; i < compensationElements.length; i++) {
        const element = compensationElements[i];
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
    const hasJobContent = document.querySelector('[data-test="JobTitle"], .job-title, .job-detail-title') !== null;
    const hasCompanyContent = document.querySelector('[data-test="StartupLink"], .company-name') !== null;

    return hasJobUrl && (hasJobContent || hasCompanyContent);
  }
}