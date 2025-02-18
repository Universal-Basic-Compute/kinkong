import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

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
    override: true // This forces override of any existing env vars
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

// Only proceed with imports after env is loaded
import { recordPortfolioSnapshot } from '../backend/src/strategy/snapshots';

async function main() {
    try {
        if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
            throw new Error('Required environment variables are missing');
        }
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
