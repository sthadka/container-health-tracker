# Container Health Tracker

Automated monitoring and reporting tool for Red Hat container image vulnerabilities using Google Apps Script and Google Sheets.

## Overview

Container Health Tracker automates the process of monitoring container images from the Red Hat Container Catalog for security vulnerabilities (CVEs). It provides security and DevOps teams with real-time visibility into Critical and Important vulnerabilities affecting their container infrastructure.

**Key Features:**

- Automated CVE tracking for Red Hat container images
- Health index calculation based on vulnerability severity
- Historical vulnerability tracking and trend analysis
- Automated notifications via email when health status changes
- All data stored and visualized in Google Sheets
- Runs automatically on a configurable schedule via Apps Script triggers

## How It Works

1. **Configure**: List the container images you want to monitor in a Google Sheet
2. **Monitor**: Apps Script runs on a schedule (e.g., daily), queries the Red Hat Container Catalog GraphQL API for each image
3. **Analyze**: System fetches latest image versions, identifies vulnerabilities, calculates health index
4. **Report**: CVE data, affected packages, and severity levels are written to Google Sheets
5. **Alert**: Notifications are sent when health index changes indicate new vulnerabilities

## Architecture

**Technology Stack:**

- TypeScript 5.x (transpiled for Google Apps Script V8 runtime)
- Google Apps Script (execution environment)
- Google Sheets (data storage and visualization)
- Red Hat Container Catalog GraphQL API (data source)
- Vite (build tooling)
- Clasp (deployment)

**Project Structure:**

```
src/
├── models/              # Domain models (MonitoredImage, CVERecord, HealthIndex)
├── services/            # Business logic (CatalogService, MonitoringOrchestrator)
├── integrations/        # External integrations (RedHatClient, SheetsRepository)
└── main.ts             # Apps Script entry points

validate-contract.ts     # GraphQL contract validator
test-graphql.js         # Live API integration tests
```

## Data Model

**Monitored Images Sheet:**
- Image registry and repository path
- Current version and architecture
- Health index score
- Last check timestamp
- Status tracking

**CVE Data Sheet:**
- CVE identifiers and severity levels
- Affected packages
- Advisory information
- Discovery and publication dates
- Active/resolved status

**Historical Sheet:**
- Archived vulnerability records
- Remediation timeline tracking
- Trend analysis data

**Execution Logs Sheet:**
- Monitoring run timestamps
- Success/error status
- Images processed count
- Execution duration

## Health Index Algorithm

The health index provides an at-a-glance view of image security posture:

```
Health Index = 100 - (Critical×20 + Important×10 + Moderate×5 + Low×1)
```

- Score 80-100: Healthy (green)
- Score 50-79: At Risk (yellow)
- Score 0-49: Critical (red)

## Setup

For detailed setup instructions, see [Setup Guide](docs/setup-project.md).

**Quick Start:**

1. Install prerequisites (Node.js, pnpm, clasp)
2. Clone repository and install dependencies
3. Create Google Sheet and Apps Script project
4. Configure Script Properties
5. Build and deploy

## Development

**Build and Test:**

```bash
pnpm install          # Install dependencies
pnpm build            # Build TypeScript to Apps Script
pnpm test             # Run unit tests
pnpm validate         # Validate GraphQL queries against contract
pnpm test:api         # Test queries against live Red Hat API
```

**Deploy:**

```bash
pnpm push             # Validate, build, and push to Apps Script
pnpm deploy           # Push and create new deployment version
```

**Validation:**

The project includes two validation tools that run automatically before deployment:

- `validate-contract.ts`: Static validation of GraphQL queries against the Red Hat API contract
- `test-graphql.js`: Live integration tests against the Red Hat GraphQL endpoint

## Usage

**Manual Execution:**

In the Apps Script editor, run:
- `testMonitoring()`: Test configuration and API connectivity
- `runMonitoring()`: Execute full monitoring cycle
- `setupProperties(spreadsheetId)`: Initialize Script Properties

**Scheduled Execution:**

Set up time-driven triggers in Apps Script:
1. Open Apps Script editor
2. Click "Triggers" (clock icon)
3. Add trigger: Function `runMonitoring`, Time-driven, Day timer, Select time
4. Save

## Configuration

All configuration is stored in Apps Script Properties:

```javascript
{
  spreadsheetId: "your-google-sheet-id",
  redHatApiEndpoint: "https://catalog.redhat.com/api/containers/graphql/",
  monitoringEnabled: true,
  notificationsEnabled: true,
  severityThreshold: "Important"
}
```

## Requirements

- Google Workspace account with Apps Script access
- Google Sheets API permissions
- Internet access for Red Hat Container Catalog API
- Node.js 18+ and pnpm for local development

## License

ISC

## Support

For setup instructions, see [Setup Guide](docs/setup-project.md).
For development documentation, see the `docs/` directory.
