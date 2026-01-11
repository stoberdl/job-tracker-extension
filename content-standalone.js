// Standalone content script without ES6 modules

// Role Detection with Scoring
class RoleDetector {
  // Tier 1: Exact tech role matches (highest priority, score: 100)
  static exactTechRoles = [
    'software engineer', 'software developer', 'full stack developer',
    'fullstack developer', 'full-stack developer', 'frontend developer',
    'front-end developer', 'frontend engineer', 'front-end engineer',
    'backend developer', 'back-end developer', 'backend engineer',
    'back-end engineer', 'devops engineer', 'site reliability engineer',
    'sre', 'platform engineer', 'cloud engineer', 'data engineer',
    'ml engineer', 'machine learning engineer', 'ai engineer',
    'mobile developer', 'mobile engineer', 'ios developer', 'ios engineer',
    'android developer', 'android engineer', 'web developer',
    'systems engineer', 'infrastructure engineer', 'security engineer',
    'qa engineer', 'test engineer', 'automation engineer',
    'solutions architect', 'technical architect', 'software architect',
    'data scientist', 'research scientist', 'applied scientist', 'research engineer'
  ];

  // Tier 2: Regex patterns for common SWE formats (score: 90)
  static techPatterns = [
    /\b(sde|swe|sre)\s*[iI1-3]{1,3}\b/i,
    /\bstaff\s+(software\s+)?engineer/i,
    /\bprincipal\s+(software\s+)?engineer/i,
    /\bsenior\s+(software\s+)?engineer/i,
    /\bjunior\s+(software\s+)?engineer/i,
    /\b(sr\.|sr)\s+(software\s+)?engineer/i,
    /\b(software|backend|frontend|full[- ]?stack)\s+engineer(ing)?\s+(intern|new\s+grad)/i,
    /\bengineer\s*[-–]\s*(backend|frontend|platform|infrastructure|data)/i,
    /\b(l[3-7]|e[3-7]|ic[1-5])\s+(software\s+)?engineer/i,
    /\bnew\s+grad\s+(software\s+)?engineer/i,
    /\bentry[- ]level\s+(software\s+)?engineer/i,
    /\b(backend|frontend|fullstack|full-stack)\s+engineer/i,
    /\b(python|java|golang|rust|node|react|typescript)\s+(developer|engineer)/i,
    /\bdev\s*ops\b/i,
    /\bsoftware\s+development\s+engineer/i
  ];

  // Tier 3: Generic tech keywords (score: 70)
  static genericTechKeywords = ['engineer', 'developer', 'architect', 'programmer', 'coder'];

  // Tier 4: General role keywords (score: 30)
  static genericKeywords = ['manager', 'analyst', 'specialist', 'lead', 'director', 'consultant', 'coordinator'];

  // Negative keywords that suggest non-tech roles
  static nonTechIndicators = [
    'sales', 'marketing', 'hr', 'human resources', 'recruiting', 'recruiter',
    'talent acquisition', 'account manager', 'customer success', 'support specialist',
    'office manager', 'administrative', 'financial analyst', 'operations manager',
    'project manager', 'product manager'
  ];

  static scoreRole(text) {
    const lowerText = text.toLowerCase().trim();
    if (text.length > 150) return null;

    let hasNonTechIndicator = false;
    for (const indicator of this.nonTechIndicators) {
      if (lowerText.includes(indicator)) {
        const hasStrongTechSignal = this.exactTechRoles.some(role => lowerText.includes(role));
        if (!hasStrongTechSignal) {
          hasNonTechIndicator = true;
          break;
        }
      }
    }

    // Tier 1: Exact tech role match
    for (const role of this.exactTechRoles) {
      if (lowerText.includes(role)) {
        return { text, score: 100, matchType: 'exact_tech' };
      }
    }

    // Tier 2: Regex pattern match
    for (const pattern of this.techPatterns) {
      if (pattern.test(lowerText)) {
        return { text, score: 90, matchType: 'tech_pattern' };
      }
    }

    // Tier 3: Generic tech keywords
    for (const keyword of this.genericTechKeywords) {
      if (lowerText.includes(keyword)) {
        const score = hasNonTechIndicator ? 40 : 70;
        return { text, score, matchType: 'generic_tech' };
      }
    }

    // Tier 4: Generic keywords
    if (!hasNonTechIndicator) {
      for (const keyword of this.genericKeywords) {
        if (lowerText.includes(keyword)) {
          return { text, score: 30, matchType: 'generic' };
        }
      }
    }

    if (hasNonTechIndicator) {
      return { text, score: 10, matchType: 'generic' };
    }

    return null;
  }

