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

  await checkAlerts(vehicle.id, vehicle.plate, speed, vehicle.speedLimit ?? 80, ignition, prevIgnition, lat, lon);

  logger.info({ vehicleId: vehicle.id, imei }, "GPS position saved");
  return vehicle;
}

function parseParams(source: Record<string, unknown>) {
  // Traccar Client sends nested: { device_id, location: { coords: { latitude, longitude, speed, heading } } }
  const coords = (source.location as any)?.coords as Record<string, unknown> | undefined;

  const imei = String(source.imei ?? source.id ?? source.deviceId ?? source.device_id ?? "").trim();

  const lat = parseFloat((
    source.lat ?? source.latitude ?? source.Latitude ??
    coords?.latitude ?? ""
  ) as string);

  const lon = parseFloat((
    source.lon ?? source.lng ?? source.longitude ?? source.Longitude ??
    coords?.longitude ?? ""
  ) as string);

  const speed = parseFloat((
    source.speed ?? source.Speed ?? coords?.speed ?? "0"
  ) as string) || 0;

  const rawCourse = source.course ?? source.bearing ?? source.heading ?? coords?.heading;
  const course = rawCourse !== undefined ? parseFloat(rawCourse as string) : undefined;

  const ignition =
    source.ignition === true ||
    source.ignition === "true" ||
    source.ignition === 1 ||
    source.ignition === "1";

  return { imei, lat, lon, speed, course, ignition };
}

async function handleGPS(source: Record<string, unknown>, res: Response) {
  logger.info({ source }, "GPS raw input");
  const p = parseParams(source);

  if (!p.imei || isNaN(p.lat) || isNaN(p.lon)) {
    logger.warn({ source, parsed: p }, "GPS 400 — missing fields");
    res.status(400).json({ error: "id (IMEI), lat e lon são obrigatórios", received: source });
    return;
  }

  const vehicle = await processGPS(p);
  if (!vehicle) { res.status(404).json({ error: "IMEI não encontrado" }); return; }
  res.json({ ok: true });
}

// POST /api/gps  — JSON or form-urlencoded body (also merges query params)
router.post("/gps", async (req: Request, res: Response) => {
  const source = { ...req.query, ...req.body } as Record<string, unknown>;
  await handleGPS(source, res);
});

// GET /api/gps  — query params (Traccar Client OsmAnd protocol, etc.)
router.get("/gps", async (req: Request, res: Response) => {
  await handleGPS(req.query as Record<string, unknown>, res);
});

export default router;
