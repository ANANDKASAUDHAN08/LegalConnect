import { execSync } from 'child_process';
import path from 'path';

const SCRIPTS_DIR = __dirname;

const runScript = (scriptName: string) => {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  console.log(`\n==================================================`);
  console.log(`🏃 Running script: ${scriptName}...`);
  console.log(`==================================================`);
  try {
    execSync(`npx ts-node "${scriptPath}"`, { stdio: 'inherit' });
    console.log(`✅ Completed: ${scriptName}`);
  } catch (error: any) {
    console.error(`❌ Failed to run script: ${scriptName}`);
    process.exit(1);
  }
};

const main = () => {
  console.log('🚀 Starting Master Database Seeding Process...');
  console.log('This will populate all collections (15 Acts, Central Acts Library, Lawyers, Help Data, Resources, and SLSA/NALSA HQs).\n');

  const startTime = Date.now();

  // 1. Seed lawyers (and temporary 7 acts)
  runScript('seed.ts');

  // 2. Overwrite acts with the FULL 15 acts and Central Acts Library
  runScript('seed_full_database.ts');

  // 3. Seed help categories, roadmaps, and helplines
  runScript('seedHelpData.ts');

  // 4. Seed verified legal resources
  runScript('seedResources.ts');

  // 5. Seed State/National Legal Services Authorities (SLSA/NALSA)
  runScript('seedSlsaData.ts');

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 All data seeded successfully in ${duration}s!`);
};

main();
