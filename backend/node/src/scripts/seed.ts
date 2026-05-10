import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import BareAct from '../models/BareAct';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI as string;
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB!');

    // Load seed data
    const seedFilePath = path.resolve(__dirname, '../data/bareacts.seed.json');
    const rawData = fs.readFileSync(seedFilePath, 'utf-8');
    const acts = JSON.parse(rawData);

    // Clear existing data first
    console.log('🗑️  Clearing existing BareActs...');
    await BareAct.deleteMany({});

    // Insert the new data
    console.log('💾 Seeding legal acts...');
    for (const act of acts) {
      const newAct = new BareAct(act);
      await newAct.save();
      console.log(`  ✅ Inserted: "${act.actName}"`);
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log(`   Total acts inserted: ${acts.length}`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedData();
