<!--
================================================================================
SYNC IMPACT REPORT - Constitution Update
================================================================================
Version Change: Initial → 1.0.0
Modified Principles: N/A (initial creation)
Added Sections:
  - All sections (initial constitution creation)
  - Core Principles (5 principles adapted from Specify defaults)
  - Technical Standards
  - Development Workflow
  - Governance
Removed Sections: N/A (initial creation)

Templates Status:
  ✅ plan-template.md - Constitution Check section reviewed and compatible
  ✅ spec-template.md - User story requirements align with integration testing focus
  ✅ tasks-template.md - Task structure supports integration testing and TypeScript development
  ✅ checklist-template.md - Generic template, no conflicts
  ✅ agent-file-template.md - Generic template, no conflicts

Follow-up TODOs: None - all placeholders filled with concrete values

Rationale for v1.0.0:
  - Initial constitution ratification for Container Health Tracker project
  - Establishes foundational governance for Google Apps Script + TypeScript development
  - Adapted Specify framework defaults to Google Apps Script execution environment
================================================================================
-->

# Container Health Tracker Constitution

## Core Principles

### I. Library-First Architecture

Every feature starts as a standalone library with clear contracts and responsibilities. Libraries MUST be:

- **Self-contained**: Minimal external dependencies, explicit interfaces
- **Independently testable**: Can be tested in isolation from Google Apps Script runtime
- **CLI-enabled**: Installable and runnable via clasp CLI tool
- **Purpose-driven**: Clear single responsibility - no organizational-only modules

**Rationale**: Google Apps Script projects can become difficult to maintain when logic is tightly coupled to the runtime environment. Library-first design enables local development, testing, and reuse across multiple scripts.

### II. TypeScript-First Development

All code MUST be written in TypeScript, not JavaScript. TypeScript requirements:

- **Strict type checking**: Use `strict: true` in tsconfig.json
- **Explicit typing**: No implicit `any` types without justification
- **Interface contracts**: All module boundaries defined via TypeScript interfaces
- **Google Apps Script types**: Use `@types/google-apps-script` for platform APIs

**Rationale**: TypeScript provides compile-time safety critical for Apps Script development where runtime debugging is limited. Strong typing prevents API misuse and catches errors before deployment.

### III. Integration Testing Focus

Integration tests are the primary quality gate. Testing requirements:

- **Contract tests MUST exist** for all external integrations:
  - Red Hat Container Catalog API
  - Google Sheets API interactions
  - Notification systems
- **Data flow testing**: End-to-end validation of catalog → sheet → notification pipeline
- **Mock external dependencies**: Use test doubles for APIs to enable local testing
- **Apps Script runtime simulation**: Test logic independently of Apps Script environment where possible

**Rationale**: Unit tests provide limited value in Apps Script's constrained environment. Integration tests verify the actual data flows and API contracts that define the system's behavior.

### IV. Declarative Configuration

System behavior MUST be driven by configuration, not code changes:

- **Image catalog**: Track images via configuration file, not hardcoded lists
- **Schedule**: Cron-like scheduling defined declaratively
- **Notification rules**: Alert conditions defined in configuration
- **Google Sheets mapping**: Column layouts and formulas externalized

**Rationale**: Apps Script deployments are slow and require manual approval. Configuration-driven design enables users to modify behavior (tracked images, alert thresholds) without code changes or redeployment.

### V. Observability & Debuggability

All operations MUST be observable and debuggable:

- **Structured logging**: Use Logger.log() with consistent format `[TIMESTAMP] [LEVEL] [COMPONENT] message`
- **Error context**: All errors MUST include context (which image, which API call, what data)
- **Execution tracking**: Log start/end of each major operation (fetch, update, notify)
- **Google Sheets audit trail**: Track last update timestamp, error counts, success rates in sheet

**Rationale**: Apps Script's debugging capabilities are limited. Comprehensive logging to Google Sheets and Apps Script logs is the primary debugging and monitoring mechanism.

## Technical Standards

### Platform & Runtime

- **Platform**: Google Apps Script (V8 runtime)
- **Language**: TypeScript 4.x+ (transpiled to ES6+)
- **Package Manager**: pnpm (for stability and deterministic installs)
- **Deployment Tool**: clasp (Google Apps Script CLI)
- **Node Version**: LTS (for local development tooling)

### External Dependencies

- **Container Registry API**: catalog.redhat.com REST API
- **Google Services**: Google Sheets API, potentially Gmail API for notifications
- **HTTP Client**: Apps Script UrlFetchApp for API calls
- **Type Definitions**: @types/google-apps-script

### Code Organization

```
project-root/
├── src/
│   ├── models/          # Data models (Image, SecurityInfo, etc.)
│   ├── services/        # Business logic (catalog fetcher, sheet updater)
│   ├── integrations/    # External API clients (Red Hat API, Sheets API)
│   └── main.ts          # Apps Script entry points (time-triggered functions)
├── tests/
│   ├── integration/     # Integration tests for API contracts
│   └── fixtures/        # Test data and mocks
├── config/
│   └── images.json      # Image catalog configuration
├── appsscript.json      # Apps Script manifest
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## Development Workflow

### Local Development

1. **Setup**: `pnpm install` to install dependencies
2. **Development**: Write TypeScript in `src/`, types checked locally
3. **Testing**: Run integration tests via `pnpm test`
4. **Build**: Transpile TypeScript → JavaScript via `tsc`
5. **Deploy**: Push to Apps Script via `clasp push`

### Deployment Process

- **Dev Environment**: Use separate Apps Script project for development/testing
- **Production**: Manual promotion after validation in dev environment
- **Rollback**: Via clasp version management (`clasp versions`, `clasp deploy --versionNumber X`)

### Testing Requirements

- **Pre-deployment**: All integration tests MUST pass before `clasp push`
- **API contract tests**: Verify Red Hat API response schemas haven't changed
- **Sheet contract tests**: Verify Google Sheets structure matches expectations
- **Data validation**: Test edge cases (missing data, API errors, malformed responses)

### Change Management

- **Breaking changes**: Require constitution amendment if:
  - External API contracts change significantly
  - Google Sheets schema changes
  - Deployment process changes
- **Feature additions**: Must include integration tests demonstrating the new behavior
- **Configuration changes**: Must be backward compatible or include migration guide

## Governance

### Amendment Process

1. **Proposal**: Document proposed change with rationale
2. **Impact Analysis**: Review affected templates and workflows
3. **Version Bump**: Follow semantic versioning (MAJOR.MINOR.PATCH)
4. **Template Sync**: Update dependent templates before ratification
5. **Commit**: Update constitution.md with sync impact report

### Versioning Policy

- **MAJOR**: Backward incompatible principle changes (e.g., removing TypeScript requirement)
- **MINOR**: New principle additions or significant expansions (e.g., adding security principle)
- **PATCH**: Clarifications, wording improvements, non-semantic fixes

### Compliance Review

- **Pre-implementation**: Verify feature plan complies with all principles
- **Code review**: Verify TypeScript, testing, and logging requirements met
- **Pre-deployment**: Verify integration tests pass and observability in place

### Complexity Justification

Any violation of these principles MUST be documented in the feature's plan.md "Complexity Tracking" section with:

- **Which principle** is being violated
- **Why** the violation is necessary
- **What simpler alternative** was rejected and why

**Examples requiring justification**:
- Skipping integration tests for a component
- Hardcoding configuration that should be externalized
- Using JavaScript instead of TypeScript
- Deploying without passing tests

**Version**: 1.0.0 | **Ratified**: 2025-10-31 | **Last Amended**: 2025-10-31
