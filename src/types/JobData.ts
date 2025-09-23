export interface JobData {
  companyName: string;
  applicationStatus: 'Not Applied' | 'Applied' | 'Interview' | 'Rejected' | 'Offer';
  role: string;
  salary: string;
  dateSubmitted: string;
  linkToJobReq: string;
  rejectionReason: string;
  notes: string;
}

export interface SiteParser {
  siteName: string;
  urlPatterns: string[];
  parse(): JobData;
  isValidJobPage(): boolean;
}

export interface ExtractedData {
  success: boolean;
  data: JobData;
  error?: string | undefined;
  parserUsed?: string;
}

export interface MessageRequest {
  action: 'extractJobData' | 'saveJob' | 'saveToSheets' | 'getStoredJobs';
  data?: any;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}