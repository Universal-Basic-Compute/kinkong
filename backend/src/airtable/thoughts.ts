import Airtable from 'airtable';

export interface Thought {
  thoughtId: string;
  swarmId: string;
  content: string;
  createdAt: string;
  type?: string;
  context?: string;
}

export interface CreateThoughtParams {
  type: string;
  content: string;
  context?: any;
}

export async function createThought(params: CreateThoughtParams): Promise<void> {
  if (!process.env.KINOS_AIRTABLE_API_KEY || !process.env.KINOS_AIRTABLE_BASE_ID) {
    throw new Error('Kinos Airtable configuration is missing');
  }

  const kinosBase = new Airtable({
    apiKey: process.env.KINOS_AIRTABLE_API_KEY
  }).base(process.env.KINOS_AIRTABLE_BASE_ID);

  try {
    const table = kinosBase.table('THOUGHTS');
    await table.create({
      thoughtId: `trade-${Date.now()}`,
      swarmId: 'kinkong',
      content: params.content,
      type: params.type,
      context: typeof params.context === 'string' ? params.context : JSON.stringify(params.context),
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating thought in Kinos Airtable:', error);
    throw error;
  }
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
    const table = kinosBase.table('THOUGHTS');
    
    const records = await table
      .select({
        maxRecords: count,
        filterByFormula: "{swarmId} = 'kinkong'",
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();

    return records.map(record => ({
      thoughtId: record.get('thoughtId') as string,
      swarmId: record.get('swarmId') as string,
      content: record.get('content') as string,
      createdAt: record.get('createdAt') as string
    }));
  } catch (error) {
    console.error('Error fetching thoughts from Kinos Airtable:', error);
    throw error;
  }
}
