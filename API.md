# EchoRank API v1

Programmatic endpoints accept `Authorization: Bearer er_…`. Create a key from a signed-in Developer page; plaintext is returned once. Revocation is immediate. All brand routes return `404` for brands outside the authenticated user's workspace.

## REST endpoints

| Method | Path | Result |
|---|---|---|
| GET | `/api/v1/brands` | `{ brands: [...] }` |
| GET | `/api/v1/brands/{brandId}/overview?range=30d` | Overview metrics; defaults to 30 days and excludes simulated data |
| GET / POST | `/api/v1/brands/{brandId}/prompts` | Prompt list and topics; create with `{ "text": "...", "topicId": null, "locale": "global" }` |
| POST | `/api/v1/brands/{brandId}/track` | `202 { runId, totalExpected, status, hasSimulated }` |
| GET | `/api/v1/runs/{runId}` | Status and answer counts for an owned run |
| GET | `/api/v1/brands/{brandId}/chats` | Paginated answer records; accepts overview filters plus `page`, `limit`, `mentioned`, `sentiment`, and `search` |
| GET | `/api/v1/brands/{brandId}/sources` | Cited-source summary |
| GET | `/api/v1/brands/{brandId}/gaps` | Prompt-level competitor gap opportunities |
| GET | `/api/v1/brands/{brandId}/recommendations` | Evidence-backed recommendations; `includeDone=true` includes completed items |

Errors use `{ "error": "..." }`. Invalid input returns `400`, missing/foreign brands and runs return `404`, unauthenticated or revoked credentials return `401`, and the API-key daily tracking limit returns `429`. Tracking initiated by an API key is limited to five runs per UTC day. Session-cookie auth is also accepted by REST v1; MCP requires an API key.

## MCP

Streamable HTTP endpoint: `/api/mcp`. Tools: `list_brands`, `get_overview`, `add_prompt`, `run_tracking`, `get_gap_opportunities`, and `get_recommendations`. Every tool rechecks brand ownership. There is no delete tool. Tracking is limited to five runs per key per UTC day.

### Claude Code

```sh
claude mcp add --transport http echorank https://YOUR_HOST/api/mcp --header "Authorization: Bearer er_YOUR_KEY"
```

### Cursor

```json
{
  "mcpServers": {
    "echorank": {
      "url": "https://YOUR_HOST/api/mcp",
      "headers": { "Authorization": "Bearer er_YOUR_KEY" }
    }
  }
}
```
