import { SiteParser, JobData, ExtractedData } from '../types/JobData';
import { LinkedInParser } from './sites/LinkedInParser';
import { IndeedParser } from './sites/IndeedParser';
import { GlassdoorParser } from './sites/GlassdoorParser';
import { AngelListParser } from './sites/AngelListParser';
import { GreenhouseParser } from './sites/GreenhouseParser';
import { LeverParser } from './sites/LeverParser';
import { GenericParser } from './sites/GenericParser';

export class ParserFactory {
  private static parsers: SiteParser[] = [
    new LinkedInParser(),
    new IndeedParser(),
    new GlassdoorParser(),
    new AngelListParser(),
    new GreenhouseParser(),
    new LeverParser(),
    new GenericParser()
  ];

  static getParser(): SiteParser {
    const url = window.location.href;

    for (const parser of this.parsers) {
      if (parser.siteName === 'Generic') continue;

      const matchesPattern = parser.urlPatterns.some(pattern =>
        pattern === '*' || url.includes(pattern)
      );

      if (matchesPattern && parser.isValidJobPage()) {
        console.log(`Using ${parser.siteName} parser for ${url}`);
        return parser;
      }
    }

    const genericParser = new GenericParser();
    if (genericParser.isValidJobPage()) {
      console.log(`Using Generic parser for ${url}`);
      return genericParser;
    }

    console.log(`No suitable parser found for ${url}, using Generic parser anyway`);
    return genericParser;
  }

  static extractJobData(): ExtractedData {
    try {
      const parser = this.getParser();
      const data = parser.parse();

      const validationResult = this.validateExtractedData(data);

      return {
        success: true,
        data: data,
        parserUsed: parser.siteName,
        error: validationResult.warnings.length > 0 ? `Warnings: ${validationResult.warnings.join(', ')}` : undefined
      } as ExtractedData;
    } catch (error) {
      console.error('Error extracting job data:', error);

      return {
        success: false,
        data: this.getEmptyJobData(),
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      } as ExtractedData;
    }
  }

  private static validateExtractedData(data: JobData): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (!data.companyName || data.companyName.length < 2) {
      warnings.push('Company name may be incomplete');
    }

    if (!data.role || data.role.length < 3) {
      warnings.push('Job title may be incomplete');
    }

    if (data.linkToJobReq && !this.isValidUrl(data.linkToJobReq)) {
      warnings.push('Job URL may be invalid');
    }

    if (data.salary && !this.containsSalaryKeywords(data.salary)) {
      warnings.push('Salary information may be inaccurate');
    }

    return {
      isValid: warnings.length === 0,
      warnings
    };
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static containsSalaryKeywords(salary: string): boolean {
    const salaryKeywords = ['$', 'k', 'hour', 'year', 'annually', 'monthly', 'salary', 'usd', 'eur', 'gbp'];
    const lowerSalary = salary.toLowerCase();
    return salaryKeywords.some(keyword => lowerSalary.includes(keyword));
  }

  private static getEmptyJobData(): JobData {
    return {
      companyName: '',
      applicationStatus: 'Submitted - Pending Response',
      role: '',
      salary: '',
      dateSubmitted: new Date().toISOString().split('T')[0] || '',
      linkToJobReq: window.location.href,
      rejectionReason: 'N/A',
      notes: 'Manual entry required - extraction failed'
    };
  }

  static getSupportedSites(): string[] {
    return this.parsers
      .filter(parser => parser.siteName !== 'Generic')
      .map(parser => parser.siteName);
  }

  static testParser(siteName: string): ExtractedData {
    const parser = this.parsers.find(p => p.siteName === siteName);
    if (!parser) {
      return {
        success: false,
        data: this.getEmptyJobData(),
        error: `Parser for ${siteName} not found`
      } as ExtractedData;
    }

    try {
      const isValid = parser.isValidJobPage();
      const data = parser.parse();

      return {
        success: isValid,
        data: data,
        parserUsed: parser.siteName,
        error: isValid ? undefined : 'Page is not recognized as a valid job page'
      } as ExtractedData;
    } catch (error) {
      return {
        success: false,
        data: this.getEmptyJobData(),
        error: error instanceof Error ? error.message : 'Parser test failed'
      } as ExtractedData;
    }
  }
}