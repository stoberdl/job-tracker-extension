import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';
import { CompanyDetector } from '../utils/CompanyDetector';

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
    // Strategy 1: JSON-LD structured data (most reliable)
    const jsonLdResult = CompanyDetector.extractFromJsonLd(document);
    if (jsonLdResult) {
      return this.cleanText(jsonLdResult.name);
    }

    // Strategy 2: Lever-specific selectors
    const selectors = [
      '.main-header-logo a',
      '.main-header a[href="/"]',
      '[data-qa="company-name"]',
      '.posting-headline .company-name',
      '.posting-header .company',
      '.company-name',
      'header .company',
      '.lever-logo-link'
    ];

    let companyName = this.extractBySelectors(selectors);

    // Strategy 3: Extract from URL subdomain (companyname.lever.co)
    if (!companyName) {
      const subdomainResult = CompanyDetector.extractFromSubdomain(window.location.href);
      if (subdomainResult) {
        companyName = subdomainResult.name;
      }
    }

    // Strategy 4: Page title (often "Job Title - Company")
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

    // Strategy 5: Last part of title
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