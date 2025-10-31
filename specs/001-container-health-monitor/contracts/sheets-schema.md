# Google Sheets Schema Contract

**Feature**: Container Health Monitor
**Date**: 2025-10-31
**Status**: Complete

## Overview

This document defines the exact structure of the Google Sheets spreadsheet used for configuration, data storage, historical tracking, and logging. All sheet names, column headers, data types, and validation rules are specified.

## Spreadsheet Structure

### Workbook: Container Health Tracker

**Spreadsheet ID**: To be created during deployment
**Sheets** (in order):
1. Config
2. CVE Data
3. Historical
4. Logs

---

## Sheet 1: Config

**Purpose**: User-managed configuration for monitored images and notification settings

**Column Structure**:

| Column | Header | Data Type | Validation | Example | Required |
|--------|--------|-----------|------------|---------|----------|
| A | Image Name | String | Must match pattern `[a-z0-9-]+/[a-z0-9-]+` | `ubi8/ubi` | Yes |
| B | Enabled | Boolean | TRUE or FALSE | `TRUE` | Yes |
| C | Severity Threshold | String | Must be: Critical, Important, Moderate, Low | `Important` | Yes |
| D | Notes | String | Free text | `Production image` | No |

**Header Row**: Row 1
**Data Rows**: Start at Row 2

**Example**:
```
| Image Name        | Enabled | Severity Threshold | Notes                |
|-------------------|---------|-------------------|----------------------|
| ubi8/ubi          | TRUE    | Important         | Production base      |
| ubi9/ubi-minimal  | TRUE    | Critical          | Minimal production   |
| nodejs-16/nodejs  | FALSE   | Important         | Deprecated - EOL     |
```

**Read Operation Contract**:
```typescript
interface ConfigRow {
  imageName: string;
  enabled: boolean;
  severityThreshold: 'Critical' | 'Important' | 'Moderate' | 'Low';
  notes?: string;
}

// Read all config rows
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
const data = sheet.getRange('A2:D').getValues();  // Skip header row
const config: ConfigRow[] = data
  .filter(row => row[0])  // Skip empty rows
  .map(row => ({
    imageName: row[0],
    enabled: row[1] === true || row[1] === 'TRUE',
    severityThreshold: row[2],
    notes: row[3] || ''
  }));
```

**Write Operation Contract**:
- Users manually add/edit rows
- System does NOT write to this sheet (read-only for code)

**Validation Rules** (to be set via Data Validation):
- Column B: Checkbox (TRUE/FALSE)
- Column C: Dropdown list (Critical, Important, Moderate, Low)

---

## Sheet 2: CVE Data

**Purpose**: Current state of CVEs for all monitored images (system-managed, updated on every run)

**Column Structure**:

| Column | Header | Data Type | Format | Example | Required |
|--------|--------|-----------|--------|---------|----------|
| A | Image Name | String | - | `ubi8/ubi` | Yes |
| B | Version | String | - | `8.10` | Yes |
| C | CVE ID | String | CVE-YYYY-NNNNN | `CVE-2024-1234` | Yes |
| D | Severity | String | Critical/Important/Moderate/Low | `Critical` | Yes |
| E | CVSS Score | Number | 0.0-10.0 | `9.8` | No |
| F | Affected Packages | String | Comma-separated | `openssl, libcurl` | Yes |
| G | Discovery Date | Date | YYYY-MM-DD | `2025-10-31` | Yes |
| H | Published Date | Date | YYYY-MM-DD | `2024-01-15` | Yes |
| I | Advisory URL | String | URL | `https://access.redhat.com/...` | Yes |
| J | Health Index | Number | 0-100 | `65` | Yes |
| K | Health Status | String | Healthy/At-Risk/Critical | `At-Risk` | Yes |
| L | Last Updated | DateTime | YYYY-MM-DD HH:MM:SS | `2025-10-31 14:30:00` | Yes |

**Header Row**: Row 1
**Data Rows**: Start at Row 2

