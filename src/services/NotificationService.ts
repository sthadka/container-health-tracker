/**
 * NotificationService
 *
 * Multi-channel notification dispatcher
 * Coordinates email and Slack notifications for health status changes
 * Per spec.md User Story 2 (Severity-Based Alert Notifications)
 */

import { EmailNotifier, EmailNotifierConfig } from '../integrations/notifiers/EmailNotifier';
import { SlackNotifier, SlackNotifierConfig } from '../integrations/notifiers/SlackNotifier';
import type { NotificationEvent } from '../models/NotificationEvent';
import { NotificationChannel, DeliveryStatus, HealthStatus, Severity } from '../models/types';

export interface NotificationServiceConfig {
  // Channels to use
  enableEmail: boolean;
  enableSlack: boolean;

  // Email configuration
  emailRecipients?: string[];
  emailFromName?: string;
  includeDetailedPackageList?: boolean;

  // Slack configuration
  slackWebhookUrl?: string;
  slackMentionUsers?: string[];

  // Notification filtering
  severityThreshold?: Severity;    // Only notify for this severity or higher
  notifyOnlyOnStatusChange?: boolean;  // Only send if status changed (default: true)
}

/**
 * NotificationService sends notifications through multiple channels
 *
 * Features:
 * - Multi-channel support (Email, Slack)
 * - Severity-based filtering
 * - Status change detection
 * - Error handling (log but don't block)
 * - Delivery status tracking
 */
export class NotificationService {
  private config: NotificationServiceConfig;
  private emailNotifier?: EmailNotifier;
  private slackNotifier?: SlackNotifier;

  constructor(config: NotificationServiceConfig) {
    this.config = config;

    // Initialize notifiers based on configuration
    if (config.enableEmail && config.emailRecipients && config.emailRecipients.length > 0) {
      const emailConfig: EmailNotifierConfig = {
        recipients: config.emailRecipients,
        fromName: config.emailFromName,
        includeDetailedPackageList: config.includeDetailedPackageList
      };
      this.emailNotifier = new EmailNotifier(emailConfig);
    }

    if (config.enableSlack && config.slackWebhookUrl) {
      const slackConfig: SlackNotifierConfig = {
        webhookUrl: config.slackWebhookUrl,
        mentionUsers: config.slackMentionUsers,
        includeDetailedPackageList: config.includeDetailedPackageList
      };
      this.slackNotifier = new SlackNotifier(slackConfig);
    }
  }

