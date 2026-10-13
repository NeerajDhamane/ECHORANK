import { z } from "zod";
import { getOwnedBrand } from "@/lib/brand-access";
import { authenticatedUser, readJson } from "@/lib/api-auth";
import { error, json } from "@/lib/http";
import { ALERT_TYPES, getAlertSettings, listAlerts, markAlertRead, updateAlertRule } from "@/lib/alerts";

type Context = { params: Promise<{ brandId: string }> };
const readSchema = z.object({ alertId: z.string().uuid(), read: z.boolean() }).strict();
const ruleSchema = z.object({ ruleId: z.string().uuid(), enabled: z.boolean(), threshold: z.number().min(0).max(100) }).strict();

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const alerts = listAlerts(brandId);
  const rules = getAlertSettings(brandId);
  return json({ alerts, rules });
}

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const { user, response } = await authenticatedUser();
  if (response || !user) return response ?? error("Authentication required.", 401);
  const { brandId } = await params;
  if (!getOwnedBrand(brandId, user.id)) return error("Brand not found.", 404);
  const body = await readJson(request);
  if (body.response) return body.response;
  const readUpdate = readSchema.safeParse(body.value);
  if (readUpdate.success) {
    if (!markAlertRead(brandId, readUpdate.data.alertId, readUpdate.data.read)) return error("Alert not found.", 404);
    return json({ ok: true });
  }
  const ruleUpdate = ruleSchema.safeParse(body.value);
  if (!ruleUpdate.success) return error("Invalid alert update.", 400);
  const rule = getAlertSettings(brandId).find((item) => item.id === ruleUpdate.data.ruleId);
  if (!rule || !ALERT_TYPES.includes(rule.type as typeof ALERT_TYPES[number])) return error("Alert rule not found.", 404);
  if (!updateAlertRule(brandId, rule.id, ruleUpdate.data.enabled, ruleUpdate.data.threshold)) return error("Alert rule not found.", 404);
  return json({ ok: true });
}
