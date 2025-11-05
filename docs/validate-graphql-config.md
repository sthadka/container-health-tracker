# GraphQL Contract Validation

This project includes comprehensive validation for Red Hat Container Catalog GraphQL API integration.

## Type System

### Contract-Based Types (`src/integrations/graphql/redhat-api-types.ts`)

All TypeScript types are derived from the official API contract:
- **Source**: `specs/001-container-health-monitor/contracts/redhat-graphql.graphql`
- **Types**: Repository, Image, Vulnerability entities with full field definitions
- **Validators**: Runtime validation functions for API responses

### Key Types

```typescript
// Repository
ContainerRepository {
  _id: string              // MongoDB ObjectID
  registry: string         // e.g., "registry.access.redhat.com"
  repository: string       // e.g., "ubi8/ubi"
}

// Image
ContainerImage {
  _id: string              // USE THIS for vulnerability queries
  docker_image_id: string  // DO NOT use for vulnerability queries
  architecture: string
  repositories: { tags: { name: string }[] }[]
}

// Vulnerability
ContainerImageVulnerability {
  cve_id: string
  severity: string         // "Critical" | "Important" | "Moderate" | "Low"
  affected_packages: { name: string }[] | null
  advisory_id: string
  public_date: string
}
```

## Validation Tools

### 1. Contract Validator (`validate-contract.ts`)

Validates GraphQL queries against the contract schema.

**Run:**
```bash
pnpm validate
```

**What it checks:**
- ✅ Required fields present in queries
- ✅ No invalid field names
- ✅ Common API mistakes (e.g., using `published_date` instead of `public_date`)
- ⚠️  Warnings for fields not in contract

**Example output:**
```
✅ FIND_REPOSITORIES: Valid
✅ FIND_REPOSITORY_IMAGES: Valid
✅ FIND_IMAGE_VULNERABILITIES: Valid
```

### 2. Live API Tester (`test-graphql.js`)

Tests queries against the actual Red Hat API.

**Run:**
```bash
pnpm test:api
```

**What it does:**
- Executes all queries against live Red Hat API
- Validates response structure
- Tests pagination
- Discovers actual field names

**Example output:**
```
✅ Find repository (ubi8/ubi): Success
✅ Find repository images: Success
✅ Find image vulnerabilities: Success
```

## Development Workflow

### Before Modifying Queries

1. **Check contract**: Review `specs/001-container-health-monitor/contracts/redhat-graphql.graphql`
2. **Update types**: Modify `src/integrations/graphql/redhat-api-types.ts`
3. **Update queries**: Modify `src/integrations/graphql/queries.ts`

### Before Deploying

Automated validation runs on:
```bash
pnpm push    # Runs validate → build → push
pnpm deploy  # Runs validate → build → push → deploy
```

### Manual Validation

```bash
# Validate contract compliance
pnpm validate

# Test against live API
pnpm test:api

# Full validation + build
pnpm build
```

## Common Pitfalls (Prevented by Validation)

### ❌ WRONG: Using docker_image_id
```graphql
find_image_vulnerabilities(id: "sha256:521deadf...")
```
**Error**: API will return 400

### ✅ CORRECT: Using _id
```graphql
find_image_vulnerabilities(id: "69038da27d49e8f2af32aaf8")
```

### ❌ WRONG: Field name mistakes
```graphql
affected_packages {
  package_name  # Field doesn't exist
}
```
**Caught by**: Contract validator

### ✅ CORRECT: Actual field names
```graphql
affected_packages {
  name  # Correct field name
}
```

## Type Guards

Runtime validation functions:

```typescript
import { isValidSeverity, isValidCveId, isMongoObjectId } from './redhat-api-types';

// Validate severity
if (isValidSeverity(severity)) {
  // TypeScript knows it's 'Critical' | 'Important' | 'Moderate' | 'Low'
}

// Validate CVE format
if (isValidCveId("CVE-2024-1234")) { ... }

// Validate MongoDB ObjectID
if (isMongoObjectId("69038da27d49e8f2af32aaf8")) { ... }
```

## Files

| File | Purpose |
|------|---------|
| `src/integrations/graphql/redhat-api-types.ts` | TypeScript types matching contract |
| `src/integrations/graphql/queries.ts` | GraphQL query templates |
| `validate-contract.ts` | Contract compliance validator |
| `test-graphql.js` | Live API integration tester |
| `specs/001-container-health-monitor/contracts/redhat-graphql.graphql` | Official API contract |

## CI/CD Integration

The `push` and `deploy` scripts automatically run validation:

```bash
pnpm push
# 1. ✅ Validates queries against contract
# 2. 🔨 Builds TypeScript
# 3. 📤 Pushes to Apps Script
```

Validation failures will prevent deployment.

## Updating the Contract

When Red Hat API changes:

1. Update `specs/001-container-health-monitor/contracts/redhat-graphql.graphql`
2. Run `pnpm test:api` to test against live API
3. Update types in `src/integrations/graphql/redhat-api-types.ts`
4. Update queries in `src/integrations/graphql/queries.ts`
5. Run `pnpm validate` to verify
6. Run `pnpm build` to ensure TypeScript compiles

## Benefits

- ✅ **Type Safety**: Full TypeScript coverage for API responses
- ✅ **Contract Compliance**: Queries validated before deployment
- ✅ **Error Prevention**: Catches field name mistakes at build time
- ✅ **Documentation**: Types serve as inline API documentation
- ✅ **Confidence**: Live API testing validates actual behavior
