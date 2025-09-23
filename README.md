# Universal Job Tracker Extension

A powerful browser extension that automatically extracts job data from job boards and tracks your applications in Google Sheets.

## Features

✅ **Universal Job Data Extraction**
- Smart parsing for LinkedIn, Indeed, Glassdoor, AngelList, Greenhouse, Lever
- Intelligent fallback parser for unknown job sites
- Extracts: Company, Role, Salary, Job URL, and more

✅ **Google Sheets Integration**
- Direct sync to your Google Sheets
- Automatic header creation
- Duplicate detection
- Offline storage with sync capability

✅ **Smart UI**
- One-click extraction with preview modal
- Editable extracted data before saving
- Job history tracking
- Status management (Not Applied, Applied, Interview, etc.)

## Installation

### 1. Build the Extension
```bash
npm install
npm run build
```

### 2. Load in Chrome/Edge
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `job-tracker-extension` folder
5. The extension icon should appear in your toolbar

### 3. Setup Google Sheets (Optional)
1. Create a new Google Sheet
2. Copy the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   ```
3. Open the extension popup → Settings tab
4. Enter your Spreadsheet ID and Sheet Name
5. Click "Authorize Google Sheets"
6. Click "Create Headers" to set up the columns
7. Test the connection

## Usage

### Quick Start
1. Navigate to any job posting (LinkedIn, Indeed, etc.)
2. Click the "Track Job" button that appears on the page
3. Review and edit the extracted data
4. Click "Save to Sheets" or "Save Locally"

### Extension Popup
- **Extract Tab**: Extract job data from current page
- **History Tab**: View all saved jobs
- **Settings Tab**: Configure Google Sheets integration

## Supported Job Sites

- **LinkedIn Jobs** - Full support with salary extraction
- **Indeed** - Company, role, salary, location
- **Glassdoor** - Job details and salary estimates
- **AngelList/Wellfound** - Startup positions
- **Greenhouse** - ATS job postings
- **Lever** - ATS job postings
- **Generic Parser** - Works on any job site with intelligent fallback

## Architecture

### Parser System
```
ParserFactory
├── LinkedInParser     - LinkedIn-specific extraction
├── IndeedParser       - Indeed-specific extraction
├── GlassdoorParser    - Glassdoor-specific extraction
├── AngelListParser    - AngelList/Wellfound extraction
├── GreenhouseParser   - Greenhouse ATS extraction
├── LeverParser        - Lever ATS extraction
└── GenericParser      - Universal fallback parser
```

### Data Flow
1. **Content Script** detects job page
2. **Parser Factory** selects appropriate parser
3. **Site Parser** extracts job data
4. **Google Sheets Service** syncs to spreadsheet
5. **Local Storage** maintains offline copy

### Smart Extraction
- **Selector Libraries**: Comprehensive CSS selectors for each site
- **Fallback Logic**: Multiple extraction strategies per field
- **Validation**: Data quality checks and warnings
- **Error Handling**: Graceful degradation on extraction failures

## Development

### Project Structure
```
src/
├── types/           - TypeScript interfaces
├── parsers/
│   ├── base/        - Abstract base parser
│   └── sites/       - Site-specific parsers
├── services/        - Google Sheets integration
├── popup/           - Extension popup UI
├── content.ts       - Content script with job tracker
└── background.ts    - Service worker
```

### Adding New Parsers
1. Create new parser in `src/parsers/sites/`
2. Extend `BaseParser` class
3. Implement site-specific selectors
4. Add to `ParserFactory.parsers` array
5. Update manifest.json with new URL patterns

### Building
```bash
npm run build    # Compile TypeScript
npm run watch    # Watch mode for development
npm run lint     # Check code quality
```

## Configuration

### Google Sheets Format
| Company Name | Application Status | Role | Salary | Date Submitted | Link to Job Req | Rejection Reason | Notes |
|--------------|-------------------|------|--------|----------------|-----------------|------------------|-------|

### Extension Permissions
- `activeTab` - Access current tab for extraction
- `storage` - Local storage for job data
- `identity` - Google Sheets authentication

## Troubleshooting

### Common Issues

**Extension not appearing on job sites**
- Check if the site URL matches content script patterns in manifest.json
- Refresh the page after loading the extension

**Google Sheets not working**
- Ensure you've authorized the extension
- Check spreadsheet ID is correct
- Verify sheet name exists

**Extraction not working**
- Try the Generic parser on unknown sites
- Use the popup "Extract" tab as backup
- Check browser console for errors

**Parser improvements needed**
- Site layouts change frequently
- Submit issues with specific job URLs
- Parsers use multiple fallback strategies

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new parsers
4. Submit pull request

## Privacy

- All job data stays in your Google Sheets and browser storage
- No data sent to external servers (except Google Sheets API)
- Authentication tokens stored securely in browser

## License

MIT License - Use freely for personal and commercial projects