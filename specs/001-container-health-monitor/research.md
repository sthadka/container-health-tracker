# Research: Container Health Monitor

**Feature**: Container Health Monitor
**Date**: 2025-10-31
**Status**: Complete

## Overview

This document consolidates technical research and decisions for implementing the Container Health Monitor. All unknowns from the Technical Context have been resolved through API exploration, documentation review, and best practices analysis.

## Research Areas

### 1. Red Hat Container Catalog GraphQL API

**Decision**: Use public GraphQL endpoint at `https://catalog.redhat.com/api/containers/graphql/` (note trailing slash)

**Rationale**:
- No authentication required for public container image data (confirmed in official docs)
- GraphQL provides precise queries, avoiding over-fetching REST endpoint data
- Multi-step workflow required: find repository → find images → identify latest → query vulnerabilities
- Official documentation provides complete query examples and data model

**Alternatives Considered**:
- **REST API**: Red Hat also provides REST endpoints, but they require multiple round trips
- **Web scraping**: Fragile and violates Red Hat's terms of service
- **Third-party CVE databases**: Would require cross-referencing image names, less reliable than authoritative source

**Implementation Details (Based on Official Documentation)**:

**Endpoint**: `https://catalog.redhat.com/api/containers/graphql/`
**Method**: POST
**Content-Type**: `application/json`

**Three-Step Query Workflow**:

1. **Find Repository** using `find_repositories`:
   ```graphql
   query {
     find_repositories(
       page: 0,
       page_size: 10,
       filter: { repository: { eq: "advanced-cluster-security/rhacs-scanner-db-slim-rhel8" } }
     ) {
       data {
         _id
         registry
         repository
       }
     }
   }
   ```

2. **Find All Images** using `find_repository_images_by_registry_path`:
   ```graphql
   query {
     find_repository_images_by_registry_path(
       registry: "registry.access.redhat.com",
       repository: "advanced-cluster-security/rhacs-scanner-db-slim-rhel8",
       page: 0,
       page_size: 500
     ) {
       data {
         _id                    # CRITICAL: Use this for vulnerability queries, NOT docker_image_id
         docker_image_id
         creation_date
         architecture
         repositories {
           tags {
             name
             added_date
           }
         }
         parsed_data {
           labels {
             name
             value
           }
         }
       }
     }
   }
   ```

3. **Query Vulnerabilities** using `find_image_vulnerabilities`:
   ```graphql
   query FIND_IMAGE_VULNERABILITIES($id: String, $page: Int, $pageSize: Int) {
     ContainerImageVulnerability: find_image_vulnerabilities(
       id: $id
       page: $page
       page_size: $pageSize
     ) {
       data {
         _id
         creation_date
         advisory_id
         advisory_type
         cve_id
         severity
         affected_packages {
           name
           version
           arch
           package_type
         }
         packages {
           rpm_nvra
         }
       }
     }
   }
   ```

**Critical Implementation Notes**:

1. **Use `_id` (MongoDB ObjectID), NOT `docker_image_id` (SHA256 digest)** for vulnerability queries
2. **Latest version detection**:
   - Extract tags from `repositories[0].tags[].name`
   - Parse as semantic versions (handle formats like `4.9.0-1`)
   - Sort by highest semantic version tag
   - For same tag, use most recent `creation_date`
   - **WARNING**: `parsed_data.labels[]` may NOT contain version label for newer images
3. **Pagination**:
   - Images query: max `page_size: 500`
   - Vulnerabilities query: max `page_size: 250` (recommended)
   - Check if `data.length == page_size` to determine if more pages exist
4. **Multi-architecture handling**: Single tag may point to multiple images (amd64, arm64, ppc64le, s390x)
5. **Rate limiting**: No official limits documented, but implement exponential backoff for 429 responses

