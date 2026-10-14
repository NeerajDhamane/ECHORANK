import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  getOwnedBrand: vi.fn(),
  getRunStatus: vi.fn(),
  createUserApiKey: vi.fn(),
  listUserApiKeys: vi.fn(),
}));

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    authenticatedUser: mocks.authenticatedUser,
    readJson: async (request: Request) => {
      try { return { value: await request.json(), response: null }; }
      catch { return { value: null, response: Response.json({ error: "Invalid request body." }, { status: 400 }) }; }
    },
  };
});
vi.mock("@/lib/brand-access", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/brand-access")>(),
  getOwnedBrand: mocks.getOwnedBrand,
}));
vi.mock("@/lib/tracking", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/tracking")>(),
  getRunStatus: mocks.getRunStatus,
}));
vi.mock("@/lib/api-keys", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api-keys")>(),
  createUserApiKey: mocks.createUserApiKey,
  listUserApiKeys: mocks.listUserApiKeys,
}));

type Context = { params: Promise<Record<string, string>> };
type Handler = (request: Request, context: Context) => Promise<Response>;
type RouteModule = Partial<Record<"GET" | "POST" | "PATCH" | "DELETE", Handler>>;

const routeModules = {
  ...import.meta.glob<RouteModule>("/src/app/api/brands/**/route.ts", { eager: true }),
  ...import.meta.glob<RouteModule>("/src/app/api/v1/brands/**/route.ts", { eager: true }),
  ...import.meta.glob<RouteModule>("/src/app/api/runs/**/route.ts", { eager: true }),
  ...import.meta.glob<RouteModule>("/src/app/api/v1/runs/**/route.ts", { eager: true }),
};

const brandScopedRoutes = Object.entries(routeModules).filter(([path]) =>
  path.includes("/api/brands/[brandId]/") || path.includes("/api/v1/brands/[brandId]/") || path.includes("/api/runs/") || path.includes("/api/v1/runs/"),
);
const routeMethods = ["GET", "POST", "PATCH", "DELETE"] as const;

function makeParams(path: string): Record<string, string> {
  return Object.fromEntries([...path.matchAll(/\[([^\]]+)\]/gu)].map((match) => [match[1]!, `foreign-${match[1]}`]));
}

describe("brand-scoped API ownership boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a", name: "A", email: "a@example.test" }, response: null });
    mocks.getOwnedBrand.mockReturnValue(null);
    mocks.getRunStatus.mockImplementation((runId: string) => ({ runId, brandId: "foreign-brand", status: "completed", startedAt: "2026-10-14 00:00:00", finishedAt: "2026-10-14 00:00:01", totalExpected: 1, completed: 1, simulatedCount: 1 }));
  });

  it.each(brandScopedRoutes.flatMap(([path, module]) => routeMethods.flatMap((method) => {
    const handler = module[method];
    return handler ? [{ path, method, handler }] : [];
  }))) ("returns 404 for a foreign brand: $method $path", async ({ path, method, handler }) => {
    const params = makeParams(path);
    const routePath = path.replace(/^\/src/u, "").replace(/\/route\.ts$/u, "").replace(/\[([^\]]+)\]/gu, (_match, name: string) => params[name] ?? "");
    const url = new URL(routePath, "https://echorank.test");
    if (routePath.endsWith("/export.csv")) url.searchParams.set("table", "chats");
    const hasBody = method !== "GET";
    const request = new Request(url, { method, ...(hasBody ? { headers: { "content-type": "application/json" }, body: "{}" } : {}) });
    const response = await handler(request, { params: Promise.resolve(params) });

    expect(response.status).toBe(404);
    expect(mocks.getOwnedBrand).toHaveBeenCalledWith(params.brandId ?? "foreign-brand", "user-a");
  });
});

describe("API-key response serialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a", name: "A", email: "a@example.test" }, response: null });
  });

  it("lists metadata without the plaintext key or its stored hash", async () => {
    mocks.listUserApiKeys.mockReturnValue([{ id: "key-1", label: "CLI", createdAt: "2026-10-14 00:00:00", lastUsedAt: null }]);
    const { GET } = await import("@/app/api/keys/route");
    const response = await GET();
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).not.toContain("one-time-plaintext-token");
    expect(body).not.toContain("stored-sha256-hash");
    expect(body).not.toContain("keyHash");
  });

  it("returns a new key once without serializing the stored hash", async () => {
    mocks.createUserApiKey.mockReturnValue({ id: "key-1", label: "CLI", token: "one-time-plaintext-token", keyHash: "stored-sha256-hash" });
    const { POST } = await import("@/app/api/keys/route");
    const response = await POST(new Request("https://echorank.test/api/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "CLI" }) }));
    const body = await response.text();
    expect(response.status).toBe(201);
    expect(body).toContain("one-time-plaintext-token");
    expect(body).not.toContain("stored-sha256-hash");
    expect(body).not.toContain("keyHash");
  });
});
