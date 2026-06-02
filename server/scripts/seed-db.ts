import { closeDb, getDatabasePath, seedDatabase } from "../db";

seedDatabase();
console.log(`SQLite seed completed at ${getDatabasePath()}`);
closeDb();