  static extractBestRole(candidates) {
    let bestMatch = null;
    for (const candidate of candidates) {
      if (!candidate || candidate.trim().length === 0) continue;
      const match = this.scoreRole(candidate.trim());
      if (match && (!bestMatch || match.score > bestMatch.score)) {
        bestMatch = match;
      }
    }
    return bestMatch;
  }
}

// Company Detection with Frequency and Pattern Analysis
class CompanyDetector {
  static contextPatterns = [
    /(?:at|@)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s+is|\s+we|[.,]|$)/i,
    /join\s+(?:the\s+)?([A-Z][A-Za-z0-9\s&.,'-]+?)\s+(?:team|family)/i,
    /([A-Z][A-Za-z0-9\s&.,'-]+?)\s+is\s+(?:hiring|looking|seeking)/i,
    /work(?:ing)?\s+(?:at|for)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s|[.,]|$)/i,
    /careers?\s+(?:at|with)\s+([A-Z][A-Za-z0-9\s&.,'-]+)/i,
    /([A-Z][A-Za-z0-9\s&.,'-]+?)\s+careers?/i,
    /about\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s|:)/i,
    /([A-Z][A-Za-z0-9\s&.,'-]+?)\s+(?:jobs?|openings?|positions?)/i
  ];

  static stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'job', 'jobs', 'career', 'careers', 'position', 'positions', 'opening',
    'apply', 'application', 'hiring', 'looking', 'seeking', 'join',
    'team', 'work', 'working', 'opportunity', 'opportunities',
    'software', 'engineer', 'developer', 'senior', 'junior', 'manager',
    'remote', 'hybrid', 'onsite', 'full-time', 'part-time', 'contract',
    'about', 'us', 'our', 'we', 'you', 'your', 'this', 'that', 'these',
    'new', 'all', 'more', 'view', 'see', 'find', 'search', 'home', 'back',
    'next', 'previous', 'page', 'site', 'website', 'company', 'companies'
  ]);

  static negativeIndicators = [
    'description', 'requirements', 'qualifications', 'responsibilities',
    'benefits', 'location', 'salary', 'experience', 'skills', 'education',
    'overview', 'summary', 'details', 'information', 'posted', 'date',
    'apply now', 'submit', 'sign in', 'log in', 'register', 'similar jobs'
  ];

  static cleanCompanyName(name) {
    let cleaned = name.trim()
      .replace(/\s+(is|are|was|team|jobs?|careers?|Inc\.?|LLC|Ltd\.?|Corp\.?)$/i, '')
      .replace(/[,.]$/, '')
      .trim();

    const words = cleaned.toLowerCase().split(/\s+/);
    if (words.every(word => this.stopWords.has(word))) {
      return '';
    }

    const lowerCleaned = cleaned.toLowerCase();
    if (this.negativeIndicators.some(ind => lowerCleaned.includes(ind))) {
      return '';
    }

    return cleaned;
  }

  static extractFromContextPatterns(text) {
    const candidates = [];
    const seenNames = new Set();

    for (const pattern of this.contextPatterns) {
      const regex = new RegExp(pattern, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const name = this.cleanCompanyName(match[1]);
          if (name && name.length >= 2 && name.length <= 50 && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            candidates.push({ name, frequency: 1, source: 'context_pattern', confidence: 85 });
          }
        }
      }
    }

    return candidates;
  }

  static extractByFrequency(doc) {
    const textContent = doc.body?.textContent || '';
    const wordFrequency = new Map();
    const capitalizedPattern = /\b([A-Z][a-z]*(?:\s+[A-Z][a-z]*){0,3})\b/g;
    let match;

    while ((match = capitalizedPattern.exec(textContent)) !== null) {
      const phrase = match[1].trim();
      const words = phrase.split(/\s+/);

      if (words.length === 1 && this.stopWords.has(words[0].toLowerCase())) continue;
      if (words.every(word => this.stopWords.has(word.toLowerCase()))) continue;
      if (phrase.length < 2 || phrase.length > 40) continue;

      const lowerPhrase = phrase.toLowerCase();
      if (this.negativeIndicators.some(ind => lowerPhrase.includes(ind))) continue;
      if (words.length > 4) continue;

      const current = wordFrequency.get(phrase) || 0;
      wordFrequency.set(phrase, current + 1);
    }

    const candidates = [];
    for (const [name, frequency] of wordFrequency) {
      if (frequency >= 3) {
        candidates.push({
          name,
          frequency,
          source: 'frequency',
          confidence: Math.min(95, 50 + (frequency * 5))
        });
      }
    }

    candidates.sort((a, b) => b.frequency - a.frequency);
    return candidates.slice(0, 10);
  }

  static selectBestCandidate(candidates) {
    if (candidates.length === 0) return '';

    const scored = candidates.map(candidate => {
      let score = candidate.confidence;

      switch (candidate.source) {
        case 'context_pattern': score += 20; break;
        case 'selector': score += 15; break;
        case 'meta': score += 10; break;
        case 'frequency': score += candidate.frequency * 3; break;
        case 'title': score += 5; break;
        case 'url': score += 0; break;
      }

      if (candidate.frequency > 1) {
        score += Math.min(20, candidate.frequency * 2);
      }

      if (candidate.name.length < 3) score -= 20;

      const lowerName = candidate.name.toLowerCase();
      const jobTitleWords = ['engineer', 'developer', 'manager', 'director', 'analyst', 'specialist'];
      if (jobTitleWords.some(word => lowerName.includes(word))) score -= 50;

      const genericTerms = ['software', 'remote', 'hybrid', 'full time', 'part time'];
      if (genericTerms.some(term => lowerName.includes(term))) score -= 40;

      return { ...candidate, finalScore: score };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);

    if (scored[0].finalScore >= 40) {
      return scored[0].name;
    }

    return '';
  }
}

// Salary Detection with Pattern Matching
class SalaryDetector {
  static salaryPatterns = [
    // $100,000 - $150,000 per year / annually / yr
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–to]+\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:year|yr|annually|annual|pa|p\.a\.)/gi, period: 'yearly' },
    // $100K - $150K (assumed yearly)
    { pattern: /\$\s*([\d.]+)\s*k\s*[-–to]+\s*\$?\s*([\d.]+)\s*k/gi, period: 'yearly' },
    // $100,000 - $150,000 (no period, assumed yearly if > $1000)
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–to]+\s*\$?\s*([\d,]+(?:\.\d{2})?)/gi, period: 'unknown' },
    // $50 - $75 per hour / hr / hourly
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–to]+\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:hour|hr|hourly)/gi, period: 'hourly' },
    // Single value: $150,000 per year
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:year|yr|annually|annual|pa|p\.a\.)/gi, period: 'yearly' },
    // Single value: $150K (assumed yearly)
    { pattern: /\$\s*([\d.]+)\s*k(?:\s|$|[,.])/gi, period: 'yearly' },
    // Single value: $50 per hour
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per\s+)?(?:hour|hr|hourly)/gi, period: 'hourly' },
    // LinkedIn format with /yr or /hr
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–]\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*\/\s*(?:yr|year)/gi, period: 'yearly' },
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*[-–]\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*\/\s*(?:hr|hour)/gi, period: 'hourly' },
    // Single with /yr or /hr
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*\/\s*(?:yr|year)/gi, period: 'yearly' },
    { pattern: /\$\s*([\d,]+(?:\.\d{2})?)\s*\/\s*(?:hr|hour)/gi, period: 'hourly' },
  ];

  static salaryKeywords = [
    'salary', 'compensation', 'pay', 'wage', 'earning', 'income',
    'base pay', 'base salary', 'annual salary', 'hourly rate',
    'salary range', 'pay range', 'compensation range'
  ];

  static parseNumber(str) {
    if (!str) return null;
    let cleaned = str.replace(/[,\s]/g, '');
    if (cleaned.toLowerCase().endsWith('k')) {
      cleaned = cleaned.slice(0, -1);
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num * 1000;
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  static normalizeFormat(min, max, period) {
    if (min === null) return '';
    const formatValue = (val) => {
      if (val >= 1000) {
        const k = val / 1000;
        return k === Math.floor(k) ? `$${k}k` : `$${k.toFixed(1)}k`;
      }
      return `$${val}`;
    };
    const periodSuffix = period === 'hourly' ? '/hr' : period === 'yearly' ? '/yr' : '';
    if (max !== null && max !== min) {
      return `${formatValue(min)} - ${formatValue(max)}${periodSuffix}`;
    }
    return `${formatValue(min)}${periodSuffix}`;
  }

  static extractSalary(text) {
    const matches = [];
    for (const { pattern, period } of this.salaryPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const raw = match[0];
        const value1 = this.parseNumber(match[1]);
        const value2 = match[2] ? this.parseNumber(match[2]) : null;
        const min = value1;
        const max = value2 ?? value1;

        let finalPeriod = period;
        if (period === 'unknown' && min !== null) {
          finalPeriod = min >= 1000 ? 'yearly' : min < 500 ? 'hourly' : 'unknown';
        }

        let confidence = 70;
        if (raw.includes('/yr') || raw.includes('/hr') || raw.includes('per year') || raw.includes('per hour')) {
          confidence = 95;
        } else if (raw.toLowerCase().includes('k')) {
          confidence = 85;
        } else if (value2 !== null) {
          confidence = 80;
        }

        const normalized = this.normalizeFormat(min, max, finalPeriod);
        matches.push({ raw: raw.trim(), normalized, min, max, period: finalPeriod, confidence });
      }
    }

    if (matches.length === 0) return null;
    matches.sort((a, b) => b.confidence - a.confidence);
    return matches[0];
  }

  static extractFromDocument(doc) {
    const candidates = [];

    // Strategy 1: Look for salary in dedicated elements
    const salarySelectors = [
      '[data-test-id="job-salary-info"]',
      '[data-test="salary-estimate"]',
      '[data-testid="salary"]',
      '.salary-snippet',
      '.salaryEstimate',
      '.SalaryEstimate',
      '.job-details-preferences-and-skills__salary',
      '*[class*="salary"]',
      '*[class*="Salary"]',
      '*[class*="compensation"]'
    ];

    for (const selector of salarySelectors) {
      try {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent || '';
          const match = this.extractSalary(text);
          if (match) {
            match.confidence += 10;
            candidates.push(match);
          }
        });
      } catch { continue; }
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
          if (hasSalaryKeyword) match.confidence += 15;
          candidates.push(match);
        }
      }
    }

    // Strategy 3: Look in job details/criteria sections
    const detailSelectors = ['.job-criteria__text', '.job-details__content', '.jobsearch-JobMetadataHeader-item'];
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
      } catch { continue; }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0];
  }

  static extractSalaryString(doc) {
    const match = this.extractFromDocument(doc);
    if (match) {
      return match.confidence >= 80 ? match.normalized : match.raw;
    }
    return '';
  }
}

