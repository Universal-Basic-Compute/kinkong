import { recordPortfolioSnapshot } from '../backend/src/strategy/snapshots';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables with debug info
console.log('🔧 Starting environment setup...');
console.log('Current working directory:', process.cwd());
const envPath = path.resolve(process.cwd(), '.env');
console.log('Looking for .env at:', envPath);

// Check if .env file exists
if (fs.existsSync(envPath)) {
    console.log('.env file found');
} else {
    console.error('❌ .env file not found!');
    process.exit(1);
}

const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('❌ Error loading .env:', result.error);
    process.exit(1);
}

// Log environment status
console.log('Environment variables loaded:', {
    hasAirtableKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
    hasAirtableBase: !!process.env.KINKONG_AIRTABLE_BASE_ID,
    keyLength: process.env.KINKONG_AIRTABLE_API_KEY?.length || 0,
    baseIdLength: process.env.KINKONG_AIRTABLE_BASE_ID?.length || 0
});

async function main() {
  try {
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
