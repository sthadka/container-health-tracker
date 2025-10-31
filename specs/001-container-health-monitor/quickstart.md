# Quickstart: Container Health Monitor

**Feature**: Container Health Monitor
**Date**: 2025-10-31
**Audience**: Developers implementing the feature

## Prerequisites

Before starting implementation, ensure you have:

- [ ] Node.js LTS (18.x or higher) installed
- [ ] pnpm package manager installed (`npm install -g pnpm`)
- [ ] Google account with access to Google Apps Script
- [ ] clasp CLI installed globally (`npm install -g @google/clasp`)
- [ ] clasp authenticated (`clasp login`)
- [ ] Access to Red Hat Container Catalog (public, no auth needed)
- [ ] Text editor or IDE with TypeScript support

## Setup Steps

### 1. Initialize Project

```bash
# Create project directory
mkdir container-health-tracker
cd container-health-tracker

# Initialize pnpm
pnpm init

# Install core dependencies
pnpm add -D typescript @types/node @types/google-apps-script
pnpm add -D vite vite-plugin-apps-script
pnpm add -D vitest @vitest/ui msw

# Install GraphQL client (for Red Hat API)
pnpm add graphql-request graphql
```

### 2. Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["google-apps-script", "@types/node"],
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 3. Configure Vite Build

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/main.ts',
      formats: ['iife'],
      name: 'ContainerHealthMonitor',
      fileName: () => 'Code.js'
    },
    rollupOptions: {
      output: {
        extend: true,
        entryFileNames: 'Code.js'
      }
    },
    target: 'es2020',
    minify: false  // Apps Script needs readable code for debugging
  }
});
```

### 4. Configure Vitest

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['tests/**', 'dist/**', 'node_modules/**']
    }
  }
});
```

### 5. Initialize Google Apps Script

```bash
# Create new Apps Script project
clasp create --type standalone --title "Container Health Monitor"

# This creates .clasp.json with project ID
```

Create `appsscript.json` (Apps Script manifest):

```json
{
  "timeZone": "America/New_York",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/gmail.send"
  ]
}
```

### 6. Create Project Structure

```bash
# Create source directories
mkdir -p src/{models,services,integrations/{graphql,sheets,notifiers},config}
mkdir -p tests/{integration,fixtures}

# Create placeholder files
touch src/main.ts
touch src/models/{MonitoredImage,CVERecord,HealthIndex,NotificationEvent,MonitoringRun}.ts
touch src/services/{CatalogService,HealthCalculator,SheetsRepository,NotificationService,MonitoringOrchestrator}.ts
touch src/integrations/graphql/{RedHatClient,queries}.ts
touch src/integrations/sheets/{SheetsAdapter,schemas}.ts
touch src/integrations/notifiers/{EmailNotifier,SlackNotifier}.ts
touch src/config/ConfigService.ts
```

### 7. Setup Google Sheets

1. Create new Google Spreadsheet: "Container Health Tracker"
2. Create 4 sheets with exact names:
   - `Config`
   - `CVE Data`
   - `Historical`
   - `Logs`
3. Add headers to each sheet (see `contracts/sheets-schema.md` for exact structure)
4. Get spreadsheet ID from URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/...`

### 8. Configure Apps Script Properties

```typescript
// Run once to initialize properties (via Apps Script editor or clasp run)
function initializeProperties() {
  const props = PropertiesService.getScriptProperties();

  props.setProperties({
    'SPREADSHEET_ID': 'YOUR_SPREADSHEET_ID_HERE',
    'EMAIL_RECIPIENTS': 'security@example.com,devops@example.com',
    'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
    'NOTIFICATION_ENABLED': 'true'
  });

  Logger.log('Properties initialized');
}
```

### 9. Add Package Scripts

Update `package.json`:

```json
{
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "push": "pnpm build && clasp push",
    "deploy": "pnpm build && clasp push && clasp deploy",
    "logs": "clasp logs",
    "open": "clasp open"
  }
}
```

## Development Workflow

### Phase 1: Implement Core Models

Start with data models (no external dependencies):

```typescript
// src/models/MonitoredImage.ts
export interface MonitoredImage {
  imageName: string;
  currentVersion: string;
  enabled: boolean;
  severityThreshold: 'Critical' | 'Important' | 'Moderate' | 'Low';
  healthIndex: number;
  healthStatus: 'Healthy' | 'At-Risk' | 'Critical';
  lastChecked: Date;
  imageCreatedDate: Date;
  cveCount: {
    critical: number;
    important: number;
    moderate: number;
    low: number;
  };
}
```

### Phase 2: Implement Health Calculator

Pure function library, fully testable:

```typescript
// src/services/HealthCalculator.ts
export function calculateHealthIndex(cveCount: CVESummary): HealthIndex {
  const penalty = (
    cveCount.critical * 20 +
    cveCount.important * 10 +
    cveCount.moderate * 5 +
    cveCount.low * 1
  );

  const score = Math.max(0, 100 - penalty);
  const status =
    score >= 80 ? 'Healthy' :
    score >= 50 ? 'At-Risk' :
                  'Critical';

  return { score, status, cveSummary: cveCount };
}