**Data Model (from official API)**:
- **ContainerRepository**: `_id`, `registry`, `repository`
- **ContainerImage**: `_id` (ObjectID), `docker_image_id` (SHA256), `creation_date`, `repositories[].tags[]`
- **ContainerImageVulnerability**: `_id`, `cve_id`, `severity`, `advisory_id`, `affected_packages[]`, `packages[].rpm_nvra[]`

**Response Example**:
```json
{
  "data": {
    "ContainerImageVulnerability": {
      "data": [
        {
          "_id": "...",
          "cve_id": "CVE-2024-0985",
          "severity": "Important",
          "advisory_id": "2024:0974",
          "advisory_type": "RHSA",
          "affected_packages": [
            {
              "name": "postgresql",
              "version": "12.9-1",
              "arch": "x86_64",
              "package_type": "rpm"
            }
          ],
          "packages": {
            "rpm_nvra": ["postgresql-12.9-1.el8.x86_64"]
          }
        }
      ]
    }
  }
}
```

**References**:
- Complete API guide: `docs/query-image-vuln-graphql.md`
- GraphQL endpoint: https://catalog.redhat.com/api/containers/graphql/
- Interactive GraphiQL: https://catalog.redhat.com/api/containers/graphql/ (in browser)

### 2. Google Apps Script Build Pipeline with Vite

**Decision**: Use `vite-plugin-apps-script` to bundle TypeScript into Apps Script-compatible JavaScript

**Rationale**:
- Apps Script requires all code in single file or uses `.gs` imports (deprecated)
- Vite provides fast builds, tree-shaking, and TypeScript transpilation
- `vite-plugin-apps-script` specifically designed for Apps Script deployment via clasp
- Maintains TypeScript strict mode during development, outputs ES6+ for V8 runtime

**Alternatives Considered**:
- **Webpack + gas-webpack-plugin**: Slower builds, more complex configuration
- **esbuild directly**: Missing Apps Script-specific plugins, would require custom scripting
- **Rollup**: Good bundler but Vite provides better DX with HMR during local testing

**Implementation Details**:
- Install: `pnpm add -D vite vite-plugin-apps-script`
- vite.config.ts configuration:
  ```typescript
  import { defineConfig } from 'vite';
  import appsScript from 'vite-plugin-apps-script';

  export default defineConfig({
    plugins: [appsScript()],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: 'src/main.ts',
        output: {
          entryFileNames: 'Code.js' // Apps Script entry point
        }
      }
    }
  });
  ```
- Build command: `pnpm vite build`
- Output: `dist/Code.js` ready for `clasp push`

**References**:
- vite-plugin-apps-script: https://github.com/beenotung/vite-plugin-apps-script
- Google Apps Script V8 runtime docs: https://developers.google.com/apps-script/guides/v8-runtime

### 3. Testing Strategy for Apps Script Environment

**Decision**: Use Vitest with MSW (Mock Service Worker) for integration tests, run tests locally outside Apps Script runtime

**Rationale**:
- Apps Script has no built-in testing framework
- Vitest provides fast TypeScript test execution with ESM support
- MSW intercepts HTTP/GraphQL requests at network level, enabling realistic API contract tests
- Local testing faster than deploying to Apps Script for every test run
- Constitution requires integration tests for all external contracts (Red Hat API, Sheets API, notifications)

**Alternatives Considered**:
- **Jest**: Industry standard but slower than Vitest for ESM + TypeScript
- **Mocha + Chai**: Requires more boilerplate, less TypeScript-native
- **Apps Script testing via clasp**: No official testing framework, would require custom harness

**Implementation Details**:
- Install: `pnpm add -D vitest @vitest/ui msw`
- Test structure:
  ```typescript
  // tests/integration/catalog-contract.test.ts
  import { http, graphql } from 'msw';
  import { setupServer } from 'msw/node';
  import { describe, it, expect, beforeAll } from 'vitest';

  const server = setupServer(
    graphql.query('containerImage', ({ query, variables }) => {
      return HttpResponse.json({ data: { /* mock response */ } });
    })
  );

  beforeAll(() => server.listen());

  it('fetches image CVE data', async () => {
    const result = await CatalogService.fetchImageCVEs('ubi8/ubi');
    expect(result.cves).toBeDefined();
  });
  ```
