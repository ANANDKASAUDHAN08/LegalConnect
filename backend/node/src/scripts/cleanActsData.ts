import dotenv from 'dotenv';
import { connectDB } from '../config/db';
import BareAct, { SectionModel } from '../models/BareAct';
import { normalizeActInfo } from '../utils/actNormalizer';

dotenv.config();

async function cleanAllActs() {
  await connectDB();
  console.log('🧹 Starting database cleanup for Bare Acts titles and short names...');

  const acts = await BareAct.find({});
  console.log(`Found ${acts.length} acts in database.`);

  let updatedCount = 0;

  for (const act of acts) {
    const originalName = act.actName || (act as any).name || (act as any).title;
    const originalShortName = act.shortName;
    const year = act.year;

    const normalized = normalizeActInfo(originalName, originalShortName, year);

    let needsUpdate = false;
    const updateObj: any = {};

    if (normalized.actName !== originalName) {
      updateObj.actName = normalized.actName;
      needsUpdate = true;
    }
    if (normalized.shortName !== originalShortName) {
      updateObj.shortName = normalized.shortName;
      needsUpdate = true;
    }

    if (needsUpdate) {
      try {
        console.log(`✏️ Updating Act ID ${act._id}:`);
        console.log(`   Old: "${originalShortName}" -> "${originalName}"`);
        console.log(`   New: "${normalized.shortName}" -> "${normalized.actName}"`);

        // Check if an act with the target actName already exists (other than this one)
        const duplicate = await BareAct.findOne({
          _id: { $ne: act._id },
          actName: normalized.actName
        });

        if (duplicate) {
          console.log(`⚠️ Duplicate found for "${normalized.actName}". Removing duplicate act record ${act._id} in favor of existing ${duplicate._id}...`);
          // Re-point any sections using act.shortName to duplicate.shortName
          await SectionModel.updateMany(
            { actShortName: originalShortName },
            { $set: { actShortName: duplicate.shortName } }
          );
          await BareAct.deleteOne({ _id: act._id });
          continue;
        }

        // Update Act document
        await BareAct.updateOne({ _id: act._id }, { $set: updateObj });

        // If shortName changed, update associated sections as well
        if (normalized.shortName !== originalShortName) {
          const secRes = await SectionModel.updateMany(
            { actShortName: originalShortName },
            { $set: { actShortName: normalized.shortName } }
          );
          console.log(`   Updated ${secRes.modifiedCount} sections from "${originalShortName}" to "${normalized.shortName}".`);
        }

        updatedCount++;
      } catch (err: any) {
        console.warn(`⚠️ Skipped act update for ${act._id}: ${err.message}`);
      }
    }
  }

  console.log(`✅ Cleanup complete! Updated ${updatedCount} acts.`);
  process.exit(0);
}

cleanAllActs().catch((err) => {
  console.error('❌ Error during acts cleanup:', err);
  process.exit(1);
});