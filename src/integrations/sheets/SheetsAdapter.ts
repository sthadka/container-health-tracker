/**
 * SheetsAdapter base class
 *
 * Abstract base class for Google Sheets operations
 * Per constitution: Library-First Architecture, Declarative Configuration
 * Per contracts/sheets-schema.md
 */

/**
 * Sheet names in the monitoring spreadsheet
 */
export enum SheetName {
  CONFIG = 'Config',
  CVE_DATA = 'CVE Data',
  HISTORICAL = 'Historical',
  LOGS = 'Logs'
}

/**
 * Base adapter for Google Sheets operations
 * Provides common utilities for reading/writing data
 */
export abstract class SheetsAdapter {
  protected spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

  constructor(spreadsheetId: string) {
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required. Please configure SPREADSHEET_ID in Script Properties.');
    }

    try {
      this.spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      throw new Error(`Failed to open spreadsheet with ID "${spreadsheetId}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get sheet by name
   * Throws error if sheet doesn't exist
   */
  protected getSheet(sheetName: SheetName): GoogleAppsScript.Spreadsheet.Sheet {
    const sheet = this.spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in spreadsheet`);
    }
    return sheet;
  }

  /**
   * Read all data from a sheet (excluding header row)
   * Returns empty array if sheet has no data
   */
  protected readAllData(sheetName: SheetName): any[][] {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      // Only header row or empty sheet
      return [];
    }

    // Read from row 2 (skip header) to last row
    const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    return range.getValues();
  }

  /**
   * Write data to sheet starting at specified row
   * Automatically expands range if needed
   */
  protected writeData(
    sheetName: SheetName,
    data: any[][],
    startRow: number = 2,
    startColumn: number = 1
  ): void {
    if (data.length === 0) {
      return;
    }

    const sheet = this.getSheet(sheetName);
    const numRows = data.length;
    const numColumns = data[0].length;

    const range = sheet.getRange(startRow, startColumn, numRows, numColumns);
    range.setValues(data);
  }

  /**
   * Append rows to the end of a sheet
   * Useful for log entries and historical data
   */
  protected appendRows(sheetName: SheetName, data: any[][]): void {
    if (data.length === 0) {
      return;
    }

    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    this.writeData(sheetName, data, lastRow + 1, 1);
  }

  /**
   * Clear all data from sheet (except header row)
   */
  protected clearData(sheetName: SheetName): void {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      // Only header row or empty
      return;
    }

    const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    range.clearContent();
  }

  /**
   * Format date for Google Sheets
   * Converts Date to string in ISO 8601 format
   */
  protected formatDate(date: Date): string {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }

  /**
   * Parse date from Google Sheets
   * Handles both Date objects and string dates
   */
  protected parseDate(value: any): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  /**
   * Validate sheet structure
   * Checks that required sheets exist
   */
  public validateStructure(): void {
    const requiredSheets = [
      SheetName.CONFIG,
      SheetName.CVE_DATA,
      SheetName.HISTORICAL,
      SheetName.LOGS
    ];

    const missingSheets: string[] = [];

    for (const sheetName of requiredSheets) {
      const sheet = this.spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        missingSheets.push(sheetName);
      }
    }

    if (missingSheets.length > 0) {
      throw new Error(
        `Missing required sheets: ${missingSheets.join(', ')}. ` +
        'Please create all sheets per contracts/sheets-schema.md'
      );
    }
  }
}
