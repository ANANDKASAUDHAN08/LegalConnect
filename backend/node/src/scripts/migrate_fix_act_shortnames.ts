/**
 * migrate_fix_act_shortnames.ts
 * 
 * Enterprise database migration script that:
 * 1. Normalizes all bareacts.shortName to clean, standardized codes (ASIR, ATM, RERA, etc.)
 * 2. Updates ALL sections.actShortName to match the new bareacts.shortName
 * 3. Populates hierarchical_id, act_code, category on bareacts
 * 4. Populates hierarchical_id on sections
 * 5. Flushes all Redis/in-memory caches
 * 
 * Safe to run multiple times (idempotent).
 * Run: npx ts-node src/scripts/migrate_fix_act_shortnames.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import {
  normalizeActInfo,
  classifyActCategory,
  generateHierarchicalId,
  generateSectionHierarchicalId,
  ActCategory
} from '../utils/actNormalizer';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalconnect';

interface MigrationReport {
  totalActs: number;
  actsUpdated: number;
  actsSkipped: number;
  sectionsUpdated: number;
  collisions: Array<{ shortName: string; acts: string[] }>;
  errors: string[];
}

async function migrate(): Promise<MigrationReport> {
  const startMs = Date.now();
  console.log('🔄 Starting enterprise act shortName migration...');
  console.log(`   Database: ${uri.includes('@') ? uri.split('@').pop() : uri}`);

  await mongoose.connect(uri);
  const bareactsCol = mongoose.connection.db!.collection('bareacts');
  const sectionsCol = mongoose.connection.db!.collection('sections');

  const report: MigrationReport = {
    totalActs: 0,
    actsUpdated: 0,
    actsSkipped: 0,
    sectionsUpdated: 0,
    collisions: [],
    errors: []
  };

  // Step 1: Load all acts
  const acts = await bareactsCol.find({}).toArray();
  report.totalActs = acts.length;
  console.log(`📦 Found ${acts.length} acts in database.`);

  // Step 2: Compute normalized shortNames and detect collisions
  const shortNameOwners = new Map<string, Array<{ _id: any; actName: string; rawShort: string; sectionCount: number }>>();

  for (const act of acts) {
    const rawTitle = act.actName || act.name || act.title || '';
    const rawShort = act.shortName || '';
    const year = act.year;

    const norm = normalizeActInfo(rawTitle, rawShort, year);
    const cleanShort = norm.shortName.toUpperCase();

    // Count sections for this act (to determine collision winner)
    const secCount = await sectionsCol.countDocuments({ actShortName: rawShort });

    const owners = shortNameOwners.get(cleanShort) || [];
    owners.push({ _id: act._id, actName: rawTitle, rawShort, sectionCount: secCount });
    shortNameOwners.set(cleanShort, owners);
  }

  // Step 3: Resolve collisions — keep the act with the most sections
  const migrationPlan = new Map<string, { _id: any; actName: string; rawShort: string; cleanShort: string; category: ActCategory; hierarchicalId: string; year: number }>();

  for (const [cleanShort, owners] of shortNameOwners.entries()) {
    if (owners.length > 1) {
      console.warn(`⚠️ Collision: ${owners.length} acts map to '${cleanShort}':`);
      owners.forEach(o => console.warn(`   - ${o.actName} (raw: '${o.rawShort}', sections: ${o.sectionCount})`));
      report.collisions.push({ shortName: cleanShort, acts: owners.map(o => o.actName) });
    }

    // Pick the winner: most sections, then alphabetical
    owners.sort((a, b) => b.sectionCount - a.sectionCount || a.actName.localeCompare(b.actName));
    const winner = owners[0];

    const act = acts.find(a => String(a._id) === String(winner._id));
    const rawTitle = act?.actName || act?.name || act?.title || '';
    const year = act?.year || 0;
    const norm = normalizeActInfo(rawTitle, winner.rawShort, year);
    const category = classifyActCategory(norm.actName);
    const hId = generateHierarchicalId(cleanShort, year, category);

    migrationPlan.set(String(winner._id), {
      _id: winner._id,
      actName: norm.actName,
      rawShort: winner.rawShort,
      cleanShort,
      category,
      hierarchicalId: hId,
      year
    });

    // Mark losers as skipped (they keep their raw shortName but get category/hId)
    for (let i = 1; i < owners.length; i++) {
      const loser = owners[i];
      const loserAct = acts.find(a => String(a._id) === String(loser._id));
      const loserTitle = loserAct?.actName || '';
      const loserYear = loserAct?.year || 0;
      const loserNorm = normalizeActInfo(loserTitle, loser.rawShort, loserYear);
      const loserCat = classifyActCategory(loserNorm.actName);
      // Give losers a unique suffixed shortName to avoid duplicate key errors
      const uniqueShort = `${cleanShort}_${loserYear || i}`;
      const loserHId = generateHierarchicalId(uniqueShort, loserYear, loserCat);
      migrationPlan.set(String(loser._id), {
        _id: loser._id,
        actName: loserNorm.actName,
        rawShort: loser.rawShort,
        cleanShort: uniqueShort,
        category: loserCat,
        hierarchicalId: loserHId,
        year: loserYear
      });
    }
  }

  // Step 4: Execute migration
  console.log(`\n🚀 Executing migration for ${migrationPlan.size} acts...`);

  for (const [idStr, plan] of migrationPlan.entries()) {
    try {
      const oldShort = plan.rawShort;
      const newShort = plan.cleanShort;

      // Build legacy_short_names array
      const legacyNames: string[] = [];
      if (oldShort && oldShort !== newShort) {
        legacyNames.push(oldShort);
      }

      // Update the bareact document
      const updateDoc: any = {
        shortName: newShort,
        hierarchical_id: plan.hierarchicalId,
        act_code: newShort,
        category: plan.category
      };
      if (legacyNames.length > 0) {
        updateDoc.legacy_short_names = legacyNames;
      }

      await bareactsCol.updateOne(
        { _id: plan._id },
        { $set: updateDoc }
      );

      // Update ALL sections matching the old shortName
      if (oldShort !== newShort) {
        const secResult = await sectionsCol.updateMany(
          { actShortName: oldShort },
          { $set: { actShortName: newShort } }
        );
        report.sectionsUpdated += secResult.modifiedCount;

        if (secResult.modifiedCount > 0) {
          console.log(`  ✅ '${oldShort}' → '${newShort}' (${secResult.modifiedCount} sections updated) [${plan.category}]`);
        }
      }

      // Update section hierarchical_ids for this act
      const actSections = await sectionsCol.find({ actShortName: newShort }, { projection: { section_number: 1 } }).toArray();
      if (actSections.length > 0) {
        const secOps = actSections.map(sec => ({
          updateOne: {
            filter: { _id: sec._id },
            update: { $set: { hierarchical_id: generateSectionHierarchicalId(newShort, plan.year, sec.section_number) } }
          }
        }));
        await sectionsCol.bulkWrite(secOps);
      }

      report.actsUpdated++;
    } catch (err: any) {
      // Handle duplicate key errors gracefully
      if (err.code === 11000) {
        console.warn(`  ⚠️ Duplicate key for '${plan.cleanShort}' — skipping ${plan.actName}`);
        report.actsSkipped++;
      } else {
        console.error(`  ❌ Error migrating ${plan.actName}:`, err.message);
        report.errors.push(`${plan.actName}: ${err.message}`);
      }
    }
  }

  // Step 5: Flush caches
  console.log('\n🗑️ Flushing caches...');
  try {
    // Clear in-memory caches by connecting and deleting Redis keys
    const { createClient } = require('redis');
    if (process.env.REDIS_URL) {
      const redis = createClient({ url: process.env.REDIS_URL });
      await redis.connect();
      const keys = await redis.keys('legal:*');
      if (keys.length > 0) {
        await redis.del(keys);
        console.log(`  ✅ Flushed ${keys.length} Redis cache entries.`);
      }
      await redis.disconnect();
    }
  } catch (e) {
    console.log('  ℹ️ Redis not available — in-memory cache will expire naturally.');
  }

  // Step 6: Summary
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION REPORT');
  console.log('='.repeat(60));
  console.log(`Total Acts:        ${report.totalActs}`);
  console.log(`Acts Updated:      ${report.actsUpdated}`);
  console.log(`Acts Skipped:      ${report.actsSkipped}`);
  console.log(`Sections Updated:  ${report.sectionsUpdated}`);
  console.log(`Collisions:        ${report.collisions.length}`);
  console.log(`Errors:            ${report.errors.length}`);
  console.log(`Time Elapsed:      ${elapsed}s`);
  console.log('='.repeat(60));

  if (report.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    report.errors.forEach(e => console.log(`  - ${e}`));
  }

  await mongoose.disconnect();
  return report;
}

migrate()
  .then(report => {
    if (report.errors.length === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️ Migration completed with errors. Review report above.');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Migration FAILED:', err);
    process.exit(1);
  });