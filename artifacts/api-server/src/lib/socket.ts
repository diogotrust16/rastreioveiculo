import { Server as SocketIOServer } from "socket.io";
import { type Server as HttpServer } from "http";
import { logger } from "./logger";

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected");
    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Client disconnected");
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function emitVehiclePosition(data: {
  vehicleId: number;
  plate: string;
  model: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  ignition: boolean | null;
  status: string;
  updatedAt: Date;
}): void {
  if (io) io.emit("vehicle:position", data);
}

export function emitVehicleAlert(data: {
  vehicleId: number;
  vehiclePlate: string;
  type: string;
  message: string;
  createdAt: Date;
}): void {
  if (io) io.emit("vehicle:alert", data);
}

export function emitVehicleStatus(data: {
  vehicleId: number;
  plate: string;
  status: string;
}): void {
  if (io) io.emit("vehicle:status", data);
}
