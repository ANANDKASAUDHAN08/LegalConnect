import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import BareAct from '../models/BareAct';
import Lawyer from '../models/Lawyer';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI as string;
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB!');

    // --- Seed BareActs ---
    const actsSeedFilePath = path.resolve(__dirname, '../data/bareacts.seed.json');
    const actsRawData = fs.readFileSync(actsSeedFilePath, 'utf-8');
    const acts = JSON.parse(actsRawData);

    console.log('🗑️  Clearing existing BareActs...');
    await BareAct.deleteMany({});
    console.log('💾 Seeding legal acts...');
    for (const act of acts) {
      const newAct = new BareAct(act);
      await newAct.save();
      console.log(`  ✅ Inserted: "${act.actName}"`);
    }

    // --- Seed Lawyers ---
    const lawyersSeedFilePath = path.resolve(__dirname, '../data/lawyers.seed.json');
    const lawyersRawData = fs.readFileSync(lawyersSeedFilePath, 'utf-8');
    const lawyers = JSON.parse(lawyersRawData);

    console.log('\n🗑️  Clearing existing Lawyers...');
    await Lawyer.deleteMany({});
    console.log('💾 Seeding lawyers...');
    for (const lawyer of lawyers) {
      const newLawyer = new Lawyer(lawyer);
      await newLawyer.save();
      console.log(`  ✅ Inserted: "${lawyer.name}"`);
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log(`   Acts inserted: ${acts.length}`);
    console.log(`   Lawyers inserted: ${lawyers.length}`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedData();

