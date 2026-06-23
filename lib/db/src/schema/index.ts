import { pgTable, serial, text, integer, real, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "CLIENT"]);
export const vehicleStatusEnum = pgEnum("vehicle_status", ["ONLINE", "OFFLINE"]);
export const alertTypeEnum = pgEnum("alert_type", ["SPEED_LIMIT", "GEOFENCE_EXIT", "IGNITION_ON", "IGNITION_OFF", "SIGNAL_LOST"]);

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  document: text("document"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("CLIENT"),
  clientId: integer("client_id").references(() => clientsTable.id),
  refreshToken: text("refresh_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientsTable.id),
  plate: text("plate").notNull(),
  model: text("model").notNull(),
  imei: text("imei").notNull().unique(),
  status: vehicleStatusEnum("status").notNull().default("OFFLINE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const positionsTable = pgTable("positions", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  speed: real("speed"),
  course: real("course"),
  ignition: boolean("ignition"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const geofencesTable = pgTable("geofences", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  radius: real("radius").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
  type: alertTypeEnum("type").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true });
export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true, createdAt: true, status: true });
export const insertPositionSchema = createInsertSchema(positionsTable).omit({ id: true, createdAt: true });
export const insertGeofenceSchema = createInsertSchema(geofencesTable).omit({ id: true, createdAt: true });
export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true, createdAt: true, read: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, refreshToken: true });

export type Client = typeof clientsTable.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Position = typeof positionsTable.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Geofence = typeof geofencesTable.$inferSelect;
export type InsertGeofence = z.infer<typeof insertGeofenceSchema>;
export type Alert = typeof alertsTable.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
