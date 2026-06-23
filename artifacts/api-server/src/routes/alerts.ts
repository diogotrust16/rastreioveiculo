import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { alertsTable, vehiclesTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getClientVehicleIds(clientId: number): Promise<number[]> {
  const vehicles = await db.select({ id: vehiclesTable.id }).from(vehiclesTable).where(eq(vehiclesTable.clientId, clientId));
  return vehicles.map(v => v.id);
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const unreadOnly = req.query.unreadOnly === "true";
  const isClient = req.user!.role === "CLIENT";
  const clientId = req.user!.clientId;

  let alerts;
  if (isClient && clientId) {
    const vehicleIds = await getClientVehicleIds(clientId);
    if (vehicleIds.length === 0) {
      res.json([]);
      return;
    }
    alerts = await db
      .select()
      .from(alertsTable)
      .where(inArray(alertsTable.vehicleId, vehicleIds))
      .orderBy(desc(alertsTable.createdAt))
      .limit(200);
  } else {
    alerts = await db
      .select()
      .from(alertsTable)
      .orderBy(desc(alertsTable.createdAt))
      .limit(200);
  }

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

  // CLIENT users can only mark their own vehicles' alerts
  if (req.user!.role === "CLIENT" && req.user!.clientId) {
    const [alert] = await db.select().from(alertsTable).where(eq(alertsTable.id, id)).limit(1);
    if (alert) {
      const vehicleIds = await getClientVehicleIds(req.user!.clientId);
      if (!vehicleIds.includes(alert.vehicleId)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
  }

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
