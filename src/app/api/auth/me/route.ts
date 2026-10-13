import { getCurrentUser } from "@/lib/require-auth";
import { error, json } from "@/lib/http";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return error("Unauthenticated.", 401);
  }
  return json({ user });
}
