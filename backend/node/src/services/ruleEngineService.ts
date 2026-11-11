import DiagnosticCrisisModel from '../models/DiagnosticCrisis';
import DiagnosticRuleModel, { IDiagnosticRule } from '../models/DiagnosticRule';

export interface EvaluationInput {
  crisisId: string;
  answers: Record<string, boolean>;
}

export interface RuleEvaluationResult {
  crisisId: string;
  status: 'VIOLATION_CONFIRMED' | 'PROCEDURAL_CLEARANCE' | 'REVIEW_REQUIRED';
  confidenceScore: number;
  isUnlawful: boolean;
  verdictTitle: string;
  verdictTitle_hi: string;
  verdictSubtitle: string;
  verdictSubtitle_hi: string;
  statutoryBasis: string;
  linkedSections: Array<{ actName: string; shortAct: string; section: string }>;
  whatToSay: string;
  whatToSay_hi: string;
  actionItems: string[];
  actionItems_hi: string[];
  helpline: string;
  helplineName: string;
  relatedRightId?: string;
  ruleVersion: number;
  provenance: {
    sourceAuthority: string;
    sourceUrl: string;
    reviewStatus: string;
    lastVerifiedAt: Date;
  };
}

class RuleEngineService {
  /**
   * Evaluates diagnostic crisis responses against active, versioned rules stored in MongoDB.
   */
  async evaluate(crisisId: string, answers: Record<string, boolean>): Promise<RuleEvaluationResult> {
    const crisis = await DiagnosticCrisisModel.findOne({ crisisId, isActive: true }).lean();
    if (!crisis) {
      throw new Error(`Diagnostic crisis "${crisisId}" not found in legal knowledge database.`);
    }

    // Retrieve active versioned rules for this crisis from database
    const rules = await DiagnosticRuleModel.find({ crisisId, isActive: true })
      .sort({ version: -1, confidenceScore: -1 })
      .lean();

    if (!rules || rules.length === 0) {
      return {
        crisisId,
        status: 'REVIEW_REQUIRED',
        confidenceScore: 50,
        isUnlawful: false,
        verdictTitle: 'Procedural Review Required',
        verdictTitle_hi: 'कानूनी समीक्षा आवश्यक',
        verdictSubtitle: 'No active deterministic statutory rules found for this scenario.',
        verdictSubtitle_hi: 'इस परिस्थिति के लिए कोई सक्रिय नियम उपलब्ध नहीं है।',
        statutoryBasis: 'Statutory Due Process / Legal Aid Review',
        linkedSections: [],
        whatToSay: 'Officer, I request clarification of the statutory grounds and written documentation before proceeding.',
        whatToSay_hi: 'अधिकारी महोदय, आगे बढ़ने से पूर्व मैं कानूनी आधार व लिखित आदेश की मांग करता/करती हूं।',
        actionItems: [
          'Document the sequence of events with exact dates and names.',
          'Consult a licensed advocate or legal aid clinic.'
        ],
        actionItems_hi: [
          'तारीख और समय के साथ घटनाओं का लिखित विवरण तैयार करें।',
          'पैनल अधिवक्ता या कानूनी सहायता केंद्र से संपर्क करें।'
        ],
        helpline: '15100',
        helplineName: 'NALSA Free Legal Aid 15100',
        ruleVersion: 1,
        provenance: {
          sourceAuthority: 'NALSA / Legal Services Authorities Act, 1987',
          sourceUrl: 'https://nalsa.gov.in',
          reviewStatus: 'verified',
          lastVerifiedAt: new Date()
        }
      };
    }

    // Find first matching rule
    let matchedRule: IDiagnosticRule | null = null;
    let anyConditionTrue = false;

    for (const rule of rules) {
      if (!rule.conditions || rule.conditions.length === 0) continue;

      let conditionCount = 0;
      let matchedCount = 0;

      for (const cond of rule.conditions) {
        if (answers[cond.questionId] !== undefined) {
          conditionCount++;
          if (answers[cond.questionId] === cond.expectedAnswer) {
            matchedCount++;
            anyConditionTrue = true;
          }
        }
      }

      if (rule.triggerWhen === 'ALL_MATCH') {
        if (conditionCount === rule.conditions.length && matchedCount === rule.conditions.length) {
          matchedRule = rule as any;
          break;
        }
      } else {
        // ANY_MATCH
        if (matchedCount > 0) {
          matchedRule = rule as any;
          break;
        }
      }
    }

    if (matchedRule) {
      return {
        crisisId,
        status: matchedRule.status,
        confidenceScore: matchedRule.confidenceScore,
        isUnlawful: matchedRule.status === 'VIOLATION_CONFIRMED',
        verdictTitle: matchedRule.verdictTitle,
        verdictTitle_hi: matchedRule.verdictTitle_hi,
        verdictSubtitle: matchedRule.verdictSubtitle,
        verdictSubtitle_hi: matchedRule.verdictSubtitle_hi,
        statutoryBasis: matchedRule.statutoryBasis,
        linkedSections: matchedRule.linkedSections || [],
        whatToSay: matchedRule.whatToSay,
        whatToSay_hi: matchedRule.whatToSay_hi,
        actionItems: matchedRule.actionItems || [],
        actionItems_hi: matchedRule.actionItems_hi || [],
        helpline: matchedRule.helpline,
        helplineName: matchedRule.helplineName,
        relatedRightId: matchedRule.relatedRightId,
        ruleVersion: matchedRule.version || 1,
        provenance: {
          sourceAuthority: matchedRule.provenance?.sourceAuthority || 'Ministry of Law and Justice',
          sourceUrl: matchedRule.provenance?.sourceUrl || 'https://legislative.gov.in',
          reviewStatus: matchedRule.provenance?.reviewStatus || 'verified',
          lastVerifiedAt: matchedRule.provenance?.lastVerifiedAt || new Date()
        }
      };
    }

    // Clearance state when all answers are negative (or no violation condition triggered)
    return {
      crisisId,
      status: 'PROCEDURAL_CLEARANCE',
      confidenceScore: 92,
      isUnlawful: false,
      verdictTitle: anyConditionTrue ? 'Procedural Clarification Needed' : 'Standard Statutory Procedure Applicable',
      verdictTitle_hi: anyConditionTrue ? 'कानूनी स्पष्टीकरण आवश्यक' : 'मानक कानूनी प्रक्रिया लागू',
      verdictSubtitle: 'No active violation triggered under the submitted facts; standard administrative rules apply.',
      verdictSubtitle_hi: 'दिए गए तथ्यों के आधार पर किसी नियम का उल्लंघन नहीं पाया गया; सामान्य प्रशासनिक नियम लागू होते हैं।',
      statutoryBasis: 'Indian Statutory Framework & Administrative Procedure',
      linkedSections: [],
      whatToSay: 'Officer, kindly provide the relevant official notification and receipt for the procedural step.',
      whatToSay_hi: 'अधिकारी महोदय, कृपया इस प्रक्रिया के संबंध में आधिकारिक अधिसूचना व रसीद प्रदान करें।',
      actionItems: [
        'Request a formal written receipt or acknowledgment for all documents exchanged.',
        'Keep records of all correspondence and officer designations.'
      ],
      actionItems_hi: [
        'सभी लेन-देन और दस्तावेजों की लिखित रसीद या पावती मांगें।',
        'संबंधित अधिकारियों के पद और पत्राचार का रिकॉर्ड रखें।'
      ],
      helpline: '112',
      helplineName: 'Citizen Emergency & Redressal 112',
      ruleVersion: 1,
      provenance: {
        sourceAuthority: 'Ministry of Law and Justice',
        sourceUrl: 'https://legislative.gov.in',
        reviewStatus: 'verified',
        lastVerifiedAt: new Date()
      }
    };
  }
}

export const ruleEngineService = new RuleEngineService();
export default ruleEngineService;