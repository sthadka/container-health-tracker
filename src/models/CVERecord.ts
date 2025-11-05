/**
 * CVERecord entity
 *
 * Represents a single CVE vulnerability for a container image
 * Data source: Red Hat Container Catalog GraphQL API (find_image_vulnerabilities)
 * Per data-model.md and contracts/redhat-graphql.graphql
 */

import { Severity } from './types';

export interface CVERecord {
  // CVE identification
  cveId: string;                       // e.g., "CVE-2024-1234"
  severity: Severity;                  // Critical | Important | Moderate | Low | None

  // Image association
  imageId: string;                     // MongoDB ObjectID linking to MonitoredImage
  registry: string;                    // Denormalized for Sheets export
  repository: string;                  // Denormalized for Sheets export
  imageVersion: string;                // Image tag/version when CVE discovered

  // Vulnerability details
  affectedPackages: string[];          // List of vulnerable RPM packages
  description: string;                 // CVE summary text

  // Advisory information (from Red Hat API)
  advisoryId: string;                  // Red Hat Security Advisory ID (e.g., "RHSA-2024:1234")
  advisoryType: string;                // Advisory classification (e.g., "Security Advisory")

  // Timestamps
  publishedDate: Date;                 // CVE publication date
  discoveredAt: Date;                  // When monitoring system first detected this CVE
  resolvedAt?: Date;                   // When CVE no longer appears (optional)

  // Status tracking
  isActive: boolean;                   // True if CVE still present in latest scan
}