**Example**:
```
| Image Name | Version | CVE ID        | Severity | CVSS | Packages       | Discovery  | Published  | Advisory URL         | Index | Status  | Updated            |
|------------|---------|---------------|----------|------|----------------|------------|------------|----------------------|-------|---------|--------------------|
| ubi8/ubi   | 8.10    | CVE-2024-1234 | Critical | 9.8  | openssl        | 2025-10-31 | 2024-01-15 | https://access...    | 65    | At-Risk | 2025-10-31 14:30   |
| ubi8/ubi   | 8.10    | CVE-2024-5678 | Important| 7.5  | libcurl        | 2025-10-31 | 2024-02-20 | https://access...    | 65    | At-Risk | 2025-10-31 14:30   |
```

**Write Operation Contract**:
```typescript
interface CVEDataRow {
  imageName: string;
  version: string;
  cveId: string;
  severity: 'Critical' | 'Important' | 'Moderate' | 'Low';
  cvssScore: number | null;
  affectedPackages: string;  // Comma-separated
  discoveryDate: Date;
  publishedDate: Date;
  advisoryUrl: string;
  healthIndex: number;
  healthStatus: 'Healthy' | 'At-Risk' | 'Critical';
  lastUpdated: Date;
}

// Write CVE data (clear previous data for image, write new data)
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CVE Data');

// Step 1: Delete old rows for this image
const data = sheet.getDataRange().getValues();
const rowsToDelete: number[] = [];
for (let i = 1; i < data.length; i++) {  // Skip header
  if (data[i][0] === imageName) {
    rowsToDelete.push(i + 1);  // +1 for 1-indexed rows
  }
}
rowsToDelete.reverse().forEach(row => sheet.deleteRow(row));

// Step 2: Append new rows
const newRows = cveRecords.map(cve => [
  cve.imageName,
  cve.version,
  cve.cveId,
  cve.severity,
  cve.cvssScore,
  cve.affectedPackages.join(', '),
  cve.discoveryDate,
  cve.publishedDate,
  cve.advisoryUrl,
  cve.healthIndex,
  cve.healthStatus,
  new Date()
]);
sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 12).setValues(newRows);
```

