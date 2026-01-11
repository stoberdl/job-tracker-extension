export interface RoleMatch {
  text: string;
  score: number;
  matchType: 'exact_tech' | 'tech_pattern' | 'generic_tech' | 'generic';
}

export class RoleDetector {
  // Tier 1: Exact tech role matches (highest priority, score: 100)
  private static exactTechRoles = [
    'software engineer',
    'software developer',
    'full stack developer',
    'fullstack developer',
    'full-stack developer',
    'frontend developer',
    'front-end developer',
    'frontend engineer',
    'front-end engineer',
    'backend developer',
    'back-end developer',
    'backend engineer',
    'back-end engineer',
    'devops engineer',
    'site reliability engineer',
    'sre',
    'platform engineer',
    'cloud engineer',
    'data engineer',
    'ml engineer',
    'machine learning engineer',
    'ai engineer',
    'mobile developer',
    'mobile engineer',
    'ios developer',
    'ios engineer',
    'android developer',
    'android engineer',
    'web developer',
    'systems engineer',
    'infrastructure engineer',
    'security engineer',
    'qa engineer',
    'test engineer',
    'automation engineer',
    'solutions architect',
    'technical architect',
    'software architect',
    'data scientist',
    'research scientist',
    'applied scientist',
    'research engineer'
  ];

  // Tier 2: Regex patterns for common SWE formats (score: 90)
  private static techPatterns: RegExp[] = [
    /\b(sde|swe|sre)\s*[iI1-3]{1,3}\b/i,                                    // SDE I, SDE II, SDE III, SWE1
    /\bstaff\s+(software\s+)?engineer/i,                                     // Staff Engineer, Staff Software Engineer
    /\bprincipal\s+(software\s+)?engineer/i,                                 // Principal Engineer
    /\bsenior\s+(software\s+)?engineer/i,                                    // Senior Engineer, Senior Software Engineer
    /\bjunior\s+(software\s+)?engineer/i,                                    // Junior Engineer
    /\b(sr\.|sr)\s+(software\s+)?engineer/i,                                 // Sr. Engineer, Sr Software Engineer
    /\b(software|backend|frontend|full[- ]?stack)\s+engineer(ing)?\s+(intern|new\s+grad)/i, // Software Engineering Intern
    /\bengineer\s*[-–]\s*(backend|frontend|platform|infrastructure|data)/i,  // Engineer - Backend
    /\b(l[3-7]|e[3-7]|ic[1-5])\s+(software\s+)?engineer/i,                  // L4 Engineer, E3 Engineer, IC2
    /\bnew\s+grad\s+(software\s+)?engineer/i,                                // New Grad Engineer
    /\bentry[- ]level\s+(software\s+)?engineer/i,                            // Entry Level Engineer
    /\b(backend|frontend|fullstack|full-stack)\s+engineer/i,                 // Backend Engineer, Frontend Engineer
    /\b(python|java|golang|rust|node|react|typescript)\s+(developer|engineer)/i, // Python Developer, Java Engineer
    /\bdev\s*ops\b/i,                                                        // DevOps (with space)
    /\bsoftware\s+development\s+engineer/i                                   // Software Development Engineer
  ];

  // Tier 3: Generic tech keywords (score: 70)
  private static genericTechKeywords = [
    'engineer',
    'developer',
    'architect',
    'programmer',
    'coder'
  ];

  // Tier 4: General role keywords (score: 30) - lower priority
  private static genericKeywords = [
    'manager',
    'analyst',
    'specialist',
    'lead',
    'director',
    'consultant',
    'coordinator'
  ];

  // Negative keywords that suggest non-tech roles (will be penalized)
  private static nonTechIndicators = [
    'sales',
    'marketing',
    'hr',
    'human resources',
    'recruiting',
    'recruiter',
    'talent acquisition',
    'account manager',
    'customer success',
    'support specialist',
    'office manager',
    'administrative',
    'financial analyst',
    'operations manager',
    'project manager',
    'product manager'  // PM is sometimes tech-adjacent but not SWE
  ];

  static scoreRole(text: string): RoleMatch | null {
    const lowerText = text.toLowerCase().trim();

    // Skip very long text (probably not a job title)
    if (text.length > 150) {
      return null;
    }

    // Check for non-tech indicators first
    let hasNonTechIndicator = false;
    for (const indicator of this.nonTechIndicators) {
      if (lowerText.includes(indicator)) {
        // Allow override if it also has strong tech signal
        const hasStrongTechSignal = this.exactTechRoles.some(role =>
          lowerText.includes(role)
        );
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
        // Penalize if non-tech indicator was found
        const score = hasNonTechIndicator ? 40 : 70;
        return { text, score, matchType: 'generic_tech' };
      }
    }

    // Tier 4: Generic keywords (only if no non-tech indicator)
    if (!hasNonTechIndicator) {
      for (const keyword of this.genericKeywords) {
        if (lowerText.includes(keyword)) {
          return { text, score: 30, matchType: 'generic' };
        }
      }
    }

    // If non-tech indicator found with no tech match, return very low score
    if (hasNonTechIndicator) {
      return { text, score: 10, matchType: 'generic' };
    }

    return null;
  }

  static extractBestRole(candidates: string[]): RoleMatch | null {
    let bestMatch: RoleMatch | null = null;

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
