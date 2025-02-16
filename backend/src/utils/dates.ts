export function parseAndFormatDate(input: unknown): string {
  try {
    // Handle different input types
    if (!input) {
      return new Date().toISOString();
    }

    // If already ISO string
    if (typeof input === 'string' && input.includes('T')) {
      return input;
    }

    // If Airtable date object
    if (input instanceof Date) {
      return input.toISOString();
    }

    // Try to parse string date
    const date = new Date(String(input));
    if (isNaN(date.getTime())) {
      console.warn('Invalid date input:', input);
      return new Date().toISOString();
    }

    return date.toISOString();
  } catch (error) {
    console.error('Date parsing error:', error, 'Input:', input);
    return new Date().toISOString();
  }
}
