import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';

export class LeverParser extends BaseParser {
  siteName = 'Lever';
  urlPatterns = ['lever.co', 'jobs.lever.co'];

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
      '.company-name',
      '.posting-header .company',
      'a[href*="/company/"]',
      '.posting-headline .company'
    ];

    let companyName = this.extractBySelectors(selectors);

    if (!companyName) {
      companyName = this.extractFromPageTitle();
    }

    if (!companyName) {
      const titleParts = document.title.split(' - ');
      if (titleParts.length > 1) {
        companyName = titleParts[titleParts.length - 1] || '';
      }
    }

    return this.cleanText(companyName);
  }

  private extractJobTitle(): string {
    const selectors = [
      '.posting-headline h2',
      '.posting-header h2',
      'h1',
      '.job-title'
    ];

    return this.cleanText(this.extractBySelectors(selectors));
  }

  private extractSalary(): string {
    const selectors = [
      '.salary-range',
      '.compensation',
      '*[class*="salary"]',
      '*[class*="compensation"]'
    ];

    let salary = this.extractBySelectors(selectors);

    if (!salary) {
      const bodyText = document.body.textContent || '';
      salary = this.extractSalaryFromText(bodyText);
    }

    return this.cleanText(salary);
  }

  isValidJobPage(): boolean {
    const url = window.location.href;
    const hasJobUrl = this.urlPatterns.some(pattern => url.includes(pattern));
    const hasJobContent = document.querySelector('.posting-headline, .posting-header') !== null;

    return hasJobUrl && hasJobContent;
  }
}