# Container Health Tracker - Development Guidelines

Project documentation for developers working on the Container Health Tracker.

Last updated: 2025-11-05

## Project Overview

Container Health Tracker is an automated monitoring system for Red Hat container image vulnerabilities. Built with TypeScript and deployed to Google Apps Script, it queries the Red Hat Container Catalog GraphQL API to track CVEs, calculate health indices, and send notifications when security posture changes.

## Active Technologies

**Core Stack:**
- TypeScript 5.x (transpiled to ES6+ for Google Apps Script V8 runtime)
- Google Apps Script (serverless execution environment)
- Google Sheets API (data storage and presentation)
- Red Hat Container Catalog GraphQL API (vulnerability data source)

**Build Tools:**
- Vite 7.x (bundling and transpilation)
- Clasp (Google Apps Script deployment)
- Vitest (unit testing)
- tsx (TypeScript execution for validation)

**Development:**
- pnpm (package manager)
- @types/google-apps-script (type definitions)
- graphql (GraphQL client library)

## Project Structure

```text
container-health-tracker/
├── src/
│   ├── models/              # Domain models
│   │   ├── types.ts         # Core type definitions
│   │   ├── MonitoredImage.ts
│   │   ├── CVERecord.ts
│   │   ├── HealthIndex.ts
│   │   └── MonitoringRun.ts
│   ├── services/            # Business logic
│   │   ├── CatalogService.ts        # Red Hat API integration
│   │   ├── HealthCalculator.ts      # Health index computation
│   │   └── MonitoringOrchestrator.ts # Main workflow
│   ├── integrations/        # External integrations
│   │   ├── graphql/
│   │   │   ├── RedHatClient.ts      # GraphQL client
│   │   │   ├── queries.ts           # Query templates
│   │   │   └── redhat-api-types.ts  # API response types
│   │   └── sheets/
│   │       ├── SheetsAdapter.ts     # Base Sheets API wrapper
│   │       └── SheetsRepository.ts  # Data persistence layer
│   ├── config/
│   │   └── ConfigService.ts         # Apps Script Properties management
│   └── main.ts                      # Apps Script entry points
├── specs/
│   └── 001-container-health-monitor/
│       ├── spec.md              # Feature specification
│       ├── plan.md              # Implementation plan
│       ├── tasks.md             # Task tracking
│       ├── data-model.md        # Data model documentation
│       ├── research.md          # Technical research
│       └── contracts/
│           └── redhat-graphql.graphql  # API contract schema
├── docs/
│   ├── setup-project.md             # Setup instructions
│   ├── query-image-vuln-graphql.md  # GraphQL usage guide
│   └── validate-graphql-config.md   # Validation documentation
├── tests/                           # Unit tests (Vitest)
├── dist/                            # Build output (generated)
├── validate-contract.ts             # Static query validator
├── test-graphql.js                  # Live API integration tests
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .clasp.json                      # Apps Script project config
└── appsscript.json                  # Apps Script manifest
```

## Commands

**Development:**
```bash
pnpm install          # Install dependencies
pnpm dev              # Watch mode - rebuild on changes
pnpm build            # Build TypeScript to Apps Script bundle
pnpm test             # Run unit tests
pnpm test:ui          # Run tests with UI
pnpm test:coverage    # Generate coverage report
```

**Validation:**
```bash
pnpm validate         # Validate GraphQL queries against contract
pnpm test:api         # Test queries against live Red Hat API
```

**Deployment:**
```bash
pnpm push             # Validate, build, and push to Apps Script
pnpm deploy           # Push and create new deployment version
pnpm logs             # View Apps Script execution logs
```

## Code Style

**TypeScript:**
- Strict mode enabled
- Explicit return types required for public functions
- Use interfaces for data structures
- Use type guards for runtime validation
- Follow standard TypeScript conventions

**Naming Conventions:**
- Classes: PascalCase (e.g., `RedHatClient`, `HealthCalculator`)
- Interfaces: PascalCase (e.g., `ContainerImage`, `MonitoredImageData`)
- Functions: camelCase (e.g., `findRepository`, `calculateHealthIndex`)
- Constants: UPPER_SNAKE_CASE (e.g., `FIND_REPOSITORIES`, `API_ENDPOINT`)
- Private methods: prefix with underscore (e.g., `_executeQuery`)

