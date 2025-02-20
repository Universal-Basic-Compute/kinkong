const Airtable = require('airtable');

console.log('⚙️ Initializing Airtable client...', {
  hasApiKey: !!process.env.KINKONG_AIRTABLE_API_KEY,
  hasBaseId: !!process.env.KINKONG_AIRTABLE_BASE_ID,
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd(),
});

if (!process.env.KINKONG_AIRTABLE_API_KEY) {
  throw new Error('KINKONG_AIRTABLE_API_KEY is not defined');
}

if (!process.env.KINKONG_AIRTABLE_BASE_ID) {
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
