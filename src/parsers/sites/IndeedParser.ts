import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';
import { CompanyDetector } from '../utils/CompanyDetector';

export class IndeedParser extends BaseParser {
  siteName = 'Indeed';
  urlPatterns = ['indeed.com/viewjob', 'indeed.com/jobs/view'];

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

    // Strategy 2: Indeed-specific selectors
    const selectors = [
      '[data-testid="company-name"]',
      '[data-testid="inlineHeader-companyName"]',
      '.jobsearch-InlineCompanyRating',
      '.jobsearch-CompanyInfoContainer a',
      '.jobsearch-JobInfoHeader-subtitle a',
      'a[data-jk][href*="cmp"]',
      '.icl-u-lg-mr--sm',
      '[data-company-name="true"]'
    ];

    let companyName = this.extractBySelectors(selectors);

    // Strategy 3: Company link fallback
    if (!companyName) {
      const companyLink = document.querySelector('a[href*="/cmp/"]');
      if (companyLink) {
        companyName = companyLink.textContent?.trim() || '';
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
      '.jobsearch-JobInfoHeader-title',
      'h1[data-automation="job-title"]',
      '.jobsearch-JobInfoHeader-title span[title]',
      'h1.icl-u-xs-mb--xs'
    ];

    return this.cleanText(this.extractBySelectors(selectors));
  }

  private extractSalary(): string {
    const selectors = [
      '.jobsearch-JobMetadataHeader-item:contains("$")',
      '.salary-snippet',
      '[data-testid="job-salary"]',
      '.icl-u-xs-mr--xs:contains("$")',
      '.jobsearch-JobDescriptionSection-sectionItem:contains("$")'
    ];

    let salary = this.extractBySelectors(selectors);

    if (!salary) {
      const salaryElements = document.querySelectorAll('.jobsearch-JobMetadataHeader-item, .jobsearch-JobDescriptionSection-sectionItem');
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
    const hasJobTitle = document.querySelector('.jobsearch-JobInfoHeader-title') !== null;
    const hasCompany = document.querySelector('[data-testid="company-name"], .jobsearch-InlineCompanyRating') !== null;

    return hasJobUrl && (hasJobTitle || hasCompany);
  }
}