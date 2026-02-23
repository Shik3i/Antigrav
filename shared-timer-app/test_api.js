const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('🚀 Starting Advanced Automated API tests...');

    // Load test definitions
    const testsPath = path.join(__dirname, 'tests', 'api_tests.json');
    if (!fs.existsSync(testsPath)) {
        console.error('❌ Error: api_tests.json not found!');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(testsPath, 'utf8'));
    const { baseUrl, tests } = config;

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        process.stdout.write(`Testing: ${test.name.padEnd(35)} `);

        try {
            const url = `${baseUrl}${test.endpoint}`;
            const options = {
                method: test.method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (test.body) {
                options.body = JSON.stringify(test.body);
            }

            const response = await fetch(url, options);
            const data = await response.json().catch(() => ({}));

            if (response.status !== test.expectedStatus) {
                throw new Error(`Expected status ${test.expectedStatus}, got ${response.status}`);
            }

            if (test.validate) {
                for (const key of test.validate) {
                    if (data[key] === undefined) {
                        throw new Error(`Missing required field in response: ${key}`);
                    }
                }
            }

            if (test.validateType === 'array' && !Array.isArray(data)) {
                throw new Error('Expected response to be an array');
            }

            console.log('✅ PASSED');
            passed++;
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            failed++;
        }
    }

    console.log('\n--- Test Summary ---');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
        process.exit(1);
    } else {
        console.log('\n✨ All automated tests passed!');
    }
}

runTests();
