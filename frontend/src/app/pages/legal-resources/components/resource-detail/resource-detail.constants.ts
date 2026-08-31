/**
 * Legal Resource Detail Constants & Statutory Types
 *
 * Source of Truth:
 * - Legal Services Authorities Act, 1987 (Section 12 Free Legal Aid Eligibility)
 * - National Legal Services Authority (NALSA) Standard Operating Procedures
 * - State Legal Services Authority (SLSA) Annual Compliance Norms
 */

export interface DocumentChecklistItem {
  id: string;
  labelEn: string;
  labelHi: string;
  noteEn: string;
  noteHi: string;
  checked: boolean;
}

export interface EligibilityCategory {
  id: string;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
  icon: string;
}

export interface ApplicationStep {
  step: number;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
}

export interface FacilityChip {
  label: string;
  iconKey: string;
  description: string;
}

export interface VerificationBadge {
  label: string;
  colorClass: string;
  tooltip: string;
}

export interface LegalResourceDetail {
  _id: string;
  name: string;
  name_hi?: string;
  type: string;
  address: string;
  address_hi?: string;
  district?: string;
  city?: string;
  state: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  contactNumber?: string[];
  email?: string[];
  website?: string;
  operatingHours?: string;
  operatingHours_hi?: string;
  lunchBreak?: string;
  isOpenNow?: boolean;
  jurisdictionLevel?: string;
  lastAuditDate?: string;
  description_hi?: string;
  facilities?: {
    hasEfiling?: boolean;
    hasLADCS?: boolean;
    hasVCRoom?: boolean;
    hasLegalAidClinic?: boolean;
    isWheelchairAccessible?: boolean;
  };
  executiveChairman?: string;
  memberSecretary?: string;
  patronInChief?: string;
  languages?: string[];
  parentAuthority?: {
    _id: string;
    name: string;
  };
  feedback?: {
    upvotes?: number;
    downvotes?: number;
  };
}

/**
 * Section 12 Free Legal Aid Statutory Categories (NALSA Mandate)
 */
export const ELIGIBILITY_CATEGORIES: EligibilityCategory[] = [
  {
    id: 'women_children',
    titleEn: 'Women & Children',
    titleHi: 'महिलाएं एवं बच्चे',
    descEn: 'All women and children are entitled to free legal aid irrespective of their income or social status.',
    descHi: 'सभी महिलाएं और बच्चे अपनी आय या सामाजिक स्थिति के बावजूद मुफ्त कानूनी सहायता के हकदार हैं।',
    icon: 'users'
  },
  {
    id: 'sc_st',
    titleEn: 'Scheduled Castes & Scheduled Tribes',
    titleHi: 'अनुसूचित जाति एवं जनजाति (SC/ST)',
    descEn: 'Members of SC/ST communities receive 100% free legal defense in all courts.',
    descHi: 'SC/ST समुदाय के सदस्यों को सभी अदालतों में 100% मुफ्त कानूनी बचाव मिलता है।',
    icon: 'shield'
  },
  {
    id: 'custody',
    titleEn: 'Persons in Custody / Undertrials',
    titleHi: 'हिरासत / विचाराधीन कैदी',
    descEn: 'Anyone in police custody, judicial custody, or jail is entitled to a free defense lawyer.',
    descHi: 'पुलिस हिरासत, न्यायिक हिरासत या जेल में बंद कोई भी व्यक्ति मुफ्त वकील का हकदार है।',
    icon: 'lock'
  },
  {
    id: 'disabled',
    titleEn: 'Persons with Disabilities',
    titleHi: 'दिव्यांगजन / मानसिक रोगी',
    descEn: 'Persons with physical disabilities, blindness, or mental illness as defined under the PwD Act.',
    descHi: 'PwD अधिनियम के तहत परिभाषित दिव्यांग व्यक्ति या मानसिक रूप से अस्वस्थ नागरिक।',
    icon: 'accessibility'
  },
  {
    id: 'trafficking',
    titleEn: 'Victims of Trafficking & Begar',
    titleHi: 'मानव तस्करी एवं बेगार के शिकार',
    descEn: 'Victims of human trafficking, forced labour, or commercial sexual exploitation.',
    descHi: 'मानव तस्करी, बंधुआ मजदूरी या शोषण के शिकार पीड़ित नागरिक।',
    icon: 'heart'
  },
  {
    id: 'disaster',
    titleEn: 'Disaster / Communal Violence Victims',
    titleHi: 'आपदा / जातीय हिंसा पीड़ित',
    descEn: 'Victims of mass disasters, ethnic violence, caste atrocities, floods, or industrial accidents.',
    descHi: 'प्राकृतिक आपदाओं, जातीय हिंसा या औद्योगिक दुर्घटनाओं के शिकार पीड़ित।',
    icon: 'alert-triangle'
  },
  {
    id: 'workmen',
    titleEn: 'Industrial Workmen',
    titleHi: 'औद्योगिक श्रमिक / मजदूर',
    descEn: 'Factory workers, construction laborers, and unorganized sector employees in labor disputes.',
    descHi: 'श्रम विवादों में शामिल कारखाने के श्रमिक, निर्माण मजदूर एवं असंगठित कामगार।',
    icon: 'briefcase'
  },
  {
    id: 'low_income',
    titleEn: 'Low Income Citizens (< ₹3 Lakh/yr)',
    titleHi: 'कम आय वर्ग (< ₹3 लाख/वर्ष)',
    descEn: 'General citizens with annual family income below statutory state ceiling (₹3,00,000 in UP).',
    descHi: 'वार्षिक पारिवारिक आय राज्य सीमा (UP में ₹3 लाख) से कम होने पर पूर्ण निःशुल्क सहायता।',
    icon: 'scale'
  }
];

