#!/usr/bin/env node

/**
 * Migrate Fleet Data Script
 * 
 * This script exports all fleet vehicles and maintenance records from the current database
 * and generates INSERT statements that can be used to populate a new database.
 * 
 * Usage:
 *   node scripts/migrate-fleet-to-new-db.js
 *   node scripts/migrate-fleet-to-new-db.js > fleet-migration.sql
 * 
 * The output can be piped to a SQL file or directly executed against a new database.
 */

require("dotenv").config();
const Database = require("../config/database");

const db = new Database();

async function migrateFleet() {
  try {
    console.log(
      "-- ========== FLEET MIGRATION SCRIPT ========== --\n"
    );
    console.log("-- Generated on:", new Date().toISOString());
    console.log("-- Source: Current Timesheet Database\n");

    // Fetch all fleet vehicles
    const vehicles = await new Promise((resolve, reject) => {
      db.db.all(
        "SELECT * FROM fleet_vehicles ORDER BY id",
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (vehicles.length === 0) {
      console.log("-- No fleet vehicles found in database");
      process.exit(0);
    }

    console.log(`-- Found ${vehicles.length} vehicle(s)\n`);
    console.log("BEGIN TRANSACTION;\n");

    console.log("-- ========== FLEET VEHICLES ========== --\n");

    // Generate INSERT statements for fleet vehicles
    const vehicleIds = [];
    vehicles.forEach((vehicle) => {
      vehicleIds.push(vehicle.id);
      const values = [
        vehicle.license_plate,
        vehicle.truck_type,
        vehicle.km,
        vehicle.apk_due_date,
        vehicle.rit_number,
        vehicle.company_id,
        vehicle.created_at,
        vehicle.updated_at,
      ]
        .map((v) =>
          v === null || v === undefined
            ? "NULL"
            : typeof v === "number"
            ? v
            : `'${String(v).replace(/'/g, "''")}'`
        )
        .join(", ");

      console.log(`INSERT INTO fleet_vehicles (
  license_plate,
  truck_type,
  km,
  apk_due_date,
  rit_number,
  company_id,
  created_at,
  updated_at
) VALUES (${values});\n`);
    });

    // Fetch all maintenance records
    console.log("-- ========== FLEET MAINTENANCE ========== --\n");
    const maintenance = await new Promise((resolve, reject) => {
      db.db.all(
        "SELECT * FROM fleet_maintenance ORDER BY vehicle_id, id",
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (maintenance.length > 0) {
      console.log(`-- Found ${maintenance.length} maintenance record(s)\n`);
      maintenance.forEach((maint) => {
        const values = [
          maint.vehicle_id,
          maint.maintenance_date,
          maint.km,
          maint.notes,
          maint.created_at,
        ]
          .map((v) =>
            v === null || v === undefined
              ? "NULL"
              : typeof v === "number"
              ? v
              : `'${String(v).replace(/'/g, "''")}'`
          )
          .join(", ");

        console.log(`INSERT INTO fleet_maintenance (
  vehicle_id,
  maintenance_date,
  km,
  notes,
  created_at
) VALUES (${values});\n`);
      });
    } else {
      console.log("-- No maintenance records found\n");
    }

    console.log("COMMIT;");
    console.log(
      "\n-- Migration complete! All fleet data has been exported."
    );
    console.log("-- You can now import this to a new database using: sqlite3 new_database.sqlite < fleet-migration.sql");
    console.log(`-- Total vehicles: ${vehicles.length}`);
    console.log(`-- Total maintenance records: ${maintenance.length}`);

    process.exit(0);
  } catch (error) {
    console.error("Error during migration:", error.message);
    process.exit(1);
  }
}

migrateFleet();
