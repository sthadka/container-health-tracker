# Implementation Plan: Container Health Monitor

**Branch**: `001-container-health-monitor` | **Date**: 2025-10-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-container-health-monitor/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

The Container Health Monitor automates CVE tracking for container images from Red Hat's catalog. It fetches vulnerability data daily via GraphQL API, updates Google Sheets with CVE details (ID, severity, affected packages, image version), calculates health indices, and sends email/Slack notifications when critical or important vulnerabilities are detected. The system runs as a Google Apps Script application, built with TypeScript, Vite, and deployed via clasp CLI.

## Technical Context

**Language/Version**: TypeScript 4.x+ (transpiled to ES6+ for Google Apps Script V8 runtime)
**Primary Dependencies**: @types/google-apps-script, vite (build tool), clasp (deployment), graphql-request or similar GraphQL client
**Storage**: Google Sheets (primary data store), Apps Script Properties Service (configuration storage)
**Testing**: Vitest (for integration tests), Mock Service Worker or similar (for API mocking)
**Target Platform**: Google Apps Script (V8 runtime), executed serverless in Google Cloud
**Project Type**: single (standalone Apps Script project)
**Performance Goals**: Complete monitoring run for 50 images within 5 minutes, GraphQL queries under 2 seconds per image
**Constraints**: Apps Script 6-minute execution time limit, rate limits on catalog.redhat.com API, Google Sheets API quota (unlimited reads, 300 write requests per minute)
**Scale/Scope**: Support 50+ concurrent monitored images, handle 10+ CVEs per image, maintain 90-day historical data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Library-First Architecture ✅

**Compliance**: PASS

- CVE fetcher will be self-contained library with GraphQL client interface
- Health index calculator will be pure function library, testable without Apps Script runtime
- Google Sheets adapter will abstract Sheets API behind data repository interface
- Notification service will support multiple channels (email/Slack) via plugin pattern

**Verification**: Each library exports TypeScript interfaces, can be imported and tested independently

### II. TypeScript-First Development ✅

**Compliance**: PASS

- All source code written in TypeScript as specified by user
- tsconfig.json will use `strict: true` mode
- @types/google-apps-script provides platform types
- All module boundaries defined via explicit interfaces (e.g., ICatalogClient, IHealthCalculator, INotifier)

**Verification**: TypeScript compiler enforces strict typing, no implicit `any` without explicit justification

### III. Integration Testing Focus ✅

**Compliance**: PASS

- Contract tests required for Red Hat GraphQL API (query structure, response schema validation)
- Contract tests required for Google Sheets API (read/write operations, data format)
- Contract tests required for notification delivery (email via Gmail API, Slack via webhook)
- Integration test will validate full pipeline: fetch → calculate → update → notify

**Verification**: Test suite includes mocked GraphQL responses, Sheets API interactions, and notification delivery confirmation

### IV. Declarative Configuration ✅

**Compliance**: PASS

- Monitored images list stored in Google Sheets "Config" sheet, not hardcoded
- Severity threshold (Critical/Important) configurable via Sheets config
- Notification recipients (email addresses, Slack webhook URLs) stored in Apps Script Properties Service
- GraphQL query templates externalized, not embedded in code
- Daily schedule configured via Apps Script time-based trigger (declarative)

**Verification**: Users can modify tracked images and notification settings without code changes

### V. Observability & Debuggability ✅

**Compliance**: PASS

- Structured logging via Logger.log() with format: `[TIMESTAMP] [LEVEL] [COMPONENT] message`
- All errors include context: image name, API endpoint, error type, stack trace
- Execution tracking logs: monitoring run start/end, per-image processing, API call duration
- Google Sheets audit trail: "Logs" sheet tracks run timestamp, success count, error count, CVEs found
- Health index changes logged with before/after values

**Verification**: Every monitoring run produces structured logs viewable in Apps Script dashboard and Sheets audit log

### Gates Summary

**Status**: ✅ ALL GATES PASS

No constitutional violations. All principles satisfied by design:
- Library-first architecture with testable modules
- TypeScript with strict mode
- Integration tests for all external contracts
- Configuration driven via Sheets and Properties Service
- Comprehensive logging and audit trail

## Project Structure

### Documentation (this feature)

```text
specs/001-container-health-monitor/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── redhat-graphql.graphql    # Red Hat Catalog GraphQL schema
│   ├── sheets-schema.md          # Google Sheets layout specification
│   └── notifications.md          # Notification payload contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/
│   ├── MonitoredImage.ts         # Image entity with health index
│   ├── CVERecord.ts               # CVE data model
│   ├── HealthIndex.ts             # Health calculation model
│   ├── NotificationEvent.ts       # Notification event model
│   └── MonitoringRun.ts           # Run metadata model
├── services/
│   ├── CatalogService.ts          # Red Hat Catalog GraphQL client
│   ├── HealthCalculator.ts        # Health index calculation logic
│   ├── SheetsRepository.ts        # Google Sheets data access layer
│   ├── NotificationService.ts     # Email/Slack notification dispatcher
│   └── MonitoringOrchestrator.ts  # Main workflow coordinator
├── integrations/
│   ├── graphql/
│   │   ├── RedHatClient.ts        # GraphQL query executor
│   │   └── queries.ts             # GraphQL query templates
│   ├── sheets/
│   │   ├── SheetsAdapter.ts       # Sheets API wrapper
│   │   └── schemas.ts             # Sheet structure definitions
│   └── notifiers/
│       ├── EmailNotifier.ts       # Gmail API integration
│       └── SlackNotifier.ts       # Slack webhook integration
├── config/
│   └── ConfigService.ts           # Apps Script Properties + Sheets config reader
└── main.ts                        # Apps Script entry points (onSchedule, manual triggers)

tests/
├── integration/
│   ├── catalog-contract.test.ts   # Red Hat API contract validation
│   ├── sheets-contract.test.ts    # Google Sheets read/write tests
│   ├── notification.test.ts       # Email/Slack delivery tests
│   └── end-to-end.test.ts         # Full pipeline integration test
└── fixtures/
    ├── graphql-responses.json     # Mock Red Hat API responses
    └── sample-cve-data.json        # Test CVE datasets

config/
└── appsscript.json                # Apps Script manifest (time triggers, OAuth scopes)

Root files:
├── tsconfig.json                  # TypeScript strict mode config
├── vite.config.ts                 # Vite build configuration for Apps Script
├── package.json                   # pnpm dependencies
├── .clasprc.json                  # clasp credentials (gitignored)
└── .clasp.json                    # clasp project settings
```

**Structure Decision**: Single project structure selected. This is a standalone Google Apps Script application with no frontend/backend separation. All code runs serverless in Google Cloud. Vite bundles TypeScript into single JavaScript file for Apps Script deployment via clasp. Testing framework runs locally with mocked external dependencies.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: No violations detected. Constitution Check passed all gates.
