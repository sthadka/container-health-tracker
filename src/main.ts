/**
 * Main entry points for Container Health Monitor
 *
 * These functions are exposed as global Apps Script functions
 * Per spec.md: User Story 1 - Automated CVE Tracking
 */

import { ConfigService } from './config/ConfigService';
import { CatalogService } from './services/CatalogService';
import { SheetsRepository } from './services/SheetsRepository';
import { MonitoringOrchestrator } from './services/MonitoringOrchestrator';
import { NotificationService } from './services/NotificationService';

/**
 * Main monitoring function - Entry point for scheduled runs
 *
 * This function is called by time-based triggers in Apps Script
 * It orchestrates the complete CVE monitoring pipeline:
 * 1. Read configuration from Config sheet
 * 2. Query Red Hat Catalog API for each enabled image
 * 3. Calculate health indices
 * 4. Update Google Sheets (CVE Data, Historical, Logs)
 *
 * Usage: Set up time-based trigger in Apps Script console
 * Recommended: Daily at midnight or early morning
 */
export function runMonitoring(): void {
  Logger.log('=== Container Health Monitor - Scheduled Run ===');

  try {
    // Initialize services
    const config = new ConfigService();
    config.initialize();

    const spreadsheetId = config.get('spreadsheetId');  // Property name in AppConfig is camelCase
    const apiEndpoint = config.get('apiEndpoint');

    const catalogService = new CatalogService(apiEndpoint);
    const sheetsRepo = new SheetsRepository(spreadsheetId);

    // Initialize notification service (optional)
    let notificationService: NotificationService | undefined;
    if (config.get('notificationEnabled')) {
      notificationService = new NotificationService({
        enableEmail: config.get('enableEmail'),
        enableSlack: config.get('enableSlack'),
        emailRecipients: config.get('emailRecipients'),
        slackWebhookUrl: config.get('slackWebhookUrl'),
        slackMentionUsers: config.get('slackMentionUsers'),
        severityThreshold: config.get('severityThreshold'),
        notifyOnlyOnStatusChange: config.get('notifyOnlyOnStatusChange'),
        includeDetailedPackageList: config.get('includeDetailedPackageList')
      });
      Logger.log('✓ Notification service initialized');
    }

    // Validate spreadsheet structure
    sheetsRepo.validateStructure();

    // Execute monitoring run
    const orchestrator = new MonitoringOrchestrator(config, catalogService, sheetsRepo, notificationService);
    const monitoringRun = orchestrator.execute();

    // Log summary
    Logger.log('=== Monitoring Run Complete ===');
    Logger.log(`Run ID: ${monitoringRun.runId}`);
    Logger.log(`Status: ${monitoringRun.status}`);
    Logger.log(`Images Processed: ${monitoringRun.imagesProcessed}`);
    Logger.log(`Successful: ${monitoringRun.imagesSuccessful}`);
    Logger.log(`Failed: ${monitoringRun.imagesFailed}`);
    Logger.log(`Total CVEs Found: ${monitoringRun.totalCvesDiscovered}`);
    Logger.log(`Notifications Sent: ${monitoringRun.notificationsSent}`);
    Logger.log(`Duration: ${Math.round((monitoringRun.durationMs || 0) / 1000)}s`);

    if (monitoringRun.errors.length > 0) {
      Logger.log(`Errors: ${monitoringRun.errors.length}`);
      monitoringRun.errors.forEach(err => {
        Logger.log(`  - ${err.errorType}: ${err.errorMessage}`);
      });
    }

  } catch (error) {
    Logger.log('FATAL ERROR: ' + (error instanceof Error ? error.message : String(error)));
    throw error;
  }
}

/**
 * Manual test function - For development and testing
 *
 * This function can be run manually from the Apps Script editor
 * Useful for:
 * - Testing configuration
 * - Verifying API connectivity
 * - Debugging monitoring pipeline
 * - Ad-hoc CVE checks
 *
 * Usage: Run from Apps Script editor via "Select function" dropdown
 */
