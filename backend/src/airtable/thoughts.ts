import Airtable from 'airtable';

export interface Thought {
  thoughtId: string;
  swarmId: string;
  content: string;
  created: string;
}

export async function getLastThoughts(count: number = 50): Promise<Thought[]> {
  if (!process.env.KINOS_AIRTABLE_API_KEY || !process.env.KINOS_AIRTABLE_BASE_ID) {
    throw new Error('Kinos Airtable configuration is missing');
  }

  // Create a separate base instance for Kinos
  const kinosBase = new Airtable({
    apiKey: process.env.KINOS_AIRTABLE_API_KEY
  }).base(process.env.KINOS_AIRTABLE_BASE_ID);

  try {
    const table = kinosBase('THOUGHTS');
    
    const records = await table
      .select({
        maxRecords: count,
        filterByFormula: "{swarmId} = 'kinkong'",
        sort: [{ field: 'created', direction: 'desc' }]
      })
      .all();

    return records.map(record => ({
      thoughtId: record.get('thoughtId') as string,
      swarmId: record.get('swarmId') as string,
      content: record.get('content') as string,
      created: record.get('created') as string
    }));
  } catch (error) {
    console.error('Error fetching thoughts from Kinos Airtable:', error);
    throw error;
  }
}
