import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';
import { CompanyDetector } from '../utils/CompanyDetector';

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
    // Strategy 1: JSON-LD structured data (most reliable)
    const jsonLdResult = CompanyDetector.extractFromJsonLd(document);
    if (jsonLdResult) {
      return this.cleanText(jsonLdResult.name);
    }

    // Strategy 2: Greenhouse-specific selectors
    const selectors = [
      '[data-mapped="company"]',
      '.company-name',
      '.header__company-name',
      '.header-company-name',
      '#header .company',
      '.main-header__company',
      '.job-board-header__company',
      '.app-body__header a[href="/"]',
      'header a[href="/"]'
    ];

    let companyName = this.extractBySelectors(selectors);

    // Strategy 3: Extract from URL subdomain (companyname.greenhouse.io)
    if (!companyName) {
      const subdomainResult = CompanyDetector.extractFromSubdomain(window.location.href);
      if (subdomainResult) {
        companyName = subdomainResult.name;
      }
    }

    // Strategy 4: Page title (often "Job Title at Company")
    if (!companyName) {
      const title = document.title;
      const atMatch = title.match(/(?:at|@)\s+([^|\-–]+)/i);
      if (atMatch && atMatch[1]) {
        const extracted = atMatch[1].trim();
        if (!CompanyDetector.isAtsPlatformName(extracted)) {
          companyName = extracted;
        }
      }
    }

    // Strategy 5: Last segment of title after separator
    if (!companyName) {
      const titleParts = document.title.split(/[\|\-–]/);
      if (titleParts.length > 1) {
        const lastPart = titleParts[titleParts.length - 1]?.trim() || '';
        if (lastPart && !CompanyDetector.isAtsPlatformName(lastPart)) {
          companyName = lastPart;
        }
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