**File Organization:**
- One class per file
- File name matches class name
- Group related types in `types.ts`
- Keep GraphQL queries in `queries.ts`

## Architecture Patterns

**Layered Architecture:**
```
main.ts (Entry Points)
    ↓
MonitoringOrchestrator (Workflow)
    ↓
CatalogService (Business Logic)
    ↓
RedHatClient (API Integration) + SheetsRepository (Data Persistence)
    ↓
External APIs (Red Hat GraphQL, Google Sheets)
```

**Key Design Decisions:**
- Repository pattern for data persistence (SheetsRepository)
- Service layer for business logic (CatalogService, HealthCalculator)
- Adapter pattern for Google Sheets (SheetsAdapter)
- Client pattern for external APIs (RedHatClient)
- Retry logic with exponential backoff for API calls
- Graceful degradation: continue processing on individual image failures

## GraphQL Contract Validation

The project enforces contract-based development with the Red Hat GraphQL API:

**Contract Schema:** `specs/001-container-health-monitor/contracts/redhat-graphql.graphql`

**Validation Tools:**
1. `validate-contract.ts` - Static validation of query field names
2. `test-graphql.js` - Live API testing with real data

**Validation runs automatically before deployment:**
```bash
pnpm push    # Runs validate-contract.ts before pushing
```

**Common Contract Mistakes:**
- Using `package_name` instead of `name` in affected_packages
- Using `published_date` instead of `public_date`
- Querying non-existent fields like `cvss3_score` or `description`
- Using `docker_image_id` instead of `_id` for vulnerability queries

## Apps Script Constraints

**Runtime Environment:**
- V8 JavaScript engine (modern ES6+ support)
- No Node.js APIs (fs, path, etc.)
- Must use UrlFetchApp instead of fetch()
- Global scope requires specific function exposure

**Quota Limits (Free Tier):**
- 6 minutes per execution
- 90 minutes per day total
- 20,000 URL Fetch calls per day
- 100 email sends per day

**Function Exposure:**
Apps Script requires top-level function declarations. Our Vite config adds a footer:
```javascript
function runMonitoring() {
  return AppScriptExports.runMonitoring();
}
```

**IIFE Bundle:**
Vite bundles to IIFE format for Apps Script compatibility.

## Development Workflow

**1. Local Development:**
```bash
git checkout -b feature/your-feature
pnpm install
pnpm dev   # Watch mode
# Make changes to src/
pnpm test  # Run tests
```

**2. Validation:**
```bash
pnpm validate     # Check GraphQL queries
pnpm test:api     # Test against live API
pnpm build        # Verify build succeeds
```

**3. Deployment:**
```bash
pnpm push         # Push to Apps Script
clasp open        # Open in editor
# Test manually in Apps Script
```

**4. Commit:**
```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature
```

## Testing Strategy

**Unit Tests (Vitest):**
- Test business logic in isolation
- Mock external dependencies (Sheets, APIs)
- Focus on: HealthCalculator, version parsing, data transformations

**Integration Tests:**
- `test-graphql.js` validates real API responses
- Manual testing in Apps Script for end-to-end workflow

**Contract Tests:**
- `validate-contract.ts` ensures queries match API schema
- Prevents deployment of invalid queries

## Google Sheets Schema

**Config Tab:**
- Column A: Image Name (e.g., "ubi8/ubi", "rhacs-main-rhel8")
- Column B: Enabled (TRUE/FALSE)
- Column C: Severity Threshold (Critical/Important/Moderate/Low)
- Column D: Notes (optional text)
- Column E: Stream (comma-separated, e.g., "4.7,4.8,4.9" or "8,9" or "latest")
- Column F: Architecture (comma-separated, e.g., "amd64,arm64,ppc64le,s390x")

**CVE Data Tab:**
- Column A: Image Name
- Column B: Architecture (e.g., "amd64", "arm64")
- Column C: Stream (e.g., "8", "4.7", "latest")
- Column D: Version
- Column E: CVE ID
- Column F: Severity
- Column G: CVSS Score (not available from API)
- Column H: Affected Packages
- Column I: Discovery Date
- Column J: Published Date
- Column K: Advisory URL
- Column L: Health Index
- Column M: Health Status
- Column N: Last Updated

