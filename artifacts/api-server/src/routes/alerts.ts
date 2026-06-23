import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { alertsTable, vehiclesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const unreadOnly = req.query.unreadOnly === "true";
  
  const alerts = await db
    .select()
    .from(alertsTable)
    .orderBy(desc(alertsTable.createdAt))
    .limit(200);

  const filtered = unreadOnly ? alerts.filter((a) => !a.read) : alerts;

  const result = await Promise.all(
    filtered.map(async (a) => {
      const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, a.vehicleId)).limit(1);
      return { ...a, vehiclePlate: vehicle?.plate ?? null };
    })
  );

  res.json(result);
});

router.patch("/:id/read", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const [alert] = await db
    .update(alertsTable)
    .set({ read: true })
    .where(eq(alertsTable.id, id))
    .returning();

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, alert.vehicleId)).limit(1);
  res.json({ ...alert, vehiclePlate: vehicle?.plate ?? null });
});

export default router;