  /**
   * Send notification through configured channels
   *
   * Implements filtering based on:
   * - Severity threshold
   * - Status change requirement
   *
   * Tracks delivery status and errors but does not throw
   *
   * @param event - Notification event to send
   * @returns Updated event with delivery status
   */
  public send(event: NotificationEvent): NotificationEvent {
    // Check if notification should be sent
    if (!this.shouldNotify(event)) {
      Logger.log(`[NotificationService] Skipping notification for ${event.registry}/${event.repository} (filtered by threshold or no status change)`);
      event.deliveryStatus = DeliveryStatus.SKIPPED;
      return event;
    }

    const channelsAttempted: NotificationChannel[] = [];
    const results: boolean[] = [];
    const errors: string[] = [];

    // Send via email
    if (this.emailNotifier) {
      channelsAttempted.push(NotificationChannel.EMAIL);
      try {
        const success = this.emailNotifier.send(event);
        results.push(success);
        if (!success) {
          errors.push('Email delivery failed');
        }
      } catch (error) {
        results.push(false);
        errors.push(`Email error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Send via Slack
    if (this.slackNotifier) {
      channelsAttempted.push(NotificationChannel.SLACK);
      try {
        const success = this.slackNotifier.send(event);
        results.push(success);
        if (!success) {
          errors.push('Slack delivery failed');
        }
      } catch (error) {
        results.push(false);
        errors.push(`Slack error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Update event with delivery results
    event.channels = channelsAttempted;
    event.deliveryAttempts = (event.deliveryAttempts || 0) + 1;

    if (results.length === 0) {
      event.deliveryStatus = DeliveryStatus.SKIPPED;
      event.errorMessage = 'No notification channels configured';
    } else if (results.every(r => r)) {
      event.deliveryStatus = DeliveryStatus.SUCCESS;
      event.sentAt = new Date();
    } else if (results.some(r => r)) {
      event.deliveryStatus = DeliveryStatus.SUCCESS;
      event.sentAt = new Date();
      event.errorMessage = `Partial success: ${errors.join('; ')}`;
    } else {
      event.deliveryStatus = DeliveryStatus.FAILED;
      event.errorMessage = errors.join('; ');
    }

    Logger.log(`[NotificationService] Notification for ${event.registry}/${event.repository}: ${event.deliveryStatus} (${channelsAttempted.join(', ')})`);

    return event;
  }

  /**
   * Send consolidated notification for multiple images
   *
   * Creates a single notification summarizing changes across multiple images
   * Reduces alert fatigue when multiple images have issues
   *
   * @param events - Array of notification events to consolidate
   * @returns Consolidated event with delivery status
   */
  public sendConsolidated(events: NotificationEvent[]): NotificationEvent | null {
    if (events.length === 0) {
      return null;
    }

    // For now, send individual notifications
    // TODO: Implement true consolidation with summary format
    // This would require creating a new NotificationEvent that summarizes all changes

    Logger.log(`[NotificationService] Sending ${events.length} individual notifications (consolidation not yet implemented)`);

    for (const event of events) {
      this.send(event);
    }

    // Return the first event as a placeholder
    return events[0];
  }

  /**
   * Determine if notification should be sent based on filters
   *
   * Checks:
   * - Severity threshold
   * - Status change requirement
   *
   * @param event - Notification event
   * @returns True if notification should be sent
   */
  private shouldNotify(event: NotificationEvent): boolean {
    // Check status change requirement
    if (this.config.notifyOnlyOnStatusChange !== false) {
      // Default is true (only notify on change)
      if (event.previousStatus === event.currentStatus) {
        return false;
      }
    }

    // Check severity threshold
    if (this.config.severityThreshold) {
      const meetsThreshold = this.meetsSeverityThreshold(event);
      if (!meetsThreshold) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if event meets severity threshold
   *
   * Threshold logic:
   * - Critical: Only Critical CVEs trigger
   * - Important: Critical or Important CVEs trigger
   * - Moderate: Critical, Important, or Moderate CVEs trigger
   * - Low: Any CVEs trigger
   *
   * @param event - Notification event
   * @returns True if threshold is met
   */
  private meetsSeverityThreshold(event: NotificationEvent): boolean {
    const threshold = this.config.severityThreshold;

    switch (threshold) {
      case Severity.CRITICAL:
        return event.criticalCveCount > 0;

      case Severity.IMPORTANT:
        return event.criticalCveCount > 0 || event.importantCveCount > 0;

      case Severity.MODERATE:
        // Any CVE count implies at least Moderate
        return event.affectedCves.length > 0;

      case Severity.LOW:
      case Severity.NONE:
        return event.affectedCves.length > 0;

      default:
        // No threshold set - always notify
        return true;
    }
  }

  /**
   * Test notification delivery
   *
   * Sends a test notification to verify channel configuration
   * Useful for setup and troubleshooting
   *
   * @returns True if test successful
   */
  public sendTest(): boolean {
    Logger.log('[NotificationService] Sending test notification...');

    const testEvent: NotificationEvent = {
      eventId: 'test-' + Date.now(),
      monitoringRunId: 'test-run',
      imageId: 'test-image',
      registry: 'registry.example.com',
      repository: 'test/container',
      imageVersion: '1.0.0',
      previousStatus: HealthStatus.HEALTHY,
      currentStatus: HealthStatus.AT_RISK,
      previousScore: 100,
      currentScore: 70,
      criticalCveCount: 0,
      importantCveCount: 2,
      affectedCves: ['CVE-2024-TEST1', 'CVE-2024-TEST2'],
      affectedPackages: ['test-package-1', 'test-package-2'],
      channels: [],
      deliveryStatus: DeliveryStatus.PENDING,
      deliveryAttempts: 0,
      triggeredAt: new Date()
    };

    const result = this.send(testEvent);
    return result.deliveryStatus === DeliveryStatus.SUCCESS;
  }
}
