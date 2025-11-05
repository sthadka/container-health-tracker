/**
 * RedHatClient
 *
 * GraphQL client for Red Hat Container Catalog API
 * Per research.md: Red Hat Container Catalog API Integration
 * Per contracts/redhat-graphql.graphql
 */

import {
  FIND_REPOSITORIES,
  FIND_REPOSITORY_IMAGES,
  FIND_IMAGE_VULNERABILITIES
} from './queries';

import type {
  ContainerRepository,
  ContainerImage,
  ContainerImageVulnerability,
  FindRepositoriesVariables,
  FindRepositoriesResponse,
  FindRepositoryImagesVariables,
  FindRepositoryImagesResponse,
  FindImageVulnerabilitiesVariables,
  FindImageVulnerabilitiesResponse
} from './redhat-api-types';

/**
 * GraphQL client for Red Hat Container Catalog
 *
 * Note: Uses UrlFetchApp since graphql-request requires Node.js fetch
 * Apps Script environment requires native UrlFetchApp
 */
export class RedHatClient {
  private apiEndpoint: string;

  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Step 1: Find repository by repository path
   *
   * @param repository - Repository path (e.g., "ubi8/ubi")
   * @returns Repository metadata including _id
   * @throws Error if repository not found or API fails
   */
  public findRepository(repository: string): ContainerRepository {
    const variables: FindRepositoriesVariables = { repository };
    const response = this.executeQuery<FindRepositoriesResponse>(FIND_REPOSITORIES, variables);

    if (!response.find_repositories.data || response.find_repositories.data.length === 0) {
      throw new Error(`Repository not found: ${repository}`);
    }

    return response.find_repositories.data[0];
  }

  /**
   * Step 2: Find images by registry and repository path
   *
   * @param registry - Registry hostname (e.g., "registry.access.redhat.com")
   * @param repository - Repository path (e.g., "ubi8/ubi")
   * @param architecture - Optional architecture filter (e.g., "amd64")
   * @param pageSize - Maximum images to return (default: 500)
   * @returns Array of image metadata with tags and _id
   * @throws Error if no images found or API fails
   */
  public findRepositoryImages(
    registry: string,
    repository: string,
    architecture?: string,
    pageSize: number = 500
  ): ContainerImage[] {
    const variables: FindRepositoryImagesVariables = {
      registry,
      repository,
      page_size: pageSize,
      architecture
    };

    const response = this.executeQuery<FindRepositoryImagesResponse>(
      FIND_REPOSITORY_IMAGES,
      variables
    );

    if (!response.find_repository_images_by_registry_path.data ||
        response.find_repository_images_by_registry_path.data.length === 0) {
      throw new Error(`No images found for ${registry}/${repository}`);
    }

    return response.find_repository_images_by_registry_path.data;
  }

  /**
   * Step 3: Find vulnerabilities for a specific image
   *
   * CRITICAL: Use image _id (MongoDB ObjectID) NOT docker_image_id (SHA256)
   *
   * @param imageId - Image _id from find_repository_images_by_registry_path
   * @param pageSize - Results per page (default: 100)
   * @returns Array of CVE records with all pages fetched
   * @throws Error if API fails
   */
  public findImageVulnerabilities(
    imageId: string,
    pageSize: number = 100
  ): ContainerImageVulnerability[] {
    let allVulnerabilities: ContainerImageVulnerability[] = [];
    let currentPage = 0;
    let hasMorePages = true;

    // Paginate through all results
    while (hasMorePages) {
      const variables: FindImageVulnerabilitiesVariables = {
        id: imageId,
        page: currentPage,
        page_size: pageSize
      };

      const response = this.executeQuery<FindImageVulnerabilitiesResponse>(
        FIND_IMAGE_VULNERABILITIES,
        variables
      );

      const result = response.find_image_vulnerabilities;
      allVulnerabilities = allVulnerabilities.concat(result.data);

      // Check if there are more pages
      const totalPages = Math.ceil(result.total / result.page_size);
      currentPage++;
      hasMorePages = currentPage < totalPages;
    }

    return allVulnerabilities;
  }

  /**
   * Execute GraphQL query with error handling and exponential backoff retry
   *
   * Retry strategy:
   * - Max 3 attempts
   * - Exponential backoff: 1s, 2s, 4s
   * - Retries on network errors and 5xx status codes
   * - No retry on 4xx client errors
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @returns Parsed response data
   * @throws Error if all retries fail
   */
  private executeQuery<T>(query: string, variables: any): T {
    const maxRetries = 3;
    const baseDelayMs = 1000; // 1 second
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const payload = JSON.stringify({
          query,
          variables
        });

        const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
          method: 'post',
          contentType: 'application/json',
          payload,
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(this.apiEndpoint, options);
        const statusCode = response.getResponseCode();

        // Handle HTTP errors
        if (statusCode >= 500) {
          // Server error - retry with exponential backoff
          throw new Error(`Server error (${statusCode}): ${response.getContentText()}`);
        } else if (statusCode >= 400) {
          // Client error - don't retry
          throw new Error(`Client error (${statusCode}): ${response.getContentText()}`);
        } else if (statusCode !== 200) {
          // Other non-200 status
          throw new Error(`Unexpected status ${statusCode}: ${response.getContentText()}`);
        }

        // Parse response
        const result = JSON.parse(response.getContentText());

        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors.map((err: any) => err.message).join(', ');
          // GraphQL errors are not retried (usually client-side issues)
          throw new Error(`GraphQL errors: ${errorMessages}`);
        }

        // Success - return data
        return result.data as T;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx) or GraphQL errors
        if (lastError.message.includes('Client error') ||
            lastError.message.includes('GraphQL errors')) {
          throw lastError;
        }

        // Check if we should retry
        if (attempt < maxRetries - 1) {
          const delayMs = baseDelayMs * Math.pow(2, attempt);
          Logger.log(`[RedHatClient] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms: ${lastError.message}`);
          Utilities.sleep(delayMs);
        }
      }
    }

    // All retries exhausted
    throw new Error(`Red Hat API request failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }
}
