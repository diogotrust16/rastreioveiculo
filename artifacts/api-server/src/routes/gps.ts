import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, positionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitVehiclePosition, emitVehicleStatus } from "../lib/socket";
import { checkAlerts, updateLastSeen } from "../lib/alertService";
import { logger } from "../lib/logger";

const router = Router();

const prevIgnitionMap = new Map<number, boolean | null>();

router.post("/gps", async (req: Request, res: Response) => {
  const { imei, lat, lon, speed = 0, ignition = false, course } = req.body;

  if (!imei || lat === undefined || lon === undefined) {
    res.status(400).json({ error: "imei, lat e lon são obrigatórios" });
    return;
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  const spd = parseFloat(speed);
  const ign = ignition === true || ignition === "true" || ignition === 1;

  if (isNaN(latitude) || isNaN(longitude)) {
    res.status(400).json({ error: "lat/lon inválidos" });
    return;
  }

  const [vehicle] = await db
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.imei, String(imei)))
    .limit(1);

  if (!vehicle) {
    res.status(404).json({ error: "IMEI não encontrado" });
    return;
  }

  const prevIgnition = prevIgnitionMap.get(vehicle.id) ?? null;

  const [position] = await db
    .insert(positionsTable)
    .values({
      vehicleId: vehicle.id,
      latitude,
      longitude,
      speed: spd,
      ignition: ign,
      course: course !== undefined ? parseFloat(course) : null,
    })
    .returning();

  if (vehicle.status !== "ONLINE") {
    await db.update(vehiclesTable).set({ status: "ONLINE" }).where(eq(vehiclesTable.id, vehicle.id));
    emitVehicleStatus({ vehicleId: vehicle.id, plate: vehicle.plate, status: "ONLINE" });
  }

  updateLastSeen(vehicle.id);
  prevIgnitionMap.set(vehicle.id, ign);

  emitVehiclePosition({
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    model: vehicle.model,
    latitude,
    longitude,
    speed: spd,
    ignition: ign,
    status: "ONLINE",
    updatedAt: position.createdAt,
  });

  await checkAlerts(vehicle.id, vehicle.plate, spd, ign, prevIgnition, latitude, longitude);

  logger.info({ vehicleId: vehicle.id, imei }, "HTTP GPS position saved");
  res.json({ ok: true });
});

export default router;
