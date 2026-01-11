export interface SalaryMatch {
  raw: string;
  normalized: string;
  min: number | null;
  max: number | null;
  period: 'hourly' | 'yearly' | 'monthly' | 'unknown';
  confidence: number;
}

export class SalaryDetector {
  // Salary patterns ordered by specificity (most specific first)
  private static salaryPatterns: { pattern: RegExp; period: 'hourly' | 'yearly' | 'monthly' | 'unknown' }[] = [
    // $100,000 - $150,000 per year / annually / yr
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–to]+\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:year|yr|annually|annual|pa|p\.a\.)/gi, period: 'yearly' },
    // $100K - $150K (assumed yearly)
    { pattern: /\$\s*([\d.]+)\s*k\s*[-–to]+\s*\$?\s*([\d.]+)\s*k/gi, period: 'yearly' },
    // $100,000 - $150,000 (no period, assumed yearly if > $1000)
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–to]+\s*\$?\s*([\d,]+(?:\.\d{2})?)/gi, period: 'unknown' },
    // $50 - $75 per hour / hr / hourly
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–to]+\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:hour|hr|hourly)/gi, period: 'hourly' },
    // $5,000 - $8,000 per month / mo / monthly
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–to]+\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:month|mo|monthly)/gi, period: 'monthly' },
    // Single value: $150,000 per year
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:year|yr|annually|annual|pa|p\.a\.)/gi, period: 'yearly' },
    // Single value: $150K (assumed yearly)
    { pattern: /\$\s*([\d.]+)\s*k(?:\s|$|[,.])/gi, period: 'yearly' },
    // Single value: $50 per hour
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:hour|hr|hourly)/gi, period: 'hourly' },
    // Single value: $5,000 per month
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:month|mo|monthly)/gi, period: 'monthly' },
    // Range without $: 100,000 - 150,000 per year
    { pattern: /([\d,]+)\s*[-–to]+\s*([\d,]+)\s*(?:per\s+)?(?:year|yr|annually)/gi, period: 'yearly' },
    // Range: 100k - 150k
    { pattern: /([\d.]+)\s*k\s*[-–to]+\s*([\d.]+)\s*k/gi, period: 'yearly' },
    // Glassdoor format: $100K - $150K (Glassdoor Estimate)
    { pattern: /\$\s*([\d.]+)\s*k\s*[-–]\s*\$?\s*([\d.]+)\s*k\s*(?:\(.*(?:estimate|est)\))?/gi, period: 'yearly' },
    // LinkedIn format with /yr or /hr
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–]\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*\/\s*(?:yr|year)/gi, period: 'yearly' },
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–]\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*\/\s*(?:hr|hour)/gi, period: 'hourly' },
    // Single with /yr or /hr
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*\/\s*(?:yr|year)/gi, period: 'yearly' },
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*\/\s*(?:hr|hour)/gi, period: 'hourly' },
  ];

  // Keywords that indicate salary section
  private static salaryKeywords = [
    'salary', 'compensation', 'pay', 'wage', 'earning', 'income',
    'base pay', 'base salary', 'annual salary', 'hourly rate',
    'salary range', 'pay range', 'compensation range'
  ];

  static extractSalary(text: string): SalaryMatch | null {
    const matches: SalaryMatch[] = [];

    for (const { pattern, period } of this.salaryPatterns) {
      // Reset regex state
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const raw = match[0];
        const value1 = this.parseNumber(match[1]);
        const value2 = match[2] ? this.parseNumber(match[2]) : null;

        // Determine if it's a range or single value
        const min = value1;
        const max = value2 ?? value1;

        // Determine period if unknown
        let finalPeriod = period;
        if (period === 'unknown') {
          // If values are large (> 1000), assume yearly
          // If values are small (< 500), assume hourly
          if (min !== null) {
            if (min >= 1000) {
              finalPeriod = 'yearly';
            } else if (min < 500) {
              finalPeriod = 'hourly';
            }
          }
        }

        // Calculate confidence based on pattern specificity
        let confidence = 70;
        if (raw.includes('/yr') || raw.includes('/hr') || raw.includes('per year') || raw.includes('per hour')) {
          confidence = 95;
        } else if (raw.toLowerCase().includes('k')) {
          confidence = 85;
        } else if (value2 !== null) {
          confidence = 80; // Range is more reliable
        }

        const normalized = this.normalizeFormat(min, max, finalPeriod);

        matches.push({
          raw: raw.trim(),
          normalized,
          min,
          max,
          period: finalPeriod,
          confidence
        });
      }
    }

    // Return the match with highest confidence
    if (matches.length === 0) return null;

    matches.sort((a, b) => b.confidence - a.confidence);
    return matches[0] ?? null;
  }

  static extractFromDocument(doc: Document): SalaryMatch | null {
    const candidates: SalaryMatch[] = [];

    // Strategy 1: Look for salary in dedicated elements
    const salarySelectors = [
      '[data-test-id="job-salary-info"]',
      '[data-test="salary-estimate"]',
      '[data-testid="salary"]',
      '.salary-snippet',
      '.salaryEstimate',
      '.SalaryEstimate',
      '.job-details-preferences-and-skills__salary',
      '.jobs-description__salary',
      '*[class*="salary"]',
      '*[class*="Salary"]',
      '*[class*="compensation"]',
      '*[class*="pay-range"]'
    ];

    for (const selector of salarySelectors) {
      try {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent || '';
          const match = this.extractSalary(text);
          if (match) {
            match.confidence += 10; // Boost for being in salary element
            candidates.push(match);
          }
        });
      } catch {
        continue;
      }
    }

    // Strategy 2: Look for salary keywords near dollar amounts
    const bodyText = doc.body?.textContent || '';
    const lines = bodyText.split('\n');

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const hasSalaryKeyword = this.salaryKeywords.some(kw => lowerLine.includes(kw));

      if (hasSalaryKeyword || line.includes('$')) {
        const match = this.extractSalary(line);
        if (match) {
          if (hasSalaryKeyword) {
            match.confidence += 15; // Boost for being near salary keyword
          }
          candidates.push(match);
        }
      }
    }

    // Strategy 3: Look in job details/criteria sections
    const detailSelectors = [
      '.job-criteria__text',
      '.job-details__content',
      '.jobsearch-JobMetadataHeader-item',
      '.JobDetails',
      '[class*="job-detail"]'
    ];

    for (const selector of detailSelectors) {
      try {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent || '';
          if (text.includes('$')) {
            const match = this.extractSalary(text);
            if (match) {
              match.confidence += 5;
              candidates.push(match);
            }
          }
        });
      } catch {
        continue;
      }
    }

    // Return best match
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0] ?? null;
  }

  private static parseNumber(str: string | undefined): number | null {
    if (!str) return null;

    // Remove commas and whitespace
    let cleaned = str.replace(/[,\s]/g, '');

    // Handle 'k' notation (e.g., "150k" -> 150000)
    if (cleaned.toLowerCase().endsWith('k')) {
      cleaned = cleaned.slice(0, -1);
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num * 1000;
    }

    // Handle decimal 'k' notation (e.g., "1.5" when we know it's in k)
    if (cleaned.includes('.') && parseFloat(cleaned) < 1000) {
      // This might be like "150.5" for $150,500 or "1.5" for $1.5k
      // Context determines this, but we'll handle it conservatively
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private static normalizeFormat(min: number | null, max: number | null, period: string): string {
    if (min === null) return '';

    const formatValue = (val: number): string => {
      if (val >= 1000) {
        // Format as $XXXk or $X.Xk
        const k = val / 1000;
        if (k === Math.floor(k)) {
          return `$${k}k`;
        } else {
          return `$${k.toFixed(1)}k`;
        }
      }
      return `$${val}`;
    };

    const periodSuffix = period === 'hourly' ? '/hr' : period === 'yearly' ? '/yr' : '';

    if (max !== null && max !== min) {
      return `${formatValue(min)} - ${formatValue(max)}${periodSuffix}`;
    }

    return `${formatValue(min)}${periodSuffix}`;
  }

  // Helper to extract salary string for display
  static extractSalaryString(doc: Document): string {
    const match = this.extractFromDocument(doc);
    if (match) {
      // Return normalized format if confidence is high, otherwise raw
      return match.confidence >= 80 ? match.normalized : match.raw;
    }
    return '';
  }
}
