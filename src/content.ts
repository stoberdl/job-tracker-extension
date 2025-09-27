import { ParserFactory } from './parsers/ParserFactory';
import { MessageRequest, MessageResponse, JobData } from './types/JobData';

class JobTracker {
  constructor() {
    this.init();
  }

  private init(): void {
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
      if (request.action === 'extractJobData') {
        try {
          const extractedData = ParserFactory.extractJobData();
          sendResponse({
            success: extractedData.success,
            data: extractedData.data,
            error: extractedData.error
          } as MessageResponse);
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Extraction failed'
          } as MessageResponse);
        }
      }
      return true;
    });
  }
}

new JobTracker();