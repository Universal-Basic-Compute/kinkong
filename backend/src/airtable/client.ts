import Airtable from 'airtable';

// Configure Airtable client
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY})
             .base(process.env.AIRTABLE_BASE_ID);

export default base;
