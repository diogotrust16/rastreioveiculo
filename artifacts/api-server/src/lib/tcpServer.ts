import net from "net";
import { db } from "@workspace/db";
import { vehiclesTable, positionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitVehiclePosition, emitVehicleStatus } from "./socket";
import { checkAlerts, updateLastSeen } from "./alertService";
import { logger } from "./logger";

interface ParsedGPSData {
  imei: string;
  latitude: number;
  longitude: number;
  speed: number;
  ignition: boolean;
  course?: number;
}

function parseTrackerMessage(raw: string): ParsedGPSData | null {
  try {
    const msg = raw.trim();
    const parts: Record<string, string> = {};
    for (const pair of msg.split(",")) {
      const [key, val] = pair.split(":");
      if (key && val !== undefined) parts[key.trim()] = val.trim();
    }

    if (!parts.imei || !parts.lat || !parts.lon) return null;

    return {
      imei: parts.imei,
      latitude: parseFloat(parts.lat),
      longitude: parseFloat(parts.lon),
      speed: parseFloat(parts.speed ?? "0"),
      ignition: parts.ignition === "true",
      course: parts.course ? parseFloat(parts.course) : undefined,
    };
  } catch {
    return null;
  }
}

const prevIgnitionMap = new Map<number, boolean | null>();

export function startTcpServer(port: number = 5001): void {
  const server = net.createServer((socket) => {
    logger.info({ remoteAddress: socket.remoteAddress }, "GPS tracker connected");

    let buffer = "";

    socket.on("data", async (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const parsed = parseTrackerMessage(line);
        if (!parsed) {
          logger.warn({ raw: line }, "Failed to parse GPS message");
          continue;
        }

        try {
          const [vehicle] = await db
            .select()
            .from(vehiclesTable)
            .where(eq(vehiclesTable.imei, parsed.imei))
            .limit(1);

          if (!vehicle) {
            logger.warn({ imei: parsed.imei }, "Unknown IMEI, ignoring");
            continue;
          }

          const prevIgnition = prevIgnitionMap.get(vehicle.id) ?? null;

          const [position] = await db
            .insert(positionsTable)
            .values({
              vehicleId: vehicle.id,
              latitude: parsed.latitude,
              longitude: parsed.longitude,
              speed: parsed.speed,
              ignition: parsed.ignition,
              course: parsed.course ?? null,
            })
            .returning();

          if (vehicle.status !== "ONLINE") {
            await db.update(vehiclesTable).set({ status: "ONLINE" }).where(eq(vehiclesTable.id, vehicle.id));
            emitVehicleStatus({ vehicleId: vehicle.id, plate: vehicle.plate, status: "ONLINE" });
          }

          updateLastSeen(vehicle.id);
          prevIgnitionMap.set(vehicle.id, parsed.ignition);

          emitVehiclePosition({
            vehicleId: vehicle.id,
            plate: vehicle.plate,
            model: vehicle.model,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            speed: parsed.speed,
            ignition: parsed.ignition,
            status: "ONLINE",
            updatedAt: position.createdAt,
          });

          await checkAlerts(
            vehicle.id,
            vehicle.plate,
            parsed.speed,
            parsed.ignition,
            prevIgnition,
            parsed.latitude,
            parsed.longitude
          );

          socket.write("OK\n");
          logger.info({ vehicleId: vehicle.id, imei: parsed.imei }, "Position saved");
        } catch (err) {
          logger.error({ err, imei: parsed.imei }, "Error processing GPS data");
        }
      }
    });

    socket.on("error", (err) => {
      logger.warn({ err }, "GPS tracker socket error");
    });

    socket.on("close", () => {
      logger.info({ remoteAddress: socket.remoteAddress }, "GPS tracker disconnected");
    });
  });

  server.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "TCP GPS server listening");
  });

  server.on("error", (err) => {
    logger.error({ err }, "TCP server error");
  });
}
