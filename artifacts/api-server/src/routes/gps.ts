import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, positionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitVehiclePosition, emitVehicleStatus } from "../lib/socket";
import { checkAlerts, updateLastSeen } from "../lib/alertService";
import { logger } from "../lib/logger";

const router = Router();

const prevIgnitionMap = new Map<number, boolean | null>();

async function processGPS(params: {
  imei: string;
  lat: number;
  lon: number;
  speed: number;
  ignition: boolean;
  course?: number;
}) {
  const { imei, lat, lon, speed, ignition, course } = params;

  const [vehicle] = await db
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.imei, imei))
    .limit(1);

  if (!vehicle) return null;

  const prevIgnition = prevIgnitionMap.get(vehicle.id) ?? null;

  const [position] = await db
    .insert(positionsTable)
    .values({
      vehicleId: vehicle.id,
      latitude: lat,
      longitude: lon,
      speed,
      ignition,
      course: course ?? null,
    })
    .returning();

  if (vehicle.status !== "ONLINE") {
    await db.update(vehiclesTable).set({ status: "ONLINE" }).where(eq(vehiclesTable.id, vehicle.id));
    emitVehicleStatus({ vehicleId: vehicle.id, plate: vehicle.plate, status: "ONLINE" });
  }

  updateLastSeen(vehicle.id);
  prevIgnitionMap.set(vehicle.id, ignition);

  emitVehiclePosition({
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    model: vehicle.model,
    latitude: lat,
    longitude: lon,
    speed,
    ignition,
    status: "ONLINE",
    updatedAt: position.createdAt,
  });

  await checkAlerts(vehicle.id, vehicle.plate, speed, ignition, prevIgnition, lat, lon);

  logger.info({ vehicleId: vehicle.id, imei }, "GPS position saved");
  return vehicle;
}

function parseParams(source: Record<string, unknown>) {
  const imei = String(source.imei ?? source.id ?? "").trim();
  const lat = parseFloat(source.lat as string);
  const lon = parseFloat(source.lon as string);
  const speed = parseFloat((source.speed as string) ?? "0") || 0;
  const course = source.course !== undefined ? parseFloat(source.course as string) : undefined;
  const ignition =
    source.ignition === true ||
    source.ignition === "true" ||
    source.ignition === 1 ||
    source.ignition === "1";
  return { imei, lat, lon, speed, course, ignition };
}

// POST /api/gps  — JSON body (GPS Logger, curl, custom apps)
router.post("/gps", async (req: Request, res: Response) => {
  const p = parseParams(req.body);

  if (!p.imei || isNaN(p.lat) || isNaN(p.lon)) {
    res.status(400).json({ error: "imei (ou id), lat e lon são obrigatórios" });
    return;
  }

  const vehicle = await processGPS(p);
  if (!vehicle) { res.status(404).json({ error: "IMEI não encontrado" }); return; }
  res.json({ ok: true });
});

// GET /api/gps  — query params (Traccar Client, OwnTracks HTTP, etc.)
router.get("/gps", async (req: Request, res: Response) => {
  const p = parseParams(req.query as Record<string, unknown>);

  if (!p.imei || isNaN(p.lat) || isNaN(p.lon)) {
    res.status(400).json({ error: "id (IMEI), lat e lon são obrigatórios" });
    return;
  }

  const vehicle = await processGPS(p);
  if (!vehicle) { res.status(404).json({ error: "IMEI não encontrado" }); return; }
  res.json({ ok: true });
});

export default router;
