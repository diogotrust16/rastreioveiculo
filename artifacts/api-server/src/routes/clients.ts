import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { clientsTable, vehiclesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const clients = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      document: clientsTable.document,
      phone: clientsTable.phone,
      vehicleCount: sql<number>`COUNT(${vehiclesTable.id})::int`,
      createdAt: clientsTable.createdAt,
    })
    .from(clientsTable)
    .leftJoin(vehiclesTable, eq(vehiclesTable.clientId, clientsTable.id))
    .groupBy(clientsTable.id)
    .orderBy(clientsTable.name);

  res.json(clients);
});

router.post("/", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { name, document, phone } = req.body as { name: string; document?: string; phone?: string };
  if (!name) {
    res.status(400).json({ error: "Name required" });
    return;
  }

  const [client] = await db.insert(clientsTable).values({ name, document: document ?? null, phone: phone ?? null }).returning();
  res.status(201).json({ ...client, vehicleCount: 0 });
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const [client] = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      document: clientsTable.document,
      phone: clientsTable.phone,
      vehicleCount: sql<number>`COUNT(${vehiclesTable.id})::int`,
      createdAt: clientsTable.createdAt,
    })
    .from(clientsTable)
    .leftJoin(vehiclesTable, eq(vehiclesTable.clientId, clientsTable.id))
    .where(eq(clientsTable.id, id))
    .groupBy(clientsTable.id);

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(client);
});

router.put("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { name, document, phone } = req.body as { name: string; document?: string; phone?: string };

  const [client] = await db
    .update(clientsTable)
    .set({ name, document: document ?? null, phone: phone ?? null })
    .where(eq(clientsTable.id, id))
    .returning();

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json({ ...client, vehicleCount: 0 });
});

router.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  await db.delete(clientsTable).where(eq(clientsTable.id, id));
  res.status(204).end();
});

export default router;
