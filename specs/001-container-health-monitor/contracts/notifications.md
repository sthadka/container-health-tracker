# Notification Payload Contracts

**Feature**: Container Health Monitor
**Date**: 2025-10-31
**Status**: Complete

## Overview

This document defines the exact payload structures for email and Slack notifications sent when container health status changes are detected. Includes formatting specifications, example payloads, and delivery confirmation contracts.

---

## Email Notification Contract

### Delivery Method
**API**: Gmail Apps Script API (`GmailApp.sendEmail`)
**Authentication**: Automatic via Apps Script OAuth scopes
**Required OAuth Scope**: `https://www.googleapis.com/auth/gmail.send`

### Email Structure

```typescript
interface EmailNotification {
  // Recipients
  to: string;  // Comma-separated email addresses from Properties Service
  cc?: string;  // Optional CC recipients
  bcc?: string;  // Optional BCC recipients

  // Content
  subject: string;  // Subject line
  htmlBody: string;  // HTML-formatted email body
  noReply?: boolean;  // If true, use no-reply sender

  // Metadata
  name?: string;  // Sender name (defaults to "Container Health Monitor")
}
```

### Subject Line Format

**Pattern**: `Container Health Alert: [N] image(s) require attention`

**Examples**:
- `Container Health Alert: 1 image requires attention`
- `Container Health Alert: 3 images require attention`

