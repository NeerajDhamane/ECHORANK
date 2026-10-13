export type DiscoveryFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type DiscoveryCredentials = { REDDIT_CLIENT_ID?: string; REDDIT_CLIENT_SECRET?: string };

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Discovery source returned HTTP ${response.status}`);
  return await response.json() as T;
}

export function toIsoDate(epoch: number | undefined, iso?: string): string | undefined {
  if (typeof epoch === "number" && Number.isFinite(epoch)) return new Date(epoch * 1000).toISOString();
  if (iso && Number.isFinite(Date.parse(iso))) return new Date(iso).toISOString();
  return undefined;
}

export const DISCOVERY_USER_AGENT = "EchoRank/1.0 (public discussion discovery; contact: support@echorank.local)";
