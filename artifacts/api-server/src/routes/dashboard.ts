import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, clientsTable, alertsTable } from "@workspace/db";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  const isClient = req.user!.role === "CLIENT";
  const clientId = req.user!.clientId;

  if (isClient && clientId) {
    const clientVehicles = await db
      .select({ id: vehiclesTable.id, status: vehiclesTable.status })
      .from(vehiclesTable)
      .where(eq(vehiclesTable.clientId, clientId));

    const vehicleIds = clientVehicles.map(v => v.id);
    const total = clientVehicles.length;
    const online = clientVehicles.filter(v => v.status === "ONLINE").length;

    let unreadAlerts = 0;
    let alertsByType: { type: string; count: number }[] = [];

    if (vehicleIds.length > 0) {
      const [alertStats] = await db
        .select({ unread: sql<number>`SUM(CASE WHEN ${alertsTable.read} = false THEN 1 ELSE 0 END)::int` })
        .from(alertsTable)
        .where(inArray(alertsTable.vehicleId, vehicleIds));
      unreadAlerts = alertStats?.unread ?? 0;

      alertsByType = await db
        .select({ type: alertsTable.type, count: sql<number>`COUNT(*)::int` })
        .from(alertsTable)
        .where(inArray(alertsTable.vehicleId, vehicleIds))
        .groupBy(alertsTable.type);
    }

    res.json({
      totalVehicles: total,
      onlineVehicles: online,
      offlineVehicles: total - online,
      totalClients: 1,
      unreadAlerts,
      alertsByType,
    });
    return;
  }

  const [vehicleStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      online: sql<number>`SUM(CASE WHEN ${vehiclesTable.status} = 'ONLINE' THEN 1 ELSE 0 END)::int`,
      offline: sql<number>`SUM(CASE WHEN ${vehiclesTable.status} = 'OFFLINE' THEN 1 ELSE 0 END)::int`,
    })
    .from(vehiclesTable);

  const [clientStats] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(clientsTable);

  const [alertStats] = await db
    .select({ unread: sql<number>`SUM(CASE WHEN ${alertsTable.read} = false THEN 1 ELSE 0 END)::int` })
    .from(alertsTable);

  const alertsByType = await db
    .select({ type: alertsTable.type, count: sql<number>`COUNT(*)::int` })
    .from(alertsTable)
    .groupBy(alertsTable.type);

  res.json({
    totalVehicles: vehicleStats?.total ?? 0,
    onlineVehicles: vehicleStats?.online ?? 0,
    offlineVehicles: vehicleStats?.offline ?? 0,
    totalClients: clientStats?.total ?? 0,
    unreadAlerts: alertStats?.unread ?? 0,
    alertsByType,
  });
});

router.get("/recent-alerts", requireAuth, async (req: Request, res: Response) => {
  const isClient = req.user!.role === "CLIENT";
  const clientId = req.user!.clientId;

  let alerts;
  if (isClient && clientId) {
    const clientVehicles = await db.select({ id: vehiclesTable.id }).from(vehiclesTable).where(eq(vehiclesTable.clientId, clientId));
    const vehicleIds = clientVehicles.map(v => v.id);
    if (vehicleIds.length === 0) {
      res.json([]);
      return;
    }
    alerts = await db
      .select()
      .from(alertsTable)
      .where(inArray(alertsTable.vehicleId, vehicleIds))
      .orderBy(desc(alertsTable.createdAt))
      .limit(10);
  } else {
    alerts = await db
      .select()
      .from(alertsTable)
      .orderBy(desc(alertsTable.createdAt))
      .limit(10);
  }

  const result = await Promise.all(
    alerts.map(async (a) => {
      const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, a.vehicleId)).limit(1);
      return { ...a, vehiclePlate: vehicle?.plate ?? null };
    })
  );

  res.json(result);
});

export default router;
