export interface CompanyCandidate {
  name: string;
  frequency: number;
  source: 'context_pattern' | 'selector' | 'meta' | 'title' | 'frequency' | 'url';
  confidence: number;
}

export class CompanyDetector {
  // Contextual patterns for company extraction
  private static contextPatterns: RegExp[] = [
    /(?:at|@)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s+is|\s+we|[.,]|$)/i,
    /join\s+(?:the\s+)?([A-Z][A-Za-z0-9\s&.,'-]+?)\s+(?:team|family)/i,
    /([A-Z][A-Za-z0-9\s&.,'-]+?)\s+is\s+(?:hiring|looking|seeking)/i,
    /work(?:ing)?\s+(?:at|for)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s|[.,]|$)/i,
    /careers?\s+(?:at|with)\s+([A-Z][A-Za-z0-9\s&.,'-]+)/i,
    /([A-Z][A-Za-z0-9\s&.,'-]+?)\s+careers?/i,
    /about\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s|:)/i,
    /([A-Z][A-Za-z0-9\s&.,'-]+?)\s+(?:jobs?|openings?|positions?)/i
  ];

  // Common words to filter out
  private static stopWords = new Set([
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

  // Words that indicate it's probably not a company name
  private static negativeIndicators = [
    'description', 'requirements', 'qualifications', 'responsibilities',
    'benefits', 'location', 'salary', 'experience', 'skills', 'education',
    'overview', 'summary', 'details', 'information', 'posted', 'date',
    'apply now', 'submit', 'sign in', 'log in', 'register', 'similar jobs'
  ];

  // ATS platform names to filter out (these are NOT company names)
  private static atsPlatforms = new Set([
    'greenhouse', 'lever', 'workday', 'icims', 'taleo', 'jobvite',
    'smartrecruiters', 'breezy', 'jazz', 'jazzhr', 'bamboohr', 'bamboo',
    'ashby', 'rippling', 'gusto', 'paylocity', 'paycom', 'adp',
    'successfactors', 'oracle', 'workable', 'recruitee', 'pinpoint',
    'teamtailor', 'personio', 'deel', 'remote', 'oyster', 'lattice',
    'linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'monster',
    'careerbuilder', 'dice', 'angellist', 'wellfound', 'ycombinator',
    'workatastartup', 'hired', 'triplebyte', 'angel', 'powered by'
  ]);

  static isAtsPlatformName(name: string): boolean {
    const lower = name.toLowerCase().trim();
    // Exact match
    if (this.atsPlatforms.has(lower)) return true;
    // Check if name starts with or equals an ATS name
    for (const ats of this.atsPlatforms) {
      if (lower === ats || lower === `${ats} logo` || lower === `${ats} careers`) {
        return true;
      }
    }
    return false;
  }

  static extractFromContextPatterns(text: string): CompanyCandidate[] {
    const candidates: CompanyCandidate[] = [];
    const seenNames = new Set<string>();

    for (const pattern of this.contextPatterns) {
      const regex = new RegExp(pattern, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const name = this.cleanCompanyName(match[1]);
          if (name && name.length >= 2 && name.length <= 50 && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            candidates.push({
              name,
              frequency: 1,
              source: 'context_pattern',
              confidence: 85
            });
          }
        }
      }
    }

    return candidates;
  }

  static extractByFrequency(doc: Document): CompanyCandidate[] {
    const textContent = doc.body?.textContent || '';
    const wordFrequency = new Map<string, number>();

    // Extract capitalized phrases (potential company names)
    // Match 1-4 capitalized words in sequence
    const capitalizedPattern = /\b([A-Z][a-z]*(?:\s+[A-Z][a-z]*){0,3})\b/g;
    let match;

    while ((match = capitalizedPattern.exec(textContent)) !== null) {
      const matchGroup = match[1];
      if (!matchGroup) continue;
      const phrase = matchGroup.trim();

      // Skip if phrase is a single word and is a stop word
      const words = phrase.split(/\s+/);
      const firstWord = words[0];
      if (words.length === 1 && firstWord && this.stopWords.has(firstWord.toLowerCase())) {
        continue;
      }

      // Skip if all words are stop words
      if (words.every(word => this.stopWords.has(word.toLowerCase()))) {
        continue;
      }

      // Skip if too short or too long
      if (phrase.length < 2 || phrase.length > 40) {
        continue;
      }

      // Skip if contains negative indicators
      const lowerPhrase = phrase.toLowerCase();
      if (this.negativeIndicators.some(ind => lowerPhrase.includes(ind))) {
        continue;
      }

      // Skip if looks like a sentence fragment (too many words)
      if (words.length > 4) {
        continue;
      }

      const current = wordFrequency.get(phrase) || 0;
      wordFrequency.set(phrase, current + 1);
    }

    // Convert to candidates, filtering by frequency
    const candidates: CompanyCandidate[] = [];
    for (const [name, frequency] of wordFrequency) {
      if (frequency >= 3) {  // Appears at least 3 times
        candidates.push({
          name,
          frequency,
          source: 'frequency',
          confidence: Math.min(95, 50 + (frequency * 5))
        });
      }
    }

    // Sort by frequency descending
    candidates.sort((a, b) => b.frequency - a.frequency);

    return candidates.slice(0, 10);  // Top 10 candidates
  }

  static extractFromJsonLd(doc: Document): CompanyCandidate | null {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (!script) continue;
      try {
        const data = JSON.parse(script.textContent || '');
        // Handle array of JSON-LD objects
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          // JobPosting schema
          if (item['@type'] === 'JobPosting' && item.hiringOrganization) {
            const org = item.hiringOrganization;
            const name = typeof org === 'string' ? org : org.name;
            if (name && !this.isAtsPlatformName(name)) {
              return { name, frequency: 1, source: 'meta', confidence: 95 };
            }
          }
          // Organization schema
          if (item['@type'] === 'Organization' && item.name) {
            if (!this.isAtsPlatformName(item.name)) {
              return { name: item.name, frequency: 1, source: 'meta', confidence: 90 };
            }
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  static extractFromSubdomain(url: string): CompanyCandidate | null {
    try {
      const hostname = new URL(url).hostname;
      // Patterns like: companyname.greenhouse.io, companyname.lever.co
      const atsSubdomainPatterns = [
        /^([a-z0-9-]+)\.greenhouse\.io$/i,
        /^([a-z0-9-]+)\.lever\.co$/i,
        /^([a-z0-9-]+)\.ashbyhq\.com$/i,
        /^([a-z0-9-]+)\.workable\.com$/i,
        /^([a-z0-9-]+)\.recruitee\.com$/i,
        /^([a-z0-9-]+)\.breezy\.hr$/i,
        /^([a-z0-9-]+)\.bamboohr\.com$/i,
        /^([a-z0-9-]+)\.pinpointhq\.com$/i,
        /^([a-z0-9-]+)\.teamtailor\.com$/i,
        /^jobs\.([a-z0-9-]+)\.com$/i
      ];
      for (const pattern of atsSubdomainPatterns) {
        const match = hostname.match(pattern);
        if (match && match[1]) {
          const subdomain = match[1];
          // Skip generic subdomains
          if (['www', 'jobs', 'careers', 'boards', 'apply'].includes(subdomain)) continue;
          // Convert to readable name (my-company -> My Company)
          const name = subdomain
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          if (!this.isAtsPlatformName(name)) {
            return { name, frequency: 1, source: 'url', confidence: 75 };
          }
        }
      }
    } catch {
      // Invalid URL
    }
    return null;
  }

  static selectBestCandidate(candidates: CompanyCandidate[]): string {
    if (candidates.length === 0) return '';

    // Filter out ATS platform names
    const filtered = candidates.filter(c => !this.isAtsPlatformName(c.name));
    if (filtered.length === 0) return '';

    // Score each candidate
    const scored = filtered.map(candidate => {
      let score = candidate.confidence;

      // Boost for source reliability
      switch (candidate.source) {
        case 'context_pattern':
          score += 20;
          break;
        case 'selector':
          score += 15;
          break;
        case 'meta':
          score += 10;
          break;
        case 'frequency':
          score += candidate.frequency * 3;
          break;
        case 'title':
          score += 5;
          break;
        case 'url':
          score += 0;
          break;
      }

      // Boost for frequency if mentioned multiple times
      if (candidate.frequency > 1) {
        score += Math.min(20, candidate.frequency * 2);
      }

      // Penalize very short names
      if (candidate.name.length < 3) {
        score -= 20;
      }

      // Penalize names that look like job titles
      const lowerName = candidate.name.toLowerCase();
      const jobTitleWords = ['engineer', 'developer', 'manager', 'director', 'analyst', 'specialist'];
      if (jobTitleWords.some(word => lowerName.includes(word))) {
        score -= 50;
      }

      // Penalize generic tech terms
      const genericTerms = ['software', 'remote', 'hybrid', 'full time', 'part time'];
      if (genericTerms.some(term => lowerName.includes(term))) {
        score -= 40;
      }

      return { ...candidate, finalScore: score };
    });

    // Sort by final score
    scored.sort((a, b) => b.finalScore - a.finalScore);

    // Return best candidate if above threshold
    const bestCandidate = scored[0];
    if (bestCandidate && bestCandidate.finalScore >= 40) {
      return bestCandidate.name;
    }

    return '';
  }

  private static cleanCompanyName(name: string): string {
    // Remove trailing common words and punctuation
    let cleaned = name.trim()
      .replace(/\s+(is|are|was|team|jobs?|careers?|Inc\.?|LLC|Ltd\.?|Corp\.?)$/i, '')
      .replace(/[,.]$/, '')
      .trim();

    // Remove if it's just stop words
    const words = cleaned.toLowerCase().split(/\s+/);
    if (words.every(word => this.stopWords.has(word))) {
      return '';
    }

    // Remove if contains negative indicators
    const lowerCleaned = cleaned.toLowerCase();
    if (this.negativeIndicators.some(ind => lowerCleaned.includes(ind))) {
      return '';
    }

    return cleaned;
  }
}
