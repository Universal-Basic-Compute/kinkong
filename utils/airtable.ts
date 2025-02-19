export async function fetchAirtableData(table: string, options: {
  formula?: string;
  sort?: Array<{field: string; direction: 'asc' | 'desc'}>;
  maxRecords?: number;
} = {}) {
  try {
    const params = new URLSearchParams();
    if (options.formula) params.set('formula', options.formula);
    if (options.sort) params.set('sort', JSON.stringify(options.sort));
    if (options.maxRecords) params.set('maxRecords', options.maxRecords.toString());

    const response = await fetch(`/api/airtable/${table}?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch data');
    
    const data = await response.json();
    return data.records;
  } catch (error) {
    console.error('Error fetching Airtable data:', error);
    throw error;
  }
}