class JobTracker {
  constructor() {
    this.init();
  }

  init() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'extractJobData') {
        try {
          const extractor = new SimpleJobExtractor();
          const extractedData = extractor.extractJobData();
          sendResponse({
            success: true,
            data: extractedData,
            error: null
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message || 'Extraction failed'
          });
        }
      }
      return true;
    });
  }
}

class SimpleJobExtractor {
  extractJobData() {
    const url = window.location.href;

    // Try LinkedIn extraction
    if (url.includes('linkedin.com/jobs')) {
      return this.extractLinkedIn();
    }

    // Try Indeed extraction
    if (url.includes('indeed.com')) {
      return this.extractIndeed();
    }

    // Try Glassdoor extraction
    if (url.includes('glassdoor.com')) {
      return this.extractGlassdoor();
    }

    // Generic extraction for other sites
    return this.extractGeneric();
  }

  extractLinkedIn() {
    const company = this.getTextFromSelectors([
      '.topcard__org-name-link',
      '.job-details-jobs-unified-top-card__company-name',
      'a[data-control-name="job_details_topcard_company_url"]'
    ]);

    const role = this.getTextFromSelectors([
      '.topcard__title',
      '.job-details-jobs-unified-top-card__job-title',
      'h1[data-test-id="job-title"]'
    ]);

    // Use SalaryDetector for robust extraction
    let salary = SalaryDetector.extractSalaryString(document);
    if (!salary) {
      salary = this.getTextFromSelectors([
        '[data-test-id="job-salary-info"]',
        '.job-details-preferences-and-skills__salary'
      ]);
    }

    return {
      companyName: company,
      role: role,
      salary: salary,
      applicationStatus: 'Submitted - Pending Response',
      dateSubmitted: new Date().toLocaleDateString('en-CA'),
      linkToJobReq: window.location.href,
      rejectionReason: 'N/A',
      notes: 'Extracted from LinkedIn'
    };
  }

