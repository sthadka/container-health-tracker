/**
 * HealthIndex entity
 *
 * Represents calculated health metrics for a container image
 * Per research.md health index calculation algorithm
 */

import { HealthStatus, Severity } from './types';

export interface HealthIndex {
  // Image reference
  imageId: string;                     // Links to MonitoredImage
  registry: string;                    // Denormalized for context
  repository: string;                  // Denormalized for context

  // Health score (0-100)
  score: number;                       // Calculated: 100 - totalPenalty
  status: HealthStatus;                // Derived from CVE severity presence

  // CVE severity breakdown
  criticalCves: number;                // Count of Critical severity CVEs
  importantCves: number;               // Count of Important severity CVEs
  moderateCves: number;                // Count of Moderate severity CVEs
  lowCves: number;                     // Count of Low severity CVEs

  // Penalty calculation (per research.md)
  criticalPenalty: number;             // criticalCves × 20
  importantPenalty: number;            // importantCves × 10
  moderatePenalty: number;             // moderateCves × 5
  lowPenalty: number;                  // lowCves × 1
  totalPenalty: number;                // Sum of all penalties

  // Change tracking
  previousScore?: number;              // Score from previous monitoring run (optional)
  scoreChange?: number;                // Difference from previous score (optional)
  statusChanged: boolean;              // True if HealthStatus changed from previous run

  // Metadata
  calculatedAt: Date;                  // Timestamp of calculation
}
