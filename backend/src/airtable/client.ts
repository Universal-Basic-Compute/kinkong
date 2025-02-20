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
  cwd: process.cwd()
});

if (!process.env.KINKONG_AIRTABLE_API_KEY) {
  throw new Error('KINKONG_AIRTABLE_API_KEY is not defined');
}

if (!process.env.KINKONG_AIRTABLE_BASE_ID) {
  throw new Error('KINKONG_AIRTABLE_BASE_ID is not defined');
}

export const base = new Airtable({
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY
}).base(process.env.KINKONG_AIRTABLE_BASE_ID);

export function testConnection() {
  try {
    const table = base.table('Investments');
    return table.select().firstPage();
  } catch (error) {
    console.error('Airtable connection test failed:', error);
    throw error;
  }
}
