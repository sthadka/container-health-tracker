/**
 * SlackNotifier
 *
 * Sends notifications to Slack via Incoming Webhooks
 * Uses Slack Block Kit for rich formatting
 * Per spec.md User Story 2 (Severity-Based Alert Notifications)
 */

import type { NotificationEvent } from '../../models/NotificationEvent';
import { HealthStatus } from '../../models/types';

export interface SlackNotifierConfig {
  webhookUrl: string;              // Slack Incoming Webhook URL
  mentionUsers?: string[];         // Slack user IDs to mention (e.g., ["U123ABC", "U456DEF"])
  includeDetailedPackageList?: boolean;  // Include full package list
}

/**
 * Slack Block Kit payload types
 */
interface SlackBlock {
  type: string;
  [key: string]: any;
}

interface SlackPayload {
  text: string;  // Fallback text
  blocks: SlackBlock[];
}

/**
 * SlackNotifier sends formatted messages to Slack channels
 *
 * Uses Slack Block Kit for rich, interactive notifications
 * Formats with color-coded severity indicators and contextual information
 */
export class SlackNotifier {
  private config: SlackNotifierConfig;

  constructor(config: SlackNotifierConfig) {
    this.config = config;
  }

  /**
   * Send notification to Slack
   *
   * @param event - Notification event to send
   * @returns True if sent successfully, false otherwise
   */
  public send(event: NotificationEvent): boolean {
    try {
      const payload = this.buildSlackPayload(event);

      const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(this.config.webhookUrl, options);
      const statusCode = response.getResponseCode();

      if (statusCode === 200) {
        Logger.log(`[SlackNotifier] Sent notification for ${event.registry}/${event.repository}`);
        return true;
      } else {
        Logger.log(`[SlackNotifier] Failed to send notification. Status: ${statusCode}, Response: ${response.getContentText()}`);
        return false;
      }

    } catch (error) {
      Logger.log(`[SlackNotifier] Error sending notification: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Build Slack Block Kit payload
   *
   * Creates rich, formatted message with:
   * - Color-coded header
   * - Container image details
   * - Health status change
   * - CVE summary
   * - Affected packages (optional)
   *
   * @param event - Notification event
   * @returns Slack payload with blocks
   */
  public buildSlackPayload(event: NotificationEvent): SlackPayload {
    const statusEmoji = this.getStatusEmoji(event.currentStatus);
    const statusColor = this.getStatusColor(event.currentStatus);

    // Fallback text for notifications
    const fallbackText = `${statusEmoji} Container Health Alert: ${event.registry}/${event.repository} - ${event.currentStatus}`;

    const blocks: SlackBlock[] = [];

    // Header block with alert emoji
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${statusEmoji} Container Health Alert`,
        emoji: true
      }
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Container image details
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Registry:*\n${event.registry}`
        },
        {
          type: 'mrkdwn',
          text: `*Repository:*\n${event.repository}`
        },
        {
          type: 'mrkdwn',
          text: `*Version:*\n${event.imageVersion}`
        },
        {
          type: 'mrkdwn',
          text: `*Timestamp:*\n${event.triggeredAt.toLocaleString()}`
        }
      ]
    });

    // Health status change with color indicator
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Health Status Change:*\n${this.formatStatusChange(event)}`
      }
    });

    // CVE Summary
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*:red_circle: Critical CVEs:*\n${event.criticalCveCount}`
        },
        {
          type: 'mrkdwn',
          text: `*:large_orange_diamond: Important CVEs:*\n${event.importantCveCount}`
        },
        {
          type: 'mrkdwn',
          text: `*Total CVEs:*\n${event.affectedCves.length}`
        },
        {
          type: 'mrkdwn',
          text: `*Health Score:*\n${event.previousScore} → ${event.currentScore}`
        }
      ]
    });

    // Affected CVEs (limited list)
    if (event.affectedCves.length > 0) {
      const cveList = event.affectedCves
        .slice(0, 10)
        .map(cve => `• ${cve}`)
        .join('\n');

      const moreText = event.affectedCves.length > 10
        ? `\n_... and ${event.affectedCves.length - 10} more CVEs_`
        : '';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Affected CVEs:*\n${cveList}${moreText}`
        }
      });
    }

    // Affected packages (if configured)
    if (this.config.includeDetailedPackageList && event.affectedPackages.length > 0) {
      const packageList = event.affectedPackages
        .slice(0, 15)
        .map(pkg => `• ${pkg}`)
        .join('\n');

      const moreText = event.affectedPackages.length > 15
        ? `\n_... and ${event.affectedPackages.length - 15} more packages_`
        : '';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Affected Packages:*\n${packageList}${moreText}`
        }
      });
    }

    // User mentions (if configured)
    if (this.config.mentionUsers && this.config.mentionUsers.length > 0) {
      const mentions = this.config.mentionUsers
        .map(userId => `<@${userId}>`)
        .join(' ');

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Notifying: ${mentions}`
          }
        ]
      });
    }

    // Footer
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_Automated notification from Container Health Monitor_'
        }
      ]
    });

    return {
      text: fallbackText,
      blocks: blocks
    };
  }

  /**
   * Get emoji for health status
   */
  private getStatusEmoji(status: HealthStatus): string {
    switch (status) {
      case HealthStatus.CRITICAL:
        return ':rotating_light:';
      case HealthStatus.AT_RISK:
        return ':warning:';
      case HealthStatus.HEALTHY:
        return ':white_check_mark:';
      default:
        return ':question:';
    }
  }

  /**
   * Get Slack color code for health status
   * Used for message attachment colors
   */
  private getStatusColor(status: HealthStatus): string {
    switch (status) {
      case HealthStatus.CRITICAL:
        return 'danger';  // Red
      case HealthStatus.AT_RISK:
        return 'warning'; // Orange
      case HealthStatus.HEALTHY:
        return 'good';    // Green
      default:
        return '#6c757d'; // Gray
    }
  }

  /**
   * Format status change with emoji indicators
   */
  private formatStatusChange(event: NotificationEvent): string {
    const previousEmoji = this.getStatusEmoji(event.previousStatus);
    const currentEmoji = this.getStatusEmoji(event.currentStatus);

    return `${previousEmoji} \`${event.previousStatus}\` → ${currentEmoji} \`${event.currentStatus}\``;
  }
}
