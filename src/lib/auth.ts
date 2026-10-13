import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const PASSWORD_COST = 12;
const DUMMY_PASSWORD_HASH = "$2b$12$zqzwls3mdH/61ctQnxJNM.emO7/VLggafDvZnNP1Pwv1IM5eFnMbS";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export const SESSION_COOKIE_NAME = "echorank_session";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("Email address is already registered.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_COST);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).get();
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  const user: PublicUser = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
  };
  const passwordHash = await hashPassword(input.password);

  try {
    db.insert(users).values({ ...user, passwordHash }).run();
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("UNIQUE constraint failed: users.email")) {
      throw new EmailAlreadyRegisteredError();
    }
    throw cause;
  }

  return user;
}

export async function authenticateUser(email: string, password: string): Promise<PublicUser | null> {
  const user = db.select().from(users).where(eq(users.email, email)).get();
  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    return null;
  }

  return { id: user.id, name: user.name, email: user.email };
}

export async function createSessionToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_DURATION_SECONDS)
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
