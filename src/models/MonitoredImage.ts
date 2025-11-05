/**
 * MonitoredImage entity
 *
 * Represents a container image being tracked for CVE monitoring
 * Data source: Google Sheets Config tab
 * Per data-model.md and Red Hat API contracts
 */

import { HealthStatus, Severity } from './types';

export interface MonitoredImage {
  // Image identification (from Config sheet)
  registry: string;                    // e.g., "registry.access.redhat.com"
  repository: string;                  // e.g., "ubi8/ubi"
  architecture: string;                // e.g., "amd64", "arm64"

  // Red Hat API identifiers (populated during monitoring)
  repositoryId: string;                // MongoDB ObjectID from find_repositories
  imageId: string;                     // MongoDB ObjectID from find_repository_images_by_registry_path
                                       // CRITICAL: Use this for find_image_vulnerabilities query
  dockerImageId: string;               // SHA256 digest (reference only, NOT for vulnerability queries)

  // Version tracking
  currentVersion: string;              // Semantic version or tag name (e.g., "8.10-1028")
  lastChecked: Date;                   // Timestamp of last monitoring run

  // Health metrics (calculated)
  healthStatus: HealthStatus;          // Healthy | At Risk | Critical | Unknown
  healthIndex: number;                 // 0-100 score (100 - penalties)

  // CVE summary counts
  criticalCount: number;               // Count of Critical severity CVEs
  importantCount: number;              // Count of Important severity CVEs
  moderateCount: number;               // Count of Moderate severity CVEs
  lowCount: number;                    // Count of Low severity CVEs

  // Configuration
  monitoringEnabled: boolean;          // Flag to enable/disable tracking
  severityThreshold: Severity;         // Minimum severity to track (from Config sheet)

  // Metadata
  createdAt: Date;                     // First monitoring timestamp
  updatedAt: Date;                     // Last modification timestamp
}
