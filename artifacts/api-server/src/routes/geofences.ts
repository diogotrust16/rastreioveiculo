import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { geofencesTable, vehiclesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getClientVehicleIds(clientId: number): Promise<number[]> {
  const vehicles = await db.select({ id: vehiclesTable.id }).from(vehiclesTable).where(eq(vehiclesTable.clientId, clientId));
  return vehicles.map(v => v.id);
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const isClient = req.user!.role === "CLIENT";
  const clientId = req.user!.clientId;

  let geofences;
  if (isClient && clientId) {
    const vehicleIds = await getClientVehicleIds(clientId);
    if (vehicleIds.length === 0) {
      res.json([]);
      return;
    }
    geofences = await db.select().from(geofencesTable).where(inArray(geofencesTable.vehicleId, vehicleIds)).orderBy(geofencesTable.createdAt);
  } else {
    geofences = await db.select().from(geofencesTable).orderBy(geofencesTable.createdAt);
  }

  const result = await Promise.all(
    geofences.map(async (g) => {
      const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, g.vehicleId)).limit(1);
      return { ...g, vehiclePlate: vehicle?.plate ?? null };
    })
  );

  res.json(result);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { vehicleId, name, latitude, longitude, radius } = req.body as {
    vehicleId: number;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
  };

  if (!vehicleId || !name || latitude === undefined || longitude === undefined || radius === undefined) {
    res.status(400).json({ error: "vehicleId, name, latitude, longitude, and radius are required" });
    return;
  }

  if (req.user!.role === "CLIENT" && req.user!.clientId) {
    const vehicleIds = await getClientVehicleIds(req.user!.clientId);
    if (!vehicleIds.includes(vehicleId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const [geofence] = await db
    .insert(geofencesTable)
    .values({ vehicleId, name, latitude, longitude, radius })
    .returning();

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId)).limit(1);
  res.status(201).json({ ...geofence, vehiclePlate: vehicle?.plate ?? null });
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { vehicleId, name, latitude, longitude, radius } = req.body as {
    vehicleId: number;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
  };

  if (req.user!.role === "CLIENT" && req.user!.clientId) {
    const vehicleIds = await getClientVehicleIds(req.user!.clientId);
    const [existing] = await db.select().from(geofencesTable).where(eq(geofencesTable.id, id)).limit(1);
    if (!existing || !vehicleIds.includes(existing.vehicleId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const [geofence] = await db
    .update(geofencesTable)
    .set({ vehicleId, name, latitude, longitude, radius })
    .where(eq(geofencesTable.id, id))
    .returning();

  if (!geofence) {
    res.status(404).json({ error: "Geofence not found" });
    return;
  }

  const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, geofence.vehicleId)).limit(1);
  res.status(200).json({ ...geofence, vehiclePlate: vehicle?.plate ?? null });
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));

  if (req.user!.role === "CLIENT" && req.user!.clientId) {
    const vehicleIds = await getClientVehicleIds(req.user!.clientId);
    const [existing] = await db.select().from(geofencesTable).where(eq(geofencesTable.id, id)).limit(1);
    if (!existing || !vehicleIds.includes(existing.vehicleId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  await db.delete(geofencesTable).where(eq(geofencesTable.id, id));
  res.status(204).end();
});

export default router;
