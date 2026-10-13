export type DiscoveryHit = {
  title: string;
  url: string;
  community?: string;
  score: number;
  comments: number;
  createdAt?: string;
  text?: string;
};

export interface DiscoverySource {
  id: "hn" | "stackexchange" | "reddit";
  search(query: string): Promise<DiscoveryHit[]>;
}

export type DiscoveryItem = {
  id: string; promptId: string | null; platform: string; title: string; url: string;
  subreddit: string | null; score: number; numComments: number; relevance: number;
  status: "new" | "saved" | "dismissed"; foundAt: string;
};
