import Airtable from 'airtable';

console.log('Initializing Airtable client...', {
  hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID
});

// Check for required environment variables
if (!process.env.KINKONG_AIRTABLE_API_KEY) {
  throw new Error('KINKONG_AIRTABLE_API_KEY is not defined in environment variables');
}

if (!process.env.KINKONG_AIRTABLE_BASE_ID) {
  throw new Error('KINKONG_AIRTABLE_BASE_ID is not defined in environment variables');
}

// Configure Airtable client
const base = new Airtable({
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY
}).base(process.env.KINKONG_AIRTABLE_BASE_ID);

// Add a test function to verify the client
export const testConnection = async () => {
  try {
    const table = base('INVESTMENTS');
    await table.select().firstPage();
    console.log('Airtable connection test successful');
    return true;
  } catch (error) {
    console.error('Airtable connection test failed:', error);
    throw error;
  }
};

export const getTable = (tableName: string) => base(tableName);

export default base;