export function testMonitoring(): void {
  Logger.log('=== Container Health Monitor - Manual Test Run ===');

  try {
    // Initialize services
    const config = new ConfigService();

    // Check Script Properties first
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    Logger.log('Script Properties:');
    Logger.log(JSON.stringify(allProps, null, 2));

    config.initialize();

    const spreadsheetId = config.get('spreadsheetId');  // Property name in AppConfig is camelCase
    const apiEndpoint = config.get('apiEndpoint');

    Logger.log(`Spreadsheet ID: ${spreadsheetId}`);
    Logger.log(`API Endpoint: ${apiEndpoint}`);

    const catalogService = new CatalogService(apiEndpoint);
    const sheetsRepo = new SheetsRepository(spreadsheetId);

    // Validate spreadsheet structure
    Logger.log('Validating spreadsheet structure...');
    sheetsRepo.validateStructure();
    Logger.log('✓ Spreadsheet structure valid');

    // Read configuration
    Logger.log('Reading configuration...');
    const configRows = sheetsRepo.readConfig();
    Logger.log(`✓ Found ${configRows.length} enabled images`);

    configRows.forEach(row => {
      Logger.log(`  - ${row.imageName} (Threshold: ${row.severityThreshold})`);
    });

    // Test Red Hat API connectivity
    if (configRows.length > 0) {
      const testImage = configRows[0].imageName;
      Logger.log(`Testing Red Hat API with image: ${testImage}`);

      try {
        const repo = catalogService.findRepository(testImage);
        Logger.log(`✓ Repository found: ${repo.registry}/${repo.repository}`);

        const latest = catalogService.findLatestImage(repo.registry, repo.repository);
        if (latest) {
          Logger.log(`✓ Latest version: ${latest.version}`);
          Logger.log(`  Image ID: ${latest.imageId}`);
          Logger.log(`  Architecture: ${latest.architecture}`);
        } else {
          Logger.log('⚠ No images found for repository');
        }
      } catch (error) {
        Logger.log('✗ Red Hat API test failed: ' + (error instanceof Error ? error.message : String(error)));
      }
    }

    // Initialize notification service (optional)
    Logger.log('Initializing notification service...');
    let notificationService: NotificationService | undefined;
    if (config.get('notificationEnabled')) {
      notificationService = new NotificationService({
        enableEmail: config.get('enableEmail'),
        enableSlack: config.get('enableSlack'),
        emailRecipients: config.get('emailRecipients'),
        slackWebhookUrl: config.get('slackWebhookUrl'),
        slackMentionUsers: config.get('slackMentionUsers'),
        severityThreshold: config.get('severityThreshold'),
        notifyOnlyOnStatusChange: config.get('notifyOnlyOnStatusChange'),
        includeDetailedPackageList: config.get('includeDetailedPackageList')
      });
      Logger.log('✓ Notification service initialized');
      Logger.log(`  Email enabled: ${config.get('enableEmail')}`);
      Logger.log(`  Slack enabled: ${config.get('enableSlack')}`);
      Logger.log(`  Severity threshold: ${config.get('severityThreshold')}`);
    } else {
      Logger.log('⚠ Notifications disabled');
    }

    // Execute full monitoring run
    Logger.log('Executing full monitoring run...');
    const orchestrator = new MonitoringOrchestrator(config, catalogService, sheetsRepo, notificationService);
    const monitoringRun = orchestrator.execute();

    // Log detailed summary
    Logger.log('=== Test Run Complete ===');
    Logger.log(`Run ID: ${monitoringRun.runId}`);
    Logger.log(`Status: ${monitoringRun.status}`);
    Logger.log(`Images Processed: ${monitoringRun.imagesProcessed}`);
    Logger.log(`  - Successful: ${monitoringRun.imagesSuccessful}`);
    Logger.log(`  - Failed: ${monitoringRun.imagesFailed}`);
    Logger.log(`  - Skipped: ${monitoringRun.imagesSkipped}`);
    Logger.log(`CVEs Discovered: ${monitoringRun.totalCvesDiscovered}`);
    Logger.log(`Notifications Sent: ${monitoringRun.notificationsSent}`);
    Logger.log(`Notifications Failed: ${monitoringRun.notificationsFailed}`);
    Logger.log(`Duration: ${Math.round((monitoringRun.durationMs || 0) / 1000)}s`);

    if (monitoringRun.errors.length > 0) {
      Logger.log(`\nErrors (${monitoringRun.errors.length}):`);
      monitoringRun.errors.forEach((err, idx) => {
        Logger.log(`${idx + 1}. [${err.errorType}] ${err.errorMessage}`);
        if (err.imageId) {
          Logger.log(`   Image: ${err.imageId}`);
        }
      });
    }

    Logger.log('\n✓ Test completed successfully');
    Logger.log('Check the Google Sheets tabs for updated data:');
    Logger.log('  - CVE Data: Current vulnerabilities');
    Logger.log('  - Historical: Trend data');
    Logger.log('  - Logs: Execution audit trail');

  } catch (error) {
    Logger.log('FATAL ERROR: ' + (error instanceof Error ? error.message : String(error)));
    if (error instanceof Error && error.stack) {
      Logger.log('Stack trace: ' + error.stack);
    }
    throw error;
  }
}

/**
 * Initialize Apps Script Properties (one-time setup)
 *
 * Run this function once to set up the required Script Properties
 * After running, manually configure EMAIL_RECIPIENTS and SLACK_WEBHOOK_URL
 *
 * @param spreadsheetId - Google Sheets spreadsheet ID (from URL)
 */
export function setupProperties(spreadsheetId?: string): void {
  if (!spreadsheetId) {
    // Try to get from active spreadsheet
    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSpreadsheet) {
      spreadsheetId = activeSpreadsheet.getId();
    } else {
      throw new Error('Please provide spreadsheet ID or run from bound spreadsheet');
    }
  }

  const properties = PropertiesService.getScriptProperties();

  properties.setProperties({
    'SPREADSHEET_ID': spreadsheetId,
    'API_ENDPOINT': 'https://catalog.redhat.com/api/containers/graphql/',
    'NOTIFICATION_ENABLED': 'true',
    'ENABLE_EMAIL': 'true',
    'ENABLE_SLACK': 'false',
    'SEVERITY_THRESHOLD': 'Important',
    'NOTIFY_ONLY_ON_STATUS_CHANGE': 'true',
    'INCLUDE_DETAILED_PACKAGE_LIST': 'false',
    'LOG_LEVEL': 'INFO'
  });

  Logger.log('✓ Apps Script Properties initialized successfully');
  Logger.log(`SPREADSHEET_ID: ${spreadsheetId}`);
  Logger.log('\nNext steps:');
  Logger.log('1. Go to Project Settings > Script Properties');
  Logger.log('2. Add EMAIL_RECIPIENTS (comma-separated emails for notifications)');
  Logger.log('3. Optionally add SLACK_WEBHOOK_URL (for Slack notifications)');
  Logger.log('4. Optionally add SLACK_MENTION_USERS (comma-separated Slack user IDs)');
  Logger.log('\nNotification settings:');
  Logger.log('- Email notifications: enabled');
  Logger.log('- Slack notifications: disabled');
  Logger.log('- Severity threshold: Important (only Critical and Important CVEs trigger notifications)');
  Logger.log('- Notify only on status change: yes');
}