/**
 * 4-Step Standard Legal Aid Application Procedure
 */
export const APPLICATION_STEPS: ApplicationStep[] = [
  {
    step: 1,
    titleEn: 'Walk-in or Online Request',
    titleHi: 'कार्यालय में आगमन या ऑनलाइन आवेदन',
    descEn: 'Visit the Front Office at the ADR Center or submit online via the NALSA legal aid portal.',
    descHi: 'ADR सेंटर के फ्रंट ऑफिस में आएं या NALSA कानूनी सहायता पोर्टल पर ऑनलाइन आवेदन करें।'
  },
  {
    step: 2,
    titleEn: 'Scrutiny & Eligibility Check',
    titleHi: 'दस्तावेज़ सत्यापन एवं पात्रता जांच',
    descEn: 'Secretary / Front Office Paralegal verifies your documents and Section 12 eligibility immediately.',
    descHi: 'सचिव / फ्रंट ऑफिस स्वयंसेवक आपके दस्तावेज़ों और धारा 12 की पात्रता की तत्काल जांच करते हैं।'
  },
  {
    step: 3,
    titleEn: 'Free Defense Counsel Assigned',
    titleHi: 'निःशुल्क पैनल वकील की नियुक्ति',
    descEn: 'Legal Aid Defense Counsel (LADCS) or panel advocate is assigned to your case within 24-48 hours.',
    descHi: '24-48 घंटों के भीतर आपके मामले के लिए निःशुल्क पैनल अधिवक्ता (LADCS) नियुक्त किया जाता है।'
  },
  {
    step: 4,
    titleEn: 'Complete Court Representation',
    titleHi: 'अदालत में पूर्ण निःशुल्क पैरवी',
    descEn: 'Your assigned lawyer drafts pleadings, files petitions, and represents you in court with ₹0 fee.',
    descHi: 'नियुक्त वकील याचिका ड्राफ्ट करते हैं और बिना किसी शुल्क (₹0) के कोर्ट में आपकी पैरवी करते हैं।'
  }
];

/**
 * Default Citizen "Before You Visit" Document Checklist
 */
export const DEFAULT_DOCUMENT_CHECKLIST: DocumentChecklistItem[] = [
  {
    id: 'govt_id',
    labelEn: 'Government Photo ID',
    labelHi: 'सरकारी पहचान पत्र',
    noteEn: 'Aadhaar Card, Voter ID, or Passport (Original + 2 self-attested copies)',
    noteHi: 'आधार कार्ड, वोटर आईडी या पासपोर्ट (मूल प्रति + 2 सत्यापित छायाप्रतियां)',
    checked: false
  },
  {
    id: 'income_proof',
    labelEn: 'Income Proof / BPL Card / Ration Card',
    labelHi: 'आय प्रमाण पत्र / राशन कार्ड / BPL कार्ड',
    noteEn: 'Required for low-income waiver (Not required for Women, Children, SC/ST, or Custody)',
    noteHi: 'कम आय छूट हेतु आवश्यक (महिलाओं, बच्चों, SC/ST या कैदियों हेतु आवश्यक नहीं)',
    checked: false
  },
  {
    id: 'case_papers',
    labelEn: 'Case FIR / Complaint / Court Summons',
    labelHi: 'मुकदमा FIR / शिकायत / कोर्ट समन कॉपी',
    noteEn: 'Copy of FIR, police notice, court summons, or previous orders if any',
    noteHi: 'FIR की प्रति, पुलिस नोटिस, कोर्ट समन या पिछले अदालती आदेश की प्रति',
    checked: false
  },
  {
    id: 'statement',
    labelEn: 'Brief Written Grievance / Application',
    labelHi: 'संक्षिप्त लिखित प्रार्थना पत्र / शिकायत',
    noteEn: 'Brief summary of issue (Front office paralegal volunteers will help draft on-site)',
    noteHi: 'समस्या का संक्षिप्त विवरण (फ्रंट ऑफिस स्वयंसेवक मौके पर तैयार करने में मदद करेंगे)',
    checked: false
  }
];