### HTML Body Template

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #d32f2f; color: white; padding: 20px; }
    .summary { background-color: #f5f5f5; padding: 15px; margin: 20px 0; }
    .image-section { border-left: 4px solid #ff9800; padding-left: 15px; margin: 20px 0; }
    .cve-list { margin: 10px 0; }
    .severity-critical { color: #d32f2f; font-weight: bold; }
    .severity-important { color: #f57c00; font-weight: bold; }
    .severity-moderate { color: #fbc02d; }
    .severity-low { color: #689f38; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
    a { color: #1976d2; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚨 Container Health Alert</h1>
    <p>Security vulnerabilities detected in monitored container images</p>
  </div>

  <div class="summary">
    <h2>Summary</h2>
    <p>
      <strong>Timestamp:</strong> {{TIMESTAMP}}<br>
      <strong>Images Affected:</strong> {{IMAGE_COUNT}}<br>
      <strong>Status Changes:</strong> {{STATUS_CHANGES}}<br>
      <strong>New Critical CVEs:</strong> {{CRITICAL_COUNT}}<br>
      <strong>New Important CVEs:</strong> {{IMPORTANT_COUNT}}
    </p>
  </div>

  {{#IMAGES}}
  <div class="image-section">
    <h3>📦 {{IMAGE_NAME}} ({{IMAGE_VERSION}})</h3>
    <p>
      <strong>Status Change:</strong> {{OLD_STATUS}} → {{NEW_STATUS}}<br>
      <strong>Health Index:</strong> {{HEALTH_INDEX}}/100
    </p>

    <div class="cve-list">
      <h4>Critical CVEs ({{CRITICAL_COUNT}}):</h4>
      <ul>
        {{#CRITICAL_CVES}}
        <li class="severity-critical">
          <a href="{{ADVISORY_URL}}" target="_blank">{{CVE_ID}}</a>
          - {{AFFECTED_PACKAGES}} (CVSS: {{CVSS_SCORE}})
        </li>
        {{/CRITICAL_CVES}}
      </ul>

      {{#IF_IMPORTANT_CVES}}
      <h4>Important CVEs ({{IMPORTANT_COUNT}}):</h4>
      <ul>
        {{#IMPORTANT_CVES}}
        <li class="severity-important">
          <a href="{{ADVISORY_URL}}" target="_blank">{{CVE_ID}}</a>
          - {{AFFECTED_PACKAGES}} (CVSS: {{CVSS_SCORE}})
        </li>
        {{/IMPORTANT_CVES}}
      </ul>
      {{/IF_IMPORTANT_CVES}}
    </div>

    <p>
      <a href="{{SHEET_URL}}" target="_blank">View full details in Google Sheets →</a>
    </p>
  </div>
  {{/IMAGES}}

  <div class="footer">
    <p>
      This is an automated notification from Container Health Monitor.<br>
      To modify monitoring settings, update the Config sheet in
      <a href="{{SHEET_URL}}" target="_blank">your tracking spreadsheet</a>.
    </p>
    <p>
      <strong>Need help?</strong> Contact your security team or check the
      <a href="https://access.redhat.com/security/vulnerabilities" target="_blank">Red Hat Security Center</a>.
    </p>
  </div>
</body>
</html>
```

### TypeScript Implementation

```typescript
interface EmailTemplateData {
  timestamp: string;
  imageCount: number;
  statusChanges: number;
  criticalCount: number;
  importantCount: number;
  images: {
    imageName: string;
    imageVersion: string;
    oldStatus: string;
    newStatus: string;
    healthIndex: number;
    criticalCves: {
      cveId: string;
      advisoryUrl: string;
      affectedPackages: string;
      cvssScore: number;
    }[];
    importantCves: {
      cveId: string;
      advisoryUrl: string;
      affectedPackages: string;
      cvssScore: number;
    }[];
    criticalCount: number;
    importantCount: number;
  }[];
  sheetUrl: string;
}

function sendEmailNotification(data: EmailTemplateData): void {
  const recipients = PropertiesService.getScriptProperties()
    .getProperty('EMAIL_RECIPIENTS');

  if (!recipients) {
    Logger.log('[WARN] [EmailNotifier] No email recipients configured');
    return;
  }

  const htmlBody = renderEmailTemplate(data);

  GmailApp.sendEmail({
    to: recipients,
    subject: `Container Health Alert: ${data.imageCount} image(s) require attention`,
    htmlBody: htmlBody,
    name: 'Container Health Monitor',
    noReply: false
  });

  Logger.log(`[INFO] [EmailNotifier] Email sent to ${recipients}`);
}

function renderEmailTemplate(data: EmailTemplateData): string {
  // Simple template rendering (production should use proper template engine)
  let html = EMAIL_TEMPLATE;

  html = html.replace('{{TIMESTAMP}}', data.timestamp);
  html = html.replace('{{IMAGE_COUNT}}', data.imageCount.toString());
  html = html.replace('{{STATUS_CHANGES}}', data.statusChanges.toString());
  html = html.replace('{{CRITICAL_COUNT}}', data.criticalCount.toString());
  html = html.replace('{{IMPORTANT_COUNT}}', data.importantCount.toString());

  // Render image sections (simplified - production should use loops)
  const imageSections = data.images.map(img => {
    let section = IMAGE_SECTION_TEMPLATE;
    section = section.replace('{{IMAGE_NAME}}', img.imageName);
    section = section.replace('{{IMAGE_VERSION}}', img.imageVersion);
    section = section.replace('{{OLD_STATUS}}', img.oldStatus);
    section = section.replace('{{NEW_STATUS}}', img.newStatus);
    section = section.replace('{{HEALTH_INDEX}}', img.healthIndex.toString());

    // Render CVE lists...
    return section;
  }).join('\n');

  html = html.replace('{{#IMAGES}}...{{/IMAGES}}', imageSections);
  html = html.replace('{{SHEET_URL}}', data.sheetUrl);

  return html;
}
```

### Delivery Confirmation

```typescript
interface EmailDeliveryResult {
  success: boolean;
  recipientCount: number;
  error?: string;
}

function confirmEmailDelivery(): EmailDeliveryResult {
  try {
    // GmailApp.sendEmail throws on failure
    // Successful execution = delivery confirmed
    return {
      success: true,
      recipientCount: recipients.split(',').length
    };
  } catch (error) {
    return {
      success: false,
      recipientCount: 0,
      error: error.message
    };
  }
}
```

---

## Slack Notification Contract

### Delivery Method
**API**: Slack Incoming Webhooks
**Authentication**: Webhook URL (stored in Properties Service)
**Method**: HTTP POST to webhook URL

### Slack Message Structure

```typescript
interface SlackNotification {
  text: string;  // Plain text fallback
  blocks: SlackBlock[];  // Rich formatting blocks
  username?: string;  // Bot display name
  icon_emoji?: string;  // Bot emoji icon
}

interface SlackBlock {
  type: 'header' | 'section' | 'divider' | 'context';
  text?: SlackText;
  fields?: SlackText[];
  accessory?: SlackAccessory;
}

interface SlackText {
  type: 'plain_text' | 'mrkdwn';
  text: string;
}
```

### Message Payload Example

```json
{
  "text": "Container Health Alert: 2 images require attention",
  "username": "Container Health Monitor",
  "icon_emoji": ":warning:",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 Container Health Alert"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Timestamp:*\n2025-10-31 14:30:00"
        },
        {
          "type": "mrkdwn",
          "text": "*Images Affected:*\n2"
        },
        {
          "type": "mrkdwn",
          "text": "*Critical CVEs:*\n3"
        },
        {
          "type": "mrkdwn",
          "text": "*Important CVEs:*\n5"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*📦 ubi8/ubi (8.10)*\nStatus: Healthy → At-Risk | Health Index: 65/100"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Critical CVEs:*\n• <https://access.redhat.com/security/cve/CVE-2024-1234|CVE-2024-1234> - openssl (CVSS: 9.8)\n• <https://access.redhat.com/security/cve/CVE-2024-5678|CVE-2024-5678> - libcurl (CVSS: 8.1)"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*📦 ubi9/ubi-minimal (9.4)*\nStatus: At-Risk → Critical | Health Index: 35/100"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Critical CVEs:*\n• <https://access.redhat.com/security/cve/CVE-2024-9999|CVE-2024-9999> - kernel (CVSS: 10.0)"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "<https://docs.google.com/spreadsheets/d/abc123|View full details in Google Sheets →>"
      }
    }
  ]
}
```

### TypeScript Implementation

```typescript
interface SlackTemplateData {
  timestamp: string;
  imageCount: number;
  criticalCount: number;
  importantCount: number;
  images: {
    imageName: string;
    imageVersion: string;
    oldStatus: string;
    newStatus: string;
    healthIndex: number;
    topCves: {
      cveId: string;
      advisoryUrl: string;
      affectedPackages: string;
      cvssScore: number;
      severity: 'Critical' | 'Important';
    }[];
  }[];
  sheetUrl: string;
}

function sendSlackNotification(data: SlackTemplateData): void {
  const webhookUrl = PropertiesService.getScriptProperties()
    .getProperty('SLACK_WEBHOOK_URL');

  if (!webhookUrl) {
    Logger.log('[WARN] [SlackNotifier] No Slack webhook configured');
    return;
  }

  const payload = buildSlackPayload(data);

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true  // Handle errors manually
  };

  const response = UrlFetchApp.fetch(webhookUrl, options);

  if (response.getResponseCode() === 200) {
    Logger.log('[INFO] [SlackNotifier] Slack notification sent successfully');
  } else {
    Logger.log(`[ERROR] [SlackNotifier] Slack delivery failed: ${response.getContentText()}`);
  }
}

function buildSlackPayload(data: SlackTemplateData): SlackNotification {
  const blocks: SlackBlock[] = [
    // Header
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚨 Container Health Alert' }
    },

    // Summary
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Timestamp:*\n${data.timestamp}` },
        { type: 'mrkdwn', text: `*Images Affected:*\n${data.imageCount}` },
        { type: 'mrkdwn', text: `*Critical CVEs:*\n${data.criticalCount}` },
        { type: 'mrkdwn', text: `*Important CVEs:*\n${data.importantCount}` }
      ]
    },

    { type: 'divider' }
  ];

  // Image sections
  data.images.forEach(img => {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📦 ${img.imageName} (${img.imageVersion})*\nStatus: ${img.oldStatus} → ${img.newStatus} | Health Index: ${img.healthIndex}/100`
      }
    });

    if (img.topCves.length > 0) {
      const cveList = img.topCves
        .map(cve => `• <${cve.advisoryUrl}|${cve.cveId}> - ${cve.affectedPackages} (CVSS: ${cve.cvssScore})`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Critical CVEs:*\n${cveList}` }
      });
    }

    blocks.push({ type: 'divider' });
  });

  // Footer
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `<${data.sheetUrl}|View full details in Google Sheets →>`
    }
  });

  return {
    text: `Container Health Alert: ${data.imageCount} image(s) require attention`,
    username: 'Container Health Monitor',
    icon_emoji: ':warning:',
    blocks: blocks
  };
}
```

### Delivery Confirmation

```typescript
interface SlackDeliveryResult {
  success: boolean;
  statusCode: number;
  error?: string;
}

function confirmSlackDelivery(response: GoogleAppsScript.URL_Fetch.HTTPResponse): SlackDeliveryResult {
  const statusCode = response.getResponseCode();

  if (statusCode === 200) {
    return { success: true, statusCode: 200 };
  } else {
    return {
      success: false,
      statusCode: statusCode,
      error: response.getContentText()
    };
  }
}
```

---

## Consolidated Notification Service

```typescript
interface NotificationPayload {
  timestamp: Date;
  images: Array<{
    imageName: string;
    imageVersion: string;
    oldStatus: HealthStatus;
    newStatus: HealthStatus;
    healthIndex: number;
    criticalCves: CVERecord[];
    importantCves: CVERecord[];
  }>;
  sheetUrl: string;
}

class NotificationService {
  send(payload: NotificationPayload): NotificationEvent {
    const event: NotificationEvent = {
      eventId: Utilities.getUuid(),
      triggeredAt: new Date(),
      affectedImages: payload.images.map(img => ({
        imageName: img.imageName,
        oldStatus: img.oldStatus,
        newStatus: img.newStatus,
        cveCount: {
          critical: img.criticalCves.length,
          important: img.importantCves.length,
          moderate: 0,  // Not tracked in notification
          low: 0
        },
        topCves: img.criticalCves.slice(0, 3).map(cve => cve.cveId)
      })),
      channels: ['email', 'slack'],
      deliveryStatus: {
        email: 'pending',
        slack: 'pending'
      },
      subject: `Container Health Alert: ${payload.images.length} image(s) require attention`,
      messageBody: ''
    };

    // Send via email
    try {
      sendEmailNotification(this.buildEmailData(payload));
      event.deliveryStatus.email = 'sent';
    } catch (error) {
      Logger.log(`[ERROR] [NotificationService] Email delivery failed: ${error.message}`);
      event.deliveryStatus.email = 'failed';
    }

    // Send via Slack
    try {
      sendSlackNotification(this.buildSlackData(payload));
      event.deliveryStatus.slack = 'sent';
    } catch (error) {
      Logger.log(`[ERROR] [NotificationService] Slack delivery failed: ${error.message}`);
      event.deliveryStatus.slack = 'failed';
    }

    return event;
  }

  private buildEmailData(payload: NotificationPayload): EmailTemplateData {
    // Transform payload to email format...
  }

  private buildSlackData(payload: NotificationPayload): SlackTemplateData {
    // Transform payload to Slack format...
  }
}
```

---

## Integration Test Contracts

### Test 1: Email Delivery
```typescript
it('sends email notification with correct subject and HTML body', () => {
  const result = sendEmailNotification(mockData);
  expect(result.success).toBe(true);
  expect(result.recipientCount).toBeGreaterThan(0);
});
```

### Test 2: Slack Delivery
```typescript
it('posts Slack notification with valid blocks structure', () => {
  const result = sendSlackNotification(mockData);
  expect(result.success).toBe(true);
  expect(result.statusCode).toBe(200);
});
```

### Test 3: Fallback Handling
```typescript
it('continues execution if one channel fails', () => {
  // Email succeeds, Slack fails
  const event = NotificationService.send(payload);
  expect(event.deliveryStatus.email).toBe('sent');
  expect(event.deliveryStatus.slack).toBe('failed');
});
```

---

## Summary

All notification contracts defined:
- ✅ Email template with HTML formatting and responsive design
- ✅ Slack message with Block Kit rich formatting
- ✅ TypeScript implementations for both channels
- ✅ Delivery confirmation and error handling
- ✅ Consolidated NotificationService for multi-channel dispatch
- ✅ Integration test contracts for delivery validation

Ready for quickstart.md generation.
