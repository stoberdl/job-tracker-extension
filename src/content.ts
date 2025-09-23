import { ParserFactory } from './parsers/ParserFactory';
import { MessageRequest, MessageResponse, JobData } from './types/JobData';

class JobTracker {
  private button: HTMLElement | null = null;
  private isProcessing = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.addTrackButton());
    } else {
      this.addTrackButton();
    }

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

  private addTrackButton(): void {
    if (document.querySelector('#job-tracker-btn') || this.button) {
      return;
    }

    this.button = document.createElement('button');
    this.button.id = 'job-tracker-btn';
    this.button.textContent = 'Track Job';
    this.button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: #007bff;
      color: white;
      border: none;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,123,255,0.3);
      transition: all 0.2s ease;
      min-width: 100px;
      text-align: center;
    `;

    this.button.addEventListener('mouseenter', () => {
      if (!this.isProcessing) {
        this.button!.style.background = '#0056b3';
        this.button!.style.transform = 'translateY(-1px)';
      }
    });

    this.button.addEventListener('mouseleave', () => {
      if (!this.isProcessing) {
        this.button!.style.background = '#007bff';
        this.button!.style.transform = 'translateY(0)';
      }
    });

    this.button.addEventListener('click', () => this.handleTrackJob());

    document.body.appendChild(this.button);

    setTimeout(() => {
      if (this.button) {
        this.button.style.opacity = '0.9';
      }
    }, 1000);
  }

  private async handleTrackJob(): Promise<void> {
    if (this.isProcessing || !this.button) return;

    this.isProcessing = true;
    this.updateButtonState('processing');

    try {
      const extractedData = ParserFactory.extractJobData();

      if (extractedData.success) {
        this.showJobPreview(extractedData.data);
      } else {
        this.showError(extractedData.error || 'Failed to extract job data');
      }
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      this.isProcessing = false;
    }
  }

  private updateButtonState(state: 'normal' | 'processing' | 'success' | 'error'): void {
    if (!this.button) return;

    switch (state) {
      case 'processing':
        this.button.textContent = 'Extracting...';
        this.button.style.background = '#6c757d';
        this.button.style.cursor = 'not-allowed';
        break;
      case 'success':
        this.button.textContent = 'Tracked!';
        this.button.style.background = '#28a745';
        setTimeout(() => this.updateButtonState('normal'), 2000);
        break;
      case 'error':
        this.button.textContent = 'Error';
        this.button.style.background = '#dc3545';
        setTimeout(() => this.updateButtonState('normal'), 2000);
        break;
      case 'normal':
      default:
        this.button.textContent = 'Track Job';
        this.button.style.background = '#007bff';
        this.button.style.cursor = 'pointer';
        break;
    }
  }

  private showJobPreview(jobData: JobData): void {
    const modal = this.createPreviewModal(jobData);
    document.body.appendChild(modal);

    setTimeout(() => {
      modal.style.opacity = '1';
    }, 10);
  }

  private createPreviewModal(jobData: JobData): HTMLElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10001;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">Job Extracted Successfully</h3>
      <div style="margin-bottom: 16px;">
        <strong>Company:</strong> ${jobData.companyName || 'Not found'}
      </div>
      <div style="margin-bottom: 16px;">
        <strong>Role:</strong> ${jobData.role || 'Not found'}
      </div>
      <div style="margin-bottom: 16px;">
        <strong>Salary:</strong> ${jobData.salary || 'Not specified'}
      </div>
      <div style="margin-bottom: 20px;">
        <strong>URL:</strong> <a href="${jobData.linkToJobReq}" target="_blank" style="color: #007bff; text-decoration: none; word-break: break-all;">${jobData.linkToJobReq}</a>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
        <button id="save-btn" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 6px; cursor: pointer;">Save to Tracker</button>
      </div>
    `;

    overlay.appendChild(modal);

    const cancelBtn = modal.querySelector('#cancel-btn');
    const saveBtn = modal.querySelector('#save-btn');

    cancelBtn?.addEventListener('click', () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    });

    saveBtn?.addEventListener('click', () => {
      this.saveJobData(jobData);
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
      }
    });

    return overlay;
  }

  private async saveJobData(jobData: JobData): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveJob',
        data: jobData
      });

      if (response.success) {
        this.updateButtonState('success');
      } else {
        this.showError(response.error || 'Failed to save job data');
      }
    } catch (error) {
      this.showError('Failed to save job data');
    }
  }

  private showError(message: string): void {
    this.updateButtonState('error');
    console.error('Job Tracker Error:', message);

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      z-index: 10002;
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

new JobTracker();