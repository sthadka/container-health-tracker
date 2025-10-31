# Data Model: Container Health Monitor

**Feature**: Container Health Monitor
**Date**: 2025-10-31
**Status**: Complete

## Overview

This document defines the data entities, their attributes, relationships, validation rules, and state transitions for the Container Health Monitor system. All entities are TypeScript interfaces representing domain concepts without implementation details.

## Core Entities

### 1. MonitoredImage

Represents a container image being tracked for security vulnerabilities.

**Attributes**:

```typescript
interface MonitoredImage {
  // Identification
  imageName: string;              // e.g., "ubi8/ubi", from Red Hat catalog
  currentVersion: string;         // e.g., "8.10", latest available version

  // Monitoring Configuration
  enabled: boolean;               // Whether to include in monitoring runs
  severityThreshold: Severity;    // Minimum severity to track (Critical | Important | Moderate | Low)

  // Health Status
  healthIndex: number;            // Calculated score 0-100
  healthStatus: HealthStatus;     // Derived from healthIndex (Healthy | At-Risk | Critical)

  // Metadata
  lastChecked: Date;              // Timestamp of last monitoring run for this image
  imageCreatedDate: Date;         // Creation date of current version from Red Hat catalog

  // CVE Summary
  cveCount: {
    critical: number;
    important: number;
    moderate: number;
    low: number;
  };
}
```

**Validation Rules**:
- `imageName` MUST match pattern `[a-z0-9-]+/[a-z0-9-]+` (Red Hat catalog format)
- `currentVersion` MUST be non-empty string
- `enabled` defaults to `true`
- `severityThreshold` defaults to `Important`
- `healthIndex` MUST be in range [0, 100]
- `healthStatus` MUST be derived from `healthIndex` (not stored independently)
- `lastChecked` MUST be updated on every monitoring run, even if no changes
- `cveCount` values MUST be non-negative integers

**Relationships**:
- Has many `CVERecord` entries (one-to-many)
- Has many `HistoricalSnapshot` entries (one-to-many, append-only)

**State Transitions**:
```
[New Image Added] → enabled=true, healthIndex=100, healthStatus=Healthy
  ↓
[First Check] → Update healthIndex, healthStatus, cveCount based on fetched CVEs
  ↓
[Subsequent Checks] → Compare previous healthStatus to current
  ↓ (if status changed)
[Trigger Notification] → Create NotificationEvent
```

---

### 2. CVERecord

Represents a specific CVE (Common Vulnerabilities and Exposures) affecting a monitored image.

**Attributes**:

```typescript
interface CVERecord {
  // CVE Identification
  cveId: string;                  // e.g., "CVE-2024-1234"
  imageName: string;              // Which image this CVE affects (FK to MonitoredImage)
  imageVersion: string;           // Version of image when CVE was discovered

  // Severity & Impact
  severity: Severity;             // Critical | Important | Moderate | Low
  cvssScore: number | null;       // CVSS base score (0-10), null if unavailable

  // Affected Components
  affectedPackages: string[];     // List of RPM package names (e.g., ["openssl", "libcurl"])

  // Temporal Data
  discoveryDate: Date;            // When this CVE was first detected by our system
  publishedDate: Date;            // Official CVE publication date from Red Hat
  resolvedDate: Date | null;      // When CVE no longer present (image updated), null if active

  // Reference Links
  advisoryUrl: string;            // Red Hat security advisory URL
}
```