// tests/integration/health-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateHealthIndex } from '../src/services/HealthCalculator';

describe('HealthCalculator', () => {
  it('calculates healthy status with no CVEs', () => {
    const result = calculateHealthIndex({ critical: 0, important: 0, moderate: 0, low: 0 });
    expect(result.score).toBe(100);
    expect(result.status).toBe('Healthy');
  });

  it('calculates at-risk status with 2 important CVEs', () => {
    const result = calculateHealthIndex({ critical: 0, important: 2, moderate: 0, low: 0 });
    expect(result.score).toBe(80);
    expect(result.status).toBe('Healthy');
  });

  it('calculates critical status with 1 critical CVE', () => {
    const result = calculateHealthIndex({ critical: 1, important: 0, moderate: 0, low: 0 });
    expect(result.score).toBe(80);
    expect(result.status).toBe('Healthy');
  });
});
```

### Phase 3: Implement GraphQL Client

With integration tests using MSW:

```typescript
// src/integrations/graphql/RedHatClient.ts
import { GraphQLClient } from 'graphql-request';
import { GET_IMAGE_WITH_SECURITY } from './queries';

export class RedHatClient {
  private client: GraphQLClient;

  constructor() {
    this.client = new GraphQLClient('https://catalog.redhat.com/api/containers/graphql');
  }

  async fetchImageWithSecurity(imageName: string) {
    return await this.client.request(GET_IMAGE_WITH_SECURITY, { imageName });
  }
}

// tests/integration/catalog-contract.test.ts
import { setupServer } from 'msw/node';
import { graphql, HttpResponse } from 'msw';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedHatClient } from '../src/integrations/graphql/RedHatClient';

const mockResponse = {
  containerImage: {
    _id: 'abc123',
    name: 'ubi8/ubi',
    latestVersion: { version: '8.10', createdDate: '2024-10-15T12:00:00Z' },
    securityData: {
      cves: [
        {
          cveId: 'CVE-2024-1234',
          severity: 'Critical',
          cvssScore: 9.8,
          affectedPackages: [{ packageName: 'openssl', fixedInVersion: null }],
          publishedDate: '2024-01-15T00:00:00Z',
          advisoryUrl: 'https://access.redhat.com/security/cve/CVE-2024-1234'
        }
      ],
      totalCveCount: 1,
      criticalCount: 1,
      importantCount: 0,
      moderateCount: 0,
      lowCount: 0
    }
  }
};