- Mock Google Sheets API with MSW to test SheetsRepository
- Separate mocks from implementation code (fixtures/ directory)

**References**:
- Vitest docs: https://vitest.dev
- MSW for API mocking: https://mswjs.io
- Apps Script testing best practices: https://developers.google.com/apps-script/guides/testing

### 4. Health Index Calculation Algorithm

**Decision**: Weighted scoring system based on CVE severity and count

**Rationale**:
- Simple to understand and explain to compliance officers
- Aligns with industry standard CVSS severity classifications
- Provides single numeric score for trend tracking
- Threshold-based alerting (score > X triggers notification)

**Algorithm**:
```
Health Index = 100 - (Critical × 20 + Important × 10 + Moderate × 5 + Low × 1)
Clamped to [0, 100] range

Health Status:
- Healthy: 80-100 (0-1 Important or <4 Moderate)
- At-Risk: 50-79 (2+ Important or 1 Critical)
- Critical: 0-49 (2+ Critical or 5+ Important)
```

**Alternatives Considered**:
- **Boolean healthy/unhealthy**: Too simplistic, doesn't capture severity gradations
- **CVSS scores**: Too granular, requires per-CVE scoring complexity
- **Red/Yellow/Green status**: Hard to define thresholds objectively

**Implementation Details**:
- Pure function in `HealthCalculator.ts`:
  ```typescript
  interface CVESummary {
    critical: number;
    important: number;
    moderate: number;
    low: number;
  }

  function calculateHealthIndex(summary: CVESummary): number {
    const penalty = (
      summary.critical * 20 +
      summary.important * 10 +
      summary.moderate * 5 +
      summary.low * 1
    );
    return Math.max(0, 100 - penalty);
  }
  ```
- Change detection: Compare current vs. previous health index from Sheets
- Trigger notification if status category changes (Healthy → At-Risk, etc.)

**References**:
- CVSS severity ratings: https://nvd.nist.gov/vuln-metrics/cvss
- Container security scoring systems: Docker Bench, Red Hat Insights

### 5. Google Sheets Schema Design

**Decision**: Multi-sheet workbook with structured data layout

**Rationale**:
- Separation of concerns: Config, Live Data, Historical Data, Logs
- Supports both human reading and programmatic access
- Enables native Sheets features (formulas, conditional formatting, pivot tables)
- Historical data preserved for compliance auditing

**Schema**:

**Sheet 1: Config**
| Column A      | Column B          | Column C           |
|---------------|-------------------|--------------------|
| Image Name    | Enabled (TRUE/FALSE) | Severity Threshold |
| ubi8/ubi      | TRUE              | Important          |
| ubi9/ubi-minimal | TRUE           | Critical           |

**Sheet 2: CVE Data** (current state)
| Image Name | Version | CVE ID | Severity | Affected Packages | Discovery Date | Health Index | Status |
|------------|---------|--------|----------|-------------------|----------------|--------------|--------|
| ubi8/ubi   | 8.10    | CVE-2024-1234 | Critical | openssl | 2025-10-31 | 65 | At-Risk |

**Sheet 3: Historical Data** (append-only log)
| Timestamp | Image Name | Version | CVE Count | Critical Count | Important Count | Health Index | Status Change |
|-----------|------------|---------|-----------|----------------|-----------------|--------------|---------------|

**Sheet 4: Logs** (execution audit trail)
| Timestamp | Status | Images Checked | CVEs Found | Errors | Notifications Sent | Duration (sec) |
|-----------|--------|----------------|------------|--------|--------------------|--------------------|

**Implementation Details**:
- Use `SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config')`
- Read config with `getRange('A2:C').getValues()`
- Write CVE data with batch operations to minimize API calls
- Conditional formatting rules: Red for Critical, Orange for At-Risk, Green for Healthy

