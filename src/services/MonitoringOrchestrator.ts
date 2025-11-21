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
import { NotificationService } from './NotificationService';
import { calculateHealthIndex } from './HealthCalculator';
import { MonitoringRun } from '../models/MonitoringRun';
import { NotificationEvent } from '../models/NotificationEvent';
import { HealthStatus, DeliveryStatus, NotificationChannel } from '../models/types';

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
  private notificationService?: NotificationService;
  private runId: string;
  private errors: Array<{ imageId?: string; errorType: string; errorMessage: string; timestamp: Date }> = [];
  private notificationEvents: NotificationEvent[] = [];

  constructor(
    config: ConfigService,
    catalogService: CatalogService,
    sheetsRepo: SheetsRepository,
    notificationService?: NotificationService
  ) {
    this.config = config;
    this.catalogService = catalogService;
    this.sheetsRepo = sheetsRepo;
    this.notificationService = notificationService;
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

      // Process each image (with stream×architecture combinations)
      for (const configRow of configRows) {
        // Generate all stream×architecture combinations for this image
        const combinations = this.generateCombinations(
          configRow.imageName,
          configRow.streams,
          configRow.architectures
        );

        this.log('INFO', 'ORCHESTRATOR',
          `Processing ${configRow.imageName}: ${combinations.length} combination(s) ` +
          `(${configRow.streams.length} stream(s) × ${configRow.architectures.length} arch(s))`
        );

        // Process each combination
        for (const combo of combinations) {
          monitoringRun.imagesProcessed++;

          try {
            const result = this.processImage(
              combo.imageName,
              'registry.access.redhat.com', // Default registry
              combo.architecture,
              combo.stream
            );

            if (result.success) {
              monitoringRun.imagesSuccessful++;
              monitoringRun.totalCvesDiscovered += result.cveCount;
              this.log('INFO', 'ORCHESTRATOR',
                `✓ ${result.imageName} (${combo.architecture}, ${combo.stream}): ${result.cveCount} CVEs, Health: ${result.healthIndex} (${result.healthStatus})`
              );
            } else {
              monitoringRun.imagesFailed++;
              this.logError(
                `${result.imageName}:${combo.architecture}:${combo.stream}`,
                'PROCESSING_ERROR',
                result.error || 'Unknown error'
              );
            }
          } catch (error) {
            monitoringRun.imagesFailed++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logError(
              `${configRow.imageName}:${combo.architecture}:${combo.stream}`,
              'PROCESSING_ERROR',
              errorMsg
            );
            this.log('ERROR', 'ORCHESTRATOR',
              `✗ ${configRow.imageName} (${combo.architecture}, ${combo.stream}): ${errorMsg}`
            );
          }
        }
      }

      // Send notifications for health status changes
      if (this.notificationService && this.notificationEvents.length > 0) {
        this.log('INFO', 'ORCHESTRATOR', `Sending ${this.notificationEvents.length} notification(s)`);

        for (const event of this.notificationEvents) {
          try {
            const result = this.notificationService.send(event);
            if (result.deliveryStatus === DeliveryStatus.SUCCESS) {
              monitoringRun.notificationsSent++;
            } else if (result.deliveryStatus === DeliveryStatus.FAILED) {
              monitoringRun.notificationsFailed++;
            }
          } catch (error) {
            monitoringRun.notificationsFailed++;
            this.log('ERROR', 'NOTIFICATION', `Failed to send notification: ${error instanceof Error ? error.message : String(error)}`);
          }
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
   * Generate all stream×architecture combinations for an image
   *
   * @param imageName - Repository path
   * @param streams - Array of stream patterns (e.g., ["4.7", "4.8", "4.9"])
   * @param architectures - Array of architectures (e.g., ["amd64", "arm64"])
   * @returns Array of combinations to process
   */
  private generateCombinations(
    imageName: string,
    streams: string[],
    architectures: string[]
  ): Array<{ imageName: string; stream: string; architecture: string }> {
    const combinations: Array<{ imageName: string; stream: string; architecture: string }> = [];

    for (const stream of streams) {
      for (const architecture of architectures) {
        combinations.push({ imageName, stream, architecture });
      }
    }

    return combinations;
  }

  /**
   * Process a single container image (for a specific stream+architecture combination)
   * Fetches latest version, queries vulnerabilities, calculates health, writes to Sheets
   *
   * @param imageName - Repository path (e.g., "ubi8/ubi")
   * @param registry - Registry hostname
   * @param architecture - Architecture filter
   * @param stream - Content stream pattern
   * @returns Processing result
   */
  public processImage(
    imageName: string,
    registry: string,
    architecture: string,
    stream: string = 'latest'
  ): ImageProcessingResult {
    this.log('INFO', 'PROCESS_IMAGE', `Processing ${imageName} (${architecture}, ${stream})`);

    try {
      // Step 1: Find repository
      this.log('DEBUG', 'PROCESS_IMAGE', `Finding repository: ${imageName}`);
      const repository = this.catalogService.findRepository(imageName);

      // Step 2: Find latest image in stream
      this.log('DEBUG', 'PROCESS_IMAGE', `Finding latest image for ${architecture}, stream: ${stream}`);
      const latestImage = this.catalogService.findLatestImageInStream(registry, imageName, architecture, stream);

      if (!latestImage) {
        // Create error entry in CVE Data sheet for missing combination
        this.log('ERROR', 'PROCESS_IMAGE', `No images found for ${registry}/${imageName} (${architecture}, stream: ${stream})`);
        this.sheetsRepo.writeCVEData(
          imageName,
          architecture,
          stream,
          'N/A',
          [{
            cveId: `ERROR: Not found in registry`,
            severity: 'None' as any,
            imageId: '',
            registry,
            repository: imageName,
            imageVersion: 'N/A',
            affectedPackages: [],
            description: `No ${architecture} images found for stream "${stream}" in ${registry}/${imageName}`,
            advisoryId: '',
            advisoryType: '',
            publishedDate: new Date(),
            discoveredAt: new Date(),
            isActive: false
          }],
          0,
          HealthStatus.UNKNOWN
        );
        throw new Error(`No images found for ${registry}/${imageName} (${architecture}, stream: ${stream})`);
      }

      this.log('INFO', 'PROCESS_IMAGE', `Latest version: ${latestImage.version}`);

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

      // Step 5: Detect health status changes (per combination)
      const previousHealth = this.sheetsRepo.getPreviousHealthStatus(imageName, architecture, stream);
      const previousStatus = previousHealth?.status || HealthStatus.UNKNOWN;
      const previousScore = previousHealth?.score || 0;
      const statusChanged = previousStatus !== healthIndex.status;

      // Only log status changes when they actually occur
      if (statusChanged) {
        this.log('INFO', 'PROCESS_IMAGE',
          `Status changed: ${previousStatus} → ${healthIndex.status}`
        );
      }

      // Step 6: Create notification event if status changed
      if (statusChanged && this.notificationService) {
        const notificationEvent: NotificationEvent = {
          eventId: `${this.runId}-${imageName}-${Date.now()}`,
          monitoringRunId: this.runId,
          imageId: latestImage.imageId,
          registry,
          repository: imageName,
          imageVersion: latestImage.version,
          previousStatus,
          currentStatus: healthIndex.status,
          previousScore,
          currentScore: healthIndex.score,
          criticalCveCount: healthIndex.criticalCves,
          importantCveCount: healthIndex.importantCves,
          affectedCves: cveRecords.map(cve => cve.cveId),
          affectedPackages: Array.from(new Set(cveRecords.flatMap(cve => cve.affectedPackages))),
          channels: [],
          deliveryStatus: DeliveryStatus.PENDING,
          deliveryAttempts: 0,
          triggeredAt: new Date()
        };

        this.notificationEvents.push(notificationEvent);
      }

      // Step 7: Write CVE data to Sheets
      this.log('DEBUG', 'PROCESS_IMAGE', `Writing CVE data to Sheets`);
      this.sheetsRepo.writeCVEData(
        imageName,
        architecture,
        stream,
        latestImage.version,
        cveRecords,
        healthIndex.score,
        healthIndex.status
      );

      // Step 8: Write historical snapshot
      const statusChangeDescription = statusChanged
        ? `${previousStatus} → ${healthIndex.status}`
        : 'No change';

      this.sheetsRepo.appendHistoricalSnapshot({
        timestamp: new Date(),
        imageName: imageName,
        architecture: architecture,
        stream: stream,
        version: latestImage.version,
        totalCves: cveRecords.length,
        criticalCount: healthIndex.criticalCves,
        importantCount: healthIndex.importantCves,
        moderateCount: healthIndex.moderateCves,
        lowCount: healthIndex.lowCves,
        healthIndex: healthIndex.score,
        healthStatus: healthIndex.status,
        statusChange: statusChangeDescription
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
    // Skip DEBUG logs to reduce noise in Apps Script execution logs
    if (level === 'DEBUG') {
      return;
    }

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