const server = setupServer(
  graphql.query('GetImageWithSecurity', () => {
    return HttpResponse.json({ data: mockResponse });
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('RedHatClient', () => {
  it('fetches image security data via GraphQL', async () => {
    const client = new RedHatClient();
    const result = await client.fetchImageWithSecurity('ubi8/ubi');

    expect(result.containerImage.name).toBe('ubi8/ubi');
    expect(result.containerImage.securityData.cves).toHaveLength(1);
    expect(result.containerImage.securityData.cves[0].cveId).toBe('CVE-2024-1234');
  });
});
```

### Phase 4: Implement Sheets Repository

```typescript
// src/integrations/sheets/SheetsAdapter.ts
export class SheetsAdapter {
  private spreadsheetId: string;
  private spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

  constructor() {
    this.spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')!;
    this.spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
  }

  readConfig(): MonitoredImage[] {
    const sheet = this.spreadsheet.getSheetByName('Config')!;
    const data = sheet.getRange('A2:D').getValues();

    return data
      .filter(row => row[0])
      .map(row => ({
        imageName: row[0],
        enabled: row[1] === true || row[1] === 'TRUE',
        severityThreshold: row[2],
        // ... initialize other fields
      }));
  }

  writeCVEData(imageName: string, cves: CVERecord[]): void {
    const sheet = this.spreadsheet.getSheetByName('CVE Data')!;

    // Delete old rows for this image
    // ... (see contracts/sheets-schema.md for full implementation)

    // Append new rows
    const newRows = cves.map(cve => [
      cve.imageName,
      cve.imageVersion,
      cve.cveId,
      cve.severity,
      cve.cvssScore,
      cve.affectedPackages.join(', '),
      cve.discoveryDate,
      cve.publishedDate,
      cve.advisoryUrl,
      // ... health index, status, lastUpdated
    ]);

    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 12).setValues(newRows);
  }
}
```

### Phase 5: Implement Main Orchestrator

```typescript
// src/main.ts
import { MonitoringOrchestrator } from './services/MonitoringOrchestrator';

// Entry point for scheduled trigger
function runMonitoring() {
  const orchestrator = new MonitoringOrchestrator();
  orchestrator.execute();
}

// Entry point for manual testing
function testMonitoring() {
  const orchestrator = new MonitoringOrchestrator();
  orchestrator.execute();
  Logger.log('Monitoring run complete - check Logs sheet');
}
```

```typescript
// src/services/MonitoringOrchestrator.ts
export class MonitoringOrchestrator {
  private sheetsRepo: SheetsRepository;
  private catalogService: CatalogService;
  private healthCalculator: HealthCalculator;
  private notificationService: NotificationService;

  constructor() {
    this.sheetsRepo = new SheetsRepository();
    this.catalogService = new CatalogService();
    this.healthCalculator = new HealthCalculator();
    this.notificationService = new NotificationService();
  }

  execute(): void {
    const run: MonitoringRun = {
      runId: Utilities.getUuid(),
      startTime: new Date(),
      endTime: null,
      imagesChecked: 0,
      successfulChecks: 0,
      failedChecks: 0,
      totalCvesFound: 0,
      newCvesDiscovered: 0,
      resolvedCves: 0,
      notificationsSent: 0,
      healthStatusChanges: 0,
      errors: [],
      durationSeconds: 0
    };

    try {
      const config = this.sheetsRepo.readConfig();
      const enabledImages = config.filter(img => img.enabled);

      enabledImages.forEach(image => {
        try {
          this.processImage(image, run);
          run.successfulChecks++;
        } catch (error) {
          run.failedChecks++;
          run.errors.push({
            imageName: image.imageName,
            errorType: error.name,
            errorMessage: error.message
          });
          Logger.log(`[ERROR] Failed to process ${image.imageName}: ${error.message}`);
        }
      });

      run.endTime = new Date();
      run.durationSeconds = (run.endTime.getTime() - run.startTime.getTime()) / 1000;

      this.sheetsRepo.appendLogEntry(run);
      Logger.log(`[INFO] Monitoring run complete: ${run.successfulChecks}/${run.imagesChecked} successful`);

    } catch (error) {
      Logger.log(`[ERROR] Monitoring run failed: ${error.message}`);
      throw error;
    }
  }

  private processImage(image: MonitoredImage, run: MonitoringRun): void {
    // 1. Fetch CVE data from Red Hat
    const cveData = this.catalogService.fetchCVEs(image.imageName);

    // 2. Calculate health index
    const healthIndex = this.healthCalculator.calculate(cveData);

    // 3. Detect status change
    const previousStatus = image.healthStatus;
    const statusChanged = previousStatus !== healthIndex.status;

    // 4. Update sheets
    this.sheetsRepo.writeCVEData(image.imageName, cveData);
    this.sheetsRepo.appendHistoricalSnapshot({ ...image, ...healthIndex });

    // 5. Send notification if status changed
    if (statusChanged) {
      const notification = this.notificationService.send({
        timestamp: new Date(),
        images: [{ ...image, ...healthIndex, previousStatus }],
        sheetUrl: this.sheetsRepo.getSpreadsheetUrl()
      });

      run.notificationsSent++;
      run.healthStatusChanges++;
    }

    run.imagesChecked++;
    run.totalCvesFound += cveData.length;
  }
}
```

## Deployment

### 1. Build and Push to Apps Script

```bash
pnpm build  # Compiles TypeScript to dist/Code.js
clasp push  # Uploads to Apps Script project
```

### 2. Configure Time-Based Trigger

In Apps Script editor:
1. Click "Triggers" (clock icon)
2. Add Trigger:
   - Function: `runMonitoring`
   - Event source: Time-driven
   - Type: Day timer
   - Time of day: 6am to 7am (recommended)
3. Save

### 3. Test Manually

```bash
clasp run testMonitoring
clasp logs  # View execution logs
```

### 4. Verify Output

Check Google Sheets:
- Config sheet: Images listed
- CVE Data sheet: Populated with CVEs
- Historical sheet: First snapshot recorded
- Logs sheet: Execution log entry

## Troubleshooting

### Issue: TypeScript compilation errors

```bash
# Check tsconfig.json is correct
pnpm tsc --noEmit

# Ensure all types are installed
pnpm add -D @types/google-apps-script
```

### Issue: clasp push fails

```bash
# Re-authenticate
clasp login

# Verify .clasp.json exists with correct scriptId
cat .clasp.json
```

### Issue: GraphQL API returns errors

```bash
# Test query directly in browser
# Navigate to: https://catalog.redhat.com/api/containers/graphql
# Paste query from contracts/redhat-graphql.graphql
```

### Issue: Sheets API permission errors

1. Check `appsscript.json` has `spreadsheets` scope
2. Re-authorize: clasp open → Run function → Grant permissions

## Next Steps

After quickstart:
1. Review `/speckit.tasks` command output for task list
2. Follow task order (setup → foundational → user stories)
3. Run tests before each `clasp push`
4. Monitor execution via `clasp logs` and Sheets "Logs" tab
5. Iterate on notification templates based on user feedback

## Resources

- [Apps Script Reference](https://developers.google.com/apps-script/reference)
- [clasp Documentation](https://github.com/google/clasp)
- [Red Hat Catalog API](https://catalog.redhat.com/api/containers/graphql)
- [Vitest Guide](https://vitest.dev/guide/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
