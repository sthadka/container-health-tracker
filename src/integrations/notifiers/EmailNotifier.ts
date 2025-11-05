/**
 * EmailNotifier
 *
 * Sends email notifications via Gmail API (MailApp in Apps Script)
 * Per spec.md User Story 2 (Severity-Based Alert Notifications)
 */

import type { NotificationEvent } from '../../models/NotificationEvent';
import { HealthStatus, Severity } from '../../models/types';

export interface EmailNotifierConfig {
  recipients: string[];           // Email addresses to send to
  fromName?: string;               // Sender display name (optional)
  includeDetailedPackageList?: boolean;  // Include full package list in email
}

/**
 * EmailNotifier sends formatted HTML emails for health status changes
 *
 * Uses Google Apps Script MailApp for delivery
 * Formats notifications with color-coded severity indicators
 */
export class EmailNotifier {
  private config: EmailNotifierConfig;

  constructor(config: EmailNotifierConfig) {
    this.config = config;
  }

  /**
   * Send notification email
   *
   * @param event - Notification event to send
   * @returns True if sent successfully, false otherwise
   */
  public send(event: NotificationEvent): boolean {
    try {
      const subject = this.buildSubject(event);
      const htmlBody = this.formatEmailHTML(event);
      const plainBody = this.formatPlainText(event);

      // Send to all recipients
      for (const recipient of this.config.recipients) {
        MailApp.sendEmail({
          to: recipient,
          subject: subject,
          htmlBody: htmlBody,
          body: plainBody,
          name: this.config.fromName || 'Container Health Monitor'
        });
      }

      Logger.log(`[EmailNotifier] Sent notification for ${event.registry}/${event.repository} to ${this.config.recipients.length} recipients`);
      return true;

    } catch (error) {
      Logger.log(`[EmailNotifier] Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Build email subject line
   *
   * Format: [CRITICAL|AT RISK] Container Health Alert: registry/repository
   */
  private buildSubject(event: NotificationEvent): string {
    const statusLabel = event.currentStatus === HealthStatus.CRITICAL
      ? 'CRITICAL'
      : event.currentStatus === HealthStatus.AT_RISK
      ? 'AT RISK'
      : 'ALERT';

    return `[${statusLabel}] Container Health Alert: ${event.registry}/${event.repository}`;
  }

  /**
   * Format HTML email body with color-coded severity indicators
   *
   * @param event - Notification event
   * @returns HTML string
   */
  public formatEmailHTML(event: NotificationEvent): string {
    const statusColor = this.getStatusColor(event.currentStatus);
    const statusChange = this.formatStatusChange(event);
    const cveList = this.formatCVEList(event);
    const packageList = this.formatPackageList(event);

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${statusColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
    .section { margin-bottom: 20px; }
    .label { font-weight: bold; color: #555; }
    .value { margin-left: 10px; }
    .status-badge { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
    .status-critical { background-color: #dc3545; color: white; }
    .status-at-risk { background-color: #fd7e14; color: white; }
    .status-healthy { background-color: #28a745; color: white; }
    .cve-list { background-color: white; padding: 15px; border-left: 4px solid ${statusColor}; }
    .cve-item { margin: 5px 0; }
    .severity-critical { color: #dc3545; font-weight: bold; }
    .severity-important { color: #fd7e14; font-weight: bold; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Container Health Alert</h1>
      <p style="margin: 5px 0 0 0;">Health status change detected</p>
    </div>

    <div class="content">
      <div class="section">
        <h2>Container Image</h2>
        <p><span class="label">Registry:</span><span class="value">${event.registry}</span></p>
        <p><span class="label">Repository:</span><span class="value">${event.repository}</span></p>
        <p><span class="label">Version:</span><span class="value">${event.imageVersion}</span></p>
      </div>

      <div class="section">
        <h2>Health Status Change</h2>
        ${statusChange}
        <p><span class="label">Health Score:</span><span class="value">${event.previousScore} → ${event.currentScore}</span></p>
      </div>

      <div class="section">
        <h2>Vulnerability Summary</h2>
        <p><span class="severity-critical">Critical CVEs: ${event.criticalCveCount}</span></p>
        <p><span class="severity-important">Important CVEs: ${event.importantCveCount}</span></p>
        <p><span class="label">Total CVEs:</span><span class="value">${event.affectedCves.length}</span></p>
      </div>

      ${cveList}

      ${packageList}

      <div class="footer">
        <p>This is an automated notification from Container Health Monitor.</p>
        <p>Triggered: ${event.triggeredAt.toLocaleString()}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Format plain text email body (fallback for non-HTML clients)
   */
  private formatPlainText(event: NotificationEvent): string {
    const lines = [
      '='.repeat(60),
      'CONTAINER HEALTH ALERT',
      '='.repeat(60),
      '',
      `Container: ${event.registry}/${event.repository}`,
      `Version: ${event.imageVersion}`,
      '',
      'HEALTH STATUS CHANGE:',
      `  Previous: ${event.previousStatus} (Score: ${event.previousScore})`,
      `  Current: ${event.currentStatus} (Score: ${event.currentScore})`,
      '',
      'VULNERABILITY SUMMARY:',
      `  Critical CVEs: ${event.criticalCveCount}`,
      `  Important CVEs: ${event.importantCveCount}`,
      `  Total CVEs: ${event.affectedCves.length}`,
      '',
      'AFFECTED CVEs:',
      ...event.affectedCves.map(cve => `  - ${cve}`),
      '',
      'AFFECTED PACKAGES:',
      ...event.affectedPackages.slice(0, 20).map(pkg => `  - ${pkg}`),
    ];

    if (event.affectedPackages.length > 20) {
      lines.push(`  ... and ${event.affectedPackages.length - 20} more packages`);
    }

    lines.push('', `Triggered: ${event.triggeredAt.toLocaleString()}`, '');

    return lines.join('\n');
  }

  /**
   * Get color code for health status
   */
  private getStatusColor(status: HealthStatus): string {
    switch (status) {
      case HealthStatus.CRITICAL:
        return '#dc3545'; // Red
      case HealthStatus.AT_RISK:
        return '#fd7e14'; // Orange
      case HealthStatus.HEALTHY:
        return '#28a745'; // Green
      default:
        return '#6c757d'; // Gray
    }
  }

  /**
   * Format status change with badges
   */
  private formatStatusChange(event: NotificationEvent): string {
    const previousBadge = `<span class="status-badge status-${this.getStatusClass(event.previousStatus)}">${event.previousStatus}</span>`;
    const currentBadge = `<span class="status-badge status-${this.getStatusClass(event.currentStatus)}">${event.currentStatus}</span>`;

    return `<p>${previousBadge} → ${currentBadge}</p>`;
  }

  /**
   * Get CSS class for status badge
   */
  private getStatusClass(status: HealthStatus): string {
    switch (status) {
      case HealthStatus.CRITICAL:
        return 'critical';
      case HealthStatus.AT_RISK:
        return 'at-risk';
      case HealthStatus.HEALTHY:
        return 'healthy';
      default:
        return 'unknown';
    }
  }

  /**
   * Format CVE list with severity indicators
   */
  private formatCVEList(event: NotificationEvent): string {
    if (event.affectedCves.length === 0) {
      return '';
    }

    const cveItems = event.affectedCves
      .slice(0, 20)  // Limit to first 20 CVEs
      .map(cve => `<div class="cve-item">${cve}</div>`)
      .join('');

    const moreText = event.affectedCves.length > 20
      ? `<div class="cve-item"><em>... and ${event.affectedCves.length - 20} more CVEs</em></div>`
      : '';

    return `
      <div class="section">
        <h2>Affected CVEs</h2>
        <div class="cve-list">
          ${cveItems}
          ${moreText}
        </div>
      </div>
    `;
  }

  /**
   * Format affected packages list
   */
  private formatPackageList(event: NotificationEvent): string {
    if (!this.config.includeDetailedPackageList || event.affectedPackages.length === 0) {
      return '';
    }

    const packageItems = event.affectedPackages
      .slice(0, 30)  // Limit to first 30 packages
      .map(pkg => `<div class="cve-item">${pkg}</div>`)
      .join('');

    const moreText = event.affectedPackages.length > 30
      ? `<div class="cve-item"><em>... and ${event.affectedPackages.length - 30} more packages</em></div>`
      : '';

    return `
      <div class="section">
        <h2>Affected Packages</h2>
        <div class="cve-list">
          ${packageItems}
          ${moreText}
        </div>
      </div>
    `;
  }
}
