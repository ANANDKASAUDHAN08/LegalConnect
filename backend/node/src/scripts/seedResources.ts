import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import LegalResource from '../models/LegalResource';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seedResources = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI as string;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is missing.');
    }
    console.log('📦 Connecting to MongoDB to seed resources...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB!');

    // Load real-world resources from JSON file
    const dataPath = path.resolve(__dirname, '../data/resources.seed.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const resources = JSON.parse(rawData);

    console.log(`📄 Loaded ${resources.length} verified resources from resources.seed.json`);
    console.log('🗑️  Clearing existing LegalResources...');
    await LegalResource.deleteMany({});
    console.log('💾 Seeding LegalResources database...');

    for (const res of resources) {
      const newResource = new LegalResource(res);
      await newResource.save();
      console.log(`  ✅ Inserted: "${res.name}" (${res.city}, ${res.state}) [${res.type}]`);
    }

    console.log('\n🎉 LegalResources database seeded successfully!');
    console.log(`   Total resources inserted: ${resources.length}`);

    // Print summary by type
    const summary: Record<string, number> = {};
    for (const res of resources) {
      summary[res.type] = (summary[res.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(summary)) {
      console.log(`   ${type}: ${count}`);
    }

    // Print summary by city
    const citySummary: Record<string, number> = {};
    for (const res of resources) {
      citySummary[res.city] = (citySummary[res.city] || 0) + 1;
    }
    console.log('\n   Coverage by city:');
    for (const [city, count] of Object.entries(citySummary)) {
      console.log(`   📍 ${city}: ${count} resources`);
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding resources failed:', error.message);
    process.exit(1);
  }
};

seedResources();