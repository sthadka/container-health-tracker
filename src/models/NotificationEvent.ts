/**
 * NotificationEvent entity
 *
 * Represents a notification sent for health status changes
 * Per spec.md User Story 2 (Severity-Based Alert Notifications)
 */

import { NotificationChannel, DeliveryStatus, HealthStatus } from './types';

export interface NotificationEvent {
  // Event identification
  eventId: string;                     // Unique identifier for this notification
  monitoringRunId: string;             // Links to MonitoringRun that triggered this

  // Image context
  imageId: string;                     // Links to MonitoredImage
  registry: string;                    // Denormalized for notification content
  repository: string;                  // Denormalized for notification content
  imageVersion: string;                // Version when notification triggered

  // Health change details
  previousStatus: HealthStatus;        // Status before change
  currentStatus: HealthStatus;         // Status after change
  previousScore: number;               // Health index before change
  currentScore: number;                // Health index after change

  // Notification content
  criticalCveCount: number;            // Count of Critical CVEs
  importantCveCount: number;           // Count of Important CVEs
  affectedCves: string[];              // List of CVE IDs (e.g., ["CVE-2024-1234", ...])
  affectedPackages: string[];          // List of vulnerable packages

  // Delivery tracking
  channels: NotificationChannel[];     // Channels used (Email, Slack)
  deliveryStatus: DeliveryStatus;      // Success | Failed | Pending | Skipped
  deliveryAttempts: number;            // Number of retry attempts
  errorMessage?: string;               // Error details if failed (optional)

  // Recipients
  emailRecipients?: string[];          // Email addresses (if EMAIL channel used)
  slackWebhookUrl?: string;            // Webhook URL (if SLACK channel used)

  // Timestamps
  triggeredAt: Date;                   // When notification was triggered
  sentAt?: Date;                       // When notification was successfully sent (optional)
}
