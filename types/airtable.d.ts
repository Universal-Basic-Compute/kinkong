declare module 'airtable' {
  export interface FieldSet {
    [key: string]: any;
  }

  export interface Record<TFields extends FieldSet> {
    id: string;
    fields: TFields;
    get(columnName: string): any;
  }

  export interface Table<TFields extends FieldSet> {
    select(params?: {
      view?: string;
      filterByFormula?: string;
      maxRecords?: number;
      pageSize?: number;
      sort?: Array<{field: string; direction: 'asc' | 'desc'}>;
    }): Query<TFields>;
    find(id: string): Promise<Record<TFields>>;
    create(records: Array<{fields: Partial<TFields>}>): Promise<Array<Record<TFields>>>;
    update(recordId: string, fields: Partial<TFields>): Promise<Record<TFields>>;
    destroy(ids: string[]): Promise<Array<Record<TFields>>>;
  }

  export interface Query<TFields extends FieldSet> {
    all(): Promise<Array<Record<TFields>>>;
    firstPage(): Promise<Array<Record<TFields>>>;
  }

  export default class Airtable {
    constructor(config: { apiKey: string });
    base(baseId: string): {
      table(tableName: string): Table<any>;
    };
  }
}
