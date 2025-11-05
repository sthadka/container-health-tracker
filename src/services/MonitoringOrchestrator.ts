/**
 * MonitoringOrchestrator
 *
 * Core orchestration service for CVE monitoring pipeline
 * Coordinates ConfigService, CatalogService, SheetsRepository, and HealthCalculator
 * Per spec.md: User Story 1 - Automated CVE Tracking
 */

import { ConfigService } from '../config/ConfigService';
import { CatalogService } from './CatalogService';
import { SheetsRepository } from './SheetsRepository';
import { calculateHealthIndex } from './HealthCalculator';
import { MonitoringRun } from '../models/MonitoringRun';
import { HealthStatus } from '../models/types';

/**
 * Result of processing a single image
 */
interface ImageProcessingResult {
  imageName: string;
  success: boolean;
  cveCount: number;
  healthIndex: number;
  healthStatus: HealthStatus;
  error?: string;
}

/**
 * MonitoringOrchestrator - Main pipeline coordinator
 */
export class MonitoringOrchestrator {
  private config: ConfigService;
  private catalogService: CatalogService;
  private sheetsRepo: SheetsRepository;
  private runId: string;
  private errors: Array<{ imageId?: string; errorType: string; errorMessage: string; timestamp: Date }> = [];

  constructor(
    config: ConfigService,
    catalogService: CatalogService,
    sheetsRepo: SheetsRepository
  ) {
    this.config = config;
    this.catalogService = catalogService;
    this.sheetsRepo = sheetsRepo;
    this.runId = Utilities.getUuid();
  }

  /**
   * Execute complete monitoring run
   * Processes all enabled images from Config sheet
   *
   * @returns Monitoring run summary
   */
  public execute(): MonitoringRun {
    const startTime = new Date();
    this.log('INFO', 'ORCHESTRATOR', `Starting monitoring run ${this.runId}`);

    // Initialize monitoring run
    const monitoringRun: MonitoringRun = {
      runId: this.runId,
      executionMode: 'manual',
      startTime,
      imagesProcessed: 0,
      imagesSuccessful: 0,
      imagesFailed: 0,
      imagesSkipped: 0,
      totalCvesDiscovered: 0,
      newCvesDiscovered: 0,
      resolvedCves: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      status: 'running',
      errors: [],
      apiCallCount: 0,
      apiCallDurationMs: 0,
      sheetsWriteCount: 0,
      version: '1.0.0'
    };

    try {
      // Read configuration
      this.log('INFO', 'ORCHESTRATOR', 'Reading configuration from Config sheet');
      const configRows = this.sheetsRepo.readConfig();
      this.log('INFO', 'ORCHESTRATOR', `Found ${configRows.length} enabled images to monitor`);

      // Process each image
      for (const configRow of configRows) {
        monitoringRun.imagesProcessed++;

        try {
          const result = this.processImage(
            configRow.imageName,
            'registry.access.redhat.com', // Default registry
            'amd64' // Default architecture
          );

          if (result.success) {
            monitoringRun.imagesSuccessful++;
            monitoringRun.totalCvesDiscovered += result.cveCount;
            this.log('INFO', 'ORCHESTRATOR',
              `✓ ${result.imageName}: ${result.cveCount} CVEs, Health: ${result.healthIndex} (${result.healthStatus})`
            );
          } else {
            monitoringRun.imagesFailed++;
            this.logError(result.imageName, 'PROCESSING_ERROR', result.error || 'Unknown error');
          }
        } catch (error) {
          monitoringRun.imagesFailed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logError(configRow.imageName, 'PROCESSING_ERROR', errorMsg);
          this.log('ERROR', 'ORCHESTRATOR', `✗ ${configRow.imageName}: ${errorMsg}`);
        }
      }

      // Determine overall status
      if (monitoringRun.imagesFailed === 0) {
        monitoringRun.status = 'completed';
      } else if (monitoringRun.imagesSuccessful > 0) {
        monitoringRun.status = 'partial';
      } else {
        monitoringRun.status = 'failed';
      }

    } catch (error) {
      monitoringRun.status = 'failed';
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logError(undefined, 'ORCHESTRATOR_ERROR', errorMsg);
      this.log('ERROR', 'ORCHESTRATOR', `Fatal error: ${errorMsg}`);
    }

    // Finalize monitoring run
    const endTime = new Date();
    monitoringRun.endTime = endTime;
    monitoringRun.durationMs = endTime.getTime() - startTime.getTime();
    monitoringRun.errors = this.errors;

    // Write log entry
    this.sheetsRepo.appendLogEntry({
      timestamp: startTime,
      runId: this.runId,
      status: this.mapRunStatus(monitoringRun.status),
      imagesChecked: monitoringRun.imagesProcessed,
      successful: monitoringRun.imagesSuccessful,
      failed: monitoringRun.imagesFailed,
      cvesFound: monitoringRun.totalCvesDiscovered,
      newCves: monitoringRun.newCvesDiscovered,
      resolvedCves: monitoringRun.resolvedCves,
      notificationsSent: monitoringRun.notificationsSent,
      healthChanges: 0,
      errors: this.errors.length > 0 ? JSON.stringify(this.errors) : '',
      durationSeconds: Math.round(monitoringRun.durationMs / 1000)
    });

    this.log('INFO', 'ORCHESTRATOR',
      `Monitoring run ${this.runId} completed: ` +
      `${monitoringRun.imagesSuccessful}/${monitoringRun.imagesProcessed} successful, ` +
      `${monitoringRun.totalCvesDiscovered} CVEs found`
    );

    return monitoringRun;
  }