**Conditional Formatting** (to be applied):
- Column K (Health Status):
  - "Healthy" = Green background (#d9ead3)
  - "At-Risk" = Orange background (#fce5cd)
  - "Critical" = Red background (#f4c7c3)
- Column D (Severity):
  - "Critical" = Red text (#cc0000)
  - "Important" = Orange text (#e69138)

**Data Validation**:
- Column J: Number between 0 and 100
- Column K: List (Healthy, At-Risk, Critical)

---

## Sheet 3: Historical

**Purpose**: Time-series data for trend analysis and compliance reporting (append-only log)

**Column Structure**:

| Column | Header | Data Type | Format | Example | Required |
|--------|--------|-----------|--------|---------|----------|
| A | Timestamp | DateTime | YYYY-MM-DD HH:MM:SS | `2025-10-31 14:30:00` | Yes |
| B | Image Name | String | - | `ubi8/ubi` | Yes |
| C | Version | String | - | `8.10` | Yes |
| D | Total CVEs | Number | Integer | `15` | Yes |
| E | Critical Count | Number | Integer | `2` | Yes |
| F | Important Count | Number | Integer | `5` | Yes |
| G | Moderate Count | Number | Integer | `6` | Yes |
| H | Low Count | Number | Integer | `2` | Yes |
| I | Health Index | Number | 0-100 | `65` | Yes |
| J | Health Status | String | Healthy/At-Risk/Critical | `At-Risk` | Yes |
| K | Status Change | String | Previous→Current or "No change" | `Healthy→At-Risk` | Yes |

**Header Row**: Row 1
**Data Rows**: Start at Row 2 (append-only, never delete)

**Example**:
```
| Timestamp          | Image     | Version | Total | Crit | Imp | Mod | Low | Index | Status  | Change             |
|--------------------|-----------|---------|-------|------|-----|-----|-----|-------|---------|--------------------|
| 2025-10-30 14:00   | ubi8/ubi  | 8.9     | 10    | 1    | 3   | 4   | 2   | 75    | Healthy | No change          |
| 2025-10-31 14:30   | ubi8/ubi  | 8.10    | 15    | 2    | 5   | 6   | 2   | 65    | At-Risk | Healthy→At-Risk    |
```

**Write Operation Contract**:
```typescript
interface HistoricalRow {
  timestamp: Date;
  imageName: string;
  version: string;
  totalCves: number;
  criticalCount: number;
  importantCount: number;
  moderateCount: number;
  lowCount: number;
  healthIndex: number;
  healthStatus: 'Healthy' | 'At-Risk' | 'Critical';
  statusChange: string;
}

// Append historical snapshot
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Historical');
const row = [
  new Date(),
  snapshot.imageName,
  snapshot.version,
  snapshot.totalCves,
  snapshot.criticalCount,
  snapshot.importantCount,
  snapshot.moderateCount,
  snapshot.lowCount,
  snapshot.healthIndex,
  snapshot.healthStatus,
  snapshot.statusChange
];
sheet.appendRow(row);
```

**Read Operation Contract**:
```typescript
// Get historical data for specific image
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Historical');
const data = sheet.getDataRange().getValues();
const imageHistory = data
  .slice(1)  // Skip header
  .filter(row => row[1] === imageName)
  .map(row => ({
    timestamp: new Date(row[0]),
    imageName: row[1],
    version: row[2],
    totalCves: row[3],
    criticalCount: row[4],
    importantCount: row[5],
    moderateCount: row[6],
    lowCount: row[7],
    healthIndex: row[8],
    healthStatus: row[9],
    statusChange: row[10]
  }));
```

---

## Sheet 4: Logs

**Purpose**: Execution audit trail for monitoring runs (system-managed, append-only)

**Column Structure**:

| Column | Header | Data Type | Format | Example | Required |
|--------|--------|-----------|--------|---------|----------|
| A | Timestamp | DateTime | YYYY-MM-DD HH:MM:SS | `2025-10-31 14:30:00` | Yes |
| B | Run ID | String | UUID | `abc-123-def-456` | Yes |
| C | Status | String | Success/Partial/Failed | `Success` | Yes |
| D | Images Checked | Number | Integer | `12` | Yes |
| E | Successful | Number | Integer | `11` | Yes |
| F | Failed | Number | Integer | `1` | Yes |
| G | CVEs Found | Number | Integer | `47` | Yes |
| H | New CVEs | Number | Integer | `3` | Yes |
| I | Resolved CVEs | Number | Integer | `1` | Yes |
| J | Notifications Sent | Number | Integer | `2` | Yes |
| K | Health Changes | Number | Integer | `2` | Yes |
| L | Errors | String | JSON array or comma-separated | `[{"image":"ubi8/..."}]` | No |
| M | Duration (sec) | Number | Float | `42.5` | Yes |

**Header Row**: Row 1
**Data Rows**: Start at Row 2 (append-only)

**Example**:
```
| Timestamp          | Run ID      | Status  | Checked | Success | Failed | CVEs | New | Resolved | Notif | Changes | Errors | Duration |
|--------------------|-------------|---------|---------|---------|--------|------|-----|----------|-------|---------|--------|----------|
| 2025-10-31 14:30   | abc-123-... | Success | 12      | 12      | 0      | 47   | 3   | 1        | 2     | 2       | []     | 42.5     |
| 2025-10-30 14:00   | def-456-... | Partial | 12      | 11      | 1      | 44   | 0   | 0        | 0     | 0       | [...]  | 38.2     |
```

**Write Operation Contract**:
```typescript
interface LogRow {
  timestamp: Date;
  runId: string;
  status: 'Success' | 'Partial' | 'Failed';
  imagesChecked: number;
  successful: number;
  failed: number;
  cvesFound: number;
  newCves: number;
  resolvedCves: number;
  notificationsSent: number;
  healthChanges: number;
  errors: string;  // JSON.stringify(errors) or empty string
  durationSeconds: number;
}

// Append monitoring run log
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
const row = [
  new Date(),
  runLog.runId,
  runLog.status,
  runLog.imagesChecked,
  runLog.successful,
  runLog.failed,
  runLog.cvesFound,
  runLog.newCves,
  runLog.resolvedCves,
  runLog.notificationsSent,
  runLog.healthChanges,
  runLog.errors.length > 0 ? JSON.stringify(runLog.errors) : '',
  runLog.durationSeconds
];
sheet.appendRow(row);
```

---

## Apps Script Properties Service Contract

**Purpose**: Store sensitive configuration (notification recipients, API keys if needed)

**Properties**:

```typescript
interface ScriptProperties {
  EMAIL_RECIPIENTS: string;  // Comma-separated: "user1@example.com,user2@example.com"
  SLACK_WEBHOOK_URL: string; // Slack incoming webhook URL
  NOTIFICATION_ENABLED: string; // "true" or "false"
  LAST_RUN_TIMESTAMP: string; // ISO 8601 timestamp of last successful run
}

// Read property
const recipients = PropertiesService.getScriptProperties().getProperty('EMAIL_RECIPIENTS');

// Write property
PropertiesService.getScriptProperties().setProperty('LAST_RUN_TIMESTAMP', new Date().toISOString());
```

**Access Pattern**:
```typescript
class ConfigService {
  private props = PropertiesService.getScriptProperties();

  getEmailRecipients(): string[] {
    const value = this.props.getProperty('EMAIL_RECIPIENTS');
    return value ? value.split(',').map(s => s.trim()) : [];
  }

  getSlackWebhookUrl(): string | null {
    return this.props.getProperty('SLACK_WEBHOOK_URL');
  }

  isNotificationEnabled(): boolean {
    return this.props.getProperty('NOTIFICATION_ENABLED') === 'true';
  }
}
```

---

## Integration Test Contracts

### Test 1: Read Config Sheet
```typescript
it('reads monitored images from Config sheet', () => {
  const config = SheetsRepository.readConfig();
  expect(config).toBeArray();
  expect(config[0]).toHaveProperty('imageName');
  expect(config[0]).toHaveProperty('enabled');
  expect(config[0]).toHaveProperty('severityThreshold');
});
```

### Test 2: Write CVE Data
```typescript
it('writes CVE data and preserves column structure', () => {
  const cveData: CVEDataRow[] = [...];
  SheetsRepository.writeCVEData('ubi8/ubi', cveData);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CVE Data');
  const headers = sheet.getRange(1, 1, 1, 12).getValues()[0];
  expect(headers[0]).toBe('Image Name');
  expect(headers[2]).toBe('CVE ID');
});
```

### Test 3: Append Historical Data
```typescript
it('appends historical snapshot without overwriting', () => {
  const initialRowCount = sheet.getLastRow();
  SheetsRepository.appendHistoricalSnapshot(snapshot);
  expect(sheet.getLastRow()).toBe(initialRowCount + 1);
});
```

### Test 4: Append Log Entry
```typescript
it('logs monitoring run with all required fields', () => {
  SheetsRepository.appendLogEntry(runLog);
  const lastRow = sheet.getRange(sheet.getLastRow(), 1, 1, 13).getValues()[0];
  expect(lastRow[1]).toBe(runLog.runId);
  expect(lastRow[2]).toBe(runLog.status);
});
```

---

## Summary

All Google Sheets contracts defined:
- ✅ 4 sheets with exact column structures
- ✅ Data types and validation rules specified
- ✅ Read/write operation contracts with TypeScript examples
- ✅ Conditional formatting rules for visual indicators
- ✅ Apps Script Properties Service contract for sensitive config
- ✅ Integration test contracts for data operations

Ready for quickstart.md generation.
