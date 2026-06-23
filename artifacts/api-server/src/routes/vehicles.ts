import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, clientsTable, positionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

async function getVehicleWithDetails(id: number) {
  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id)).limit(1);
  if (!vehicle) return null;

  let clientName: string | null = null;
  if (vehicle.clientId) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, vehicle.clientId)).limit(1);
    clientName = client?.name ?? null;
  }

  const [lastPosition] = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.vehicleId, id))
    .orderBy(desc(positionsTable.createdAt))
    .limit(1);

  return { ...vehicle, clientName, lastPosition: lastPosition ?? null };
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
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
      const [lastPos] = await db
        .select()
        .from(positionsTable)
        .where(eq(positionsTable.vehicleId, v.id))
        .orderBy(desc(positionsTable.createdAt))
        .limit(1);
      return { ...v, clientName, lastPosition: lastPos ?? null };
    })
  );

  res.json(result);
});

router.post("/", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { plate, model, imei, clientId } = req.body as { plate: string; model: string; imei: string; clientId?: number };
  if (!plate || !model || !imei) {
    res.status(400).json({ error: "Plate, model, and IMEI required" });
    return;
  }

  const [vehicle] = await db
    .insert(vehiclesTable)
    .values({ plate, model, imei, clientId: clientId ?? null })
    .returning();

  res.status(201).json({ ...vehicle, clientName: null, lastPosition: null });
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const vehicle = await getVehicleWithDetails(id);
  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  // CLIENT users can only view their own vehicles
  if (req.user!.role === "CLIENT" && vehicle.clientId !== req.user!.clientId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(vehicle);
});

router.put("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { plate, model, imei, clientId } = req.body as { plate: string; model: string; imei: string; clientId?: number };

  const [updated] = await db
    .update(vehiclesTable)
    .set({ plate, model, imei, clientId: clientId ?? null })
    .where(eq(vehiclesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  const vehicle = await getVehicleWithDetails(id);
  res.json(vehicle);
});

router.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  await db.delete(vehiclesTable).where(eq(vehiclesTable.id, id));
  res.status(204).end();
});

export default router;
