import { getTable } from './client';

export interface Thought {
  thoughtId: string;
  swarmId: string;
  content: string;
  created: string;
}

export async function getLastThoughts(count: number = 50): Promise<Thought[]> {
  const table = getTable('THOUGHTS');
  
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
}
