export interface JobData {
  companyName: string;
  applicationStatus: 'Have Not Applied' | 'Submitted - Pending Response' | 'Rejected' | 'Interviewing' | 'Offer Extended - In Progress' | 'Job Rec Removed/Deleted' | 'Ghosted' | 'Offer Extended - Did Not Accept' | 'Re-Applied With Updates' | 'Rescinded Application' | 'Not For Me' | 'Sent Follow Up Email' | 'N/A';
  role: string;
  salary: string;
  dateSubmitted: string;
  linkToJobReq: string;
  rejectionReason: 'Filled - Internal' | 'Generic "Not A Good Fit"' | 'No New Applicants' | 'Eliminated Role' | 'Changed Job Scope' | 'Applied Too Late' | 'Auto-Reject: No Feedback' | '1st Round Rejection' | 'Middle Round Rejection' | 'N/A' | 'Final Round Rejection' | 'No Response: Sent Email' | 'Post-Interview Follow-up' | '';
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