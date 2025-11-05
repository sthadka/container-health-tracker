/**
 * CatalogService
 *
 * High-level service for Red Hat Container Catalog operations
 * Wraps RedHatClient with domain logic and semantic version parsing
 * Per research.md: Red Hat Container Catalog API Integration
 */

import { RedHatClient } from '../integrations/graphql/RedHatClient';
import { CVERecord } from '../models/CVERecord';
import { Severity } from '../models/types';

/**
 * Image metadata from Red Hat Catalog
 */
export interface CatalogImage {
  imageId: string;              // MongoDB ObjectID (_id)
  dockerImageId: string;        // SHA256 digest
  version: string;              // Tag name
  architecture: string;
}

/**
 * CatalogService - Domain service for Red Hat Catalog operations
 */
export class CatalogService {
  private client: RedHatClient;

  constructor(apiEndpoint: string) {
    this.client = new RedHatClient(apiEndpoint);
  }

  /**
   * Find repository by repository path
   * Validates repository exists in Red Hat Catalog
   *
   * @param repository - Repository path (e.g., "ubi8/ubi")
   * @returns Repository metadata with MongoDB ObjectID
   * @throws Error if repository not found
   */
  public findRepository(repository: string): { id: string; registry: string; repository: string } {
    const result = this.client.findRepository(repository);
    return {
      id: result._id,
      registry: result.registry,
      repository: result.repository
    };
  }

  /**
   * Find latest image by semantic version parsing
   * Queries all images for registry/repository, filters by architecture,
   * and selects the highest semantic version
   *
   * @param registry - Registry hostname (e.g., "registry.access.redhat.com")
   * @param repository - Repository path (e.g., "ubi8/ubi")
   * @param architecture - Architecture filter (e.g., "amd64")
   * @returns Latest image metadata or null if no images found
   */
  public findLatestImage(
    registry: string,
    repository: string,
    architecture: string = 'amd64'
  ): CatalogImage | null {
    const images = this.client.findRepositoryImages(registry, repository, architecture);

    if (images.length === 0) {
      return null;
    }

    // Extract all tags from all images
    const imageWithTags: Array<{ image: typeof images[0]; tag: string }> = [];

    for (const image of images) {
      if (!image.repositories || image.repositories.length === 0) {
        continue;
      }

      for (const repo of image.repositories) {
        if (!repo.tags || repo.tags.length === 0) {
          continue;
        }

        for (const tag of repo.tags) {
          if (tag.name && tag.name !== 'latest') {
            imageWithTags.push({ image, tag: tag.name });
          }
        }
      }
    }

    if (imageWithTags.length === 0) {
      return null;
    }

    // Sort by semantic version (highest first)
    imageWithTags.sort((a, b) => this.compareVersions(b.tag, a.tag));

    const latest = imageWithTags[0];

    return {
      imageId: latest.image._id,
      dockerImageId: latest.image.docker_image_id,
      version: latest.tag,
      architecture: latest.image.architecture
    };
  }

  /**
   * Fetch all vulnerabilities for a specific image
   * Uses pagination to retrieve all CVE records
   *
   * @param imageId - Image _id (MongoDB ObjectID) from findLatestImage
   * @param registry - Registry hostname (for denormalization)
   * @param repository - Repository path (for denormalization)
   * @param version - Image version/tag (for denormalization)
   * @returns Array of CVE records
   */
  public fetchImageVulnerabilities(
    imageId: string,
    registry: string,
    repository: string,
    version: string
  ): CVERecord[] {
    const vulnerabilities = this.client.findImageVulnerabilities(imageId);

    return vulnerabilities.map(vuln => ({
      cveId: vuln.cve_id,
      severity: this.mapSeverity(vuln.severity),
      imageId: imageId,
      registry: registry,
      repository: repository,
      imageVersion: version,
      affectedPackages: vuln.affected_packages?.map(pkg => pkg.name) || [],
      description: '',  // Field not available in Red Hat API
      advisoryId: vuln.advisory_id || '',
      advisoryType: '',  // Field not available in Red Hat API
      publishedDate: vuln.public_date ? new Date(vuln.public_date) : new Date(),
      discoveredAt: new Date(),
      isActive: true
    }));
  }

  /**
   * Compare two semantic version strings
   * Returns positive if v1 > v2, negative if v1 < v2, zero if equal
   *
   * Handles formats:
   * - Simple: "8.10"
   * - Build number: "8.10-1028"
   * - Prerelease: "8.10-rc1"
   *
   * @param v1 - First version string
   * @param v2 - Second version string
   * @returns Comparison result (-1, 0, 1)
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = this.parseVersion(v1);
    const parts2 = this.parseVersion(v2);

    // Compare major.minor.patch
    for (let i = 0; i < Math.max(parts1.segments.length, parts2.segments.length); i++) {
      const n1 = parts1.segments[i] || 0;
      const n2 = parts2.segments[i] || 0;

      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }

    // Compare build numbers
    if (parts1.build !== null && parts2.build !== null) {
      if (parts1.build > parts2.build) return 1;
      if (parts1.build < parts2.build) return -1;
    } else if (parts1.build !== null) {
      return 1; // v1 has build, v2 doesn't (v1 is newer)
    } else if (parts2.build !== null) {
      return -1; // v2 has build, v1 doesn't (v2 is newer)
    }

    return 0;
  }

  /**
   * Parse version string into components
   *
   * Examples:
   * - "8.10" → { segments: [8, 10], build: null }
   * - "8.10-1028" → { segments: [8, 10], build: 1028 }
   * - "8.10.5" → { segments: [8, 10, 5], build: null }
   *
   * @param version - Version string
   * @returns Parsed version components
   */
  private parseVersion(version: string): { segments: number[]; build: number | null } {
    // Remove leading 'v' if present
    let v = version.toLowerCase().replace(/^v/, '');

    // Split on dash to separate build number
    const parts = v.split('-');
    const mainVersion = parts[0];
    const buildPart = parts[1];

    // Parse main version segments (e.g., "8.10.5" → [8, 10, 5])
    const segments = mainVersion
      .split('.')
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n));

    // Parse build number if numeric
    let build: number | null = null;
    if (buildPart) {
      const buildNum = parseInt(buildPart, 10);
      if (!isNaN(buildNum)) {
        build = buildNum;
      }
    }

    return { segments, build };
  }

  /**
   * Map Red Hat API severity to internal Severity enum
   *
   * @param apiSeverity - Severity string from API
   * @returns Severity enum value
   */
  private mapSeverity(apiSeverity: string): Severity {
    const severityMap: Record<string, Severity> = {
      'Critical': Severity.CRITICAL,
      'Important': Severity.IMPORTANT,
      'Moderate': Severity.MODERATE,
      'Low': Severity.LOW,
      'None': Severity.NONE
    };

    return severityMap[apiSeverity] || Severity.NONE;
  }
}
