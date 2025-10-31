# Feature Specification: Container Health Monitor

**Feature Branch**: `001-container-health-monitor`
**Created**: 2025-10-31
**Status**: Draft
**Input**: User description: "Create a monitoring and reporting tool for container health. The goal is to ensure we are compliant and can deliver image CVE fixes when they have "Impact" above a certain level, e.g "Important" or "Critical". We want to track the CVE, affected packages, created dates for the latest version of the available image. This would all be hosted via Google Appscript and the data written to Google Sheets. The information on which images to check will be available on the spreadsheet itself. If there is a change in the health index, we will use the notify feature to send an email / Slack notification from the spreadsheet (via native integration / Appscript command)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated CVE Tracking for Monitored Images (Priority: P1)

A security compliance officer needs to maintain awareness of critical and important vulnerabilities in container images used across the organization. They configure a list of container images in a spreadsheet, and the system automatically fetches the latest CVE information daily, updating the spreadsheet with vulnerability details including CVE IDs, affected packages, severity levels, and image version information.

**Why this priority**: This is the core value proposition - automated vulnerability tracking eliminates manual checking of container registries and provides a single source of truth for security compliance. Without this, there is no MVP.

**Independent Test**: Can be fully tested by adding a container image name to the spreadsheet's image list, triggering the monitoring process, and verifying that CVE data appears in the spreadsheet with accurate CVE IDs, severity ratings, and package information from catalog.redhat.com.

**Acceptance Scenarios**:

1. **Given** a spreadsheet with configured container image names from Red Hat catalog, **When** the monitoring system runs its scheduled check, **Then** the system fetches the latest image version, retrieves CVE information, and populates the spreadsheet with CVE IDs, affected packages, severity levels, and image creation dates
2. **Given** a container image with no critical or important CVEs, **When** the monitoring check runs, **Then** the spreadsheet reflects a healthy status with zero high-severity vulnerabilities
3. **Given** a container image that has new CVEs since the last check, **When** the monitoring check runs, **Then** the spreadsheet is updated with the new CVE information and the health index changes accordingly
4. **Given** an invalid or non-existent container image name in the tracking list, **When** the monitoring check runs, **Then** the system logs an error status in the spreadsheet for that image without failing the entire monitoring run

---

### User Story 2 - Severity-Based Alert Notifications (Priority: P2)

A DevOps team member needs to be immediately notified when critical or important vulnerabilities are detected in tracked container images. When the health index changes due to new high-severity CVEs, the system automatically sends notifications via email or Slack, enabling rapid response to security issues.

**Why this priority**: Automated alerting transforms passive monitoring into active incident response. This adds significant value but requires the foundational tracking (P1) to function.

**Independent Test**: Can be tested by simulating a health index change (either by manually updating spreadsheet data or triggering a check that discovers new CVEs), then verifying that notifications are sent to configured email addresses or Slack channels with accurate CVE details and severity information.

**Acceptance Scenarios**:

1. **Given** a monitored image's health index changes from healthy to unhealthy due to new critical CVEs, **When** the monitoring check completes, **Then** the system sends a notification to configured recipients containing the image name, CVE IDs, severity levels, and affected packages
2. **Given** a monitored image has a new important (but not critical) CVE, **When** the monitoring check completes, **Then** the system sends a notification based on the configured severity threshold
3. **Given** no health index changes have occurred, **When** the monitoring check completes, **Then** no notifications are sent to avoid alert fatigue
4. **Given** multiple images have health index changes in a single monitoring run, **When** the check completes, **Then** the system sends a single consolidated notification summarizing all changes rather than multiple individual alerts

---

### User Story 3 - Historical Tracking and Trend Analysis (Priority: P3)

A compliance manager needs to review historical vulnerability trends and demonstrate compliance efforts over time. The system maintains historical records of CVE discoveries, remediation timelines, and health index changes, enabling audit reporting and trend analysis.

**Why this priority**: Historical data provides long-term value for compliance reporting and process improvement, but the immediate security value comes from P1 and P2. This can be added incrementally.

**Independent Test**: Can be tested by running multiple monitoring cycles over time, then reviewing the spreadsheet to verify that historical CVE data is preserved, timestamps are accurate, and trend information (such as time-to-remediation or vulnerability count over time) is available for reporting.

**Acceptance Scenarios**:

1. **Given** a monitored image has been tracked for multiple monitoring cycles, **When** viewing the historical data, **Then** the spreadsheet shows a timeline of CVE discoveries with dates, allowing analysis of when vulnerabilities were introduced
2. **Given** a CVE that was present in a previous check but resolved in the current check, **When** viewing the historical data, **Then** the system shows both the discovery date and resolution date for that CVE
3. **Given** multiple monitoring runs have occurred, **When** generating a compliance report, **Then** the user can see metrics such as average time-to-detection, total CVE count by severity, and remediation rates
4. **Given** historical data exists for an image, **When** that image is removed from the tracking list, **Then** the historical data is preserved (archived) rather than deleted to maintain audit trail

---

### Edge Cases

