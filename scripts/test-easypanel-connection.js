#!/usr/bin/env node

/**
 * Test Easypanel Connection Script
 * 
 * This script tests the connection to an Easypanel instance
 * to help debug connection issues.
 * 
 * Usage:
 *   node scripts/test-easypanel-connection.js <API_URL> <API_KEY>
 * 
 * Example:
 *   node scripts/test-easypanel-connection.js https://v1lkkr.easypanel.host YOUR_API_KEY
 */

import fetch from 'node-fetch';

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/test-easypanel-connection.js <API_URL> <API_KEY>');
  console.error('Example: node scripts/test-easypanel-connection.js https://v1lkkr.easypanel.host YOUR_API_KEY');
  process.exit(1);
}

const [apiUrl, apiKey] = args;

console.log('='.repeat(80));
console.log('Easypanel Connection Test');
console.log('='.repeat(80));
console.log();

// Normalize URL
let baseUrl = apiUrl.replace(/\/+$/, '').replace(/\/api\/trpc$/, '');
console.log('Input URL:', apiUrl);
console.log('Normalized Base URL:', baseUrl);
console.log('API Key:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));
console.log();

// Test endpoints to try
const endpoints = [
  'projects.listProjects',
  'auth.getUser',
];

async function testEndpoint(endpoint, method = 'GET') {
  const testUrl = `${baseUrl}/api/trpc/${endpoint}`;
  
  console.log('-'.repeat(80));
  console.log(`Testing: ${method} ${testUrl}`);
  console.log('-'.repeat(80));
  
  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    };
    
    console.log('Request Headers:');
    console.log(JSON.stringify(options.headers, null, 2));
    console.log();
    
    const startTime = Date.now();
    const response = await fetch(testUrl, options);
    const endTime = Date.now();
    
    console.log(`Response Time: ${endTime - startTime}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response Headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    console.log();
    
    const contentType = response.headers.get('content-type');
    let responseBody;
    
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
      console.log('Response Body (JSON):');
      console.log(JSON.stringify(responseBody, null, 2));
    } else {
      responseBody = await response.text();
      console.log('Response Body (Text):');
      console.log(responseBody);
    }
    console.log();
    
    if (response.ok) {
      console.log('✅ SUCCESS: Connection test passed');
      return { success: true, data: responseBody };
    } else {
      console.log('❌ FAILED: Connection test failed');
      return { success: false, status: response.status, error: responseBody };
    }
  } catch (error) {
    console.log('❌ ERROR: Connection test threw an exception');
    console.error('Error Details:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.cause) {
      console.error('Error Cause:', error.cause);
    }
    return { success: false, error: error.message };
  }
}

async function testWithQueryParams(endpoint) {
  const testUrl = `${baseUrl}/api/trpc/${endpoint}`;
  const params = new URLSearchParams();
  params.append('input', JSON.stringify({ json: {} }));
  const fullUrl = `${testUrl}?${params.toString()}`;
  
  console.log('-'.repeat(80));
  console.log(`Testing with Query Params: GET ${fullUrl}`);
  console.log('-'.repeat(80));
  
  try {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    };
    
    console.log('Request Headers:');
    console.log(JSON.stringify(options.headers, null, 2));
    console.log();
    
    const startTime = Date.now();
    const response = await fetch(fullUrl, options);
    const endTime = Date.now();
    
    console.log(`Response Time: ${endTime - startTime}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response Headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    console.log();
    
    const contentType = response.headers.get('content-type');
    let responseBody;
    
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
      console.log('Response Body (JSON):');
      console.log(JSON.stringify(responseBody, null, 2));
    } else {
      responseBody = await response.text();
      console.log('Response Body (Text):');
      console.log(responseBody);
    }
    console.log();
    
    if (response.ok) {
      console.log('✅ SUCCESS: Connection test with query params passed');
      return { success: true, data: responseBody };
    } else {
      console.log('❌ FAILED: Connection test with query params failed');
      return { success: false, status: response.status, error: responseBody };
    }
  } catch (error) {
    console.log('❌ ERROR: Connection test threw an exception');
    console.error('Error Details:', error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('Starting connection tests...');
  console.log();
  
  const results = [];
  
  // Test each endpoint with GET
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint, 'GET');
    results.push({ endpoint, method: 'GET', ...result });
    console.log();
  }
  
  // Test projects.listProjects with query params
  const queryParamResult = await testWithQueryParams('projects.listProjects');
  results.push({ endpoint: 'projects.listProjects', method: 'GET with query params', ...queryParamResult });
  console.log();
  
  // Summary
  console.log('='.repeat(80));
  console.log('Test Summary');
  console.log('='.repeat(80));
  console.log();
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log();
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${result.method} ${result.endpoint}`);
    if (!result.success) {
      if (result.status) {
        console.log(`   Status: ${result.status}`);
      }
      if (result.error) {
        console.log(`   Error: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`);
      }
    }
  });
  console.log();
  
  // Recommendations
  console.log('='.repeat(80));
  console.log('Recommendations');
  console.log('='.repeat(80));
  console.log();
  
  if (successCount === 0) {
    console.log('❌ All tests failed. Possible issues:');
    console.log('   1. Invalid API key - verify the key is correct');
    console.log('   2. Network connectivity - ensure the Easypanel instance is reachable');
    console.log('   3. Firewall/security - check if requests are being blocked');
    console.log('   4. SSL/TLS issues - verify certificate validity');
  } else if (successCount < results.length) {
    console.log('⚠️  Some tests passed, some failed. Possible issues:');
    console.log('   1. Specific endpoints may not exist or require different parameters');
    console.log('   2. API version differences');
    console.log('   3. Permission issues with the API key');
  } else {
    console.log('✅ All tests passed! The connection is working correctly.');
    console.log('   If you\'re still experiencing issues in the application:');
    console.log('   1. Check application logs for additional errors');
    console.log('   2. Verify the configuration is saved correctly in the database');
    console.log('   3. Ensure the API key encryption/decryption is working');
  }
  console.log();
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
