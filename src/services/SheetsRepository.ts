/**
 * SheetsRepository
 *
 * Google Sheets data access layer
 * Extends SheetsAdapter with domain-specific read/write operations
 * Per contracts/sheets-schema.md
 */

import { SheetsAdapter, SheetName } from '../integrations/sheets/SheetsAdapter';
import { MonitoredImage } from '../models/MonitoredImage';
import { CVERecord } from '../models/CVERecord';
import { Severity, HealthStatus } from '../models/types';

/**
 * Configuration row from Config sheet
 */
interface ConfigRow {
  imageName: string;
  enabled: boolean;
  severityThreshold: Severity;
  notes: string;
}

/**
 * Log entry for monitoring run
 */
interface LogEntry {
  timestamp: Date;
  runId: string;
  status: 'Success' | 'Partial' | 'Failed';
  imagesChecked: number;
  successful: number;
  failed: number;
  cvesFound: number;
  newCves: number;
  resolvedCves: number;
  notificationsSent: number;
  healthChanges: number;
  errors: string;
  durationSeconds: number;
}

/**
 * Historical snapshot for trend tracking
 */
interface HistoricalSnapshot {
  timestamp: Date;
  imageName: string;
  version: string;
  totalCves: number;
  criticalCount: number;
  importantCount: number;
  moderateCount: number;
  lowCount: number;
  healthIndex: number;
  healthStatus: HealthStatus;
  statusChange: string;
}

/**
 * SheetsRepository - Data access layer for Google Sheets
 */
export class SheetsRepository extends SheetsAdapter {
  /**
   * Read monitored image configuration from Config sheet
   * Per contracts/sheets-schema.md - Config sheet structure
   *
   * @returns Array of configuration rows for enabled images
   */
  public readConfig(): ConfigRow[] {
    const data = this.readAllData(SheetName.CONFIG);

    return data
      .filter(row => row[0]) // Skip empty rows
      .map(row => ({
        imageName: String(row[0]),
        enabled: row[1] === true || row[1] === 'TRUE',
        severityThreshold: this.parseSeverity(row[2]),
        notes: row[3] ? String(row[3]) : ''
      }))
      .filter(config => config.enabled); // Only return enabled images
  }

  /**
   * Write CVE data for a specific image to CVE Data sheet
   * Replaces existing data for the image (delete old rows, append new)
   * Per contracts/sheets-schema.md - CVE Data sheet structure
   *
   * @param imageName - Full image name (e.g., "ubi8/ubi")
   * @param version - Image version/tag
   * @param cveRecords - Array of CVE records
   * @param healthIndex - Calculated health index (0-100)
   * @param healthStatus - Calculated health status
   */
  public writeCVEData(
    imageName: string,
    version: string,
    cveRecords: CVERecord[],
    healthIndex: number,
    healthStatus: HealthStatus
  ): void {
    const sheet = this.getSheet(SheetName.CVE_DATA);

    // Step 1: Delete existing rows for this image
    this.deleteRowsForImage(sheet, imageName);

    // Step 2: Prepare new rows
    const newRows = cveRecords.map(cve => [
      imageName,                                    // A: Image Name
      version,                                      // B: Version
      cve.cveId,                                    // C: CVE ID
      cve.severity,                                 // D: Severity
      '',                                           // E: CVSS Score (not available from Red Hat API)
      cve.affectedPackages.join(', '),              // F: Affected Packages
      this.formatDate(cve.discoveredAt),            // G: Discovery Date
      this.formatDate(cve.publishedDate),           // H: Published Date
      `https://access.redhat.com/security/cve/${cve.cveId}`, // I: Advisory URL
      healthIndex,                                  // J: Health Index
      healthStatus,                                 // K: Health Status
      this.formatDate(new Date())                   // L: Last Updated
    ]);

    // Step 3: Append new rows
    if (newRows.length > 0) {
      this.appendRows(SheetName.CVE_DATA, newRows);
    }
  }

  /**
   * Append monitoring run log entry to Logs sheet
   * Per contracts/sheets-schema.md - Logs sheet structure
   *
   * @param logEntry - Monitoring run log data
   */
  public appendLogEntry(logEntry: LogEntry): void {
    const row = [
      this.formatDate(logEntry.timestamp),          // A: Timestamp
      logEntry.runId,                               // B: Run ID
      logEntry.status,                              // C: Status
      logEntry.imagesChecked,                       // D: Images Checked
      logEntry.successful,                          // E: Successful
      logEntry.failed,                              // F: Failed
      logEntry.cvesFound,                           // G: CVEs Found
      logEntry.newCves,                             // H: New CVEs
      logEntry.resolvedCves,                        // I: Resolved CVEs
      logEntry.notificationsSent,                   // J: Notifications Sent
      logEntry.healthChanges,                       // K: Health Changes
      logEntry.errors,                              // L: Errors
      logEntry.durationSeconds                      // M: Duration (sec)
    ];

    this.appendRows(SheetName.LOGS, [row]);
  }

  /**
   * Append historical snapshot for trend tracking
   * Per contracts/sheets-schema.md - Historical sheet structure
   *
   * @param snapshot - Historical data snapshot
   */
  public appendHistoricalSnapshot(snapshot: HistoricalSnapshot): void {
    const row = [
      this.formatDate(snapshot.timestamp),          // A: Timestamp
      snapshot.imageName,                           // B: Image Name
      snapshot.version,                             // C: Version
      snapshot.totalCves,                           // D: Total CVEs
      snapshot.criticalCount,                       // E: Critical Count
      snapshot.importantCount,                      // F: Important Count
      snapshot.moderateCount,                       // G: Moderate Count
      snapshot.lowCount,                            // H: Low Count
      snapshot.healthIndex,                         // I: Health Index
      snapshot.healthStatus,                        // J: Health Status
      snapshot.statusChange                         // K: Status Change
    ];

    this.appendRows(SheetName.HISTORICAL, [row]);
  }

  /**
   * Delete all rows for a specific image from a sheet
   * Helper method for writeCVEData
   *
   * @param sheet - Google Sheets sheet object
   * @param imageName - Image name to filter by (column A)
   */
  private deleteRowsForImage(sheet: GoogleAppsScript.Spreadsheet.Sheet, imageName: string): void {
    const data = sheet.getDataRange().getValues();
    const rowsToDelete: number[] = [];

    // Find rows matching image name (skip header row at index 0)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === imageName) {
        rowsToDelete.push(i + 1); // +1 for 1-indexed rows
      }
    }

    // Delete rows in reverse order to maintain correct indices
    rowsToDelete.reverse().forEach(rowIndex => {
      sheet.deleteRow(rowIndex);
    });
  }

  /**
   * Parse severity string with validation
   * Defaults to LOW if invalid
   *
   * @param value - Severity string from sheet
   * @returns Valid Severity enum value
   */
  private parseSeverity(value: any): Severity {
    const severityMap: Record<string, Severity> = {
      'Critical': Severity.CRITICAL,
      'Important': Severity.IMPORTANT,
      'Moderate': Severity.MODERATE,
      'Low': Severity.LOW
    };

    return severityMap[String(value)] || Severity.LOW;
  }
}
