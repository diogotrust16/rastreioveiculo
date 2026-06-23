import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, JWT_SECRET, type AuthPayload } from "../middlewares/auth";

const router = Router();

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "fleet-watch-refresh-secret-change-in-production";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role, clientId: user.clientId };
  const { accessToken, refreshToken } = generateTokens(payload);

  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId, createdAt: user.createdAt },
  });
});

router.post("/register", async (req: Request, res: Response) => {
  const { name, email, password, clientId } = req.body as { name: string; email: string; password: string; clientId?: number };
  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    name,
    email,
    password: hashed,
    role: "CLIENT",
    clientId: clientId ?? null,
  }).returning();

  const payload: AuthPayload = { userId: user.id, email: user.email, role: user.role, clientId: user.clientId };
  const { accessToken, refreshToken } = generateTokens(payload);

  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));

  res.status(201).json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId, createdAt: user.createdAt },
  });
});

router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };
  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token required" });
    return;
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!user || user.refreshToken !== refreshToken) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const newPayload: AuthPayload = { userId: user.id, email: user.email, role: user.role, clientId: user.clientId };
  const tokens = generateTokens(newPayload);

  await db.update(usersTable).set({ refreshToken: tokens.refreshToken }).where(eq(usersTable.id, user.id));

  res.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId, createdAt: user.createdAt },
  });
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId, createdAt: user.createdAt });
});

export default router;
