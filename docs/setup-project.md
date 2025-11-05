# Container Health Tracker - Setup Guide

Complete setup instructions for deploying the Container Health Tracker to Google Apps Script.

## Prerequisites

### Required Software

1. **Node.js 18 or higher**
   ```bash
   node --version  # Should be 18.x or higher
   ```
   Download from: https://nodejs.org/

2. **pnpm package manager**
   ```bash
   npm install -g pnpm
   pnpm --version
   ```

3. **Google Clasp CLI**
   ```bash
   npm install -g @google/clasp
   clasp --version
   ```

### Required Accounts and Permissions

1. **Google Workspace Account** with the following permissions:
   - Google Apps Script execution
   - Google Sheets creation and editing
   - Gmail API access (for email notifications)
   - External request access (to call Red Hat API)

2. **Red Hat Container Catalog Access**
   - Public GraphQL API endpoint: `https://catalog.redhat.com/api/containers/graphql/`
   - No authentication required for public container queries

## Step 1: Initial Setup

### 1.1 Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd container-health-tracker

# Install dependencies
pnpm install
```

### 1.2 Verify Build

```bash
# Build the project (transpile TypeScript to JavaScript)
pnpm build

# Validate GraphQL queries against contract
pnpm validate

# Optional: Test queries against live Red Hat API
pnpm test:api
```

Expected output:
- `dist/` directory created with bundled `Code.js`
- `dist/appsscript.json` manifest file
- Validation passes with no errors

## Step 2: Google Apps Script Setup

### 2.1 Login to Clasp

```bash
clasp login
```

This opens a browser window for Google authentication. Grant the requested permissions.

### 2.2 Create Apps Script Project

**Option A: Create new standalone project**

```bash
clasp create --type standalone --title "Container Health Tracker"
```

**Option B: Create from existing Google Sheet**

1. Create a new Google Sheet manually
2. Note the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
3. Run:
   ```bash
   clasp create --type sheets --parentId {SPREADSHEET_ID} --title "Container Health Tracker"
   ```

This creates:
- `.clasp.json` file with script ID
- Apps Script project in your Google Drive

### 2.3 Verify Project Creation

```bash
clasp open
```

This opens the Apps Script editor in your browser.

## Step 3: Google Sheets Setup

### 3.1 Create Spreadsheet (if not already created)

1. Go to https://sheets.google.com
2. Create new spreadsheet
3. Name it "Container Health Tracker"
4. Note the spreadsheet ID from URL

### 3.2 Create Required Sheets

Create the following sheets (tabs) in your spreadsheet:

**Sheet 1: "Monitored Images"**

Headers (Row 1):
```
Image Name | Registry | Repository | Version | Architecture | Health Index | Status | Last Updated | Notes
```

Example data (Row 2):
```
ubi8/ubi | registry.access.redhat.com | ubi8/ubi | 8.10 | amd64 | | | | Red Hat Universal Base Image
```

**Sheet 2: "CVE Data"**

Headers (Row 1):
```
Image Name | Version | CVE ID | Severity | Affected Packages | Advisory ID | Public Date | Discovered At | Is Active
```

**Sheet 3: "Historical"**

Headers (Row 1):
```
Timestamp | Image Name | Version | CVE ID | Severity | Event Type | Details
```

**Sheet 4: "Logs"**

Headers (Row 1):
```
Timestamp | Level | Function | Message | Details
```

### 3.3 Get Spreadsheet ID

From the URL:
```
https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit
                                       ^^^^^^^^^^^^^^^^^^^^
                                       This is your spreadsheet ID
```

## Step 4: Configure Apps Script Properties

Apps Script uses Script Properties for configuration. You can set these in two ways:

### Option A: Using setupProperties() Function

1. First deployment:
   ```bash
   pnpm build
   clasp push --force
   ```

2. Open Apps Script editor:
   ```bash
   clasp open
   ```

3. In the editor, select function `setupProperties` from dropdown
4. Edit the function call to include your spreadsheet ID:
   ```javascript
   setupProperties('your-spreadsheet-id-here')
   ```
5. Click "Run"
6. Authorize the script when prompted

### Option B: Manual Configuration

1. Open Apps Script editor
2. Go to Project Settings (gear icon)
3. Scroll to "Script Properties"
4. Add the following properties:

| Property | Value | Description |
|----------|-------|-------------|
| `spreadsheetId` | Your spreadsheet ID | Google Sheets spreadsheet to write data to |
| `redHatApiEndpoint` | `https://catalog.redhat.com/api/containers/graphql/` | Red Hat Container Catalog API endpoint |
| `monitoringEnabled` | `true` | Enable/disable monitoring |
| `notificationsEnabled` | `true` | Enable/disable email notifications |
| `severityThreshold` | `Important` | Minimum severity for notifications (Critical, Important, Moderate, Low) |

## Step 5: Authorization and Permissions

### 5.1 OAuth Scopes

The project requires the following OAuth scopes (defined in `appsscript.json`):

- `https://www.googleapis.com/auth/spreadsheets` - Read/write Google Sheets
- `https://www.googleapis.com/auth/script.external_request` - Call Red Hat API
- `https://www.googleapis.com/auth/script.scriptapp` - Apps Script execution
- `https://mail.google.com/` - Send email notifications

### 5.2 First Authorization

1. In Apps Script editor, select `testMonitoring` from function dropdown
2. Click "Run"
3. Review permissions dialog
4. Click "Advanced" → "Go to Container Health Tracker (unsafe)"
5. Click "Allow"

Note: The "unsafe" warning appears because this is an unverified Apps Script project. This is normal for personal/organizational scripts.

### 5.3 Verify Authorization