  extractIndeed() {
    const company = this.getTextFromSelectors([
      '[data-testid="company-name"]',
      '.jobsearch-InlineCompanyRating',
      '.jobsearch-CompanyInfoContainer a'
    ]);

    const role = this.getTextFromSelectors([
      '.jobsearch-JobInfoHeader-title',
      'h1[data-automation="job-title"]'
    ]);

    const salary = this.getTextFromSelectors([
      '.salary-snippet',
      '[data-testid="job-salary"]'
    ]);

    return {
      companyName: company,
      role: role,
      salary: salary,
      applicationStatus: 'Submitted - Pending Response',
      dateSubmitted: new Date().toLocaleDateString('en-CA'),
      linkToJobReq: window.location.href,
      rejectionReason: 'N/A',
      notes: 'Extracted from Indeed'
    };
  }

  extractGlassdoor() {
    const company = this.getTextFromSelectors([
      '[data-test="employer-name"]',
      '.employerName',
      '.job-details-header .employerName'
    ]);

    const role = this.getTextFromSelectors([
      '[data-test="job-title"]',
      '.jobTitle',
      '.job-details-header .jobTitle'
    ]);

    // Use SalaryDetector for robust extraction
    let salary = SalaryDetector.extractSalaryString(document);
    if (!salary) {
      salary = this.getTextFromSelectors([
        '[data-test="salary-estimate"]',
        '.salaryEstimate',
        '.SalaryEstimate'
      ]);
    }

    return {
      companyName: company,
      role: role,
      salary: salary,
      applicationStatus: 'Submitted - Pending Response',
      dateSubmitted: new Date().toLocaleDateString('en-CA'),
      linkToJobReq: window.location.href,
      rejectionReason: 'N/A',
      notes: 'Extracted from Glassdoor'
    };
  }