- What happens when the Red Hat Container Catalog API is unavailable or returns errors?
- How does the system handle rate limiting from the catalog.redhat.com API?
- What happens when a container image name is ambiguous or matches multiple catalog entries?
- How does the system handle images that are deprecated or no longer available in the catalog?
- What happens if the spreadsheet reaches row limits or has permission issues?
- How does the system handle notification delivery failures (email bounces, Slack API errors)?
- What happens when CVE data is missing or incomplete in the Red Hat catalog?
- How does the system handle timezone differences for creation dates and monitoring timestamps?
- What happens if multiple instances of the monitoring script run simultaneously?
- How does the system handle very large CVE lists that might exceed notification size limits?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST retrieve container image information from catalog.redhat.com including latest version and creation date
- **FR-002**: System MUST fetch CVE data for each monitored container image including CVE IDs, affected packages, and severity levels (Critical, Important, Moderate, Low)
- **FR-003**: System MUST read the list of container images to monitor from a designated section of the Google Sheets spreadsheet
- **FR-004**: System MUST write CVE tracking data to the Google Sheets spreadsheet including image name, version, CVE details, affected packages, severity, and timestamps
- **FR-005**: System MUST calculate and update a health index for each monitored image based on the presence and severity of CVEs
- **FR-006**: System MUST detect changes in health index between monitoring runs
- **FR-007**: System MUST send notifications when health index changes are detected
- **FR-008**: System MUST support email notifications as a notification channel
- **FR-009**: System MUST support Slack notifications as a notification channel
- **FR-010**: System MUST filter CVEs by severity threshold, focusing on Critical and Important severities by default
- **FR-011**: System MUST handle API errors gracefully without corrupting existing spreadsheet data
- **FR-012**: System MUST log execution status, errors, and summary information for troubleshooting
- **FR-013**: System MUST run on a scheduled basis (daily is assumed based on requirements)
- **FR-014**: System MUST preserve existing spreadsheet data when updating with new monitoring results
- **FR-015**: System MUST timestamp all monitoring runs and data updates for audit purposes
- **FR-016**: System MUST handle multiple container images in a single monitoring run
- **FR-017**: System MUST differentiate between new CVEs and previously tracked CVEs
- **FR-018**: Notifications MUST include essential details: image name, CVE IDs, severity levels, and affected packages
- **FR-019**: System MUST support configuration of notification recipients (email addresses or Slack channel)
- **FR-020**: System MUST validate container image names before attempting to fetch data from Red Hat catalog

### Key Entities

- **Monitored Image**: Represents a container image being tracked for vulnerabilities. Key attributes include image name (from Red Hat catalog), current version, last check timestamp, health index status, and monitoring enabled/disabled flag.

- **CVE Record**: Represents a Common Vulnerabilities and Exposures entry affecting a monitored image. Key attributes include CVE identifier (e.g., CVE-2024-1234), severity level (Critical/Important/Moderate/Low), affected package names, discovery date (when first detected by the system), and resolution status.

- **Health Index**: Represents the security posture of a monitored image. Calculated based on CVE count and severity distribution. Key attributes include overall status (healthy/at-risk/critical), critical CVE count, important CVE count, last change timestamp, and previous status for change detection.

- **Notification Event**: Represents an alert triggered by health index changes. Key attributes include triggered timestamp, affected image(s), change description (what changed in health index), delivery channel (email/Slack), delivery status, and recipient list.

- **Monitoring Run**: Represents a single execution of the monitoring process. Key attributes include run timestamp, images checked count, successful checks count, errors encountered, total CVEs found, notifications sent count, and execution duration.

### Assumptions

- Container images are sourced from catalog.redhat.com (Red Hat Container Catalog)
- The Red Hat Container Catalog provides public API access for querying image information and CVE data
- Monitoring runs will execute on a daily schedule (configurable via Apps Script triggers)
- Email notifications will use Gmail API or similar Google Workspace integration
- Slack notifications will use either native spreadsheet integrations or Slack webhook URLs
- A single Google Sheets spreadsheet will contain both input (image list) and output (CVE data, health metrics)
- Users have appropriate permissions to run Apps Script and access Google Sheets
- The severity threshold for notifications defaults to Important and Critical, but may be configurable
- Health index change detection compares current state to previous monitoring run stored in spreadsheet
- Historical data will be maintained within the same spreadsheet (separate sheet/tab) or in the same sheet with archival markers

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Security teams can identify all critical and important CVEs affecting monitored container images within 24 hours of CVE publication in the Red Hat catalog
- **SC-002**: Monitoring runs complete successfully for at least 95% of scheduled executions without manual intervention
- **SC-003**: Notifications are delivered within 5 minutes of health index changes being detected
- **SC-004**: Users can add a new container image to the monitoring list and receive CVE data in the spreadsheet within one monitoring cycle (max 24 hours)
- **SC-005**: The system accurately tracks at least 50 concurrent container images without performance degradation
- **SC-006**: Zero data loss occurs during monitoring runs - existing CVE data is preserved when updates are applied
- **SC-007**: 100% of critical and important CVEs are captured and reported when present in the Red Hat catalog
- **SC-008**: Compliance officers can generate audit reports showing vulnerability discovery and remediation timelines from spreadsheet data without manual data processing
- **SC-009**: Alert fatigue is minimized - notifications are sent only for actual health index changes, not for every monitoring run
- **SC-010**: System uptime and reliability meet operational requirements with less than 5% failure rate across all monitoring runs

### Compliance & Operational Goals

- **SC-011**: Organization maintains continuous awareness of container image CVE status as demonstrated by up-to-date spreadsheet data
- **SC-012**: Response time to critical vulnerabilities improves as measured by time between CVE publication and team notification
- **SC-013**: Manual effort for CVE tracking is eliminated, reducing security team workload by automating daily checks
