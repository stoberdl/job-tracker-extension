import { JobData, SiteParser } from '../../types/JobData';

export abstract class BaseParser implements SiteParser {
  abstract siteName: string;
  abstract urlPatterns: string[];

  protected commonSelectors = {
    jobTitle: [
      'h1[data-automation="job-title"]',
      '.jobsearch-JobInfoHeader-title',
      '[data-testid="job-title"]',
      'h1.job-title',
      '.job-title',
      'h1:first-of-type',
      '.topcard__title',
      '.job-details-jobs-unified-top-card__job-title'
    ],
    companyName: [
      '[data-testid="company-name"]',
      '.jobsearch-InlineCompanyRating',
      '[data-automation="company-name"]',
      '.company-name',
      'a[href*="/company/"]',
      '.topcard__org-name-link',
      '.job-details-jobs-unified-top-card__company-name',
      'a[data-control-name="job_details_topcard_company_url"]'
    ],
    salary: [
      '[data-testid="salary"]',
      '.salary-snippet',
      '[data-automation="salary"]',
      '[data-test-id="job-salary-info"]',
      '.jobsearch-JobMetadataHeader-item:contains("$")',
      '.salary',
      '*[class*="salary"]'
    ],
    location: [
      '[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-subtitle',
      '[data-automation="location"]',
      '.location',
      '[data-test-id="job-location"]'
    ]
  };

  abstract parse(): JobData;
  abstract isValidJobPage(): boolean;

  protected extractBySelectors(selectors: string[]): string {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element?.textContent?.trim()) {
          return element.textContent.trim();
        }
      } catch (error) {
        continue;
      }
    }
    return '';
  }

  protected extractFromPageTitle(): string {
    const title = document.title;
    const parts = title.split(/[\|\-\–]/);
    if (parts.length > 1) {
      return parts[parts.length - 1]?.trim() || '';
    }
    return '';
  }

  protected extractFromBreadcrumbs(): string {
    const breadcrumbs = document.querySelectorAll('[aria-label="breadcrumb"] a, .breadcrumb a, nav a');
    if (breadcrumbs.length > 0) {
      const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1] as HTMLElement;
      return lastBreadcrumb?.textContent?.trim() || '';
    }
    return '';
  }

  protected extractFromURL(): string {
    const url = window.location.href;
    const domain = new URL(url).hostname;
    const parts = domain.split('.');
    if (parts.length > 1) {
      const part = parts[parts.length - 2];
      return part || '';
    }
    return '';
  }

  protected extractSalaryFromText(text: string): string {
    const salaryPatterns = [
      /\$[\d,]+(?:\.\d{2})?(?:\s*-\s*\$[\d,]+(?:\.\d{2})?)?(?:\s*(?:per\s+)?(?:hour|hr|year|yr|annually|month|mo))?/gi,
      /[\d,]+k?(?:\s*-\s*[\d,]+k?)?\s*(?:per\s+)?(?:hour|hr|year|yr|annually|month|mo)/gi
    ];

    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return '';
  }

  protected getDefaultJobData(): JobData {
    return {
      companyName: '',
      applicationStatus: 'Not Applied',
      role: '',
      salary: '',
      dateSubmitted: new Date().toISOString().split('T')[0] || '',
      linkToJobReq: window.location.href,
      rejectionReason: '',
      notes: `Extracted using ${this.siteName} parser`
    };
  }

  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[""'']/g, '"')
      .trim();
  }
}