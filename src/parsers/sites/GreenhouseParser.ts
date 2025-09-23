import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';

export class GreenhouseParser extends BaseParser {
  siteName = 'Greenhouse';
  urlPatterns = ['greenhouse.io', 'boards.greenhouse.io'];

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
      '.header-company-name',
      'a[href*="/company/"]',
      '.app-title'
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
      '.app-title',
      'h1',
      '.job-title',
      '.header-job-title'
    ];

    return this.cleanText(this.extractBySelectors(selectors));
  }

  private extractSalary(): string {
    const selectors = [
      '.salary',
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
    const hasJobContent = document.querySelector('.app-title, h1') !== null;

    return hasJobUrl && hasJobContent;
  }
}