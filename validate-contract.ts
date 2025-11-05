/**
 * Contract Validator for Red Hat GraphQL API
 *
 * Validates that our TypeScript queries and types match the contract schema
 * Run: npx tsx validate-contract.ts
 */

import {
  FIND_REPOSITORIES,
  FIND_REPOSITORY_IMAGES,
  FIND_IMAGE_VULNERABILITIES
} from './src/integrations/graphql/queries';

import type {
  ContainerRepository,
  ContainerImage,
  ContainerImageVulnerability
} from './src/integrations/graphql/redhat-api-types';

interface ValidationResult {
  query: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Extract top-level field names from GraphQL query
 * Simplified: extracts all identifiers that appear to be field names
 */
function extractFields(query: string, typeName: string): Set<string> {
  const fields = new Set<string>();

  // Find the main data block (after "data {")
  const dataStart = query.indexOf('data {');
  if (dataStart === -1) return fields;

  // Extract everything after "data {"
  const afterData = query.substring(dataStart + 6);

  // Split by lines and look for field names
  const lines = afterData.split('\n');
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track brace depth to know when we're in nested structures
    braceDepth += (trimmed.match(/{/g) || []).length;
    braceDepth -= (trimmed.match(/}/g) || []).length;

    if (braceDepth < 0) break; // Exited data block

    // Extract field name (word at start of line)
    const fieldMatch = trimmed.match(/^([a-z_][a-z0-9_]*)/i);
    if (fieldMatch && fieldMatch[1] !== 'data') {
      fields.add(fieldMatch[1]);
    }
  }

  return fields;
}

/**
 * Get expected fields from contract schema
 */
const CONTRACT_FIELDS = {
  repository: new Set(['_id', 'registry', 'repository', 'published']),

  image: new Set([
    '_id',
    'docker_image_id',
    'image_id',
    'creation_date',
    'architecture',
    'repositories',
    'parsed_data'
  ]),

  vulnerability: new Set([
    '_id',
    'creation_date',
    'advisory_id',
    'advisory_type',
    'cve_id',
    'severity',
    'affected_packages',
    'packages',
    'public_date'
  ])
};

/**
 * Validate repository query
 */
function validateRepositoryQuery(): ValidationResult {
  const result: ValidationResult = {
    query: 'FIND_REPOSITORIES',
    valid: true,
    errors: [],
    warnings: []
  };

  const queryFields = extractFields(FIND_REPOSITORIES, 'find_repositories');

  // Check for required fields
  const requiredFields = ['_id', 'registry', 'repository'];
  for (const field of requiredFields) {
    if (!queryFields.has(field)) {
      result.errors.push(`Missing required field: ${field}`);
      result.valid = false;
    }
  }

  // Check for unknown fields
  for (const field of queryFields) {
    if (!CONTRACT_FIELDS.repository.has(field)) {
      result.warnings.push(`Unknown field (not in contract): ${field}`);
    }
  }

  return result;
}

/**
 * Validate image query
 */
function validateImageQuery(): ValidationResult {
  const result: ValidationResult = {
    query: 'FIND_REPOSITORY_IMAGES',
    valid: true,
    errors: [],
    warnings: []
  };

  const queryFields = extractFields(FIND_REPOSITORY_IMAGES, 'find_repository_images_by_registry_path');

  // Check for critical fields
  const criticalFields = ['_id', 'architecture', 'docker_image_id'];
  for (const field of criticalFields) {
    if (!queryFields.has(field)) {
      result.errors.push(`Missing critical field: ${field}`);
      result.valid = false;
    }
  }

  // Verify we're querying tags (needed for version detection)
  if (!FIND_REPOSITORY_IMAGES.includes('tags')) {
    result.errors.push('Missing tags field - required for version detection');
    result.valid = false;
  }

  // Check for unknown fields
  for (const field of queryFields) {
    if (!CONTRACT_FIELDS.image.has(field)) {
      result.warnings.push(`Unknown field (not in contract): ${field}`);
    }
  }

  return result;
}

/**
 * Validate vulnerability query
 */
function validateVulnerabilityQuery(): ValidationResult {
  const result: ValidationResult = {
    query: 'FIND_IMAGE_VULNERABILITIES',
    valid: true,
    errors: [],
    warnings: []
  };

  const queryFields = extractFields(FIND_IMAGE_VULNERABILITIES, 'find_image_vulnerabilities');

  // Check for required fields
  const requiredFields = ['cve_id', 'severity', 'advisory_id'];
  for (const field of requiredFields) {
    if (!queryFields.has(field)) {
      result.errors.push(`Missing required field: ${field}`);
      result.valid = false;
    }
  }

  // Check for common mistakes
  if (FIND_IMAGE_VULNERABILITIES.includes('package_name')) {
    result.errors.push('WRONG: using package_name instead of name in affected_packages');
    result.valid = false;
  }

  if (FIND_IMAGE_VULNERABILITIES.includes('published_date')) {
    result.errors.push('WRONG: using published_date instead of public_date');
    result.valid = false;
  }

  if (FIND_IMAGE_VULNERABILITIES.includes('cvss3_score')) {
    result.errors.push('Field cvss3_score does not exist in Red Hat API');
    result.valid = false;
  }

  if (FIND_IMAGE_VULNERABILITIES.includes('description')) {
    result.errors.push('Field description does not exist in Red Hat API');
    result.valid = false;
  }

  // Check for unknown fields
  for (const field of queryFields) {
    if (!CONTRACT_FIELDS.vulnerability.has(field)) {
      result.warnings.push(`Unknown field (not in contract): ${field}`);
    }
  }

  return result;
}

/**
 * Validate type definitions match contract
 */
function validateTypes(): ValidationResult {
  const result: ValidationResult = {
    query: 'TYPE_DEFINITIONS',
    valid: true,
    errors: [],
    warnings: []
  };

  // This is a static check - in a real validator we'd use TypeScript compiler API
  // For now, we'll just check that the types file exists and has the right exports

  result.warnings.push('Type validation requires TypeScript compiler - run `pnpm build` to check');

  return result;
}

/**
 * Main validation runner
 */
function main() {
  console.log('🔍 Validating GraphQL queries against Red Hat API contract...\n');

  const results = [
    validateRepositoryQuery(),
    validateImageQuery(),
    validateVulnerabilityQuery(),
    validateTypes()
  ];

  let allValid = true;

  for (const result of results) {
    console.log(`📝 ${result.query}:`);

    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('  ✅ Valid - no issues found');
    } else {
      if (result.errors.length > 0) {
        console.log('  ❌ Errors:');
        result.errors.forEach(err => console.log(`     - ${err}`));
        allValid = false;
      }

      if (result.warnings.length > 0) {
        console.log('  ⚠️  Warnings:');
        result.warnings.forEach(warn => console.log(`     - ${warn}`));
      }
    }
    console.log('');
  }

  if (allValid) {
    console.log('✅ All queries valid! Ready for deployment.\n');
    process.exit(0);
  } else {
    console.log('❌ Validation failed. Fix errors before deploying.\n');
    process.exit(1);
  }
}

main();
