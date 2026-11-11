/**
 * @file rights-helpers.util.ts
 * @description Centralized, institutional-grade statutory rights utilities for LegalConnect.
 * Encapsulates presentation helpers, bilingual language resolution (English & Hindi),
 * authoritative confrontation verbal scripts ("What to Say"), procedural Do's & Don'ts matrices,
 * multi-platform sharing builders, and formal legal citation generators.
 *
 * Designed to eliminate code duplication across parent views, drawers, modals, and crisis triages.
 */

import { StatutoryRight } from '../../../services/rights.service';

/**
 * Resolves the display title for a statutory right respecting the active language.
 *
 * @param right The statutory right model or null/undefined
 * @param lang Active language ISO code ('en' | 'hi')
 * @returns Localized or default title string
 */
export function getRightTitle(right: StatutoryRight | null | undefined, lang: string = 'en'): string {
  if (!right) return '';
  if (lang === 'hi' && right.title_hi?.trim()) {
    return right.title_hi.trim();
  }
  return right.title || '';
}

/**
 * Resolves the executive summary for a statutory right respecting the active language.
 *
 * @param right The statutory right model or null/undefined
 * @param lang Active language ISO code ('en' | 'hi')
 * @returns Localized or default summary string
 */
export function getRightSummary(right: StatutoryRight | null | undefined, lang: string = 'en'): string {
  if (!right) return '';
  if (lang === 'hi' && right.summary_hi?.trim()) {
    return right.summary_hi.trim();
  }
  return right.summary || '';
}

/**
 * Resolves the authoritative spoken confrontation script ("What to Say").
 * Follows strict priority order:
 * 1. Bilingual Hindi script (when lang === 'hi' and whatToSay_hi is defined)
 * 2. Database/Admin-authored verbatim script (whatToSay)
 * 3. High-fidelity scenario-specific codified scripts (traffic police, arrest, cyber fraud, tenancy, healthcare, etc.)
 * 4. Fallback statutory assertion derived from act name, sections, and remedy
 *
 * @param right The statutory right model or null/undefined
 * @param lang Active language ISO code ('en' | 'hi')
 * @returns Spoken script formatted for verbatim reading
 */
