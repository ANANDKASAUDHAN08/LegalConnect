import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Lawyer from '../models/Lawyer';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const backfillLawyerMetrics = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI as string;
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);

    console.log('[Migration] Resetting fabricated casesCompleted (150 -> 0)...');
    const casesResult = await Lawyer.updateMany(
      { casesCompleted: 150 },
      { $set: { casesCompleted: 0 } }
    );
    console.log(`[Migration] Updated ${casesResult.modifiedCount} lawyer(s) with fabricated casesCompleted.`);

    console.log('[Migration] Resetting fabricated successRate (95 -> 0)...');
    const successResult = await Lawyer.updateMany(
      { successRate: 95 },
      { $set: { successRate: 0 } }
    );
    console.log(`[Migration] Updated ${successResult.modifiedCount} lawyer(s) with fabricated successRate.`);

    console.log('✅ [Migration] Fabricated lawyer metrics successfully backfilled to 0.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ [Migration] Error backfilling lawyer metrics:', error);
    process.exit(1);
  }
};

backfillLawyerMetrics();