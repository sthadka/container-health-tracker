---

description: "Task list for Container Health Monitor implementation"
---

# Tasks: Container Health Monitor

**Input**: Design documents from `/specs/001-container-health-monitor/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - only include if explicitly requested. This feature uses integration tests per the constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below use single project structure per plan.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize pnpm project with package.json
- [x] T002 Install TypeScript and configure tsconfig.json with strict mode
- [x] T003 Install Vite and vite-plugin-apps-script for build pipeline
- [x] T004 Install clasp CLI globally and authenticate with Google account
- [x] T005 Create Apps Script project via clasp create and configure .clasp.json
- [x] T006 Create appsscript.json manifest with V8 runtime and OAuth scopes
- [x] T007 [P] Install @types/google-apps-script type definitions
- [x] T008 [P] Install Vitest and MSW for integration testing
- [x] T009 [P] Install graphql-request for GraphQL API client
- [x] T010 Create vite.config.ts for Apps Script bundling (output: Code.js)
- [x] T011 Create vitest.config.ts for test configuration
- [x] T012 Create project directory structure (src/, tests/, config/)
- [x] T013 Create Google Sheets spreadsheet with 4 tabs (Config, CVE Data, Historical, Logs)
- [x] T014 Add column headers to all Google Sheets tabs per contracts/sheets-schema.md
- [x] T015 Configure Apps Script Properties via initializeProperties() function
- [x] T016 Add build scripts to package.json (dev, build, test, push, deploy)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T017 [P] Create Severity enum type in src/models/types.ts
- [x] T018 [P] Create HealthStatus enum type in src/models/types.ts
- [x] T019 [P] Create NotificationChannel enum type in src/models/types.ts
- [x] T020 [P] Create DeliveryStatus enum type in src/models/types.ts
- [x] T021 Create MonitoredImage interface in src/models/MonitoredImage.ts
- [x] T022 Create CVERecord interface in src/models/CVERecord.ts
- [x] T023 Create HealthIndex interface in src/models/HealthIndex.ts
- [x] T024 Create NotificationEvent interface in src/models/NotificationEvent.ts
- [x] T025 Create MonitoringRun interface in src/models/MonitoringRun.ts
- [x] T026 Implement HealthCalculator pure function in src/services/HealthCalculator.ts
- [x] T027 Create GraphQL query templates in src/integrations/graphql/queries.ts
- [x] T028 Implement ConfigService to read from Apps Script Properties in src/config/ConfigService.ts
- [x] T029 Create SheetsAdapter base class in src/integrations/sheets/SheetsAdapter.ts
- [x] T030 Create RedHatClient GraphQL client in src/integrations/graphql/RedHatClient.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Automated CVE Tracking (Priority: P1) 🎯 MVP

**Goal**: Automated CVE tracking for monitored images with health index calculation and Google Sheets updates

**Independent Test**: Add a container image to Config sheet, trigger monitoring, verify CVE data appears in CVE Data sheet with accurate information from catalog.redhat.com

### Tests for User Story 1 (OPTIONAL - integration tests per constitution) ⚠️

> **NOTE: Integration tests required per constitution**

- [ ] T031 [P] [US1] Create MSW mock for Red Hat GraphQL API in tests/fixtures/graphql-responses.json
- [ ] T032 [P] [US1] Write contract test for find_repositories query in tests/integration/catalog-contract.test.ts
- [ ] T033 [P] [US1] Write contract test for find_repository_images_by_registry_path query in tests/integration/catalog-contract.test.ts
- [ ] T034 [P] [US1] Write contract test for find_image_vulnerabilities query in tests/integration/catalog-contract.test.ts
- [ ] T035 [P] [US1] Write Sheets read contract test in tests/integration/sheets-contract.test.ts
- [ ] T036 [P] [US1] Write Sheets write contract test in tests/integration/sheets-contract.test.ts
- [ ] T037 [US1] Write end-to-end integration test for monitoring pipeline in tests/integration/end-to-end.test.ts

### Implementation for User Story 1

- [x] T038 [P] [US1] Implement readConfig method in SheetsRepository extending SheetsAdapter in src/services/SheetsRepository.ts
- [x] T039 [P] [US1] Implement findRepository method in CatalogService in src/services/CatalogService.ts
- [x] T040 [US1] Implement findLatestImage method with semantic version parsing in src/services/CatalogService.ts
- [x] T041 [US1] Implement fetchImageVulnerabilities method with pagination in src/services/CatalogService.ts
- [x] T042 [US1] Implement version parsing utility (semver) in src/services/CatalogService.ts
- [x] T043 [P] [US1] Implement writeCVEData method in SheetsRepository in src/services/SheetsRepository.ts
- [x] T044 [P] [US1] Implement appendLogEntry method in SheetsRepository in src/services/SheetsRepository.ts
- [x] T045 [US1] Implement calculateHealthIndex in HealthCalculator (if not done in Phase 2)
- [x] T046 [US1] Implement processImage method in MonitoringOrchestrator in src/services/MonitoringOrchestrator.ts
- [x] T047 [US1] Implement execute method for monitoring run in MonitoringOrchestrator
- [x] T048 [US1] Create runMonitoring entry point function in src/main.ts
- [x] T049 [US1] Create testMonitoring manual test function in src/main.ts
- [x] T050 [US1] Add error handling with exponential backoff for API calls in RedHatClient
- [x] T051 [US1] Add structured logging with format [TIMESTAMP] [LEVEL] [COMPONENT] throughout MonitoringOrchestrator
- [x] T052 [US1] Implement graceful degradation (continue on image failure) in MonitoringOrchestrator
- [x] T053 [US1] Build with Vite and test manual trigger via clasp run testMonitoring
- [ ] T054 [US1] Verify Config sheet data is read correctly
- [ ] T055 [US1] Verify CVE Data sheet is populated with accurate Red Hat API data
- [ ] T056 [US1] Verify Logs sheet contains execution audit trail
- [ ] T057 [US1] Verify health index calculation matches specification (100 - penalties)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (MVP complete!)

---

## Phase 4: User Story 2 - Severity-Based Alert Notifications (Priority: P2)

**Goal**: Automated notifications via email and Slack when health index changes

**Independent Test**: Simulate health index change (manually or via new CVEs), verify notifications sent to configured recipients with accurate CVE details

### Tests for User Story 2 (OPTIONAL - integration tests per constitution) ⚠️

- [ ] T058 [P] [US2] Write email notification delivery test in tests/integration/notification.test.ts
- [ ] T059 [P] [US2] Write Slack notification delivery test in tests/integration/notification.test.ts
- [ ] T060 [US2] Write test for notification consolidation (multiple images, single alert) in tests/integration/notification.test.ts

### Implementation for User Story 2

- [x] T061 [P] [US2] Implement EmailNotifier class with Gmail API integration in src/integrations/notifiers/EmailNotifier.ts
- [x] T062 [P] [US2] Implement SlackNotifier class with webhook integration in src/integrations/notifiers/SlackNotifier.ts
- [x] T063 [US2] Implement formatEmailHTML template renderer in src/integrations/notifiers/EmailNotifier.ts
- [x] T064 [US2] Implement buildSlackPayload with Block Kit formatting in src/integrations/notifiers/SlackNotifier.ts
- [x] T065 [US2] Implement NotificationService dispatcher in src/services/NotificationService.ts
- [x] T066 [US2] Implement send method with multi-channel support in NotificationService
- [x] T067 [US2] Implement health status change detection in MonitoringOrchestrator
- [x] T068 [US2] Integrate NotificationService into processImage method in MonitoringOrchestrator
- [x] T069 [US2] Add notification delivery status tracking in MonitoringOrchestrator
- [x] T070 [US2] Implement notification consolidation (single alert for multiple images)
- [x] T071 [US2] Add error handling for notification failures (log but don't block run)
- [x] T072 [US2] Configure EMAIL_RECIPIENTS in Apps Script Properties
- [x] T073 [US2] Configure SLACK_WEBHOOK_URL in Apps Script Properties
- [ ] T074 [US2] Test email notification delivery with real Gmail API
- [ ] T075 [US2] Test Slack notification delivery with real webhook
- [ ] T076 [US2] Verify notification content includes all required fields (image, CVEs, severity, packages)
- [ ] T077 [US2] Verify no notifications sent when health status unchanged

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Historical Tracking (Priority: P3)

**Goal**: Maintain historical CVE data for compliance reporting and trend analysis

**Independent Test**: Run multiple monitoring cycles, verify historical data preserved with timestamps, trend information available for audit reporting

### Tests for User Story 3 (OPTIONAL) ⚠️

- [ ] T078 [P] [US3] Write historical snapshot append test in tests/integration/sheets-contract.test.ts
- [ ] T079 [P] [US3] Write historical data preservation test (image removal) in tests/integration/sheets-contract.test.ts

### Implementation for User Story 3

- [ ] T080 [P] [US3] Implement appendHistoricalSnapshot method in SheetsRepository in src/services/SheetsRepository.ts
- [ ] T081 [US3] Create historical snapshot on each monitoring run in MonitoringOrchestrator
- [ ] T082 [US3] Track status changes (previous → current) in historical snapshots
- [ ] T083 [US3] Implement CVE resolution detection (compare current vs previous CVEs)
- [ ] T084 [US3] Update MonitoringRun to track newCvesDiscovered and resolvedCves counts
- [ ] T085 [US3] Preserve historical data when image removed from Config sheet
- [ ] T086 [US3] Test historical data accumulation over multiple runs
- [ ] T087 [US3] Verify historical sheet shows timeline of CVE discoveries
- [ ] T088 [US3] Verify resolution dates recorded when CVEs disappear

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T089 [P] Add JSDoc comments to all public interfaces and methods
- [ ] T090 [P] Add input validation to all service methods
- [ ] T091 [P] Implement rate limiting (max 10 requests/second) in RedHatClient
- [ ] T092 [P] Implement circuit breaker (stop after 3 consecutive failures) in RedHatClient
- [ ] T093 [P] Add request timeout (5 seconds) to all GraphQL queries
- [ ] T094 [P] Add performance logging (query duration) to CatalogService
- [ ] T095 [P] Optimize Sheets batch writes to reduce API calls
- [ ] T096 [P] Add conditional formatting rules to Sheets (red for Critical, orange for At-Risk, green for Healthy)
- [ ] T097 [P] Add data validation rules to Config sheet (dropdown for severity, checkbox for enabled)
- [ ] T098 Configure time-based trigger for daily execution in Apps Script console
- [ ] T099 Test full monitoring run with 5+ real images from catalog.redhat.com
- [ ] T100 Verify Apps Script execution completes within 6-minute limit
- [ ] T101 Verify Google Sheets API quota not exceeded (300 writes/minute)
- [ ] T102 Test error scenarios (API unavailable, invalid image names, permission errors)
- [ ] T103 Document environment setup in README.md
- [ ] T104 Document Apps Script deployment process in README.md
- [ ] T105 Create example Config sheet with sample images

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ **MVP**
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends US1 with historical tracking but independently testable

### Within Each User Story

- Integration tests (if included) MUST run and FAIL before implementation
- Models before services (already in Foundational phase)
- Services before orchestrator
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T007-T009 can run together)
- All Foundational tasks marked [P] can run in parallel (T017-T020 enums, T021-T025 interfaces)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel (T031-T036)
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all integration tests for User Story 1 together (after Phase 2 complete):
Task T031: "Create MSW mock for Red Hat GraphQL API"
Task T032: "Write contract test for find_repositories query"
Task T033: "Write contract test for find_repository_images_by_registry_path query"
Task T034: "Write contract test for find_image_vulnerabilities query"
Task T035: "Write Sheets read contract test"
Task T036: "Write Sheets write contract test"

# Launch all service implementations in parallel (after tests fail):
Task T038: "Implement readConfig method in SheetsRepository"
Task T039: "Implement findRepository method in CatalogService"
Task T043: "Implement writeCVEData method in SheetsRepository"
Task T044: "Implement appendLogEntry method in SheetsRepository"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T016)
2. Complete Phase 2: Foundational (T017-T030) - **CRITICAL** - blocks all stories
3. Complete Phase 3: User Story 1 (T031-T057)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy to Apps Script and test with real images
6. Set up daily trigger and monitor for 24 hours

**At this point you have a working MVP!** - Automated CVE tracking with health calculation and Sheets updates

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP!)
3. Add User Story 2 → Test independently → Deploy (adds notifications)
4. Add User Story 3 → Test independently → Deploy (adds historical tracking)
5. Add Polish → Final production-ready system

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T030)
2. Once Foundational is done:
   - Developer A: User Story 1 (T031-T057)
   - Developer B: User Story 2 (T058-T077)
   - Developer C: User Story 3 (T078-T088)
3. Stories complete and integrate independently
4. Team completes Polish together (T089-T105)

---

## Task Summary

**Total Tasks**: 105

**By Phase**:
- Setup: 16 tasks (T001-T016)
- Foundational: 14 tasks (T017-T030)
- User Story 1 (P1 - MVP): 27 tasks (T031-T057) - includes 7 integration tests
- User Story 2 (P2): 20 tasks (T058-T077) - includes 3 integration tests
- User Story 3 (P3): 11 tasks (T078-T088) - includes 2 integration tests
- Polish: 17 tasks (T089-T105)

**Integration Tests**: 12 total (constitution requirement)
- US1: 7 tests (Red Hat API contracts, Sheets contracts, E2E)
- US2: 3 tests (Email, Slack, consolidation)
- US3: 2 tests (Historical snapshots, preservation)

**Parallel Tasks**: 42 tasks marked [P] can run in parallel with others

**Critical Path**:
1. Setup (16 tasks, some parallel)
2. Foundational (14 tasks, many parallel)
3. US1 core implementation (20 tasks after tests)
4. Deploy and validate MVP

**Estimated MVP Timeline** (single developer):
- Setup: 4-6 hours
- Foundational: 6-8 hours
- US1 Implementation: 16-20 hours
- Testing & Validation: 4-6 hours
- **Total: 30-40 hours** for working MVP

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Integration tests required per constitution (III. Integration Testing Focus)
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Use `clasp push` to deploy, `clasp logs` to debug
- Monitor Apps Script execution time (6-minute limit)
- Monitor Google Sheets API quota (300 writes/minute)
- Reference contracts/ for API schemas and examples
- Reference quickstart.md for setup instructions

---

## Ready to Start?

Begin with **T001** (Initialize pnpm project) and work sequentially through Setup phase. After Foundational phase (T030), you can proceed with User Story 1 for MVP or split work across stories if you have multiple developers.

For fastest path to MVP: Complete T001-T030, then T031-T057. You'll have a working automated CVE tracker!
