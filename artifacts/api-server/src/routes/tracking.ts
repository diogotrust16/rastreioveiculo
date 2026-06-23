import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, positionsTable, clientsTable } from "@workspace/db";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/live", requireAuth, async (req: Request, res: Response) => {
  const isClient = req.user!.role === "CLIENT";
  const clientId = req.user!.clientId;

  const vehicles = isClient && clientId
    ? await db.select().from(vehiclesTable).where(eq(vehiclesTable.clientId, clientId)).orderBy(vehiclesTable.plate)
    : await db.select().from(vehiclesTable).orderBy(vehiclesTable.plate);

  const result = await Promise.all(
    vehicles.map(async (v) => {
      let clientName: string | null = null;
      if (v.clientId) {
        const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, v.clientId)).limit(1);
        clientName = c?.name ?? null;
      }
      const [pos] = await db
        .select()
        .from(positionsTable)
        .where(eq(positionsTable.vehicleId, v.id))
        .orderBy(desc(positionsTable.createdAt))
        .limit(1);

      if (!pos) return null;

      return {
        vehicleId: v.id,
        plate: v.plate,
        model: v.model,
        clientName,
        status: v.status,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed: pos.speed,
        ignition: pos.ignition,
        updatedAt: pos.createdAt,
      };
    })
  );

  res.json(result.filter(Boolean));
});

router.get("/history", requireAuth, async (req: Request, res: Response) => {
  const vehicleId = parseInt(req.query.vehicleId as string);
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  if (!vehicleId || isNaN(vehicleId)) {
    res.status(400).json({ error: "vehicleId is required" });
    return;
  }

  // CLIENT users can only view history of their own vehicles
  if (req.user!.role === "CLIENT" && req.user!.clientId) {
    const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId)).limit(1);
    if (!vehicle || vehicle.clientId !== req.user!.clientId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const conditions = [eq(positionsTable.vehicleId, vehicleId)];
  if (from) conditions.push(gte(positionsTable.createdAt, new Date(from)));
  if (to) conditions.push(lte(positionsTable.createdAt, new Date(to)));

  const positions = await db
    .select()
    .from(positionsTable)
    .where(and(...conditions))
    .orderBy(positionsTable.createdAt)
    .limit(2000);

  res.json(positions);
});

export default router;
