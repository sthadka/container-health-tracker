/**
 * GraphQL query templates for Red Hat Container Catalog API
 *
 * Per contracts/redhat-graphql.graphql and research.md
 * 3-step workflow: find_repositories → find_repository_images_by_registry_path → find_image_vulnerabilities
 *
 * IMPORTANT: These queries are validated against the contract schema
 * Any changes MUST be tested with test-graphql.js before deployment
 */

import type {
  FindRepositoriesResponse,
  FindRepositoriesVariables,
  FindRepositoryImagesResponse,
  FindRepositoryImagesVariables,
  FindImageVulnerabilitiesResponse,
  FindImageVulnerabilitiesVariables
} from './redhat-api-types';

/**
 * Step 1: Find repository by registry and repository path
 *
 * Returns repository metadata including MongoDB ObjectID
 * Used to verify repository exists before querying images
 *
 * Variables:
 * - $repository: Repository path (e.g., "ubi8/ubi")
 */
export const FIND_REPOSITORIES = `
  query FindRepositories($repository: String!) {
    find_repositories(filter: { repository: { eq: $repository } }) {
      data {
        _id
        registry
        repository
        published
      }
      total
    }
  }
`;

/**
 * Step 2: Find images by registry and repository path
 *
 * Returns image metadata including tags and MongoDB ObjectID
 * CRITICAL: Use the _id field for vulnerability queries (NOT docker_image_id)
 *
 * Variables:
 * - $registry: Registry hostname (e.g., "registry.access.redhat.com")
 * - $repository: Repository path (e.g., "ubi8/ubi")
 * - $page_size: Maximum images to return (default: 500)
 * - $architecture: Optional architecture filter (e.g., "amd64")
 */
export const FIND_REPOSITORY_IMAGES = `
  query FindRepositoryImages(
    $registry: String!,
    $repository: String!,
    $page_size: Int,
    $architecture: String
  ) {
    find_repository_images_by_registry_path(
      registry: $registry,
      repository: $repository,
      page_size: $page_size,
      filter: { architecture: { eq: $architecture } }
    ) {
      data {
        _id
        architecture
        docker_image_id
        image_id
        repositories {
          tags {
            name
          }
        }
      }
      page
      page_size
      total
    }
  }
`;

/**
 * Step 3: Find vulnerabilities for a specific image
 *
 * Returns CVE records with severity, affected packages, and advisory details
 * CRITICAL: Use image _id (MongoDB ObjectID) NOT docker_image_id (SHA256)
 *
 * Variables:
 * - $id: Image _id from find_repository_images_by_registry_path (MongoDB ObjectID)
 * - $page: Page number for pagination (default: 0)
 * - $page_size: Results per page (default: 100)
 */
export const FIND_IMAGE_VULNERABILITIES = `
  query FindImageVulnerabilities($id: String!, $page: Int, $page_size: Int) {
    find_image_vulnerabilities(id: $id, page: $page, page_size: $page_size) {
      data {
        cve_id
        severity
        affected_packages {
          name
        }
        advisory_id
        public_date
      }
      page
      page_size
      total
    }
  }
`;

// Re-export types for convenience
export type {
  FindRepositoriesResponse,
  FindRepositoriesVariables,
  FindRepositoryImagesResponse,
  FindRepositoryImagesVariables,
  FindImageVulnerabilitiesResponse,
  FindImageVulnerabilitiesVariables
} from './redhat-api-types';
