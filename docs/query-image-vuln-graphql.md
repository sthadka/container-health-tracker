# Red Hat Container Catalog GraphQL API - Vulnerability Query Guide

This document provides a comprehensive, reproducible methodology for querying the Red Hat Container Catalog GraphQL API to find the latest version of a container image and retrieve its vulnerabilities.

## Table of Contents

- [API Overview](#api-overview)
- [Authentication](#authentication)
- [Data Model](#data-model)
- [Query Methodology](#query-methodology)
- [Common Pitfalls](#common-pitfalls)
- [Example Workflows](#example-workflows)
- [Tool Implementation Considerations](#tool-implementation-considerations)

---

## API Overview

**Base URL**: `https://catalog.redhat.com/api/containers/graphql/`

**Method**: POST

**Content-Type**: `application/json`

The Red Hat Container Catalog provides a GraphQL API for querying container images, repositories, vulnerabilities, and certification data. The API supports pagination, filtering, and complex queries.

---

## Authentication

The API supports **unauthenticated access** for public container image data. No API key or authentication headers are required for read-only operations on public repositories.

For write operations or private repositories, authentication may be required via API keys (see `create_api_key` mutation).

---

## Data Model

### Key Entities

1. **ContainerRepository**: Represents a container repository
   - `_id`: Unique identifier (ObjectID)
   - `registry`: Registry hostname (e.g., `registry.access.redhat.com`)
   - `repository`: Repository path (e.g., `advanced-cluster-security/rhacs-scanner-db-slim-rhel8`)

2. **ContainerImage**: Represents a specific container image
   - `_id`: Unique identifier (ObjectID) - **Use this for vulnerability queries**
   - `docker_image_id`: SHA256 digest
   - `creation_date`: ISO 8601 timestamp
   - `repositories[].tags[]`: Array of tags associated with the image
   - `parsed_data.labels[]`: Image labels (metadata)

3. **ContainerImageVulnerability**: Represents a vulnerability in an image
   - `_id`: Unique identifier
   - `cve_id`: CVE identifier (e.g., `CVE-2024-0985`)
   - `severity`: Severity level (`Critical`, `Important`, `Moderate`, `Low`)
   - `advisory_id`: Red Hat advisory ID
   - `affected_packages[]`: Packages affected by the vulnerability
   - `packages[].rpm_nvra[]`: Installed RPM packages

### Important Relationships

- One repository can have many images
- One image can have multiple tags
- One image can have multiple architectures (multi-arch)
- Tags are mutable and can move between images
- The `_id` field is the stable identifier for vulnerability queries

---

## Query Methodology

### Step 1: Find the Repository

**Query**: `find_repositories`

```graphql
query {
  find_repositories(
    page: 0,
    page_size: 10,
    filter: {
      repository: { eq: "advanced-cluster-security/rhacs-scanner-db-slim-rhel8" }
    }
  ) {
    data {
      _id
      registry
      repository
    }
  }
}
```

**Example cURL**:
```bash
curl -s -X POST 'https://catalog.redhat.com/api/containers/graphql/' \
  -H 'content-type: application/json' \
  --data-raw '{
    "query": "query { find_repositories(page: 0, page_size: 10, filter: { repository: { eq: \"REPOSITORY_PATH\" } }) { data { _id registry repository } } }"
  }'
```

**Response**:
```json
{
  "data": {
    "find_repositories": {
      "data": [
        {
          "_id": "621f755a5c4460caf3124781",
          "registry": "registry.access.redhat.com",
          "repository": "advanced-cluster-security/rhacs-scanner-db-slim-rhel8"
        }
      ]
    }
  }
}
```

---

### Step 2: Find All Images for the Repository

**Query**: `find_repository_images_by_registry_path`

```graphql
query {
  find_repository_images_by_registry_path(
    registry: "registry.access.redhat.com",
    repository: "advanced-cluster-security/rhacs-scanner-db-slim-rhel8",
    page: 0,
    page_size: 500
  ) {
    data {
      _id
      docker_image_id
      creation_date
      architecture
      repositories {
        tags {
          name
          added_date
        }
      }
      parsed_data {
        labels {
          name
          value
        }
      }
    }
  }
}
```

**Important Parameters**:
- `page_size`: Maximum 500 (increase to fetch all images in one request)
- `page`: Zero-indexed page number for pagination

**Example cURL**:
```bash
curl -s -X POST 'https://catalog.redhat.com/api/containers/graphql/' \
  -H 'content-type: application/json' \
  --data-raw '{
    "query": "query { find_repository_images_by_registry_path(registry: \"REGISTRY\", repository: \"REPOSITORY\", page: 0, page_size: 500) { data { _id creation_date repositories { tags { name added_date } } parsed_data { labels { name value } } } } }"
  }'
```

---

### Step 3: Identify the Latest Image

**Critical Finding**: The `parsed_data.labels[]` array may not contain a `version` label for newer images. Tags are the most reliable source for version information.

**Recommended Approach**: Sort by `creation_date` (descending) and filter for the highest semantic version tag.

**Algorithm**:
1. Extract all images from the response
2. For each image, extract all tags from `repositories[0].tags[].name`
3. Parse tags as semantic versions (handle formats like `4.9.0-1`, `4.9.0`, `4.9`)
4. Sort images by the highest semantic version tag
5. Among images with the same highest tag, use the most recent `creation_date`

**Example using jq**:
```bash
# Extract all tags and find latest by semantic version
cat response.json | jq -r '.data.find_repository_images_by_registry_path.data[] |
  select(.repositories != null and .repositories[0].tags != null) |
  .repositories[0].tags[].name' | \
  grep -E "^[0-9]+\.[0-9]+" | \
  sort -V | \
  tail -1

# Find the image ID with that tag
LATEST_TAG="4.9.0-1"
cat response.json | jq -r ".data.find_repository_images_by_registry_path.data[] |
  select(.repositories[0].tags[].name == \"$LATEST_TAG\") |
  {id: ._id, creation: .creation_date}" | \
  jq -s 'sort_by(.creation) | reverse | .[0].id'
```

**Alternative Approach**: If you only need the absolute latest by creation date:
```bash
cat response.json | jq -r '.data.find_repository_images_by_registry_path.data |
  sort_by(.creation_date) |
  reverse |
  .[0]._id'
```

---

### Step 4: Query Vulnerabilities

**Query**: `find_image_vulnerabilities`

**Important**: Use the `_id` field from Step 3, NOT the `docker_image_id`.

```graphql
query FIND_IMAGE_VULNERABILITIES($id: String, $page: Int, $pageSize: Int) {
  ContainerImageVulnerability: find_image_vulnerabilities(
    id: $id
    page: $page
    page_size: $pageSize
  ) {
    data {
      _id
      creation_date
      advisory_id
      advisory_type
      cve_id
      severity
      affected_packages {
        name
        version
        arch
        package_type
      }
      packages {
        rpm_nvra
      }
    }
  }
}
```

**Example cURL**:
```bash
IMAGE_ID="69038da27d49e8f2af32aaf8"

curl -s 'https://catalog.redhat.com/api/containers/graphql/' \
  -H 'content-type: application/json' \
  --data-raw "{
    \"operationName\": \"FIND_IMAGE_VULNERABILITIES\",
    \"variables\": {
      \"id\": \"$IMAGE_ID\",
      \"pageSize\": 250,
      \"page\": 0
    },
    \"query\": \"query FIND_IMAGE_VULNERABILITIES(\$id: String, \$page: Int, \$pageSize: Int) { ContainerImageVulnerability: find_image_vulnerabilities(id: \$id, page: \$page, page_size: \$pageSize) { data { _id creation_date advisory_id advisory_type cve_id severity affected_packages { name version arch package_type } packages { rpm_nvra } } } }\"
  }"
```

**Pagination**:
- `page_size`: Maximum 250 recommended
- If total vulnerabilities > 250, increment `page` and repeat

**Response**:
```json
{
  "data": {
    "ContainerImageVulnerability": {
      "data": [
        {
          "_id": "...",
          "cve_id": "CVE-2024-0985",
          "severity": "Important",
          "advisory_id": "2024:0974",
          "advisory_type": "RHSA",
          "affected_packages": [...],
          "packages": [...]
        }
      ]
    }
  }
}
```

---

## Common Pitfalls

### 1. **Using `docker_image_id` Instead of `_id`**
- ❌ Wrong: `find_image_vulnerabilities(id: "sha256:521deadf...")`
- ✅ Correct: `find_image_vulnerabilities(id: "69038da27d49e8f2af32aaf8")`

The vulnerability query expects the MongoDB ObjectID (`_id`), not the Docker SHA256 digest.

### 2. **Relying on `parsed_data.labels` for Version**
Some images (especially newer ones) do not have a `version` label in `parsed_data.labels[]`. Always use tags from `repositories[].tags[]` as the source of truth.

### 3. **String Sorting Instead of Semantic Versioning**
- ❌ Wrong: `"4.9.0"` < `"4.100.0"` (lexicographic)
- ✅ Correct: Use semver parsing or `sort -V` (version sort)

### 4. **Not Handling Pagination**
Large repositories may have 500+ images. Always check if there are more pages:
- If `data.length == page_size`, there may be more results
- Increment `page` and repeat the query

### 5. **Ignoring Multi-Architecture Images**
A single tag (e.g., `4.9.0-1`) may point to multiple images with different architectures:
- `amd64` / `x86_64`
- `arm64` / `aarch64`
- `ppc64le`
- `s390x`

Filter by `architecture` if you need a specific platform.

---

## Example Workflows

### Workflow 1: Find Latest Version and Count Vulnerabilities

```bash
#!/bin/bash

REGISTRY="registry.access.redhat.com"
REPOSITORY="advanced-cluster-security/rhacs-scanner-db-slim-rhel8"
API_URL="https://catalog.redhat.com/api/containers/graphql/"

# Step 1: Fetch all images
IMAGES_JSON=$(curl -s -X POST "$API_URL" \
  -H 'content-type: application/json' \
  --data-raw "{
    \"query\": \"query { find_repository_images_by_registry_path(registry: \\\"$REGISTRY\\\", repository: \\\"$REPOSITORY\\\", page: 0, page_size: 500) { data { _id creation_date repositories { tags { name added_date } } } } }\"
  }")

# Step 2: Find latest image by creation_date
IMAGE_ID=$(echo "$IMAGES_JSON" | jq -r '.data.find_repository_images_by_registry_path.data | sort_by(.creation_date) | reverse | .[0]._id')
LATEST_TAG=$(echo "$IMAGES_JSON" | jq -r '.data.find_repository_images_by_registry_path.data | sort_by(.creation_date) | reverse | .[0].repositories[0].tags[0].name')

echo "Latest Image ID: $IMAGE_ID"
echo "Latest Tag: $LATEST_TAG"

# Step 3: Query vulnerabilities
VULN_JSON=$(curl -s "$API_URL" \
  -H 'content-type: application/json' \
  --data-raw "{
    \"operationName\": \"FIND_IMAGE_VULNERABILITIES\",
    \"variables\": {\"id\": \"$IMAGE_ID\", \"pageSize\": 250, \"page\": 0},
    \"query\": \"query FIND_IMAGE_VULNERABILITIES(\$id: String, \$page: Int, \$pageSize: Int) { ContainerImageVulnerability: find_image_vulnerabilities(id: \$id, page: \$page, page_size: \$pageSize) { data { cve_id severity } } }\"
  }")

# Step 4: Count and categorize vulnerabilities
TOTAL=$(echo "$VULN_JSON" | jq '.data.ContainerImageVulnerability.data | length')
CRITICAL=$(echo "$VULN_JSON" | jq '[.data.ContainerImageVulnerability.data[] | select(.severity == "Critical")] | length')
IMPORTANT=$(echo "$VULN_JSON" | jq '[.data.ContainerImageVulnerability.data[] | select(.severity == "Important")] | length')
MODERATE=$(echo "$VULN_JSON" | jq '[.data.ContainerImageVulnerability.data[] | select(.severity == "Moderate")] | length')
LOW=$(echo "$VULN_JSON" | jq '[.data.ContainerImageVulnerability.data[] | select(.severity == "Low")] | length')

echo "Total Vulnerabilities: $TOTAL"
echo "  Critical: $CRITICAL"
echo "  Important: $IMPORTANT"
echo "  Moderate: $MODERATE"
echo "  Low: $LOW"
```

### Workflow 2: Compare Vulnerabilities Across Versions

```bash
#!/bin/bash

# Compare vulnerabilities between two specific tags
TAG1="4.8.0"
TAG2="4.9.0-1"

for TAG in "$TAG1" "$TAG2"; do
  # Find image ID by tag
  IMAGE_ID=$(curl -s "$API_URL" -H 'content-type: application/json' \
    --data-raw "{\"query\": \"query { find_repository_images_by_registry_path(registry: \\\"$REGISTRY\\\", repository: \\\"$REPOSITORY\\\", page: 0, page_size: 500) { data { _id repositories { tags { name } } } } }\"}" | \
    jq -r ".data.find_repository_images_by_registry_path.data[] | select(.repositories[0].tags[].name == \"$TAG\") | ._id" | head -1)

  # Count vulnerabilities
  VULN_COUNT=$(curl -s "$API_URL" -H 'content-type: application/json' \
    --data-raw "{\"variables\": {\"id\": \"$IMAGE_ID\", \"pageSize\": 250, \"page\": 0}, \"query\": \"query(\$id: String, \$page: Int, \$pageSize: Int) { find_image_vulnerabilities(id: \$id, page: \$page, page_size: \$pageSize) { data { cve_id } } }\"}" | \
    jq '.data.find_image_vulnerabilities.data | length')

  echo "$TAG: $VULN_COUNT vulnerabilities (Image ID: $IMAGE_ID)"
done
```

---

## Tool Implementation Considerations

### Architecture Recommendations

1. **Caching Strategy**
   - Cache repository metadata (changes infrequently)
   - Cache image lists for a repository (TTL: 1 hour)
   - Cache vulnerability data per image ID (TTL: 24 hours)
   - Invalidate cache when a new image is detected

2. **Rate Limiting**
   - No official rate limits documented
   - Implement exponential backoff for errors
   - Use batch queries where possible

3. **Data Storage**
   - Store `_id` (ObjectID) as the primary key
   - Index by `registry`, `repository`, `tag`, `creation_date`
   - Normalize vulnerability data to avoid duplication

4. **Version Parsing**
   - Use a semver library (e.g., `semver` in Node.js, `packaging.version` in Python)
   - Handle Red Hat versioning: `major.minor.patch-release` (e.g., `4.9.0-1`)
   - Fall back to lexicographic sorting if semver parsing fails

5. **Error Handling**
   - Handle GraphQL errors (check `response.errors[]`)
   - Handle empty results (no images, no vulnerabilities)
   - Handle network timeouts and retries

### Sample Tool Interface

```bash
# Command-line tool interface
$ vulnscan find-latest --registry registry.access.redhat.com --repo rhel8/postgresql-12
Latest: 1.0.0-123 (Image ID: abc123, Created: 2025-10-30)

$ vulnscan vulnerabilities --image-id abc123 --format json
{
  "image_id": "abc123",
  "tag": "1.0.0-123",
  "total": 42,
  "critical": 2,
  "important": 15,
  "moderate": 20,
  "low": 5,
  "cves": [...]
}

$ vulnscan compare --tag1 1.0.0-100 --tag2 1.0.0-123
Comparing 1.0.0-100 (42 CVEs) → 1.0.0-123 (35 CVEs)
  Fixed: 10 CVEs
  New: 3 CVEs
  Unchanged: 32 CVEs
```

---

## GraphQL Schema Resources

For full schema documentation, use GraphQL introspection:

```graphql
query {
  __schema {
    types {
      name
      fields {
        name
        type {
          name
        }
      }
    }
  }
}
```

Or explore the interactive GraphiQL interface at:
`https://catalog.redhat.com/api/containers/graphql/`

---

## Appendix: Complete Query Examples

### A. Find Repository by Partial Name

```graphql
query {
  find_repositories(
    page: 0,
    page_size: 10,
    filter: {
      repository: { like: "%postgresql%" }
    }
  ) {
    data {
      _id
      registry
      repository
    }
  }
}
```

### B. Find Images by NVR (Name-Version-Release)

```graphql
query {
  find_images_by_nvr(
    nvr: "rhacs-scanner-db-slim-container-4.9.0-1",
    page: 0,
    page_size: 10
  ) {
    data {
      _id
      docker_image_id
      repositories {
        registry
        repository
        tags {
          name
        }
      }
    }
  }
}
```

### C. Find Images with Critical Vulnerabilities

```graphql
query {
  find_images(
    page: 0,
    page_size: 10,
    filter: {
      repositories: {
        elemMatch: {
          repository: { eq: "rhel8/postgresql-12" }
        }
      }
    }
  ) {
    data {
      _id
      repositories {
        tags {
          name
        }
      }
    }
  }
}
```

Then for each image ID, query vulnerabilities and filter by severity.

---

## Version History

- **v1.0** (2025-10-31): Initial documentation
  - Documented complete query workflow
  - Identified common pitfalls
  - Provided example implementations

---

## Contact & Support

For issues with the Red Hat Container Catalog API:
- Documentation: https://catalog.redhat.com/
- Red Hat Customer Portal: https://access.redhat.com/

For general GraphQL questions:
- GraphQL Spec: https://spec.graphql.org/

---

*This guide is provided as-is for educational and development purposes.*