export function getRightWhatToSay(right: StatutoryRight | null | undefined, lang: string = 'en'): string {
  if (!right) return '';

  // 1. Bilingual Hindi priority
  if (lang === 'hi' && right.whatToSay_hi?.trim()) {
    return right.whatToSay_hi.trim();
  }

  // 2. Dynamic DB / Admin-authored verbal script priority
  if (right.whatToSay?.trim()) {
    return right.whatToSay.trim();
  }

  const act = right.statutoryBasis?.shortAct || right.statutoryBasis?.actName || 'Codified Law';
  const sec = (right.statutoryBasis?.sections || []).join(', ');
  const remedy = right.legalRemedy || 'applicable statutory authorities';
  const tag = (right.scenarioTag || '').toLowerCase();
  const id = (right.id || '').toLowerCase();

  // 3. Scenario-specific confrontation directives
  if (tag === 'traffic-police' || id.includes('traffic')) {
    if (lang === 'hi') {
      return `अधिकारी महोदय, केंद्रीय मोटर वाहन नियम 139 और आईटी एक्ट की धारा 4 के तहत डिजिलॉकर और एम-परिवहन पर दिखाए गए डिजिटल दस्तावेज मान्य हैं। साथ ही, बिना वैध चालान मेमो के वाहन की चाबी निकालना अवैध है।`;
    }
    return `Officer, under Rule 139 of the Central Motor Vehicles Rules and Section 4 of the IT Act, digital documents presented via DigiLocker and mParivahan are statutory originals. Also, vehicle keys cannot be removed from ignition without a formal challan memo.`;
  }

  if (tag === 'police-stop' || id.includes('arrest') || id.includes('police')) {
    if (lang === 'hi') {
      return `अधिकारी महोदय, भारतीय नागरिक सुरक्षा संहिता (BNSS 2023) की धारा 35(3) और अर्नेश कुमार बनाम बिहार राज्य के दिशानिर्देशों के तहत गिरफ्तारी से पूर्व लिखित उपस्थिति नोटिस अनिवार्य है। कृपया मुझे गिरफ्तारी का लिखित आधार दिखाएं और धारा 47 के तहत परिजनों को सूचित करने दें।`;
    }
    return `Officer, under Section 35(3) of the Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) and Supreme Court guidelines in Arnesh Kumar vs State of Bihar, a formal written Notice of Appearance is mandatory prior to arrest. May I respectfully see the written grounds of arrest and exercise my right to notify my family under Section 47?`;
  }

  if (tag === 'cyber-scam' || id.includes('cyber') || id.includes('fraud')) {
    if (lang === 'hi') {
      return `मैं आरबीआई के 72 घंटे के शून्य-देनदारी (Zero-Liability) नियम के तहत अनधिकृत लेन-देन की रिपोर्ट कर रहा हूँ। कृपया यूटीआर नंबर दर्ज करें, नेशनल साइबर पोर्टल (हेल्पलाइन 1930) के तहत प्राप्तकर्ता खाते को तत्काल फ्रीज करें और औपचारिक शिकायत पावती दें।`;
    }
    return `I am reporting an unauthorized financial transaction within the RBI 72-Hour Zero-Liability window. Please record the transaction UTR number, freeze the beneficiary wallet/account under National Cyber Crime Protocol (Helpline 1930), and furnish an official complaint acknowledgment number.`;
  }

  if (tag === 'tenant-eviction' || id.includes('tenant') || id.includes('landlord')) {
    if (lang === 'hi') {
      return `मॉडल टेनेंसी एक्ट और बीएनएस की धारा 432 के तहत सक्षम न्यायालय के आदेश के बिना बिजली, पानी जैसी आवश्यक सेवाएं काटना या जबरन बेदखल करना गैरकानूनी अतिक्रमण और आपराधिक कृत्य है। कृपया सेवाएं तुरंत बहाल करें।`;
    }
    return `Under Section 432 of the Bharatiya Nyaya Sanhita (BNS) and the Model Tenancy Act, disconnecting essential services like water or electricity or locking out a tenant without a competent court decree constitutes criminal trespass. Please restore utilities immediately.`;
  }

  if (tag === 'medical-emergency' || id.includes('patient') || id.includes('hospital')) {
    if (lang === 'hi') {
      return `सर्वोच्च न्यायालय के परमानंद कटारा बनाम भारत संघ फैसले और अनुच्छेद 21 के तहत सभी अस्पतालों के लिए अग्रिम भुगतान या पुलिस औपचारिकताओं के बिना आपातकालीन जीवनरक्षक चिकित्सा प्रदान करना कानूनी रूप से अनिवार्य है।`;
    }
    return `Under the landmark Supreme Court ruling in Parmanand Katara vs Union of India and Article 21, hospitals are statutorily mandated to provide immediate emergency trauma stabilization care without demanding upfront monetary deposits or police clearance.`;
  }

  if (tag === 'flight-delay' || id.includes('flight') || id.includes('aviation')) {
    return `Under the DGCA Civil Aviation Requirements (CAR Section 3, Series M, Part IV), as this delay exceeds statutory limits, passengers are entitled to complimentary refreshments, alternate travel or full refund, and mandatory delay compensation. Kindly provide a written delay certificate.`;
  }

  if (tag === 'ecommerce-refund' || id.includes('consumer') || id.includes('refund')) {
    return `Under Section 2(7) of the Consumer Protection Act 2019 and E-Commerce Rules 2020, refusing refund for a defective product constitutes an unfair trade practice. I demand an unconditional reversal of the transaction within 48 hours, failing which this will be filed before e-Daakhil and Helpline 1915.`;
  }

  if (tag === 'workplace-harassment' || id.includes('posh') || id.includes('workplace')) {
    return `Under the Sexual Harassment of Women at Workplace (POSH) Act 2013, I am formally requesting this complaint be referred to the Internal Committee (IC) with complete statutory confidentiality and interim protection from retaliation under Section 12.`;
  }

  // 4. Default authoritative fallback
  if (lang === 'hi') {
    return `मैं ${act}${sec ? ' (' + sec + ')' : ''} के तहत अपने कानूनी अधिकारों का प्रयोग कर रहा हूँ। इसका कोई भी मनमाना उल्लंघन ${remedy} के समक्ष औपचारिक विधिक कार्यवाही को आकर्षित करता है।`;
  }

  return `I am asserting my statutory protection codified under ${act}${sec ? ' (' + sec + ')' : ''}. The law guarantees: "${right.summary || 'Statutory legal protection'}". Any arbitrary non-compliance attracts direct statutory escalation before ${remedy}.`;
}

