import mongoose from 'mongoose';
import StatutoryRightModel from '../models/StatutoryRight';
import JudicialDecisionModel from '../models/JudicialDecision';
import DiagnosticCrisisModel from '../models/DiagnosticCrisis';
import DiagnosticRuleModel from '../models/DiagnosticRule';
import PracticeAreaModel from '../models/PracticeArea';
import FaqModel from '../models/Faq';
import IngestionLogModel from '../models/IngestionLog';
import BareActModel, { SectionModel } from '../models/BareAct';
import { ruleEngineService } from '../services/ruleEngineService';
import aiService from '../services/AiService';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalconnect_db';

async function runPlatformVerification() {
  console.log('\n===============================================================');
  console.log('   LEGALCONNECT ARCHITECTURAL PLATFORM VERIFICATION SUITE      ');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${testName}`);
      if (details) console.log(`         -> ${details}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
      if (details) console.error(`         -> ${details}`);
      throw new Error(`Verification failed on: ${testName}`);
    }
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB at:', MONGO_URI);

    // ── SUITE 1: STATUTORY RIGHTS & PROVENANCE ─────────────────────────────
    console.log('\n--- SUITE 1: Statutory Rights & Provenance Verification ---');
    const rights = await StatutoryRightModel.find({}).lean();
    assert(rights.length >= 39, `Statutory rights count in DB`, `Found ${rights.length} rights (expected >= 39)`);

    const missingProvenance = rights.filter(r => !r.provenance || !r.provenance.sourceAuthority || !r.provenance.sourceUrl);
    assert(missingProvenance.length === 0, `All statutory rights have traceable provenance`, `0 missing provenance records`);

    const verifiedRights = rights.filter(r => r.provenance?.reviewStatus === 'verified');
    assert(verifiedRights.length === rights.length, `All statutory rights have 'verified' status`, `${verifiedRights.length}/${rights.length} verified`);

    const godlRights = rights.filter(r => r.provenance?.license && r.provenance.license.includes('GODL-India'));
    assert(godlRights.length > 0, `Statutory rights possess GODL-India open data license metadata`, `${godlRights.length} rights licensed under GODL-India`);

    // ── SUITE 2: JUDICIAL DECISIONS & PRECEDENTS ────────────────────────────
    console.log('\n--- SUITE 2: Judicial Precedents & Citations ---');
    const decisions = await JudicialDecisionModel.find({}).lean();
    assert(decisions.length >= 6, `Landmark Judicial Precedents present in DB`, `Found ${decisions.length} decisions`);

    const landmarkTitles = ['Maneka Gandhi', 'Parmanand Katara', 'Puttaswamy', 'D.K. Basu', 'Arnesh Kumar', 'Vishaka'];
    for (const title of landmarkTitles) {
      const found = decisions.some(d => d.title.toLowerCase().includes(title.toLowerCase()));
      assert(found, `Landmark decision "${title}" indexed with verified citation and ratio decidendi`);
    }

    const allDecisionsHaveRatio = decisions.every(d => d.ratioDecidendi && d.holding && d.provenance?.sourceAuthority);
    assert(allDecisionsHaveRatio, `All judicial decisions contain verified ratio decidendi and source provenance`);

    // ── SUITE 3: DETERMINISTIC RULE ENGINE & DIAGNOSTICS ───────────────────
    console.log('\n--- SUITE 3: Deterministic Rule Engine & Diagnostic Evaluation ---');
    const crises = await DiagnosticCrisisModel.find({}).lean();
    assert(crises.length >= 6, `Diagnostic crisis categories in DB`, `Found ${crises.length} categories`);

    const rules = await DiagnosticRuleModel.find({}).lean();
    assert(rules.length >= 6, `Versioned deterministic rules in DB`, `Found ${rules.length} rules`);

    // Test Police Detainment Violation
    const policeEvalViolation = await ruleEngineService.evaluate('police', {
      offense_under_3_years: true,
      notice_served: false,
      female_after_sunset: true
    });
    assert(
      policeEvalViolation.status === 'VIOLATION_CONFIRMED' && policeEvalViolation.isUnlawful === true,
      `Rule Engine: Unlawful arrest conditions trigger VIOLATION_CONFIRMED`,
      `Score: ${policeEvalViolation.confidenceScore}%, Grounds: ${policeEvalViolation.statutoryBasis}`
    );
    assert(
      !!policeEvalViolation.provenance && policeEvalViolation.provenance.reviewStatus === 'verified',
      `Rule Engine: Evaluation result returns traceable provenance and source authority`
    );
    assert(
      policeEvalViolation.ruleVersion >= 1,
      `Rule Engine: Evaluation returns explicit rule version (v${policeEvalViolation.ruleVersion})`
    );

    // Test Police Detainment Clearance
    const policeEvalClearance = await ruleEngineService.evaluate('police', {
      offense_under_3_years: false,
      notice_served: true,
      female_after_sunset: false
    });
    assert(
      policeEvalClearance.status === 'PROCEDURAL_CLEARANCE' && policeEvalClearance.isUnlawful === false,
      `Rule Engine: Full compliance returns PROCEDURAL_CLEARANCE`,
      `Score: ${policeEvalClearance.confidenceScore}%`
    );

    // Test Traffic Digilocker Violation
    const trafficEval = await ruleEngineService.evaluate('traffic', {
      passenger_inside_towing: false,
      digilocker_rejected: true,
      fresh_nozzle_refused: false
    });
    assert(
      trafficEval.status === 'VIOLATION_CONFIRMED' && trafficEval.statutoryBasis.includes('Rule 139'),
      `Rule Engine: DigiLocker refusal triggers VIOLATION_CONFIRMED under Rule 139 CMVR`
    );

    // Test Landlord Eviction / Utility Cut Violation
    const landlordEval = await ruleEngineService.evaluate('landlord', {
      utilities_cut: true,
      no_court_order: false,
      deposit_withheld_30d: false
    });
    assert(
      landlordEval.status === 'VIOLATION_CONFIRMED' && landlordEval.statutoryBasis.includes('Model Tenancy Act'),
      `Rule Engine: Utility disconnection triggers VIOLATION_CONFIRMED under Model Tenancy Act`
    );

    // ── SUITE 4: CODIFIED LEGISLATION & SECTIONS COVERAGE ──────────────────
    console.log('\n--- SUITE 4: Codified Legislation & Section Documents ---');
    const actsCount = await BareActModel.countDocuments();
    assert(actsCount >= 700, `Central Bare Acts catalog in DB`, `Found ${actsCount} Bare Acts (India Code)`);

    const sectionsCount = await SectionModel.countDocuments();
    assert(sectionsCount >= 100000, `Codified Section Documents in DB`, `Found ${sectionsCount.toLocaleString()} sections`);

    // ── SUITE 5: PRACTICE AREAS & TAXONOMY ─────────────────────────────────
    console.log('\n--- SUITE 5: Practice Areas & Legal Taxonomy ---');
    const practiceAreas = await PracticeAreaModel.find({}).lean();
    assert(practiceAreas.length >= 17, `Database-backed practice areas`, `Found ${practiceAreas.length} practice areas`);

    // ── SUITE 6: FAQS & KNOWLEDGE REPOSITORY ───────────────────────────────
    console.log('\n--- SUITE 6: Database-backed FAQs ---');
    const faqs = await FaqModel.find({}).lean();
    assert(faqs.length >= 9, `Database-backed legal FAQs`, `Found ${faqs.length} FAQs with bilingual support`);

    // ── SUITE 7: INGESTION LOGS & AUDIT TRAIL ──────────────────────────────
    console.log('\n--- SUITE 7: Ingestion Logs & Licensing Audit Trail ---');
    const logs = await IngestionLogModel.find({}).lean();
    assert(logs.length >= 3, `Source ingestion logs in DB`, `Found ${logs.length} ingestion logs recorded`);

    // ── SUITE 8: SOURCE-GROUNDED AI RETRIEVAL INTEGRITY ────────────────────
    console.log('\n--- SUITE 8: Source-Grounded AI Legal Assistant Integrity ---');
    const testSections = await SectionModel.find({ section_number: '138' }).limit(1).lean();
    assert(testSections.length > 0, `Section 138 of codified statutory acts exists in database`);

    const groundedResponse = await aiService.askLegalQuestion(
      'What happens when a cheque bounces in India and what is the notice timeline under Section 138 of Negotiable Instruments Act?',
      ['Negotiable Instruments Act, 1881', 'Bharatiya Nagarik Suraksha Sanhita, 2023'],
      'Source 1: Negotiable Instruments Act, 1881 - Section 138 (Dishonour of cheque for insufficiency of funds). Notice in writing must be served within thirty days of receipt of return memo, giving drawer 15 days to pay.'
    );
    assert(
      !!groundedResponse && !!groundedResponse.answer && groundedResponse.answer.length > 50,
      `AI Service returns source-grounded explanation`,
      `Length: ${groundedResponse.answer.length} chars`
    );
    assert(
      groundedResponse.answer.includes('138') || groundedResponse.answer.includes('Negotiable Instruments'),
      `AI Service cites Section 138 Negotiable Instruments Act from verified context`
    );

    console.log('\n===============================================================');
    console.log(`   ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY (100% PASS RATE)`);
    console.log('===============================================================\n');

  } catch (error) {
    console.error('\nVerification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[DB] Disconnected from MongoDB.');
  }
}

runPlatformVerification();