import { BaseParser } from '../base/BaseParser';
import { JobData } from '../../types/JobData';
import { RoleDetector } from '../utils/RoleDetector';
import { CompanyDetector, CompanyCandidate } from '../utils/CompanyDetector';
import { SalaryDetector } from '../utils/SalaryDetector';

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

    // Strategy 1: JSON-LD structured data (HIGHEST confidence)
    const jsonLdResult = CompanyDetector.extractFromJsonLd(document);
    if (jsonLdResult) {
      candidates.push(jsonLdResult);
    }

    // Strategy 2: URL subdomain for known ATS platforms
    const subdomainResult = CompanyDetector.extractFromSubdomain(window.location.href);
    if (subdomainResult) {
      candidates.push(subdomainResult);
    }

    // Strategy 3: CSS selectors (high confidence)
    const selectorResult = this.extractBySelectors(this.commonSelectors.companyName);
    if (selectorResult && !CompanyDetector.isAtsPlatformName(selectorResult)) {
      candidates.push({
        name: selectorResult,
        frequency: 1,
        source: 'selector',
        confidence: 90
      });
    }

    // Strategy 4: Meta tags
    const metaResult = this.extractFromMetaTags();
    if (metaResult && !CompanyDetector.isAtsPlatformName(metaResult)) {
      candidates.push({
        name: metaResult,
        frequency: 1,
        source: 'meta',
        confidence: 80
      });
    }

    // Strategy 5: Page title
    const titleResult = this.extractFromPageTitle();
    if (titleResult && !CompanyDetector.isAtsPlatformName(titleResult)) {
      candidates.push({
        name: titleResult,
        frequency: 1,
        source: 'title',
        confidence: 70
      });
    }

    // Strategy 6: Context patterns (e.g., "Join [Company] team")
    const bodyText = document.body?.textContent || '';
    const contextCandidates = CompanyDetector.extractFromContextPatterns(bodyText);
    candidates.push(...contextCandidates);

    // Strategy 7: Frequency analysis
    const frequencyCandidates = CompanyDetector.extractByFrequency(document);
    candidates.push(...frequencyCandidates);

    // Strategy 8: Logo alt text (fallback)
    const logoResult = this.extractFromLogoAlt();
    if (logoResult) {
      candidates.push({
        name: logoResult,
        frequency: 1,
        source: 'selector',
        confidence: 50
      });
    }

    // Strategy 9: URL domain (last resort)
    const urlResult = this.extractFromURL();
    if (urlResult && !CompanyDetector.isAtsPlatformName(urlResult)) {
      candidates.push({
        name: urlResult,
        frequency: 1,
        source: 'url',
        confidence: 30
      });
    }

    // Strategy 10: Breadcrumbs
    const breadcrumbResult = this.extractFromBreadcrumbs();
    if (breadcrumbResult && !CompanyDetector.isAtsPlatformName(breadcrumbResult)) {
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
    // Use SalaryDetector for robust extraction
    const salary = SalaryDetector.extractSalaryString(document);
    if (salary) {
      return salary;
    }

    // Fallback to selector-based extraction
    const selectorResult = this.extractBySelectors(this.commonSelectors.salary);
    if (selectorResult) {
      return selectorResult;
    }

    return '';
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
    const logos = document.querySelectorAll('img[alt*="logo"], img[src*="logo"], img[class*="logo"], img[alt*="Logo"]');
    for (let i = 0; i < logos.length; i++) {
      const logo = logos[i];
      const alt = (logo as HTMLImageElement).alt;
      if (alt) {
        // Clean up common alt text patterns
        let companyName = alt
          .replace(/\s*logo\s*/gi, ' ')
          .replace(/\s*icon\s*/gi, ' ')
          .replace(/\s*image\s*/gi, ' ')
          .replace(/powered\s+by\s*/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Skip if empty, too short, or is an ATS platform name
        if (companyName.length > 1 && !CompanyDetector.isAtsPlatformName(companyName)) {
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