/**
 * Resolves the structured Do's & Don'ts guidance matrix for a statutory right.
 *
 * @param right The statutory right model or null/undefined
 * @param lang Active language ISO code ('en' | 'hi')
 * @returns Object containing dos and donts string arrays
 */
export function getRightDosAndDonts(right: StatutoryRight | null | undefined, lang: string = 'en'): { dos: string[]; donts: string[] } {
  if (!right) {
    return { dos: [], donts: [] };
  }

  // 1. Bilingual Hindi priority
  if (lang === 'hi' && right.dos_hi && right.dos_hi.length > 0 && right.donts_hi && right.donts_hi.length > 0) {
    return { dos: right.dos_hi, donts: right.donts_hi };
  }

  // 2. Dynamic DB / Admin-authored matrix priority
  if (right.dos && right.dos.length > 0 && right.donts && right.donts.length > 0) {
    return { dos: right.dos, donts: right.donts };
  }

  const act = right.statutoryBasis?.shortAct || right.statutoryBasis?.actName || 'governing statute';
  const tag = (right.scenarioTag || '').toLowerCase();
  const id = (right.id || '').toLowerCase();

  // 3. Scenario-tailored matrices
  if (tag === 'traffic-police' || id.includes('traffic')) {
    return {
      dos: [
        'Present digital documents via DigiLocker / mParivahan QR code.',
        'Politely record officer designation, name, and uniform badge number.',
        'Demand a computer-generated e-challan or contest directly via Virtual Court.'
      ],
      donts: [
        'Do NOT hand over cash bribes without a valid treasury receipt.',
        'Do NOT permit physical seizure of vehicle keys without an official seizure memo.',
        'Do NOT engage in physical conflict; document interactions calmly.'
      ]
    };
  }

  if (tag === 'police-stop' || id.includes('arrest') || id.includes('police')) {
    return {
      dos: [
        'Politely ask for officer identity and statutory written grounds of arrest.',
        'Ensure an Arrest Memo is witnessed and signed by a family member or local respectable citizen.',
        'Immediately request to contact family and legal counsel or call NALSA legal aid at 15100.'
      ],
      donts: [
        'Do NOT sign blank documents, incomplete forms, or unverified statements.',
        'Women cannot be arrested between sunset and sunrise without a Judicial Magistrate special order.',
        'Do NOT resist physically; invoke your rights calmly under Section 35 of BNSS 2023.'
      ]
    };
  }

  if (tag === 'cyber-scam' || id.includes('cyber') || id.includes('fraud')) {
    return {
      dos: [
        'Dial National Helpline 1930 immediately within the first 2 hours (Golden Hour).',
        'File an official report on cybercrime.gov.in and download the acknowledgment PDF.',
        'Notify your bank in writing within 72 hours for zero customer liability protection.'
      ],
      donts: [
        'Do NOT click on unverified recovery links sent via SMS, WhatsApp, or Telegram.',
        'Do NOT delete OTP SMS messages, transaction confirmation emails, or call logs.',
        'Do NOT share UPI PINs or card details with anyone claiming to represent bank fraud units.'
      ]
    };
  }

  if (tag === 'tenant-eviction' || id.includes('tenant') || id.includes('landlord')) {
    return {
      dos: [
        'Retain electronic bank transaction receipts and records for all rent payments.',
        'Serve a written statutory notice if essential amenities are unlawfully disrupted.',
        'Approach the Rent Controller or lodge a police General Diary entry for criminal trespass.'
      ],
      donts: [
        'Do NOT vacate premises under verbal intimidation without a formal court decree.',
        'Do NOT stop paying documented rent without clear statutory authorization.',
        'Do NOT engage in physical altercations; document utility disruption with video evidence.'
      ]
    };
  }

  if (tag === 'medical-emergency' || id.includes('patient') || id.includes('hospital')) {
    return {
      dos: [
        'Cite the Supreme Court Parmanand Katara ruling at hospital admission triage.',
        'Demand immediate emergency life-saving stabilization care prior to billing disputes.',
        'Contact the Chief Medical Officer (CMO) or emergency helpline 112 if care is refused.'
      ],
      donts: [
        'Hospitals CANNOT detain deceased bodies or patients over unsettled billing balances.',
        'Do NOT delay emergency treatment for completion of police medico-legal formalities.',
        'Do NOT accept verbal refusal; ask for a written refusal memo from the attending physician.'
      ]
    };
  }

  // 4. Fallback statutory guidance
  if (lang === 'hi') {
    return {
      dos: [
        `संवैधानिक प्रावधान ${act} के तहत अपने अधिकार दर्ज कराएं।`,
        'अधिकारी का नाम, पद और घटना का समय व स्थान लिखित रूप में नोट करें।',
        'सक्षम कानूनी मंच के समक्ष तत्काल आधिकारिक निवारण याचिका प्रस्तुत करें।'
      ],
      donts: [
        'कानूनी प्रक्रिया को बायपास करने वाले किसी अनधिकृत दस्तावेज पर हस्ताक्षर न करें।',
        'कानून के विपरीत की गई किसी भी मनमानी मांग के आगे न झुकें।',
        'वैधानिक समय-सीमा (Limitation Period) समाप्त होने से पूर्व कार्रवाई करें।'
      ]
    };
  }

  return {
    dos: [
      'Document all communications, receipts, timestamps, and officer IDs in writing.',
      `Assert statutory protection under ${act}.`,
      `Escalate formally through ${right.legalRemedy || 'statutory grievance mechanisms'}.`
    ],
    donts: [
      'Do NOT rely on verbal assurances without formal written acknowledgment.',
      'Do NOT ignore statutory limitation periods for filing formal disputes.',
      'Do NOT waive your constitutional remedies under Article 226/32.'
    ]
  };
}

