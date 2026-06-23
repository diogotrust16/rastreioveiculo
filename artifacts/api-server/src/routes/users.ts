import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import bcrypt from "bcrypt";

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      clientId: usersTable.clientId,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.name);

  res.json(users);
});

router.post("/", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { name, email, password, role, clientId } = req.body as {
    name: string; email: string; password: string;
    role?: "ADMIN" | "CLIENT"; clientId?: number | null;
  };

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email já está em uso" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, password: hashed, role: role ?? "CLIENT", clientId: clientId ?? null })
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, clientId: usersTable.clientId, createdAt: usersTable.createdAt });

  res.status(201).json(user);
});

router.put("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { name, email, password, role, clientId } = req.body as {
    name: string; email: string; password?: string;
    role?: "ADMIN" | "CLIENT"; clientId?: number | null;
  };

  const updates: Partial<typeof usersTable.$inferInsert> = { name, email, role: role ?? "CLIENT", clientId: clientId ?? null };
  if (password) {
    updates.password = await bcrypt.hash(password, 10);
  }

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, clientId: usersTable.clientId, createdAt: usersTable.createdAt });

  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  res.json(user);
});

router.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).end();
});

export default router;
