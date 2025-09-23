# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
```bash
npm install              # Install dependencies
npm run build           # Compile TypeScript to dist/
npm run dev             # Watch mode for development
npm run watch           # Alternative watch command
npm run lint            # ESLint on src/**/*.ts
npm run clean           # Remove dist/ directory
```

### Extension Testing
1. Build the extension: `npm run build`
2. Load in browser: Navigate to `chrome://extensions/` or `brave://extensions/`
3. Enable "Developer mode" and click "Load unpacked"
4. Select the root directory (contains manifest.json)
5. Reload extension after changes using refresh button

## Code Architecture

### Parser System (Core Feature)
The extension uses a sophisticated parser factory pattern to extract job data:

**Parser Hierarchy:**
- `BaseParser` (abstract): Common selectors and utility methods
- Site-specific parsers: `LinkedInParser`, `IndeedParser`, `GlassdoorParser`, etc.
- `GenericParser`: Intelligent fallback for unknown sites
- `ParserFactory`: Selects appropriate parser based on URL patterns and page validation

**Key Flow:**
1. `ParserFactory.getParser()` identifies the best parser for current site
2. Parser validates page with `isValidJobPage()`
3. `parse()` method extracts job data using site-specific selectors
4. Returns structured `JobData` object

### Extension Components
- **Content Script**: Injects "Track Job" button, handles extraction requests
- **Background Script**: Service worker for message passing and storage
- **Popup**: Multi-tab interface (Extract, History, Settings)
- **Google Sheets Service**: OAuth integration for direct spreadsheet sync

### Message Passing Architecture
Uses Chrome extension message passing between components:
```typescript
// Content → Background
chrome.runtime.sendMessage({ action: 'saveJob', data: jobData })

// Popup → Content
chrome.tabs.sendMessage(tabId, { action: 'extractJobData' })
```

### Data Structure
Core `JobData` interface with application lifecycle fields:
- Company, role, salary, URL (extracted)
- Application status, date, rejection reason, notes (user managed)

## Technical Implementation

### Dual File System
**IMPORTANT**: The project has both TypeScript source and standalone JavaScript files:
- `src/` - TypeScript source (compiled to `dist/`)
- `*-standalone.js` - Browser-compatible versions for current production

The standalone files are used in manifest.json due to module import issues in browser extensions.

### TypeScript Configuration
- Uses `"module": "None"` for browser compatibility
- Strict typing with exact optional properties
- Compiles to `dist/` with source maps and declarations

### Google Sheets Integration
- OAuth2 flow using Chrome identity API
- Direct API calls to Sheets v4 API
- Automatic header creation and duplicate detection
- Error handling for authentication and network issues

## Parser Development

### Adding New Site Parsers
1. Create new parser in `src/parsers/sites/` extending `BaseParser`
2. Implement required methods: `parse()`, `isValidJobPage()`
3. Define site-specific selectors and extraction logic
4. Add to `ParserFactory.parsers` array
5. Update manifest.json host_permissions if needed

### Selector Strategy
Each parser uses multiple fallback selectors per field:
```typescript
const selectors = [
  '.primary-selector',      // Most reliable
  '.fallback-selector',     // Common alternative
  '[data-testid="field"]'   // Generic pattern
];
```

### Testing Parsers
- Use browser developer tools to inspect job page HTML
- Test `ParserFactory.extractJobData()` in console on job pages
- Verify extraction in popup "Extract" tab

## Extension Permissions

### Required Permissions
- `activeTab`: Access current job page for extraction
- `storage`: Local storage for job data and settings
- `identity`: Google OAuth for Sheets integration

### Host Permissions
Configured for major job sites plus `https://*/*` for generic parser support.

## Known Issues & Considerations

### Module System Complexity
The project uses standalone JS files instead of compiled TypeScript due to browser extension module loading limitations. When modifying functionality, update both the TypeScript source and standalone files.

### Parser Maintenance
Job sites frequently change their HTML structure. Parsers use multiple selector fallbacks and validation to maintain reliability, but may need updates when sites redesign.

### Google Sheets Setup
Users must manually configure spreadsheet ID and complete OAuth flow. The extension provides guided setup in Settings tab with connection testing.




##  Standard Workflow
1. First think through the problem, read the codebase for relevant files, and write a plan to todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the todo.md file with a summary of the changes you made and any other relevant information.