**References**:
- Apps Script Sheets API: https://developers.google.com/apps-script/reference/spreadsheet
- Sheets API quotas: 300 write requests/minute

### 6. Notification Delivery Mechanisms

**Decision**: Dual-channel support - Gmail API for email, Slack Incoming Webhooks for Slack

**Rationale**:
- Gmail API native to Google Workspace, no external dependencies
- Slack webhooks simple, no OAuth flow required
- Both support rich formatting (HTML email, Slack markdown)
- Failure in one channel doesn't block the other

**Implementation Details**:

**Email (Gmail API)**:
```typescript
function sendEmailNotification(event: NotificationEvent): void {
  GmailApp.sendEmail({
    to: PropertiesService.getScriptProperties().getProperty('EMAIL_RECIPIENTS'),
    subject: `Container Health Alert: ${event.affectedImages.join(', ')}`,
    htmlBody: formatEmailHTML(event)
  });
}
```

**Slack (Incoming Webhook)**:
```typescript
function sendSlackNotification(event: NotificationEvent): void {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK');
  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      text: `Container Health Alert`,
      blocks: formatSlackBlocks(event)
    })
  });
}
```

**Notification Content**:
- Subject/Title: "Container Health Alert: [Image Names]"
- Body:
  - Image name and version
  - Health status change (Before → After)
  - CVE summary (count by severity)
  - Top 3 most critical CVEs with links to Red Hat advisories
  - Link to Google Sheets for full details

**Alternatives Considered**:
- **Google Chat**: Limited rich formatting vs Slack
- **PagerDuty**: Overkill for notification-only use case
- **SMS via Twilio**: Requires paid account, character limits

**References**:
- Gmail Apps Script API: https://developers.google.com/apps-script/reference/gmail
- Slack Incoming Webhooks: https://api.slack.com/messaging/webhooks

### 7. Error Handling and Retry Logic

**Decision**: Graceful degradation with structured error logging, exponential backoff for transient failures

**Rationale**:
- Apps Script has 6-minute execution limit, can't afford long retry loops
- Network failures (API timeouts, rate limits) should not crash entire monitoring run
- Failed images logged, rest of batch continues processing
- Observability principle requires all errors captured with context

**Strategy**:
- **GraphQL API failures**: Retry up to 3 times with exponential backoff (1s, 2s, 4s), then log error and skip image
- **Sheets API failures**: Batch operations with try/catch, fallback to individual writes if batch fails
- **Notification failures**: Log error but don't block monitoring run completion
- **Partial success handling**: Some images succeed, some fail → log both outcomes

**Implementation Details**:
```typescript
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt - 1) * 1000;
      Utilities.sleep(delay);
    }
  }
}
```

**Error Logging Format**:
```
[2025-10-31T12:34:56Z] [ERROR] [CatalogService] Failed to fetch ubi8/ubi after 3 retries: Network timeout (image: ubi8/ubi, endpoint: graphql, error: ETIMEDOUT)
```

**References**:
- Apps Script execution limits: https://developers.google.com/apps-script/guides/services/quotas
- Exponential backoff best practices: https://cloud.google.com/iot/docs/how-tos/exponential-backoff

## Summary of Decisions

| Area | Decision | Status |
|------|----------|--------|
| Red Hat API | GraphQL public endpoint, no auth | ✅ Validated |
| Build Tool | Vite with vite-plugin-apps-script | ✅ Validated |
| Testing | Vitest + MSW for integration tests | ✅ Validated |
| Health Algorithm | Weighted severity scoring (0-100) | ✅ Validated |
| Sheets Schema | Multi-sheet: Config, CVE Data, Historical, Logs | ✅ Validated |
| Notifications | Gmail API (email) + Slack Webhooks | ✅ Validated |
| Error Handling | Exponential backoff, graceful degradation | ✅ Validated |

All research complete. No NEEDS CLARIFICATION items remain. Ready to proceed to Phase 1 (Design & Contracts).
