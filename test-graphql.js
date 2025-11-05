/**
 * Test GraphQL queries against Red Hat Catalog API
 * Run: node test-graphql.js
 */

const API_ENDPOINT = 'https://catalog.redhat.com/api/containers/graphql/';

async function testQuery(query, variables, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log('Variables:', JSON.stringify(variables, null, 2));

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) {
      console.error('❌ GraphQL Errors:', JSON.stringify(result.errors, null, 2));
      return { success: false, errors: result.errors };
    }

    console.log('✅ Query successful');
    console.log('Sample data:', JSON.stringify(result.data, null, 2).substring(0, 500) + '...');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('=== Red Hat GraphQL API Query Tests ===\n');

  // Test 1: Find repository
  const FIND_REPOSITORIES = `
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

  const repo1 = await testQuery(
    FIND_REPOSITORIES,
    { repository: 'ubi8/ubi' },
    'Find repository (ubi8/ubi)'
  );

  if (!repo1.success) {
    console.error('\n❌ Test suite failed at step 1');
    process.exit(1);
  }

  // Test 2: Find repository images
  const FIND_REPOSITORY_IMAGES = `
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

  const repo2 = await testQuery(
    FIND_REPOSITORY_IMAGES,
    {
      registry: 'registry.access.redhat.com',
      repository: 'ubi8/ubi',
      page_size: 5,
      architecture: 'amd64'
    },
    'Find repository images'
  );

  if (!repo2.success) {
    console.error('\n❌ Test suite failed at step 2');
    process.exit(1);
  }

  // Get first image ID for vulnerability test
  const imageId = repo2.data?.find_repository_images_by_registry_path?.data?.[0]?._id;

  if (!imageId) {
    console.error('\n❌ No image ID found for vulnerability test');
    process.exit(1);
  }

  console.log(`\nUsing image ID for vulnerability test: ${imageId}`);

  // Test 3: Find image vulnerabilities - Try different fields
  const FIND_IMAGE_VULNERABILITIES_TEST1 = `
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

  console.log('\nTrying affected_packages.name...');
  let repo3 = await testQuery(
    FIND_IMAGE_VULNERABILITIES_TEST1,
    {
      id: imageId,
      page: 0,
      page_size: 5
    },
    'Find image vulnerabilities (try name field)'
  );

  if (!repo3.success) {
    // Try without subfield selection
    console.log('\nTrying affected_packages without subfield...');
    const FIND_IMAGE_VULNERABILITIES_TEST2 = `
      query FindImageVulnerabilities($id: String!, $page: Int, $page_size: Int) {
        find_image_vulnerabilities(id: $id, page: $page, page_size: $page_size) {
          data {
            cve_id
            severity
            advisory_id
            public_date
          }
          page
          page_size
          total
        }
      }
    `;

    repo3 = await testQuery(
      FIND_IMAGE_VULNERABILITIES_TEST2,
      {
        id: imageId,
        page: 0,
        page_size: 5
      },
      'Find image vulnerabilities (without affected_packages)'
    );
  }

  if (!repo3.success) {
    console.error('\n❌ Test suite failed at step 3');
    process.exit(1);
  }

  // All tests passed
  console.log('\n✅ All GraphQL queries validated successfully!');
  console.log('\nQuery fields confirmed:');
  console.log('  ✓ Repository: _id, registry, repository, published');
  console.log('  ✓ Images: _id, architecture, docker_image_id, image_id, repositories.tags.name');

  if (repo3.data?.find_image_vulnerabilities?.data?.[0]?.affected_packages) {
    console.log('  ✓ Vulnerabilities: cve_id, severity, affected_packages.name, advisory_id, public_date');
  } else {
    console.log('  ✓ Vulnerabilities: cve_id, severity, advisory_id, public_date (affected_packages requires further investigation)');
  }
}

runTests().catch(error => {
  console.error('\n❌ Test suite crashed:', error);
  process.exit(1);
});
