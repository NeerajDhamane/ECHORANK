export type ProviderOptions = {
  locale?: string;
  brandName?: string;
  date?: string;
};

export interface AIProvider {
  id: string;
  label: string;
  isMock: boolean;
  run(prompt: string, opts?: ProviderOptions): Promise<string>;
}

export class ProviderHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ProviderHttpError";
  }
}
