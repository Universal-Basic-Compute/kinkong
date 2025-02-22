import Airtable from 'airtable';

if (!process.env.KINKONG_AIRTABLE_API_KEY || !process.env.KINKONG_AIRTABLE_BASE_ID) {
  throw new Error('Airtable configuration is missing');
}

export const base = new Airtable({ 
  apiKey: process.env.KINKONG_AIRTABLE_API_KEY 
}).base(process.env.KINKONG_AIRTABLE_BASE_ID);

export function getTable(tableName: string) {
  if (!tableName) {
    throw new Error('Table name is required');
  }
  return base.table(tableName);
}
