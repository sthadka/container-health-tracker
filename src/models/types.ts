/**
 * Core enum types for Container Health Monitor
 *
 * Per constitution: TypeScript-First Development
 * All enums are strongly typed with explicit string values
 */

/**
 * CVE severity levels from Red Hat Container Catalog API
 * Maps to CVSS scoring ranges
 */
export enum Severity {
  CRITICAL = 'Critical',
  IMPORTANT = 'Important',
  MODERATE = 'Moderate',
  LOW = 'Low',
  NONE = 'None'
}

/**
 * Health status classification based on CVE severity thresholds
 * Used for visual indicators and notification triggers
 */
export enum HealthStatus {
  HEALTHY = 'Healthy',      // No Critical or Important CVEs
  AT_RISK = 'At Risk',      // Important CVEs present
  CRITICAL = 'Critical',    // Critical CVEs present
  UNKNOWN = 'Unknown'       // No data or error state
}

/**
 * Notification delivery channels
 * Supports multi-channel alert distribution
 */
export enum NotificationChannel {
  EMAIL = 'Email',
  SLACK = 'Slack'
}

/**
 * Notification delivery status tracking
 * Used for audit trail in monitoring runs
 */
export enum DeliveryStatus {
  SUCCESS = 'Success',
  FAILED = 'Failed',
  PENDING = 'Pending',
  SKIPPED = 'Skipped'
}