**Validation Rules**:
- `cveId` MUST match pattern `CVE-\d{4}-\d{4,}` (e.g., CVE-2024-1234)
- `imageName` MUST reference existing `MonitoredImage.imageName`
- `severity` MUST be one of: `Critical`, `Important`, `Moderate`, `Low`
- `cvssScore` MUST be in range [0.0, 10.0] if not null
- `affectedPackages` MUST be non-empty array
- `discoveryDate` MUST be ≤ current date
- `publishedDate` MUST be ≤ `discoveryDate` (we can't discover before publication)
- `resolvedDate` MUST be > `discoveryDate` if not null
- `advisoryUrl` MUST be valid HTTPS URL

**Relationships**:
- Belongs to one `MonitoredImage` (many-to-one)

**State Transitions**:
```
[CVE Discovered] → Create CVERecord with discoveryDate=now, resolvedDate=null
  ↓
[Subsequent Checks - CVE Still Present] → No changes
  ↓
[Subsequent Checks - CVE Resolved] → Set resolvedDate=now, move to Historical sheet
```

---

### 3. HealthIndex

Represents the calculated security health score for a monitored image. This is a value object, not stored independently but computed on-demand.

**Attributes**:

```typescript
interface HealthIndex {
  // Computed Score
  score: number;                  // 0-100, where 100 = perfectly healthy
  status: HealthStatus;           // Healthy | At-Risk | Critical

  // Contributing Factors
  cveSummary: {
    critical: number;
    important: number;
    moderate: number;
    low: number;
  };

  // Comparison
  previousScore: number | null;   // Previous health index for change detection
  scoreChange: number;            // Difference from previous score (negative = worse)
  statusChanged: boolean;         // True if status category changed
}
```

**Calculation Algorithm**:
```typescript
function calculateHealthIndex(cveSummary: CVESummary): HealthIndex {
  const penalty = (
    cveSummary.critical * 20 +
    cveSummary.important * 10 +
    cveSummary.moderate * 5 +
    cveSummary.low * 1
  );

  const score = Math.max(0, 100 - penalty);

  const status =
    score >= 80 ? HealthStatus.Healthy :
    score >= 50 ? HealthStatus.AtRisk :
                  HealthStatus.Critical;

  return { score, status, cveSummary };
}
```

**Validation Rules**:
- `score` MUST be in range [0, 100]
- `status` derived deterministically from `score` (not independently set)
- `cveSummary` counts MUST be non-negative integers
- `scoreChange` = `score - previousScore`, positive means improvement

**Relationships**:
- Computed from `MonitoredImage.cveCount`
- Triggers `NotificationEvent` if `statusChanged === true`

---

### 4. NotificationEvent

Represents an alert triggered by health index changes.

**Attributes**:

```typescript
interface NotificationEvent {
  // Event Identification
  eventId: string;                // Unique identifier (UUID)
  triggeredAt: Date;              // When notification was created

  // Affected Resources
  affectedImages: {
    imageName: string;
    oldStatus: HealthStatus;
    newStatus: HealthStatus;
    cveCount: { critical: number; important: number; moderate: number; low: number };
    topCves: string[];            // Top 3 CVE IDs by severity
  }[];

  // Notification Delivery
  channels: NotificationChannel[]; // ['email', 'slack']
  deliveryStatus: {
    email: DeliveryStatus;        // 'pending' | 'sent' | 'failed'
    slack: DeliveryStatus;        // 'pending' | 'sent' | 'failed'
  };

  // Content
  subject: string;                // Email subject / Slack title
  messageBody: string;            // Formatted message text (HTML for email, Markdown for Slack)
}
```

**Validation Rules**:
- `eventId` MUST be unique (use `Utilities.getUuid()` in Apps Script)
- `triggeredAt` MUST be ≤ current timestamp
- `affectedImages` MUST be non-empty array
- For each affected image:
  - `oldStatus` MUST differ from `newStatus` (otherwise no notification needed)
  - `topCves` MUST contain ≤ 3 CVE IDs
- `channels` MUST be non-empty array
- `deliveryStatus` MUST have entry for each channel in `channels`
- `subject` MUST be non-empty
- `messageBody` MUST be non-empty

**Relationships**:
- References multiple `MonitoredImage` entries (many-to-many)
- Triggered by `HealthIndex.statusChanged === true`

**State Transitions**:
```
[Health Status Change Detected] → Create NotificationEvent with deliveryStatus='pending'
  ↓
[Send via Email] → Update deliveryStatus.email = 'sent' or 'failed'
  ↓
[Send via Slack] → Update deliveryStatus.slack = 'sent' or 'failed'
  ↓
[Log Event] → Write to Sheets "Logs" tab for audit trail
```

---

### 5. MonitoringRun

Represents a single execution of the monitoring workflow.

**Attributes**:

```typescript
interface MonitoringRun {
  // Run Identification
  runId: string;                  // Unique identifier (UUID)
  startTime: Date;                // When monitoring run began
  endTime: Date | null;           // When monitoring run completed (null if in progress)

  // Execution Summary
  imagesChecked: number;          // Total images processed (enabled=true)
  successfulChecks: number;       // Images successfully fetched + updated
  failedChecks: number;           // Images that encountered errors

  // CVE Discovery
  totalCvesFound: number;         // Total CVEs across all images
  newCvesDiscovered: number;      // CVEs not present in previous run
  resolvedCves: number;           // CVEs present in previous run but not current

  // Notifications
  notificationsSent: number;      // Count of NotificationEvents created
  healthStatusChanges: number;    // Images with status transitions

  // Errors
  errors: {
    imageName: string;
    errorType: string;            // e.g., 'GraphQLTimeout', 'InvalidImageName'
    errorMessage: string;
  }[];

  // Performance
  durationSeconds: number;        // endTime - startTime in seconds
}
```

**Validation Rules**:
- `runId` MUST be unique
- `startTime` MUST be ≤ current timestamp
- `endTime` MUST be > `startTime` if not null
- `imagesChecked` MUST = `successfulChecks` + `failedChecks`
- All count fields MUST be non-negative integers
- `durationSeconds` MUST be ≥ 0
- `errors` array length MUST equal `failedChecks`

**Relationships**:
- Aggregates results from multiple `MonitoredImage` checks
- Creates zero or more `NotificationEvent` entries

**State Transitions**:
```
[Scheduled Trigger Fires] → Create MonitoringRun with startTime=now, endTime=null
  ↓
[Process Each Enabled Image] → Increment imagesChecked, update success/fail counters
  ↓
[Detect Health Changes] → Increment healthStatusChanges, create NotificationEvents
  ↓
[Run Completes] → Set endTime=now, calculate durationSeconds, log to Sheets
```

---

## Enumeration Types

### Severity

```typescript
enum Severity {
  Critical = 'Critical',
  Important = 'Important',
  Moderate = 'Moderate',
  Low = 'Low'
}
```

**Usage**: CVE severity classification from Red Hat catalog

---

### HealthStatus

```typescript
enum HealthStatus {
  Healthy = 'Healthy',      // Health index 80-100
  AtRisk = 'At-Risk',       // Health index 50-79
  Critical = 'Critical'     // Health index 0-49
}
```

**Usage**: Derived from `HealthIndex.score`

---

### NotificationChannel

```typescript
enum NotificationChannel {
  Email = 'email',
  Slack = 'slack'
}
```

**Usage**: Delivery channels for notifications

---

### DeliveryStatus

```typescript
enum DeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed'
}
```

**Usage**: Tracking notification delivery success/failure

---

## Data Flow Diagram

```
┌─────────────────┐
│ Google Sheets   │
│ "Config" Sheet  │
└────────┬────────┘
         │ Read monitored images list
         ▼
┌─────────────────┐
│ MonitoringRun   │ ◄─── Scheduled trigger (daily)
│ (In Progress)   │
└────────┬────────┘
         │ For each enabled image
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Red Hat Catalog │◄─────┤ CatalogService   │
│ GraphQL API     │      │ (Fetch CVEs)     │
└─────────────────┘      └────────┬─────────┘
                                  │ Returns CVERecord[]
                                  ▼
                         ┌─────────────────┐
                         │ HealthCalculator│
                         │ (Compute Index) │
                         └────────┬────────┘
                                  │ Returns HealthIndex
                                  ▼
                         ┌─────────────────┐
                         │ Compare to      │
                         │ Previous Status │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │ Status Changed?           │
                    └─────┬────────────────┬────┘
                          │ YES            │ NO
                          ▼                ▼
                 ┌─────────────────┐  (Continue to next image)
                 │NotificationEvent│
                 │ (Create Alert)  │
                 └────────┬────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
     ┌────────────────┐      ┌────────────────┐
     │ EmailNotifier  │      │ SlackNotifier  │
     │ (Send Email)   │      │ (Send Slack)   │
     └────────────────┘      └────────────────┘
              │                       │
              └───────────┬───────────┘
                          ▼
                 ┌─────────────────┐
                 │ Google Sheets   │
                 │ Update CVE Data │
                 │ + Historical    │
                 │ + Logs          │
                 └─────────────────┘
```

## Persistence Mapping (Google Sheets)

### Sheet: Config
Maps to: `MonitoredImage` configuration only

| Column A (imageName) | Column B (enabled) | Column C (severityThreshold) |
|----------------------|--------------------|------------------------------|
| ubi8/ubi             | TRUE               | Important                    |

### Sheet: CVE Data (Current State)
Maps to: `MonitoredImage` + `CVERecord` (denormalized view)

| Image Name | Version | CVE ID | Severity | Packages | Discovery | Health Index | Status |
|------------|---------|--------|----------|----------|-----------|--------------|--------|
| ubi8/ubi   | 8.10    | CVE-2024-1234 | Critical | openssl | 2025-10-31 | 65 | At-Risk |

### Sheet: Historical Data
Maps to: `MonitoredImage` snapshots over time

| Timestamp | Image | Version | CVE Count | Critical | Important | Health Index | Status |
|-----------|-------|---------|-----------|----------|-----------|--------------|--------|

### Sheet: Logs
Maps to: `MonitoringRun`

| Timestamp | Status | Images Checked | CVEs Found | Errors | Notifications | Duration |
|-----------|--------|----------------|------------|--------|---------------|----------|

## Invariants

1. **Health Index Consistency**: `MonitoredImage.healthIndex` MUST always equal the result of `calculateHealthIndex(MonitoredImage.cveCount)`

2. **CVE Count Accuracy**: `MonitoredImage.cveCount` MUST equal the count of active `CVERecord` entries (where `resolvedDate === null`) grouped by severity

3. **Notification Trigger**: A `NotificationEvent` MUST be created if and only if `HealthIndex.statusChanged === true`

4. **Monotonic Timestamps**: For any `CVERecord`, `publishedDate ≤ discoveryDate ≤ resolvedDate` (if resolved)

5. **Monitoring Run Completeness**: `MonitoringRun.imagesChecked` MUST equal the count of `MonitoredImage` entries where `enabled === true`

6. **No Orphan CVEs**: Every `CVERecord.imageName` MUST reference an existing `MonitoredImage.imageName`

7. **Unique CVEs per Image**: The combination `(imageName, cveId, imageVersion)` MUST be unique in active `CVERecord` entries

## Summary

All entities defined with clear attributes, validation rules, relationships, and state transitions. Data model supports:
- ✅ CVE tracking across multiple images
- ✅ Health index calculation and change detection
- ✅ Notification triggering based on status changes
- ✅ Historical data preservation for compliance
- ✅ Execution audit trail via MonitoringRun

Ready to proceed with API contract generation.
