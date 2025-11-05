/**
 * Red Hat Container Catalog GraphQL API Type Definitions
 *
 * Source: specs/001-container-health-monitor/contracts/redhat-graphql.graphql
 * These types match the official Red Hat API schema exactly
 *
 * IMPORTANT: Any changes to these types MUST be validated against the contract
 */

// ============================================================================
// Repository Types
// ============================================================================

export interface ContainerRepository {
  _id: string;                // MongoDB ObjectID
  registry: string;           // e.g., "registry.access.redhat.com"
  repository: string;         // e.g., "ubi8/ubi"
  published?: boolean;        // Repository publication status
}

export interface FindRepositoriesResponse {
  find_repositories: {
    data: ContainerRepository[];
    total: number;
    page: number;
    page_size: number;
  };
}

export interface FindRepositoriesVariables {
  repository: string;
}

// ============================================================================
// Image Types
// ============================================================================

export interface Tag {
  name: string;               // Tag name (e.g., "8.10-1028", "latest")
  added_date?: string;        // ISO 8601 timestamp
}

export interface RepositoryInfo {
  tags: Tag[];
}

export interface Label {
  name: string;               // Label key (e.g., "version", "release")
  value: string;              // Label value
}

export interface ParsedData {
  labels: Label[];
}

export interface ContainerImage {
  _id: string;                // MongoDB ObjectID - USE THIS for vulnerability queries
  docker_image_id: string;    // SHA256 digest - DO NOT use for vulnerability queries
  image_id?: string;          // Alternative ID
  creation_date?: string;     // ISO 8601 timestamp
  architecture: string;       // "amd64", "arm64", "ppc64le", "s390x"
  repositories: RepositoryInfo[];
  parsed_data?: ParsedData;
}

export interface FindRepositoryImagesResponse {
  find_repository_images_by_registry_path: {
    data: ContainerImage[];
    total: number;
    page: number;
    page_size: number;
  };
}

export interface FindRepositoryImagesVariables {
  registry: string;
  repository: string;
  page?: number;
  page_size?: number;
  architecture?: string;
}

// ============================================================================
// Vulnerability Types
// ============================================================================

export interface AffectedPackage {
  name: string;               // Package name (e.g., "postgresql")
  version?: string;           // Package version (e.g., "12.9-1")
  arch?: string;              // Architecture (e.g., "x86_64")
  package_type?: string;      // Package type (e.g., "rpm")
}

export interface PackageInfo {
  rpm_nvra: string[];         // Full RPM package names
}

export interface ContainerImageVulnerability {
  _id: string;                // Vulnerability entry ID
  creation_date?: string;     // ISO 8601 timestamp
  advisory_id: string;        // Red Hat advisory ID (e.g., "2024:0974")
  advisory_type?: string;     // Advisory type (e.g., "RHSA", "RHBA")
  cve_id: string;             // CVE identifier (e.g., "CVE-2024-0985")
  severity: string;           // "Critical" | "Important" | "Moderate" | "Low"
  affected_packages: AffectedPackage[] | null;
  packages?: PackageInfo;
  public_date?: string;       // ISO 8601 timestamp (alternative to creation_date)
}

export interface FindImageVulnerabilitiesResponse {
  find_image_vulnerabilities: {
    data: ContainerImageVulnerability[];
    total: number;
    page: number;
    page_size: number;
  };
}

export interface FindImageVulnerabilitiesVariables {
  id: string;                 // Image _id (MongoDB ObjectID) - NOT docker_image_id
  page?: number;
  page_size?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isValidSeverity(value: string): value is 'Critical' | 'Important' | 'Moderate' | 'Low' {
  return ['Critical', 'Important', 'Moderate', 'Low'].includes(value);
}

export function isValidCveId(value: string): boolean {
  return /^CVE-\d{4}-\d{4,}$/.test(value);
}

export function isMongoObjectId(value: string): boolean {
  return /^[0-9a-f]{24}$/i.test(value);
}

export function isSha256Digest(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/i.test(value);
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate repository response matches contract schema
 */
export function validateRepositoryResponse(response: any): response is FindRepositoriesResponse {
  if (!response?.find_repositories) return false;
  const result = response.find_repositories;

  if (!Array.isArray(result.data)) return false;
  if (typeof result.total !== 'number') return false;
  if (typeof result.page !== 'number') return false;
  if (typeof result.page_size !== 'number') return false;

  return result.data.every((repo: any) =>
    typeof repo._id === 'string' &&
    typeof repo.registry === 'string' &&
    typeof repo.repository === 'string'
  );
}

/**
 * Validate image response matches contract schema
 */
export function validateImageResponse(response: any): response is FindRepositoryImagesResponse {
  if (!response?.find_repository_images_by_registry_path) return false;
  const result = response.find_repository_images_by_registry_path;

  if (!Array.isArray(result.data)) return false;
  if (typeof result.total !== 'number') return false;

  return result.data.every((image: any) =>
    typeof image._id === 'string' &&
    isMongoObjectId(image._id) &&
    typeof image.docker_image_id === 'string' &&
    typeof image.architecture === 'string' &&
    Array.isArray(image.repositories)
  );
}

/**
 * Validate vulnerability response matches contract schema
 */
export function validateVulnerabilityResponse(response: any): response is FindImageVulnerabilitiesResponse {
  if (!response?.find_image_vulnerabilities) return false;
  const result = response.find_image_vulnerabilities;

  if (!Array.isArray(result.data)) return false;
  if (typeof result.total !== 'number') return false;

  return result.data.every((vuln: any) =>
    typeof vuln.cve_id === 'string' &&
    isValidCveId(vuln.cve_id) &&
    typeof vuln.severity === 'string' &&
    isValidSeverity(vuln.severity) &&
    typeof vuln.advisory_id === 'string'
  );
}
