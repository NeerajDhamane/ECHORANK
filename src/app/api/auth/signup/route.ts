import { cookies } from "next/headers";
import { EmailAlreadyRegisteredError, createSessionToken, getAuthSecret, registerUser, SESSION_COOKIE_NAME } from "@/lib/auth";
import { signupSchema } from "@/lib/auth-validation";
import { error, json } from "@/lib/http";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid request body.", 400);
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return error("Please provide a name, valid email, and password of at least 8 characters.", 400);
  }

  try {
    getAuthSecret();
    const user = await registerUser(parsed.data);
    const token = await createSessionToken(user.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return json({ user }, 201);
  } catch (cause) {
    if (cause instanceof EmailAlreadyRegisteredError) {
      return error("An account with that email already exists.", 409);
    }
    return error("Unable to create account.", 500);
  }
}