  /**
   * Process a single container image
   * Fetches latest version, queries vulnerabilities, calculates health, writes to Sheets
   *
   * @param imageName - Repository path (e.g., "ubi8/ubi")
   * @param registry - Registry hostname
   * @param architecture - Architecture filter
   * @returns Processing result
   */
  public processImage(
    imageName: string,
    registry: string,
    architecture: string
  ): ImageProcessingResult {
    this.log('INFO', 'PROCESS_IMAGE', `Processing ${registry}/${imageName}`);

    try {
      // Step 1: Find repository
      this.log('DEBUG', 'PROCESS_IMAGE', `Finding repository: ${imageName}`);
      const repository = this.catalogService.findRepository(imageName);

      // Step 2: Find latest image
      this.log('DEBUG', 'PROCESS_IMAGE', `Finding latest image for ${architecture}`);
      const latestImage = this.catalogService.findLatestImage(registry, imageName, architecture);

      if (!latestImage) {
        throw new Error(`No images found for ${registry}/${imageName} (${architecture})`);
      }

      this.log('INFO', 'PROCESS_IMAGE', `Latest version: ${latestImage.version} (${latestImage.imageId})`);

      // Step 3: Fetch vulnerabilities
      this.log('DEBUG', 'PROCESS_IMAGE', `Fetching vulnerabilities for image ${latestImage.imageId}`);
      const cveRecords = this.catalogService.fetchImageVulnerabilities(
        latestImage.imageId,
        registry,
        imageName,
        latestImage.version
      );

      this.log('INFO', 'PROCESS_IMAGE', `Found ${cveRecords.length} CVEs`);

      // Step 4: Calculate health index
      const healthIndex = calculateHealthIndex(
        latestImage.imageId,
        registry,
        imageName,
        cveRecords
      );

      this.log('INFO', 'PROCESS_IMAGE',
        `Health Index: ${healthIndex.score} (${healthIndex.status}) - ` +
        `Critical: ${healthIndex.criticalCves}, Important: ${healthIndex.importantCves}`
      );

      // Step 5: Write CVE data to Sheets
      this.log('DEBUG', 'PROCESS_IMAGE', `Writing CVE data to Sheets`);
      this.sheetsRepo.writeCVEData(
        imageName,
        latestImage.version,
        cveRecords,
        healthIndex.score,
        healthIndex.status
      );

      // Step 6: Write historical snapshot
      this.sheetsRepo.appendHistoricalSnapshot({
        timestamp: new Date(),
        imageName: imageName,
        version: latestImage.version,
        totalCves: cveRecords.length,
        criticalCount: healthIndex.criticalCves,
        importantCount: healthIndex.importantCves,
        moderateCount: healthIndex.moderateCves,
        lowCount: healthIndex.lowCves,
        healthIndex: healthIndex.score,
        healthStatus: healthIndex.status,
        statusChange: 'No change' // TODO: Implement change detection in Phase 3
      });

      return {
        imageName,
        success: true,
        cveCount: cveRecords.length,
        healthIndex: healthIndex.score,
        healthStatus: healthIndex.status
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        imageName,
        success: false,
        cveCount: 0,
        healthIndex: 0,
        healthStatus: HealthStatus.UNKNOWN,
        error: errorMsg
      };
    }
  }

  /**
   * Structured logging
   * Format: [TIMESTAMP] [LEVEL] [COMPONENT] Message
   *
   * @param level - Log level (DEBUG, INFO, WARN, ERROR)
   * @param component - Component name
   * @param message - Log message
   */
  private log(level: string, component: string, message: string): void {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const logMessage = `[${timestamp}] [${level}] [${component}] ${message}`;
    Logger.log(logMessage);
  }

  /**
   * Log error to internal error array
   *
   * @param imageId - Optional image identifier
   * @param errorType - Error category
   * @param errorMessage - Error details
   */
  private logError(imageId: string | undefined, errorType: string, errorMessage: string): void {
    this.errors.push({
      imageId,
      errorType,
      errorMessage,
      timestamp: new Date()
    });
  }

  /**
   * Map MonitoringRun status to log entry status
   */
  private mapRunStatus(status: MonitoringRun['status']): 'Success' | 'Partial' | 'Failed' {
    if (status === 'completed') return 'Success';
    if (status === 'partial') return 'Partial';
    return 'Failed';
  }
}
