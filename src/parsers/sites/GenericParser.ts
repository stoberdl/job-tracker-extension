import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';

export class GenericParser extends BaseParser {
  siteName = 'Generic';
  urlPatterns = ['*'];

  parse(): JobData {
    const jobData = this.getDefaultJobData();

    jobData.companyName = this.smartExtractCompany();
    jobData.role = this.smartExtractRole();
    jobData.salary = this.smartExtractSalary();
    jobData.notes = 'Auto-extracted (please verify)';

    return jobData;
  }

  private smartExtractCompany(): string {
    const patterns = [
      () => this.extractBySelectors(this.commonSelectors.companyName),
      () => this.extractFromPageTitle(),
      () => this.extractFromBreadcrumbs(),
      () => this.extractFromURL(),
      () => this.extractFromMetaTags(),
      () => this.extractFromLogoAlt()
    ];

    for (const pattern of patterns) {
      const result = pattern();
      if (result && result.length > 1) {
        return result;
      }
    }
    return '';
  }

  private smartExtractRole(): string {
    const h1Text = document.querySelector('h1')?.textContent?.trim() || '';
    const titleText = document.title;

    const jobKeywords = [
      'engineer', 'developer', 'manager', 'analyst', 'specialist', 'coordinator',
      'director', 'lead', 'senior', 'junior', 'intern', 'associate', 'consultant',
      'architect', 'designer', 'scientist', 'researcher', 'technician', 'administrator'
    ];

    if (h1Text && this.containsJobKeywords(h1Text, jobKeywords)) {
      return h1Text;
    }

    if (titleText && this.containsJobKeywords(titleText, jobKeywords)) {
      const cleanTitle = titleText.split(/[\|\-\–]/)[0]?.trim() || '';
      return cleanTitle;
    }

    const jobTitleFromSelectors = this.extractBySelectors(this.commonSelectors.jobTitle);
    if (jobTitleFromSelectors) {
      return jobTitleFromSelectors;
    }

    const allHeaders = document.querySelectorAll('h1, h2, h3');
    for (let i = 0; i < allHeaders.length; i++) {
      const header = allHeaders[i];
      if (!header) continue;
      const headerText = header.textContent?.trim() || '';
      if (this.containsJobKeywords(headerText, jobKeywords)) {
        return headerText;
      }
    }

    return '';
  }

  private smartExtractSalary(): string {
    let salary = this.extractBySelectors(this.commonSelectors.salary);

    if (!salary) {
      const salaryElements = document.querySelectorAll('*[class*="salary"], *[class*="Salary"], *[class*="compensation"], *[class*="pay"]');
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
      const lines = bodyText.split('\n');
      for (const line of lines) {
        const extractedSalary = this.extractSalaryFromText(line);
        if (extractedSalary) {
          salary = extractedSalary;
          break;
        }
      }
    }

    return salary;
  }

  private extractFromMetaTags(): string {
    const metaSelectors = [
      'meta[property="og:site_name"]',
      'meta[name="author"]',
      'meta[name="publisher"]',
      'meta[property="og:title"]'
    ];

    for (const selector of metaSelectors) {
      const meta = document.querySelector(selector) as HTMLMetaElement;
      if (meta?.content) {
        return meta.content.trim();
      }
    }
    return '';
  }

  private extractFromLogoAlt(): string {
    const logos = document.querySelectorAll('img[alt*="logo"], img[src*="logo"], img[class*="logo"]');
    for (let i = 0; i < logos.length; i++) {
      const logo = logos[i];
      const alt = (logo as HTMLImageElement).alt;
      if (alt && alt.toLowerCase().includes('logo')) {
        const companyName = alt.replace(/logo/gi, '').trim();
        if (companyName.length > 1) {
          return companyName;
        }
      }
    }
    return '';
  }

  private containsJobKeywords(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  isValidJobPage(): boolean {
    const indicators = [
      () => document.title.toLowerCase().includes('job'),
      () => document.title.toLowerCase().includes('career'),
      () => document.title.toLowerCase().includes('position'),
      () => window.location.href.includes('job'),
      () => window.location.href.includes('career'),
      () => window.location.href.includes('position'),
      () => document.querySelector('[data-testid*="job"], [class*="job"], [id*="job"]') !== null,
      () => (document.body.textContent?.includes('apply now') || false),
      () => (document.body.textContent?.includes('apply for') || false),
      () => document.querySelector('button:contains("apply"), a:contains("apply")') !== null,
      () => this.hasJobKeywordsInContent()
    ];

    return indicators.filter(check => check()).length >= 2;
  }

  private hasJobKeywordsInContent(): boolean {
    const content = document.body.textContent?.toLowerCase() || '';
    const jobKeywords = [
      'job description', 'responsibilities', 'requirements', 'qualifications',
      'skills required', 'experience', 'education', 'benefits', 'salary',
      'employment type', 'full time', 'part time', 'remote', 'on-site'
    ];

    return jobKeywords.some(keyword => content.includes(keyword));
  }
}