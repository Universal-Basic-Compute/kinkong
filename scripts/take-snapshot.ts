import { recordPortfolioSnapshot } from '../backend/src/strategy/snapshots';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
console.log('🔧 Initializing environment...');
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });
console.log('📁 Environment path:', envPath);
console.log('✅ Environment loaded:', {
  hasAirtableKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasAirtableBase: !!process.env.KINKONG_AIRTABLE_BASE_ID,
  envPath
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
