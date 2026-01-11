import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';
import { RoleDetector } from '../utils/RoleDetector';
import { CompanyDetector, CompanyCandidate } from '../utils/CompanyDetector';

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
    const candidates: CompanyCandidate[] = [];

    // Strategy 1: CSS selectors (high confidence)
    const selectorResult = this.extractBySelectors(this.commonSelectors.companyName);
    if (selectorResult) {
      candidates.push({
        name: selectorResult,
        frequency: 1,
        source: 'selector',
        confidence: 90
      });
    }

    // Strategy 2: Meta tags
    const metaResult = this.extractFromMetaTags();
    if (metaResult) {
      candidates.push({
        name: metaResult,
        frequency: 1,
        source: 'meta',
        confidence: 80
      });
    }

    // Strategy 3: Page title
    const titleResult = this.extractFromPageTitle();
    if (titleResult) {
      candidates.push({
        name: titleResult,
        frequency: 1,
        source: 'title',
        confidence: 70
      });
    }

    // Strategy 4: Context patterns (e.g., "Join [Company] team")
    const bodyText = document.body?.textContent || '';
    const contextCandidates = CompanyDetector.extractFromContextPatterns(bodyText);
    candidates.push(...contextCandidates);

    // Strategy 5: Frequency analysis
    const frequencyCandidates = CompanyDetector.extractByFrequency(document);
    candidates.push(...frequencyCandidates);

    // Strategy 6: Logo alt text (fallback)
    const logoResult = this.extractFromLogoAlt();
    if (logoResult) {
      candidates.push({
        name: logoResult,
        frequency: 1,
        source: 'selector',
        confidence: 50
      });
    }

    // Strategy 7: URL domain (last resort)
    const urlResult = this.extractFromURL();
    if (urlResult) {
      candidates.push({
        name: urlResult,
        frequency: 1,
        source: 'url',
        confidence: 30
      });
    }

    // Strategy 8: Breadcrumbs
    const breadcrumbResult = this.extractFromBreadcrumbs();
    if (breadcrumbResult) {
      candidates.push({
        name: breadcrumbResult,
        frequency: 1,
        source: 'selector',
        confidence: 60
      });
    }

    // Use voting/scoring to select best candidate
    return CompanyDetector.selectBestCandidate(candidates);
  }

  private smartExtractRole(): string {
    const candidates: string[] = [];

    // Collect candidates from multiple sources
    const h1Text = document.querySelector('h1')?.textContent?.trim();
    if (h1Text) candidates.push(h1Text);

    // Title text (first segment before separator)
    const titleParts = document.title.split(/[\|\-\–]/);
    if (titleParts[0]?.trim()) {
      candidates.push(titleParts[0].trim());
    }

    // Job title from CSS selectors
    const selectorResult = this.extractBySelectors(this.commonSelectors.jobTitle);
    if (selectorResult) candidates.push(selectorResult);

    // All headers (h1, h2, h3)
    const allHeaders = document.querySelectorAll('h1, h2, h3');
    allHeaders.forEach(header => {
      const headerText = header.textContent?.trim();
      if (headerText && headerText.length < 150) {
        candidates.push(headerText);
      }
    });

    // Use RoleDetector to find best match with scoring
    const bestMatch = RoleDetector.extractBestRole(candidates);

    if (bestMatch && bestMatch.score >= 30) {
      return bestMatch.text;
    }

    // Fallback: return first h1 if available
    return h1Text || '';
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