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
  streams: string[];        // Content streams to track (e.g., ["4.7", "4.8", "4.9"])
  architectures: string[];  // Architectures to track (e.g., ["amd64", "arm64"])
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
  architecture: string;
  stream: string;
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
        notes: row[3] ? String(row[3]) : '',
        streams: this.parseCommaSeparated(row[4], ['latest']),      // Column E: Stream (default: "latest")
        architectures: this.parseCommaSeparated(row[5], ['amd64'])  // Column F: Architecture (default: "amd64")
      }))
      .filter(config => config.enabled); // Only return enabled images
  }

  /**
   * Write CVE data for a specific image to CVE Data sheet
   * Replaces existing data for the image (delete old rows, append new)
   * Per contracts/sheets-schema.md - CVE Data sheet structure
   *
   * @param imageName - Full image name (e.g., "ubi8/ubi")
   * @param architecture - Image architecture (e.g., "amd64", "arm64")
   * @param stream - Content stream (e.g., "8", "4.7", "latest")
   * @param version - Image version/tag
   * @param cveRecords - Array of CVE records
   * @param healthIndex - Calculated health index (0-100)
   * @param healthStatus - Calculated health status
   */
  public writeCVEData(
    imageName: string,
    architecture: string,
    stream: string,
    version: string,
    cveRecords: CVERecord[],
    healthIndex: number,
    healthStatus: HealthStatus
  ): void {
    const sheet = this.getSheet(SheetName.CVE_DATA);

    // Step 1: Delete existing rows for this image+architecture+stream combination
    Logger.log(`[SheetsRepository] Processing ${imageName} (${architecture}, stream ${stream}, version ${version})`);
    const deletedCount = this.deleteRowsForImageCombination(sheet, imageName, architecture, stream);
    if (deletedCount > 0) {
      Logger.log(`[SheetsRepository] Deleted ${deletedCount} existing row(s)`);
    }

    // Step 2: Prepare new rows
    const newRows = cveRecords.map(cve => [
      imageName,                                    // A: Image Name
      architecture,                                 // B: Architecture
      stream,                                       // C: Stream
      version,                                      // D: Version
      cve.cveId,                                    // E: CVE ID
      cve.severity,                                 // F: Severity
      '',                                           // G: CVSS Score (not available from Red Hat API)
      cve.affectedPackages.join(', '),              // H: Affected Packages
      this.formatDate(cve.discoveredAt),            // I: Discovery Date
      this.formatDate(cve.publishedDate),           // J: Published Date
      `https://access.redhat.com/security/cve/${cve.cveId}`, // K: Advisory URL
      healthIndex,                                  // L: Health Index
      healthStatus,                                 // M: Health Status
      this.formatDate(new Date())                   // N: Last Updated
    ]);

    // Step 3: Append new rows
    if (newRows.length > 0) {
      this.appendRows(SheetName.CVE_DATA, newRows);
      Logger.log(`[SheetsRepository] Added ${newRows.length} CVE row(s) for version ${version}`);
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
      snapshot.architecture,                        // C: Architecture
      snapshot.stream,                              // D: Stream
      snapshot.version,                             // E: Version
      snapshot.totalCves,                           // F: Total CVEs
      snapshot.criticalCount,                       // G: Critical Count
      snapshot.importantCount,                      // H: Important Count
      snapshot.moderateCount,                       // I: Moderate Count
      snapshot.lowCount,                            // J: Low Count
      snapshot.healthIndex,                         // K: Health Index
      snapshot.healthStatus,                        // L: Health Status
      snapshot.statusChange                         // M: Status Change
    ];

    this.appendRows(SheetName.HISTORICAL, [row]);
  }

  /**
   * Get previous health status for an image+architecture+stream combination
   * Reads the most recent historical snapshot for the given combination
   *
   * @param imageName - Image name to look up
   * @param architecture - Architecture to look up
   * @param stream - Stream to look up
   * @returns Previous health status and score, or null if no history exists
   */
  public getPreviousHealthStatus(
    imageName: string,
    architecture: string,
    stream: string
  ): { status: HealthStatus; score: number } | null {
    const data = this.readAllData(SheetName.HISTORICAL);

    // Find all rows for this image+architecture+stream combination (skip header row)
    const imageRows = data
      .filter(row => row[1] === imageName && row[2] === architecture && row[3] === stream)
      .map(row => ({
        timestamp: row[0],                 // Column A: Timestamp
        healthIndex: Number(row[10]) || 0, // Column K: Health Index (shifted by 2)
        healthStatus: row[11] as HealthStatus // Column L: Health Status (shifted by 2)
      }));

    // Return null if no history
    if (imageRows.length === 0) {
      return null;
    }

    // Return most recent (last) entry
    const mostRecent = imageRows[imageRows.length - 1];
    return {
      status: mostRecent.healthStatus,
      score: mostRecent.healthIndex
    };
  }

  /**
   * Delete all rows for a specific image+architecture+stream combination from a sheet
   * Helper method for writeCVEData
   *
   * @param sheet - Google Sheets sheet object
   * @param imageName - Image name to filter by (column A)
   * @param architecture - Architecture to filter by (column B)
   * @param stream - Stream to filter by (column C)
   * @returns Number of rows deleted
   */
  private deleteRowsForImageCombination(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    imageName: string,
    architecture: string,
    stream: string
  ): number {
    const data = sheet.getDataRange().getValues();
    const rowsToDelete: number[] = [];
    const versionsFound: string[] = [];

    // Normalize input for comparison
    const normalizedImageName = String(imageName).trim();
    const normalizedArchitecture = String(architecture).trim();
    const normalizedStream = String(stream).trim();

    // Find rows matching image+architecture+stream combination (skip header row at index 0)
    for (let i = 1; i < data.length; i++) {
      const rowImageName = String(data[i][0] || '').trim();
      const rowArchitecture = String(data[i][1] || '').trim();
      const rowStream = String(data[i][2] || '').trim();
      const rowVersion = String(data[i][3] || '').trim();

      if (rowImageName === normalizedImageName &&
          rowArchitecture === normalizedArchitecture &&
          rowStream === normalizedStream) {
        rowsToDelete.push(i + 1); // +1 for 1-indexed rows
        if (!versionsFound.includes(rowVersion)) {
          versionsFound.push(rowVersion);
        }
      }
    }

    // Log versions being replaced
    if (versionsFound.length > 0) {
      Logger.log(`[SheetsRepository] Replacing ${versionsFound.length} version(s): ${versionsFound.join(', ')}`);
    }

    // Delete rows in reverse order to maintain correct indices
    rowsToDelete.reverse().forEach(rowIndex => {
      sheet.deleteRow(rowIndex);
    });

    return rowsToDelete.length;
  }

  /**
   * Delete all rows for a specific image from a sheet
   * Helper method for writeCVEData (legacy, kept for backwards compatibility)
   *
   * @param sheet - Google Sheets sheet object
   * @param imageName - Image name to filter by (column A)
   * @deprecated Use deleteRowsForImageCombination instead
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

  /**
   * Parse comma-separated string into array
   * Trims whitespace and filters empty values
   *
   * @param value - Comma-separated string from sheet
   * @param defaultValue - Default array if value is empty/null
   * @returns Array of trimmed non-empty strings
   */
  private parseCommaSeparated(value: any, defaultValue: string[]): string[] {
    if (!value || String(value).trim() === '') {
      return defaultValue;
    }

    return String(value)
      .split(',')
      .map(item => item.trim())
      .filter(item => item !== '');
  }
}