  extractGeneric() {
    // Smart role extraction with scoring
    const role = this.smartExtractRole();

    // Smart company extraction with voting
    const company = this.smartExtractCompany();

    // Smart salary extraction
    const salary = SalaryDetector.extractSalaryString(document);

    return {
      companyName: company,
      role: role,
      salary: salary,
      applicationStatus: 'Submitted - Pending Response',
      dateSubmitted: new Date().toLocaleDateString('en-CA'),
      linkToJobReq: window.location.href,
      rejectionReason: 'N/A',
      notes: 'Extracted using generic parser - please verify'
    };
  }

  smartExtractRole() {
    const candidates = [];

    // Collect candidates from multiple sources
    const h1Text = document.querySelector('h1')?.textContent?.trim();
    if (h1Text) candidates.push(h1Text);

    // Title text (first segment before separator)
    const titleParts = document.title.split(/[\|\-\–]/);
    if (titleParts[0]?.trim()) {
      candidates.push(titleParts[0].trim());
    }

    // Job title from CSS selectors
    const selectorResult = this.getTextFromSelectors([
      '.job-title', '[class*="job-title"]', '[class*="title"]',
      '[data-testid*="title"]', '[data-test*="title"]'
    ]);
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

  smartExtractCompany() {
    const candidates = [];

    // Strategy 1: CSS selectors (high confidence)
    const selectorResult = this.getTextFromSelectors([
      '.company', '.company-name', '[class*="company"]',
      'a[href*="/company/"]', '[data-testid*="company"]'
    ]);
    if (selectorResult) {
      candidates.push({ name: selectorResult, frequency: 1, source: 'selector', confidence: 90 });
    }

    // Strategy 2: Meta tags
    const metaSelectors = [
      'meta[property="og:site_name"]',
      'meta[name="author"]',
      'meta[name="publisher"]'
    ];
    for (const selector of metaSelectors) {
      const meta = document.querySelector(selector);
      if (meta?.content) {
        candidates.push({ name: meta.content.trim(), frequency: 1, source: 'meta', confidence: 80 });
        break;
      }
    }

    // Strategy 3: Page title (last segment)
    const titleParts = document.title.split(/[\|\-\–]/);
    if (titleParts.length > 1) {
      const titleCompany = titleParts[titleParts.length - 1].trim();
      if (titleCompany) {
        candidates.push({ name: titleCompany, frequency: 1, source: 'title', confidence: 70 });
      }
    }

    // Strategy 4: Context patterns (e.g., "Join [Company] team")
    const bodyText = document.body?.textContent || '';
    const contextCandidates = CompanyDetector.extractFromContextPatterns(bodyText);
    candidates.push(...contextCandidates);

    // Strategy 5: Frequency analysis
    const frequencyCandidates = CompanyDetector.extractByFrequency(document);
    candidates.push(...frequencyCandidates);

    // Strategy 6: Logo alt text
    const logos = document.querySelectorAll('img[alt*="logo"], img[src*="logo"], img[class*="logo"]');
    for (const logo of logos) {
      const alt = logo.alt;
      if (alt && alt.toLowerCase().includes('logo')) {
        const companyName = alt.replace(/logo/gi, '').trim();
        if (companyName.length > 1) {
          candidates.push({ name: companyName, frequency: 1, source: 'selector', confidence: 50 });
          break;
        }
      }
    }

    // Use voting/scoring to select best candidate
    return CompanyDetector.selectBestCandidate(candidates);
  }

  getTextFromSelectors(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    return '';
  }

  extractCompanyFromTitle() {
    const title = document.title;
    const parts = title.split(/[\|\-\–]/);
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }
    return '';
  }
}

// Initialize the job tracker
new JobTracker();
