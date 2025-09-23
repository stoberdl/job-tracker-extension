hisimport { JobData, MessageRequest, MessageResponse } from './types/JobData';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Universal Job Tracker Extension installed');

  chrome.storage.local.get(['jobs'], (result) => {
    if (!result.jobs) {
      chrome.storage.local.set({ jobs: [] });
    }
  });

  chrome.storage.local.get(['sheetsConfig'], (result) => {
    if (!result.sheetsConfig) {
      chrome.storage.local.set({
        sheetsConfig: {
          spreadsheetId: '',
          sheetName: 'Job Applications'
        }
      });
    }
  });
});

chrome.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
  if (request.action === 'saveJob') {
    saveJobApplication(request.data)
      .then(() => sendResponse({ success: true } as MessageResponse))
      .catch((error) => sendResponse({
        success: false,
        error: error.message
      } as MessageResponse));
    return true;
  }

  if (request.action === 'getStoredJobs') {
    getStoredJobs()
      .then((jobs) => sendResponse({
        success: true,
        data: jobs
      } as MessageResponse))
      .catch((error) => sendResponse({
        success: false,
        error: error.message
      } as MessageResponse));
    return true;
  }

  return false;
});

async function saveJobApplication(jobData: JobData): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['jobs']);
    const jobs = result.jobs || [];

    const jobWithMetadata = {
      id: Date.now().toString(),
      ...jobData,
      savedAt: new Date().toISOString(),
      source: 'extension'
    };

    jobs.push(jobWithMetadata);
    await chrome.storage.local.set({ jobs });

    console.log('Job application saved:', jobWithMetadata);
  } catch (error) {
    console.error('Error saving job application:', error);
    throw error;
  }
}

async function getStoredJobs(): Promise<any[]> {
  try {
    const result = await chrome.storage.local.get(['jobs']);
    return result.jobs || [];
  } catch (error) {
    console.error('Error retrieving stored jobs:', error);
    throw error;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const jobSitePatterns = [
      'linkedin.com/jobs',
      'indeed.com',
      'glassdoor.com',
      'angel.co',
      'wellfound.com',
      'greenhouse.io',
      'lever.co',
      'workday.com'
    ];

    const isJobSite = jobSitePatterns.some(pattern => tab.url?.includes(pattern));

    if (isJobSite) {
      chrome.action.setBadgeText({
        tabId: tabId,
        text: '🔍'
      });

      chrome.action.setBadgeBackgroundColor({
        tabId: tabId,
        color: '#007bff'
      });
    } else {
      chrome.action.setBadgeText({
        tabId: tabId,
        text: ''
      });
    }
  }
});