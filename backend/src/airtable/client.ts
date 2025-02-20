const Airtable = require('airtable');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Add debug logging
console.log('⚙️ Initializing Airtable client...', {
  hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID,
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd(),
  envPath: path.resolve(process.cwd(), '.env')
});

// Add retry logic for environment variables
let retries = 0;
const maxRetries = 3;

while (!process.env.KINKONG_AIRTABLE_API_KEY && retries < maxRetries) {
  console.log(`Retrying environment load attempt ${retries + 1}/${maxRetries}...`);
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  retries++;
  
  // Small delay between retries
  if (retries < maxRetries) {
    require('node:timers/promises').setTimeout(1000);
  }
}

if (!process.env.KINKONG_AIRTABLE_API_KEY) {
  console.error('Failed to load KINKONG_AIRTABLE_API_KEY from:', {
    envPath: path.resolve(process.cwd(), '.env'),
    availableEnvVars: Object.keys(process.env).filter(key => key.includes('KINKONG'))
  });
  throw new Error('KINKONG_AIRTABLE_API_KEY is not defined');
}

if (!process.env.KINKONG_AIRTABLE_BASE_ID) {
  console.error('Failed to load KINKONG_AIRTABLE_BASE_ID from:', {
    envPath: path.resolve(process.cwd(), '.env'),
    availableEnvVars: Object.keys(process.env).filter(key => key.includes('KINKONG'))
  });
  throw new Error('KINKONG_AIRTABLE_BASE_ID is not defined');
}

console.log('Configuring Airtable client...');
const base = new Airtable({
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY
}).base(process.env.KINKONG_AIRTABLE_BASE_ID);
console.log('Airtable client configured successfully');

function testConnection() {
  try {
    const table = base.table('Investments');
    return table.select().firstPage();
  } catch (error) {
    console.error('Airtable connection test failed:', error);
    throw error;
  }
}

function getTable(tableName) {
  console.log('Getting table:', tableName);
  return base.table(tableName);
}

module.exports = { base, testConnection, getTable };
