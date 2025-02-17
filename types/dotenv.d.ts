declare module 'dotenv' {
  export interface DotenvConfigOutput {
    error?: Error;
    parsed?: { [key: string]: string };
  }

  export function config(options?: {
    path?: string;
    encoding?: string;
    debug?: boolean;
    override?: boolean;
  }): DotenvConfigOutput;
}
