import Airtable from 'airtable';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Add debug logging
console.log('⚙️ Initializing Airtable client...', {
  hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID,
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd(),
  envPath: path.resolve(process.cwd(), '.env')
});

if (!process.env.KINKONG_AIRTABLE_API_KEY) {
  throw new Error('KINKONG_AIRTABLE_API_KEY is not defined');
}

if (!process.env.KINKONG_AIRTABLE_BASE_ID) {
  throw new Error('KINKONG_AIRTABLE_BASE_ID is not defined');
}

// Initialize Airtable with explicit configuration
const airtableConfig = {
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY,
  endpointUrl: 'https://api.airtable.com',
};

console.log('Creating Airtable base instance...', {
  baseId: process.env.KINKONG_AIRTABLE_BASE_ID
});

export const base = new Airtable(airtableConfig).base(process.env.KINKONG_AIRTABLE_BASE_ID);

// Add a test function to verify connection
export async function testConnection() {
  try {
    console.log('Testing Airtable connection...');
    const table = base.table('PORTFOLIO');
    const records = await table.select().firstPage();
    console.log(`✅ Connection successful. Found ${records.length} records in PORTFOLIO table`);
    return true;
  } catch (error) {
    console.error('❌ Airtable connection test failed:', error);
    throw error;
  }
}
