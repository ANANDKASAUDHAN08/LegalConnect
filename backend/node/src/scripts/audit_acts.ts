import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { normalizeActInfo } from '../utils/actNormalizer';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalconnect';

async function main() {
  await mongoose.connect(uri);
  const acts = await mongoose.connection.db!.collection('bareacts').find({}).toArray();
  const sections = await mongoose.connection.db!.collection('sections').find({}, { projection: { actShortName: 1, section_number: 1 } }).toArray();

  console.log(`Analyzing ${acts.length} acts and ${sections.length} sections...`);

  const mismatches: Array<{ id: any; actName: string; storedShort: string; normalizedShort: string }> = [];
  const invalidShorts: Array<{ id: any; actName: string; storedShort: string }> = [];

  for (const act of acts) {
    const rawTitle = act.actName || act.name || act.title;
    const norm = normalizeActInfo(rawTitle, act.shortName, act.year);

    if (act.shortName !== norm.shortName) {
      mismatches.push({
        id: act._id,
        actName: act.actName,
        storedShort: act.shortName,
        normalizedShort: norm.shortName
      });
    }

    if (!act.shortName || act.shortName.includes('(') || act.shortName.length > 8 || /[^A-Za-z0-9\-_]/.test(act.shortName)) {
      invalidShorts.push({
        id: act._id,
        actName: act.actName,
        storedShort: act.shortName
      });
    }
  }

  console.log(`\n=== TOTAL MISMATCHES (GET /acts returns one thing, DB has another): ${mismatches.length} ===`);
  console.log(JSON.stringify(mismatches, null, 2));

  console.log(`\n=== TOTAL INVALID/MALFORMED DB SHORT NAMES: ${invalidShorts.length} ===`);
  console.log(JSON.stringify(invalidShorts, null, 2));

  // Check section actShortName alignment
  const distinctSectionActShortNames = await mongoose.connection.db!.collection('sections').distinct('actShortName');
  console.log('\n=== DISTINCT actShortName IN SECTIONS COLLECTION ===');
  console.log(distinctSectionActShortNames);

  await mongoose.disconnect();
}

main().catch(console.error);
