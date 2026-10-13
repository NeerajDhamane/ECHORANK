import { cookies } from "next/headers";
import { authenticateUser, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { loginSchema } from "@/lib/auth-validation";
import { error, json } from "@/lib/http";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid request body.", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return error("Please provide a valid email and password.", 400);
  }

  try {
    const user = await authenticateUser(parsed.data.email, parsed.data.password);
    if (!user) {
      return error("Invalid email or password.", 401);
    }

    const token = await createSessionToken(user.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return json({ user });
  } catch {
    return error("Unable to sign in.", 500);
  }
}
