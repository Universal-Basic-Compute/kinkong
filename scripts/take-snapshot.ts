import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { recordPortfolioSnapshot } from '../backend/src/strategy/snapshots.js';
import { testConnection } from '../backend/src/airtable/client.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force load the .env file from the project root
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

console.log('🔧 Environment setup:', {
    projectRoot,
    envPath,
    exists: fs.existsSync(envPath)
});

// Force load the .env file
const envConfig = dotenv.config({ 
    path: envPath,
    override: true
});

if (envConfig.error) {
    console.error('❌ Failed to load .env file:', envConfig.error);
    process.exit(1);
}

// Log loaded variables (without exposing values)
console.log('📝 Loaded environment variables:', {
    KINKONG_AIRTABLE_API_KEY: process.env.KINKONG_AIRTABLE_API_KEY ? '✅ Present' : '❌ Missing',
    KINKONG_AIRTABLE_BASE_ID: process.env.KINKONG_AIRTABLE_BASE_ID ? '✅ Present' : '❌ Missing',
    parsed: envConfig.parsed ? Object.keys(envConfig.parsed) : []
});

async function main() {
    try {
        // Check environment variables
        const airtableKey = process.env.KINKONG_AIRTABLE_API_KEY;
        const airtableBase = process.env.KINKONG_AIRTABLE_BASE_ID;
        
        console.log('Checking Airtable configuration:', {
            apiKey: airtableKey ? '✅ Present' : '❌ Missing',
            baseId: airtableBase ? '✅ Present' : '❌ Missing'
        });

        if (!airtableKey || !airtableBase) {
            throw new Error('Required environment variables are missing');
        }

        // Test Airtable connection
        console.log('Testing Airtable connection...');
        await testConnection();

        console.log('📸 Starting manual snapshot...');
        const result = await recordPortfolioSnapshot();
        console.log('✅ Snapshot completed:', {
            totalValue: result.totalValue,
            snapshotsCount: result.snapshots.length
        });
    } catch (error) {
        console.error('❌ Snapshot failed:', error);
        process.exit(1);
    }
}

main();
