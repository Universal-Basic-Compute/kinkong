import Airtable from 'airtable';

// Check for required environment variables
if (!process.env.KINOS_AIRTABLE_API_KEY) {
  throw new Error('KINOS_AIRTABLE_API_KEY is not defined in environment variables');
}

if (!process.env.KINOS_AIRTABLE_BASE_ID) {
  throw new Error('KINOS_AIRTABLE_BASE_ID is not defined in environment variables');
}

// Configure Airtable client
const base = new Airtable({apiKey: process.env.KINOS_AIRTABLE_API_KEY})
             .base(process.env.KINOS_AIRTABLE_BASE_ID as string);

export const getTable = (tableName: string) => base(tableName);

export default base;
