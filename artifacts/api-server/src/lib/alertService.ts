import { db } from "@workspace/db";
import { alertsTable, vehiclesTable, geofencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitVehicleAlert } from "./socket";
import { logger } from "./logger";

const SPEED_LIMIT = 80;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function createAlert(
  vehicleId: number,
  type: "SPEED_LIMIT" | "GEOFENCE_EXIT" | "IGNITION_ON" | "IGNITION_OFF" | "SIGNAL_LOST",
  message: string,
  plate: string
): Promise<void> {
  const [alert] = await db.insert(alertsTable).values({ vehicleId, type, message }).returning();
  emitVehicleAlert({ vehicleId, vehiclePlate: plate, type, message, createdAt: alert.createdAt });
  logger.info({ vehicleId, type, message }, "Alert created");
}

export async function checkAlerts(
  vehicleId: number,
  plate: string,
  speed: number | null,
  ignition: boolean | null,
  prevIgnition: boolean | null,
  latitude: number,
  longitude: number
): Promise<void> {
  if (speed !== null && speed > SPEED_LIMIT) {
    await createAlert(vehicleId, "SPEED_LIMIT", `Vehicle ${plate} exceeded speed limit: ${speed} km/h`, plate);
  }

  if (ignition !== null && prevIgnition !== null && ignition !== prevIgnition) {
    const type = ignition ? "IGNITION_ON" : "IGNITION_OFF";
    const message = ignition ? `Vehicle ${plate} ignition turned ON` : `Vehicle ${plate} ignition turned OFF`;
    await createAlert(vehicleId, type, message, plate);
  }

  const geofences = await db.select().from(geofencesTable).where(eq(geofencesTable.vehicleId, vehicleId));
  for (const g of geofences) {
    const dist = haversineDistance(latitude, longitude, g.latitude, g.longitude);
    if (dist > g.radius) {
      await createAlert(vehicleId, "GEOFENCE_EXIT", `Vehicle ${plate} exited geofence "${g.name}"`, plate);
    }
  }
}

const lastSeenMap = new Map<number, Date>();

export function updateLastSeen(vehicleId: number): void {
  lastSeenMap.set(vehicleId, new Date());
}

export function startSignalLostMonitor(): void {
  const SIGNAL_LOST_THRESHOLD_MS = 5 * 60 * 1000;

  setInterval(async () => {
    const vehicles = await db.select().from(vehiclesTable).where(eq(vehiclesTable.status, "ONLINE"));
    const now = new Date();
    for (const v of vehicles) {
      const lastSeen = lastSeenMap.get(v.id);
      if (!lastSeen) continue;
      const diff = now.getTime() - lastSeen.getTime();
      if (diff > SIGNAL_LOST_THRESHOLD_MS) {
        await db.update(vehiclesTable).set({ status: "OFFLINE" }).where(eq(vehiclesTable.id, v.id));
        await createAlert(v.id, "SIGNAL_LOST", `Vehicle ${v.plate} lost signal`, v.plate);
        lastSeenMap.delete(v.id);
      }
    }
  }, 60_000);
}
