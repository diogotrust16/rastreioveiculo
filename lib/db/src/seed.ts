import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import {
  clientsTable,
  usersTable,
  vehiclesTable,
  positionsTable,
  alertsTable,
} from "./schema/index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("123456", 10);

  // ── Clients ──────────────────────────────────────────────────────────────
  const [acme] = await db
    .insert(clientsTable)
    .values({ name: "Acme Logistics", document: "12.345.678/0001-99", phone: "(11) 99999-0001" })
    .onConflictDoNothing()
    .returning();

  const [fastCargo] = await db
    .insert(clientsTable)
    .values({ name: "FastCargo Transportes", document: "98.765.432/0001-11", phone: "(11) 99999-0002" })
    .onConflictDoNothing()
    .returning();

  console.log("  ✔ clients");

  // ── Users ─────────────────────────────────────────────────────────────────
  await db
    .insert(usersTable)
    .values([
      { name: "Admin", email: "admin@monitor.com", password: passwordHash, role: "ADMIN" },
      {
        name: "Cliente Acme",
        email: "client@monitor.com",
        password: passwordHash,
        role: "CLIENT",
        clientId: acme?.id ?? null,
      },
    ])
    .onConflictDoUpdate({
      target: usersTable.email,
      set: { password: passwordHash },
    });

  console.log("  ✔ users  (admin@monitor.com / 123456  •  client@monitor.com / 123456)");

  // ── Vehicles ──────────────────────────────────────────────────────────────
  const vehicleRows = [
    { plate: "ABC-1234", model: "Volkswagen Delivery", imei: "100000000000001", clientId: acme?.id ?? null },
    { plate: "DEF-5678", model: "Mercedes-Benz Actros", imei: "100000000000002", clientId: acme?.id ?? null },
    { plate: "GHI-9012", model: "Scania R450", imei: "100000000000003", clientId: acme?.id ?? null },
    { plate: "JKL-3456", model: "Iveco Daily", imei: "100000000000004", clientId: fastCargo?.id ?? null },
    { plate: "MNO-7890", model: "Volvo FH16", imei: "100000000000005", clientId: fastCargo?.id ?? null },
  ];

  const vehicles = await db
    .insert(vehiclesTable)
    .values(vehicleRows)
    .onConflictDoNothing()
    .returning();

  console.log(`  ✔ vehicles (${vehicles.length} inserted)`);

  // ── Sample positions ──────────────────────────────────────────────────────
  // São Paulo area coordinates
  const baseCoords = [
    { lat: -23.5505, lon: -46.6333 },
    { lat: -23.561,  lon: -46.6543 },
    { lat: -23.548,  lon: -46.638  },
    { lat: -23.572,  lon: -46.625  },
    { lat: -23.539,  lon: -46.651  },
  ];

  const positionRows = vehicles.flatMap((v, i) => {
    const base = baseCoords[i % baseCoords.length];
    return Array.from({ length: 5 }, (_, j) => ({
      vehicleId: v.id,
      latitude:  base.lat + (j * 0.001),
      longitude: base.lon + (j * 0.001),
      speed:     j === 0 ? 0 : 40 + j * 10,
      ignition:  j > 0,
    }));
  });

  if (positionRows.length > 0) {
    await db.insert(positionsTable).values(positionRows).onConflictDoNothing();
    console.log(`  ✔ positions (${positionRows.length} inserted)`);
  }

  // ── Sample alerts ─────────────────────────────────────────────────────────
  if (vehicles.length > 0) {
    await db
      .insert(alertsTable)
      .values([
        { vehicleId: vehicles[0].id, type: "SPEED_LIMIT",  message: "Veículo excedeu 80 km/h na Rodovia Anhanguera" },
        { vehicleId: vehicles[0].id, type: "IGNITION_ON",  message: "Ignição ligada" },
        { vehicleId: vehicles[1]?.id ?? vehicles[0].id, type: "GEOFENCE_EXIT", message: "Saiu da área definida: Depósito Central" },
        { vehicleId: vehicles[2]?.id ?? vehicles[0].id, type: "SIGNAL_LOST",  message: "Sinal perdido por mais de 10 minutos" },
      ])
      .onConflictDoNothing();
    console.log("  ✔ alerts");
  }

  console.log("\n✅ Seed concluído com sucesso!");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed falhou:", err);
  pool.end();
  process.exit(1);
});