/**
 * Returns Do's list for a statutory right.
 */
export function getRightDos(right: StatutoryRight | null | undefined, lang: string = 'en'): string[] {
  return getRightDosAndDonts(right, lang).dos;
}

/**
 * Returns Don'ts list for a statutory right.
 */
export function getRightDonts(right: StatutoryRight | null | undefined, lang: string = 'en'): string[] {
  return getRightDosAndDonts(right, lang).donts;
}

/**
 * Generates an absolute deep-link URL to view a specific statutory right.
 *
 * @param rightId Right identifier (slug or code)
 * @returns Fully qualified or relative deep-link URL
 */
export function getRightShareUrl(rightId?: string): string {
  if (!rightId) return '';
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/rights?detail=${rightId}`;
  }
  return `/rights?detail=${rightId}`;
}

/**
 * Formats a concise, descriptive subject line for sharing a right via email/message.
 */
export function getRightShareSubject(
  right: StatutoryRight | null | undefined,
  lang: string = 'en',
  fallbackPrefix: string = 'LegalConnect Citizen Statutory Protection'
): string {
  if (!right) return fallbackPrefix;
  const title = getRightTitle(right, lang);
  return `${title} | LegalConnect`;
}

/**
 * Formats a rich plaintext summary payload for copying or dispatching via WhatsApp/messaging.
 */
export function getRightShareText(
  right: StatutoryRight | null | undefined,
  lang: string = 'en',
  options?: { prefix?: string; includeDirective?: boolean }
): string {
  if (!right) return '';
  const title = getRightTitle(right, lang);
  const summary = getRightSummary(right, lang);
  const act = right.statutoryBasis ? `\nStatute: ${right.statutoryBasis.actName || right.statutoryBasis.shortAct}` : '';
  const prefix = options?.prefix || 'Statutory Legal Protection:';
  const directive = (options?.includeDirective && right.whatToSay)
    ? `\n\nAuthority Directive:\n"${getRightWhatToSay(right, lang)}"`
    : '';

  return `${prefix} ${title}\n${summary}${act}${directive}\n\nVerified via LegalConnect:`;
}

/**
 * Formats the legal citation string (Sections + Act Name + Verification tag).
 */
export function getRightCitationText(
  right: StatutoryRight | null | undefined,
  verifiedSuffix: boolean = false
): string {
  if (!right) return '';
  let citation = '';
  if (right.statutoryBasis) {
    const act = right.statutoryBasis.actName || right.statutoryBasis.shortAct;
    const sec = right.statutoryBasis.sections?.join(', ') || '';
    citation = `${sec ? sec + ', ' : ''}${act}`;
  } else {
    citation = right.title;
  }
  return verifiedSuffix ? `${citation} — [Verified by LegalConnect Council]` : citation;
}

/**
 * Generates a clean snackbar confirmation string for citation copy events.
 */
export function getCitationSuccessMessage(right: StatutoryRight | null | undefined): string {
  if (!right) return 'Copied Citation';
  const citation = getRightCitationText(right, false);
  return `Copied Citation: ${citation}`;
}