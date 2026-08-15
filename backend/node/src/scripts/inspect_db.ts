import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalconnect';

async function main() {
  await mongoose.connect(uri);
  const acts = await mongoose.connection.db!.collection('bareacts').find({}, { projection: { actName: 1, shortName: 1, year: 1 } }).toArray();
  console.log('TOTAL ACTS IN DB:', acts.length);
  
  const searchCodes = ['ASIR', 'ATM', 'AT', 'ATA', 'AOSAIR2', 'AT('];
  console.log('\n--- Specific Code Search ---');
  for (const code of searchCodes) {
    const found = acts.filter((a: any) => a.shortName && a.shortName.toUpperCase() === code.toUpperCase());
    console.log(`Code '${code}': found ${found.length} matches:`, found);
  }

  console.log('\n--- Acts matching /AT/i or /ASIR/i or /ATM/i in actName or shortName ---');
  const regexMatches = acts.filter((a: any) => 
    /ASIR|ATM|Tribunal/i.test(a.shortName || '') || /ASIR|ATM|Tribunal/i.test(a.actName || '')
  );
  console.log(JSON.stringify(regexMatches, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
