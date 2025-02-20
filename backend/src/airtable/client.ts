const Airtable = require('airtable');

console.log('⚙️ Initializing Airtable client...', {
  hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID,
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd(),
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
const testConnection = async () => {
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

const getTable = (tableName) => {
  console.log('Getting table:', tableName);
  return base.table(tableName);
};

module.exports = {
  default: base,
  testConnection,
  getTable
};
