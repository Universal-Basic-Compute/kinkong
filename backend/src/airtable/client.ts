import Airtable from 'airtable';
import dotenv from 'dotenv';
import path from 'path';

// Add debug logging
console.log('⚙️ Initializing Airtable client...', {
  hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID,
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd(),
  envPath: path.resolve(process.cwd(), '.env')
});

// Load .env explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Check again after loading
console.log('After loading .env:', {
  hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID
});

// Check for required environment variables
if (!process.env.KINKONG_AIRTABLE_API_KEY) {
  throw new Error('KINKONG_AIRTABLE_API_KEY is not defined');
}

if (!process.env.KINKONG_AIRTABLE_BASE_ID) {
  throw new Error('KINKONG_AIRTABLE_BASE_ID is not defined');
}

// Configure Airtable client with additional logging
console.log('Configuring Airtable client...');
const base = new Airtable({
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY
}).base(process.env.KINKONG_AIRTABLE_BASE_ID);
console.log('Airtable client configured successfully');

// Add a test function to verify the client
export const testConnection = async () => {
  try {
    const table = base.table('Investments');
    await table.select().firstPage();
    console.log('Airtable connection test successful');
    return true;
  } catch (error) {
    console.error('Airtable connection test failed:', error);
    throw error;
  }
};

export const getTable = (tableName: string) => {
  console.log('Getting table:', tableName);
  return base.table(tableName);
};

export default base;
