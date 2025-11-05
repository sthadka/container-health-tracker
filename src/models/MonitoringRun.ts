/**
 * MonitoringRun entity
 *
 * Represents a single execution of the monitoring pipeline
 * Per spec.md - tracks execution metrics and audit trail
 */

export interface MonitoringRun {
  // Run identification
  runId: string;                       // Unique identifier for this run
  executionMode: 'scheduled' | 'manual'; // Trigger type

  // Execution timing
  startTime: Date;                     // Run start timestamp
  endTime?: Date;                      // Run completion timestamp (optional during execution)
  durationMs?: number;                 // Execution duration in milliseconds (optional)

  // Monitoring scope
  imagesProcessed: number;             // Total images checked
  imagesSuccessful: number;            // Images processed without errors
  imagesFailed: number;                // Images that encountered errors
  imagesSkipped: number;               // Images with monitoring disabled

  // CVE tracking
  totalCvesDiscovered: number;         // Total CVEs found across all images
  newCvesDiscovered: number;           // CVEs not seen in previous run
  resolvedCves: number;                // CVEs that disappeared since previous run

  // Notification tracking
  notificationsSent: number;           // Total notifications sent
  notificationsFailed: number;         // Notifications that failed to deliver

  // Status and errors
  status: 'running' | 'completed' | 'failed' | 'partial'; // Overall run status
  errors: Array<{                      // Error log entries
    imageId?: string;                  // Image that caused error (if applicable)
    errorType: string;                 // Error category (e.g., "API_ERROR", "VALIDATION_ERROR")
    errorMessage: string;              // Error details
    timestamp: Date;                   // When error occurred
  }>;

  // Performance metrics
  apiCallCount: number;                // Total GraphQL API calls made
  apiCallDurationMs: number;           // Total time spent on API calls
  sheetsWriteCount: number;            // Total Sheets write operations

  // Metadata
  triggeredBy?: string;                // User email if manual run (optional)
  version: string;                     // Code version/build identifier
}
