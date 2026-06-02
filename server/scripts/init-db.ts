import { closeDb, getDatabasePath, initializeDatabase } from "../db";

initializeDatabase();
console.log(`SQLite database initialized at ${getDatabasePath()}`);
closeDb();