**Historical Tab:**
- Column A: Timestamp
- Column B: Image Name
- Column C: Architecture
- Column D: Stream
- Column E: Version
- Column F: Total CVEs
- Column G: Critical Count
- Column H: Important Count
- Column I: Moderate Count
- Column J: Low Count
- Column K: Health Index
- Column L: Health Status
- Column M: Status Change

**Stream Patterns:**
- `latest`: Tracks absolute latest version (no filtering)
- `8`: Tracks latest 8.x version (e.g., 8.10, 8.10-1028)
- `4.7`: Tracks latest 4.7.x version (e.g., 4.7.5, 4.7.5-123)
- Multiple streams: `4.7,4.8,4.9` tracks all three independently

**Architecture Support:**
- `amd64`: x86-64 architecture (default)
- `arm64`: ARM 64-bit architecture
- `ppc64le`: PowerPC 64-bit Little Endian
- `s390x`: IBM Z architecture
- Multiple architectures: `amd64,arm64` tracks both independently

**Example Config Row:**
```
ubi8/ubi | TRUE | Important | Production images | 8,9 | amd64,arm64
```
This would track 4 combinations:
- ubi8/ubi (amd64, stream 8)
- ubi8/ubi (amd64, stream 9)
- ubi8/ubi (arm64, stream 8)
- ubi8/ubi (arm64, stream 9)

## Configuration Management

All runtime configuration stored in Apps Script Properties:

```typescript
interface AppConfig {
  spreadsheetId: string;           // Required
  redHatApiEndpoint: string;       // Required
  monitoringEnabled: boolean;      // Optional: default true
  notificationsEnabled: boolean;   // Optional: default true
  severityThreshold: string;       // Optional: default "Important"
}
```

Access via ConfigService:
```typescript
config.initialize();
const spreadsheetId = config.get('spreadsheetId');
```

## Common Development Tasks

**Add New GraphQL Query:**
1. Add query to `src/integrations/graphql/queries.ts`
2. Add types to `src/integrations/graphql/redhat-api-types.ts`
3. Update `validate-contract.ts` if needed
4. Test with `pnpm test:api`
5. Add method to `RedHatClient.ts`

**Add New Data Model:**
1. Create interface in `src/models/types.ts`
2. Create model class in `src/models/YourModel.ts`
3. Add repository methods if needed
4. Update Sheets schema in `SheetsRepository.ts`

**Modify Health Index Algorithm:**
1. Update `src/services/HealthCalculator.ts`
2. Update tests
3. Update documentation in README.md and spec.md

## Recent Changes

**2025-11-21:**
- Added multi-stream and multi-architecture support
- Config tab now accepts comma-separated streams (Column E) and architectures (Column F)
- Each image tracks multiple stream×arch combinations independently
- CVE Data and Historical tabs updated with Architecture and Stream columns
- Added `findLatestImageInStream()` method for stream-specific version detection
- Error entries created when stream/arch combinations not found in registry
- Health status tracked per combination (e.g., ubi8-amd64-8, ubi8-arm64-9)

**2025-11-05:**
- Completed MVP implementation (Phases 1-2)
- Added contract validation system (validate-contract.ts)
- Added live API testing (test-graphql.js)
- Fixed GraphQL field name issues (affected_packages.name, public_date)
- Implemented full TypeScript type system for Red Hat API
- Added comprehensive documentation (README.md, setup-project.md)
- Integrated validation into build pipeline

**2025-10-31:**
- Initial project setup
- Created specification and implementation plan
- Defined architecture and data models

## Known Issues

**Affected Packages Often Null:**
The Red Hat API frequently returns `affected_packages: null` instead of an empty array. Code must handle this gracefully.

**Version Detection:**
Red Hat tags don't follow strict semver (e.g., "8.10-1028"). Custom version parser implemented in CatalogService.

**MongoDB ObjectID Requirement:**
Vulnerability queries MUST use `_id` (MongoDB ObjectID) NOT `docker_image_id` (SHA256).

## Resources

**External Documentation:**
- [Red Hat Container Catalog](https://catalog.redhat.com)
- [Google Apps Script Reference](https://developers.google.com/apps-script)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Clasp Documentation](https://github.com/google/clasp)

**Internal Documentation:**
- [Setup Guide](docs/setup-project.md)
- [Feature Specification](specs/001-container-health-monitor/spec.md)
- [Implementation Plan](specs/001-container-health-monitor/plan.md)
- [Data Model](specs/001-container-health-monitor/data-model.md)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
