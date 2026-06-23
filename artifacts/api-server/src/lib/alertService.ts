import { db } from "@workspace/db";
import { alertsTable, vehiclesTable, geofencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitVehicleAlert } from "./socket";
import { logger } from "./logger";

// Cooldown: don't fire SPEED_LIMIT alert more than once per 5 min per vehicle
const speedAlertCooldown = new Map<number, number>();
const SPEED_COOLDOWN_MS = 5 * 60 * 1000;

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
  speedMs: number | null,       // speed in m/s from GPS device
  speedLimitKmh: number,        // configured limit in km/h
  ignition: boolean | null,
  prevIgnition: boolean | null,
  latitude: number,
  longitude: number
): Promise<void> {
  // Speed check — convert m/s → km/h for comparison
  if (speedMs !== null && speedMs > 0) {
    const speedKmh = speedMs * 3.6;
    if (speedKmh > speedLimitKmh) {
      const lastAlert = speedAlertCooldown.get(vehicleId) ?? 0;
      const now = Date.now();
      if (now - lastAlert > SPEED_COOLDOWN_MS) {
        speedAlertCooldown.set(vehicleId, now);
        await createAlert(
          vehicleId,
          "SPEED_LIMIT",
          `${plate} excedeu ${speedLimitKmh} km/h (atual: ${Math.round(speedKmh)} km/h)`,
          plate
        );
      }
    }
  }

  // Ignition change
  if (ignition !== null && prevIgnition !== null && ignition !== prevIgnition) {
    const type = ignition ? "IGNITION_ON" : "IGNITION_OFF";
    const message = ignition ? `${plate}: ignição ligada` : `${plate}: ignição desligada`;
    await createAlert(vehicleId, type, message, plate);
  }

  // Geofence exit
  const geofences = await db.select().from(geofencesTable).where(eq(geofencesTable.vehicleId, vehicleId));
  for (const g of geofences) {
    const dist = haversineDistance(latitude, longitude, g.latitude, g.longitude);
    if (dist > g.radius) {
      await createAlert(vehicleId, "GEOFENCE_EXIT", `${plate} saiu da geocerca "${g.name}"`, plate);
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
        await createAlert(v.id, "SIGNAL_LOST", `${v.plate}: sinal perdido`, v.plate);
        lastSeenMap.delete(v.id);
      }
    }
  }, 60_000);
}
