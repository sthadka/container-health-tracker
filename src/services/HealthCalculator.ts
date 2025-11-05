/**
 * HealthCalculator service
 *
 * Pure function for calculating health index from CVE data
 * Per research.md algorithm and constitution: Library-First Architecture
 */

import { HealthStatus, Severity } from '../models/types';
import { HealthIndex } from '../models/HealthIndex';
import { CVERecord } from '../models/CVERecord';

/**
 * Penalty weights for CVE severity levels
 * Per research.md: Health Index Calculation
 */
const SEVERITY_PENALTIES: Record<Severity, number> = {
  [Severity.CRITICAL]: 20,
  [Severity.IMPORTANT]: 10,
  [Severity.MODERATE]: 5,
  [Severity.LOW]: 1,
  [Severity.NONE]: 0
};

/**
 * Calculate health index from CVE records
 *
 * Algorithm:
 * 1. Count CVEs by severity level
 * 2. Calculate penalties: Critical×20 + Important×10 + Moderate×5 + Low×1
 * 3. Score = max(0, 100 - totalPenalty)
 * 4. Determine status: Critical if any Critical CVEs, At Risk if any Important CVEs, else Healthy
 *
 * @param imageId - MongoDB ObjectID of the image
 * @param registry - Registry hostname (e.g., "registry.access.redhat.com")
 * @param repository - Repository path (e.g., "ubi8/ubi")
 * @param cveRecords - Array of CVE records for this image
 * @param previousScore - Optional previous health score for change tracking
 * @returns Calculated HealthIndex
 */
export function calculateHealthIndex(
  imageId: string,
  registry: string,
  repository: string,
  cveRecords: CVERecord[],
  previousScore?: number
): HealthIndex {
  // Count CVEs by severity
  const criticalCves = cveRecords.filter(cve => cve.severity === Severity.CRITICAL).length;
  const importantCves = cveRecords.filter(cve => cve.severity === Severity.IMPORTANT).length;
  const moderateCves = cveRecords.filter(cve => cve.severity === Severity.MODERATE).length;
  const lowCves = cveRecords.filter(cve => cve.severity === Severity.LOW).length;

  // Calculate penalties
  const criticalPenalty = criticalCves * SEVERITY_PENALTIES[Severity.CRITICAL];
  const importantPenalty = importantCves * SEVERITY_PENALTIES[Severity.IMPORTANT];
  const moderatePenalty = moderateCves * SEVERITY_PENALTIES[Severity.MODERATE];
  const lowPenalty = lowCves * SEVERITY_PENALTIES[Severity.LOW];
  const totalPenalty = criticalPenalty + importantPenalty + moderatePenalty + lowPenalty;

  // Calculate score (0-100 range)
  const score = Math.max(0, 100 - totalPenalty);

  // Determine health status
  let status: HealthStatus;
  if (criticalCves > 0) {
    status = HealthStatus.CRITICAL;
  } else if (importantCves > 0) {
    status = HealthStatus.AT_RISK;
  } else {
    status = HealthStatus.HEALTHY;
  }

  // Calculate change metrics
  const scoreChange = previousScore !== undefined ? score - previousScore : undefined;
  const statusChanged = previousScore !== undefined && score !== previousScore;

  return {
    imageId,
    registry,
    repository,
    score,
    status,
    criticalCves,
    importantCves,
    moderateCves,
    lowCves,
    criticalPenalty,
    importantPenalty,
    moderatePenalty,
    lowPenalty,
    totalPenalty,
    previousScore,
    scoreChange,
    statusChanged,
    calculatedAt: new Date()
  };
}

/**
 * Determine if health status represents a degraded state requiring notification
 *
 * @param status - Current health status
 * @returns True if status is At Risk or Critical
 */
export function requiresNotification(status: HealthStatus): boolean {
  return status === HealthStatus.CRITICAL || status === HealthStatus.AT_RISK;
}

/**
 * Compare two health scores to detect significant changes
 *
 * @param previousScore - Previous health score
 * @param currentScore - Current health score
 * @param threshold - Minimum change to consider significant (default: 10 points)
 * @returns True if score change exceeds threshold
 */
export function hasSignificantChange(
  previousScore: number,
  currentScore: number,
  threshold: number = 10
): boolean {
  return Math.abs(currentScore - previousScore) >= threshold;
}
