import Airtable from 'airtable';

// Check for required environment variables
if (!process.env.AIRTABLE_API_KEY) {
  throw new Error('AIRTABLE_API_KEY is not defined in environment variables');
}

if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error('AIRTABLE_BASE_ID is not defined in environment variables');
}

// Configure Airtable client
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY})
             .base(process.env.AIRTABLE_BASE_ID as string);

export default base;