After authorization, `testMonitoring` should run successfully and log:
- Script Properties configuration
- Spreadsheet access confirmation
- Red Hat API connectivity test

Check execution logs: View → Logs (or Ctrl+Enter)

## Step 6: Initial Deployment

### 6.1 Build and Push

```bash
# Validate, build, and push to Apps Script
pnpm push
```

This runs:
1. `validate-contract.ts` - Validates GraphQL queries
2. `vite build` - Transpiles TypeScript
3. `clasp push --force` - Uploads to Apps Script

### 6.2 Test Execution

In Apps Script editor:

1. Select `testMonitoring` function
2. Click "Run"
3. Check logs for successful execution
4. Verify spreadsheet is accessible

Expected log output:
```
Script Properties:
{
  "spreadsheetId": "...",
  "redHatApiEndpoint": "...",
  ...
}
Configuration initialized
Spreadsheet opened successfully
```

### 6.3 First Monitoring Run

1. Add container images to "Monitored Images" sheet
2. Select `runMonitoring` function in Apps Script
3. Click "Run"
4. Monitor execution logs
5. Check spreadsheet for CVE data

## Step 7: Schedule Automatic Runs

### 7.1 Create Time-Driven Trigger

1. In Apps Script editor, click "Triggers" (clock icon on left sidebar)
2. Click "+ Add Trigger" (bottom right)
3. Configure trigger:
   - Function: `runMonitoring`
   - Deployment: Head
   - Event source: Time-driven
   - Type of time-based trigger: Day timer
   - Time of day: Select preferred time (e.g., 2am - 3am)
4. Click "Save"

### 7.2 Configure Failure Notifications

1. In trigger settings, click notification settings
2. Select: "Notify me immediately" for failures
3. Save

### 7.3 Verify Trigger

Triggers will appear in the "Triggers" panel with:
- Function name
- Event type
- Status
- Last run time

## Step 8: Configure Notifications (Optional)

### 8.1 Email Notifications

Email notifications use Gmail and are automatically enabled when `notificationsEnabled` is `true` in Script Properties.

Recipients are determined by:
- Script owner's email (default)
- Can be extended to send to specific addresses (requires code modification)

### 8.2 Slack Notifications (Future)

Slack integration planned for Phase 2. Will require:
- Slack webhook URL
- Additional Script Property: `slackWebhookUrl`

## Troubleshooting

### Common Issues

**Issue: "Cannot read properties of null"**
- Check spreadsheet ID is correct in Script Properties
- Verify spreadsheet exists and is accessible
- Confirm property name is `spreadsheetId` (camelCase)

**Issue: "Exception: Service invoked too many times"**
- Apps Script quota exceeded (usually 6 min/execution, 90 min/day for free tier)
- Reduce number of monitored images
- Increase time between monitoring runs

**Issue: "GraphQL errors: Cannot query field..."**
- Query validation failed
- Run `pnpm validate` locally to check queries
- Run `pnpm test:api` to test against live API
- Check contracts in `specs/001-container-health-monitor/contracts/`

**Issue: Authorization errors**
- Re-run authorization flow
- Check OAuth scopes in `appsscript.json`
- Verify account has necessary Google Workspace permissions

**Issue: Red Hat API errors**
- Verify API endpoint is accessible: `https://catalog.redhat.com/api/containers/graphql/`
- Check network connectivity
- Verify image names are correct (format: `namespace/repository`)

### Debug Mode

Enable detailed logging:

1. Edit `src/config/ConfigService.ts`
2. Add debug logging to executeQuery in `src/integrations/graphql/RedHatClient.ts`
3. Rebuild and push: `pnpm push`
4. Check Apps Script logs after execution

### Getting Help

1. Check execution logs in Apps Script editor
2. Review validation output: `pnpm validate`
3. Test API queries: `pnpm test:api`
4. Check spreadsheet structure matches expected format
5. Verify Script Properties are set correctly

## Maintenance

### Regular Updates

```bash
# Pull latest changes
git pull

# Install any new dependencies
pnpm install

# Validate and deploy
pnpm deploy
```

### Monitoring Quota Usage

Google Apps Script quotas (Free tier):
- Execution time: 6 minutes per execution, 90 minutes per day
- URL Fetch calls: 20,000 per day
- Email sends: 100 per day

Monitor usage in Apps Script dashboard.

### Data Cleanup

Periodically archive or clean historical data:
1. Export "Historical" sheet to CSV
2. Archive to Google Drive
3. Clear old records from spreadsheet

## Next Steps

After successful setup:

1. Add container images to monitor in "Monitored Images" sheet
2. Run `runMonitoring` manually to verify
3. Check CVE data appears in "CVE Data" sheet
4. Review health index calculations
5. Monitor scheduled trigger executions
6. Configure notification preferences
7. Set up historical data archival process

## Reference

### Container Image Format

Red Hat container images use the format:
```
registry.access.redhat.com/namespace/repository:tag
```

Example: `registry.access.redhat.com/ubi8/ubi:8.10`

For monitoring, specify:
- Registry: `registry.access.redhat.com`
- Repository: `ubi8/ubi`

### Health Index Calculation

```
Health Index = 100 - (Critical×20 + Important×10 + Moderate×5 + Low×1)
```

Example:
- 2 Critical, 3 Important = 100 - (2×20 + 3×10) = 100 - 70 = 30 (Critical status)

### Script Property Reference

All Script Properties (case-sensitive):

```javascript
{
  spreadsheetId: string,           // Required: Google Sheet ID
  redHatApiEndpoint: string,       // Required: API endpoint URL
  monitoringEnabled: boolean,      // Optional: Default true
  notificationsEnabled: boolean,   // Optional: Default true
  severityThreshold: string        // Optional: Default "Important"
}
```
