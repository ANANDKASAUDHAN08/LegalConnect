import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runLegalPlatformMigration } from '../utils/legalPlatformMigrator';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/legalconnect_db';

async function main() {
  console.log('Connecting to Mongo at:', uri);
  await mongoose.connect(uri);
  const result = await runLegalPlatformMigration(true);
  console.log('Migration Result:', result);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});