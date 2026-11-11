export interface DiagnosticQuestion {
  id: string;
  question: string;
  question_hi: string;
  hint: string;
  hint_hi: string;
}

export interface DiagnosticCrisis {
  id: string;
  title: string;
  title_hi: string;
  icon: string;
  color: string;
  summary: string;
  summary_hi: string;
  questions: DiagnosticQuestion[];
}

export interface DiagnosticEvaluation {
  crisisId?: string;
  status: 'VIOLATION_CONFIRMED' | 'PROCEDURAL_CLEARANCE';
  confidenceScore: number;
  isUnlawful?: boolean;
  verdictTitle: string;
  verdictTitle_hi: string;
  verdictSubtitle: string;
  verdictSubtitle_hi: string;
  statutoryBasis: string;
  whatToSay: string;
  whatToSay_hi: string;
  actionItems: string[];
  actionItems_hi: string[];
  helpline: string;
  helplineName: string;
  relatedRightId?: string;
}

export const DEFAULT_DIAGNOSTIC_CRISES: DiagnosticCrisis[] = [
  {
    id: 'police',
    title: 'Police Confrontation & Custody',
    title_hi: 'पुलिस द्वारा रोकना या हिरासत में लेना',
    icon: 'shield',
    color: 'rose',
    summary: 'Arrest procedures, interrogation limits, notice of appearance & women custody safeguards.',
    summary_hi: 'गिरफ्तारी के नियम, नोटिस की अनिवार्यता और महिलाओं की हिरासत के नियम।',
    questions: [
      {
        id: 'offense_under_3_years',
        question: 'Is the alleged offence punishable with less than 3 years of imprisonment (or bailable)?',
        question_hi: 'क्या कथित आरोप में 3 साल से कम सजा का प्रावधान है (या जमानती है)?',
        hint: 'Under BNSS Sec 35(3), arrests for offences under 3 years are forbidden without prior SP permission & formal notice.',
        hint_hi: 'बीएनएसएस धारा 35(3) के अनुसार 3 वर्ष से कम सजा वाले अपराधों में सीधे गिरफ्तारी वर्जित है।'
      },
      {
        id: 'notice_served',
        question: 'Did the police officer serve you a formal written Notice of Appearance beforehand?',
        question_hi: 'क्या पुलिस अधिकारी ने आपको पहले औपचारिक लिखित नोटिस (Notice of Appearance) दिया?',
        hint: 'Failure to issue a statutory notice under BNSS Section 35(3) makes any attempted arrest unlawful.',
        hint_hi: 'लिखित नोटिस के बिना गिरफ्तारी का प्रयास गैरकानूनी माना जाता है।'
      },
      {
        id: 'female_after_sunset',
        question: 'Is the person being arrested or summoned a female between sunset and sunrise (night)?',
        question_hi: 'क्या हिरासत में ली जाने वाली व्यक्ति महिला है और समय सूर्यास्त से सूर्योदय के बीच (रात) का है?',
        hint: 'BNSS Section 46 & CrPC 46(4) strictly forbid night arrests of women without a Judicial Magistrate order.',
        hint_hi: 'धारा 46 के तहत न्यायिक मजिस्ट्रेट के विशेष आदेश के बिना रात में महिला की गिरफ्तारी वर्जित है।'
      }
    ]
  },
  {
    id: 'traffic',
    title: 'Traffic Police Stop & Vehicle Towing',
    title_hi: 'ट्रैफिक पुलिस चेकिंग और गाड़ी क्रेन से उठाना',
    icon: 'zap',
    color: 'amber',
    summary: 'Occupied car towing bans, DigiLocker digital credentials validity & breathalyzer hygiene rules.',
    summary_hi: 'गाड़ी में बैठे होने पर टो करने पर रोक, डिजिलॉकर की मान्यता और ब्रीथ एनालाइजर नियम।',
    questions: [
      {
        id: 'passenger_inside_towing',
        question: 'Are you or any passenger seated inside the vehicle while the crane is attempting to tow it?',
        question_hi: 'क्या क्रेन द्वारा गाड़ी उठाते समय आप या कोई सवारी कार/वाहन के अंदर बैठी है?',
        hint: 'Section 127 MVA strictly forbids towing or hoisting any vehicle while human occupants are inside.',
        hint_hi: 'मोटर वाहन अधिनियम धारा 127 के तहत अंदर बैठे व्यक्ति के साथ गाड़ी उठाना पूर्णतः गैरकानूनी है।'
      },
      {
        id: 'digilocker_rejected',
        question: 'Did the officer refuse to accept valid electronic DL/RC displayed on DigiLocker or mParivahan?',
        question_hi: 'क्या ट्रैफिक पुलिस ने डिजिलॉकर या एम-परिवहन पर दिखाए गए डिजिटल DL/RC को मानने से मना किया?',
        hint: 'Rule 139 CMVR & Section 4 IT Act grant full statutory equivalence to verified digital documents.',
        hint_hi: 'केंद्रीय मोटर वाहन नियम 139 के अनुसार डिजिटल दस्तावेज़ कानूनी रूप से 100% मान्य हैं।'
      },
      {
        id: 'fresh_nozzle_refused',
        question: 'Did the officer refuse to open a fresh, sealed disposable nozzle in your presence for breathalyzer test?',
        question_hi: 'क्या अधिकारी ने शराब जांच (Breathalyzer) के लिए आपके सामने नया सीलबंद नोज़ल खोलने से मना किया?',
        hint: 'Section 203 MVA & Health Directives mandate single-use sterile nozzles to prevent disease transmission.',
        hint_hi: 'स्वास्थ्य नियमों के अनुसार नया सीलबंद प्लास्टिक पाइप खोलना अनिवार्य है।'
      }
    ]
  },
  {
    id: 'landlord',
    title: 'Landlord Eviction & Utility Disconnection',
    title_hi: 'मकान मालिक द्वारा बिजली-पानी काटना या बेदखली',
    icon: 'home',
    color: 'blue',
    summary: 'Essential water/electricity supply cutoffs, 30-day notice mandate & security deposit refunds.',
    summary_hi: 'बिजली-पानी काटने पर रोक, 30 दिन का नोटिस और सिक्योरिटी डिपॉजिट वापसी।',
    questions: [
      {
        id: 'utilities_cut',
        question: 'Has the landlord disconnected or tampered with your electricity, drinking water, or elevator supply?',
        question_hi: 'क्या मकान मालिक ने आपकी बिजली, पानी या लिफ्ट जैसी मूलभूत सुविधाएं काट दी हैं?',
        hint: 'Section 20 Model Tenancy Act strictly prohibits cutting essential municipal utilities to coerce tenants.',
        hint_hi: 'किरायेदारी अधिनियम की धारा 20 के अनुसार आवश्यक सेवाएं काटना दंडनीय अपराध है।'
      },
      {
        id: 'no_court_order',
        question: 'Is the landlord threatening physical eviction without an executable Rent Court decree or 30-day notice?',
        question_hi: 'क्या मकान मालिक बिना कोर्ट के आदेश या 30 दिन के नोटिस के जबरन खाली कराने की धमकी दे रहा है?',
        hint: 'Landlords cannot take law into their hands; eviction requires a formal decree from the Rent Authority.',
        hint_hi: 'मकान मालिक अदालत के औपचारिक आदेश के बिना जबरन मकान खाली नहीं करा सकता।'
      },
      {
        id: 'deposit_withheld_30d',
        question: 'Has the landlord withheld your security deposit beyond 30 days of vacating without GST damage bills?',
        question_hi: 'क्या मकान खाली करने के 30 दिनों बाद भी सिक्योरिटी डिपॉजिट बिना बिल के रोकी गई है?',
        hint: 'Section 11 Model Tenancy Act mandates full refund within 30 days; normal wear and tear cannot be deducted.',
        hint_hi: 'मकान खाली करने के 30 दिनों के भीतर सुरक्षा राशि लौटाना अनिवार्य है।'
      }
    ]
  },
  {
    id: 'banking',
    title: 'UPI & Bank Account Cyber Freeze',
    title_hi: 'साइबर पुलिस द्वारा बैंक खाता फ्रीज / डेबिट ब्लॉक',
    icon: 'lock',
    color: 'emerald',
    summary: 'Blanket account freeze limits, innocent P2P crypto trade protections & lien restrictions.',
    summary_hi: 'पूरा खाता सीज करने पर रोक, निर्दोष P2P लेन-देन और केवल विवादित राशि पर रोक का नियम।',
    questions: [
      {
        id: 'entire_account_frozen',
        question: 'Is your entire bank account frozen rather than just the specific disputed transaction amount?',
        question_hi: 'क्या केवल विवादित राशि के बजाय आपका पूरा बैंक खाता (बचत व वेतन) फ्रीज कर दिया गया है?',
        hint: 'Section 106 BNSS & High Court precedents mandate that debit freezes must strictly target the disputed quantum only.',
        hint_hi: 'उच्च न्यायालय के अनुसार साइबर पुलिस केवल विवादित राशि पर ही रोक लगा सकती है, पूरे खाते पर नहीं।'
      },
      {
        id: 'bona_fide_transaction',
        question: 'Do you possess genuine invoices, trade chats, or receipts proving this was a bona fide innocent transaction?',
        question_hi: 'क्या आपके पास पक्के बिल, चैट या रसीदें हैं जो साबित करती हैं कि यह लेन-देन वैध था?',
        hint: 'Innocent third-party recipients are protected under Section 497 BNSS against malicious cyber complaints.',
        hint_hi: 'वैध सबूत होने पर धारा 497 के तहत मजिस्ट्रेट कोर्ट से खाता अनफ्रीज कराया जा सकता है।'
      }
    ]
  },
  {
    id: 'hospital',
    title: 'Hospital Emergency & Deceased Release',
    title_hi: 'अस्पताल में आपातकालीन इलाज व शव बंधक बनाना',
    icon: 'heart',
    color: 'indigo',
    summary: 'Mandatory trauma stabilization without advance deposit, and strict ban on detaining deceased bodies.',
    summary_hi: 'बिना एडवांस पैसे आपातकालीन इलाज का अधिकार और शव को बंधक बनाने पर रोक।',
    questions: [
      {
        id: 'advance_demanded_emergency',
        question: 'Did the hospital refuse emergency life-saving stabilization or triage because advance money was not deposited?',
        question_hi: 'क्या अस्पताल ने अग्रिम पैसे जमा न होने के कारण आपातकालीन जीवनरक्षक इलाज शुरू करने से मना किया?',
        hint: 'Supreme Court ruling in Parmanand Katara & Sec 12 CEA mandate immediate emergency care regardless of billing.',
        hint_hi: 'सुप्रीम कोर्ट के परमानंद कटारा फैसले के अनुसार अग्रिम पैसे के अभाव में आपातकालीन इलाज नहीं रोका जा सकता।'
      },
      {
        id: 'dead_body_detained',
        question: 'Is the hospital refusing to release a deceased body or discharged patient over unpaid medical invoices?',
        question_hi: 'क्या अस्पताल बकाया बिल के लिए मृतक के शव को परिजनों को सौंपने से इनकार कर रहा है?',
        hint: 'Detaining a corpse or patient for unpaid fees constitutes illegal confinement under BNS Section 127 and human rights extortion.',
        hint_hi: 'शव को बंधक बनाना बीएनएस की धारा 127 के तहत अवैध बंधक और गैरकानूनी अपराध है।'
      }
    ]
  },
  {
    id: 'workplace',
    title: 'Workplace Harassment (POSH)',
    title_hi: 'कार्यस्थल उत्पीड़न (पॉश कानून)',
    icon: 'users',
    color: 'purple',
    summary: 'Mandatory ICC committees in 10+ employee offices, 90-day paid interim leave & non-retaliation.',
    summary_hi: '10+ कर्मचारियों वाली कंपनियों में ICC समिति, 90 दिन की सवैतनिक छुट्टी और सुरक्षा।',
    questions: [
      {
        id: 'no_icc_committee',
        question: 'Does your organization employ 10 or more persons without an active, independent Internal Complaints Committee (ICC)?',
        question_hi: 'क्या आपके संस्थान में 10 या अधिक कर्मचारी हैं परंतु कोई सक्रिय आंतरिक शिकायत समिति (ICC) नहीं है?',
        hint: 'Section 4 POSH Act 2013 mandates an ICC with an independent NGO member; non-compliance attracts a ₹50,000 fine.',
        hint_hi: 'पॉश कानून की धारा 4 के अनुसार आंतरिक शिकायत समिति होना कानूनी रूप से अनिवार्य है।'
      },
      {
        id: 'interim_relief_denied',
        question: 'Has management refused or ignored your written request for 90 days paid leave or department transfer under Section 12?',
        question_hi: 'क्या प्रबंधन ने धारा 12 के तहत 90 दिनों की सवैतनिक छुट्टी या स्थानांतरण की मांग को खारिज किया है?',
        hint: 'Section 12 guarantees up to 90 days paid leave (separate from normal leave) during ongoing inquiries.',
        hint_hi: 'धारा 12 के तहत जांच चलने तक 90 दिनों की सवैतनिक छुट्टी पीड़िता का कानूनी अधिकार है।'
      }
    ]
  },
  {
    id: 'consumer',
    title: 'E-Commerce Fraud & Defective Goods',
    title_hi: 'ऑनलाइन फ्रॉड व दोषपूर्ण सामान रिफंड',
    icon: 'shield-check',
    color: 'teal',
    summary: 'Defective product replacements, unfulfilled refund promises & misleading advertising under CPA 2019.',
    summary_hi: 'दोषपूर्ण सामान की वापसी, 48 घंटे में रिफंड नियम और उपभोक्ता फोरम में हर्जाने का अधिकार।',
    questions: [
      {
        id: 'return_replacement_refused',
        question: 'Did the seller or platform refuse refund/replacement for a damaged, counterfeit, or defective product?',
        question_hi: 'क्या विक्रेता या ई-कॉमर्स प्लेटफॉर्म ने दोषपूर्ण, नकली या खराब सामान बदलने या रिफंड देने से मना किया?',
        hint: 'Section 84-86 CPA 2019 imposes strict product liability on manufacturers, sellers, and e-commerce platforms.',
        hint_hi: 'उपभोक्ता संरक्षण कानून की धारा 84-86 के तहत विक्रेता और प्लेटफॉर्म पर सख्त दायित्व निर्धारित है।'
      },
      {
        id: 'delivery_delayed_no_refund',
        question: 'Has the product delivery been delayed beyond the guaranteed timeline without an immediate cancellation refund?',
        question_hi: 'क्या तय समय सीमा से अधिक देरी होने पर भी तुरंत ऑर्डर कैंसिल और पूरा रिफंड नहीं दिया गया?',
        hint: 'Consumer Protection (E-Commerce) Rules 2020 forbid unreasonable cancellation penalties on consumers.',
        hint_hi: 'ई-कॉमर्स नियम 2020 के अनुसार समय पर डिलीवरी न होने पर पूर्ण रिफंड उपभोक्ता का अधिकार है।'
      }
    ]
  },
  {
    id: 'cheque',
    title: 'Cheque Bounce & Statutory Notice',
    title_hi: 'चेक बाउंस व 15 दिन का कानूनी नोटिस',
    icon: 'file-text',
    color: 'cyan',
    summary: 'Mandatory 15-day statutory demand notice under Section 138 NI Act, 30-day limitation & criminal liability.',
    summary_hi: 'नेगोशिएबल इंस्ट्रूमेंट्स एक्ट धारा 138 के तहत 15 दिन का नोटिस और 2 साल तक की सजा का प्रावधान।',
    questions: [
      {
        id: 'cheque_dishonoured_memo',
        question: 'Do you hold the official Bank Return Memo confirming dishonour for "Funds Insufficient" or similar grounds?',
        question_hi: 'क्या आपके पास बैंक का आधिकारिक रिटर्न मेमो है जिसमें "खाते में पर्याप्त राशि नहीं" का कारण लिखा है?',
        hint: 'Section 138 NI Act requires formal bank return memo as conclusive evidence of dishonour.',
        hint_hi: 'धारा 138 के तहत बैंक का लिखित रिटर्न मेमो प्राथमिक कानूनी साक्ष्य है।'
      },
      {
        id: 'within_30_days_memo',
        question: 'Has it been less than 30 days since you received the bank dishonour memo from your bank?',
        question_hi: 'क्या बैंक से चेक बाउंस का मेमो मिले अभी 30 दिन से कम समय हुआ है?',
        hint: 'Statutory demand notice must be served strictly within 30 days of receiving the bank memo.',
        hint_hi: 'मेमो मिलने के 30 दिनों के भीतर कानूनी नोटिस भेजना अनिवार्य है।'
      }
    ]
  }
];

export function evaluateDiagnosticAnswers(
  crisisId: string,
  answers: Record<string, boolean>
): DiagnosticEvaluation {
  let isProtected = false;

  switch (crisisId) {
    case 'police':
      isProtected =
        answers['offense_under_3_years'] === true ||
        answers['notice_served'] === false ||
        answers['female_after_sunset'] === true;
      break;

    case 'traffic':
      isProtected =
        answers['passenger_inside_towing'] === true ||
        answers['digilocker_rejected'] === true ||
        answers['fresh_nozzle_refused'] === true;
      break;

    case 'landlord':
      isProtected =
        answers['utilities_cut'] === true ||
        answers['no_court_order'] === true ||
        answers['deposit_withheld_30d'] === true;
      break;

    case 'banking':
      isProtected =
        answers['entire_account_frozen'] === true ||
        answers['bona_fide_transaction'] === true;
      break;

    case 'hospital':
      isProtected =
        answers['advance_demanded_emergency'] === true ||
        answers['dead_body_detained'] === true;
      break;

    case 'workplace':
      isProtected =
        answers['no_icc_committee'] === true ||
        answers['interim_relief_denied'] === true;
      break;

    case 'consumer':
      isProtected =
        answers['return_replacement_refused'] === true ||
        answers['delivery_delayed_no_refund'] === true;
      break;

    case 'cheque':
      isProtected =
        answers['cheque_dishonoured_memo'] === true &&
        answers['within_30_days_memo'] === true;
      break;

    default:
      isProtected = Object.values(answers).some(val => val === true);
      break;
  }

  let evaluation: DiagnosticEvaluation;

  switch (crisisId) {
    case 'police':
      evaluation = {
        crisisId: 'police',
        status: isProtected ? 'VIOLATION_CONFIRMED' : 'PROCEDURAL_CLEARANCE',
        confidenceScore: 99,
        verdictTitle: isProtected ? 'Unlawful Police Custody Action Detected' : 'Standard Police Verification Procedure',
        verdictTitle_hi: isProtected ? 'अवैध पुलिस हिरासत कार्रवाई की पुष्टि' : 'सामान्य पुलिस सत्यापन प्रक्रिया',
        verdictSubtitle: isProtected
          ? 'Mandatory statutory safeguards under BNSS Sec 35 & 46 are being actively breached.'
          : 'Officer may request identity verification. Remain calm and request receipt for any handed documents.',
        verdictSubtitle_hi: isProtected
          ? 'बीएनएसएस धारा 35 और 46 के तहत कानूनी सुरक्षा नियमों का उल्लंघन हो रहा है।'
          : 'अधिकारी पहचान पत्र मांग सकते हैं। शांत रहें और दस्तावेजों की पावती मांगें।',
        statutoryBasis: 'BNSS 2023 Sec 35(3), 46(1) & Supreme Court Arnesh Kumar Guidelines',
        whatToSay: 'Officer, under Section 35(3) of Bharatiya Nagarik Suraksha Sanhita (BNSS), arrest without prior written notice is prohibited for offences under 3 years. I respectfully demand your badge number, station diary entry, and formal notice of appearance.',
        whatToSay_hi: 'अधिकारी महोदय, बीएनएसएस की धारा 35(3) के अनुसार 3 वर्ष से कम सजा वाले मामलों में बिना लिखित नोटिस के गिरफ्तारी वर्जित है। कृपया मुझे पेशी का औपचारिक नोटिस दें।',
        actionItems: [
          'Demand Station Diary (GD) entry number immediately.',
          'Insist on formal written Section 35(3) BNSS Notice of Appearance.',
          'Dial 112 to record distress call timestamp with state police control room.'
        ],
        actionItems_hi: [
          'थाना दैनिक डायरी (GD) का नंबर तुरंत मांगें।',
          'बीएनएसएस धारा 35(3) का लिखित नोटिस देने की मांग करें।',
          'पुलिस कंट्रोल रूम में रिकॉर्ड के लिए 112 पर तुरंत कॉल करें।'
        ],
        helpline: '112',
        helplineName: 'Police Emergency 112',
        relatedRightId: 'police-appearance-notice-35'
      };
      break;

    case 'traffic':
      evaluation = {
        crisisId: 'traffic',
        status: isProtected ? 'VIOLATION_CONFIRMED' : 'PROCEDURAL_CLEARANCE',
        confidenceScore: 96,
        verdictTitle: isProtected ? 'Illegal Traffic Enforcement / Towing' : 'Valid Traffic Enforcement Check',
        verdictTitle_hi: isProtected ? 'अवैध ट्रैफिक चालान / टोइंग कार्रवाई' : 'वैध ट्रैफिक जांच प्रक्रिया',
        verdictSubtitle: isProtected
          ? 'Section 127 MVA forbids hoisting occupied cars; CMVR Rule 139 guarantees digital DigiLocker equivalence.'
          : 'Present valid credentials digitally or pay composite fine against official e-challan.',
        verdictSubtitle_hi: isProtected
          ? 'धारा 127 के तहत अंदर बैठे व्यक्ति के साथ क्रेन से गाड़ी उठाना और डिजिलॉकर अस्वीकार करना गैरकानूनी है।'
          : 'ई-चालान के लिए दस्तावेज दिखाएं।',
        statutoryBasis: 'Motor Vehicles Act 1988 Sec 127, 203 & CMVR Rule 139',
        whatToSay: 'Officer, Section 127 of the Motor Vehicles Act explicitly prohibits towing a vehicle with passengers inside. Furthermore, Rule 139 of CMVR mandates acceptance of digital RC and DL via DigiLocker. Please generate an official e-challan if an infraction is alleged.',
        whatToSay_hi: 'अधिकारी महोदय, मोटर वाहन अधिनियम की धारा 127 के अनुसार अंदर बैठे व्यक्ति के साथ गाड़ी उठाना अवैध है। साथ ही नियम 139 के तहत डिजिलॉकर के दस्तावेज पूरी तरह मान्य हैं।',
        actionItems: [
          'Record clear video showing passenger seated inside the vehicle.',
          'Show verified DL/RC directly within the official DigiLocker application.',
          'Request e-challan SMS; refuse any cash payment without a printed treasury receipt.'
        ],
        actionItems_hi: [
          'गाड़ी के अंदर बैठे होने का स्पष्ट वीडियो बनाएं।',
          'डिजिलॉकर ऐप खोलकर डिजिटल दस्तावेज दिखाएं।',
          'बिना सरकारी रसीद या ई-चालान के नकद भुगतान न करें।'
        ],
        helpline: '1033',
        helplineName: 'National Highway Traffic 1033',
        relatedRightId: 'traffic-towing-occupied-car'
      };
      break;

    case 'landlord':
      evaluation = {
        crisisId: 'landlord',
        status: isProtected ? 'VIOLATION_CONFIRMED' : 'PROCEDURAL_CLEARANCE',
        confidenceScore: 95,
        verdictTitle: isProtected ? 'Unlawful Coercive Tenancy Action' : 'Civil Tenancy Matter In Progress',
        verdictTitle_hi: isProtected ? 'मकान मालिक द्वारा अवैध उत्पीड़न की पुष्टि' : 'किरायेदारी प्रक्रिया के नियम',
        verdictSubtitle: isProtected
          ? 'Section 20 Model Tenancy Act prohibits cutting electricity/water; eviction requires 30-day notice and Rent Court decree.'
          : 'Ensure rent receipts are preserved and communication is conducted in writing.',
        verdictSubtitle_hi: isProtected
          ? 'मॉडल किरायेदारी कानून की धारा 20 के तहत बिजली-पानी काटना दंडनीय अपराध है।'
          : 'सभी किराए की रसीदें सुरक्षित रखें और केवल लिखित में बात करें।',
        statutoryBasis: 'Model Tenancy Act Sec 20 & Transfer of Property Act Sec 106',
        whatToSay: 'Cutting electricity or water to force eviction is a punishable offence under Section 20 of the Tenancy Act. Physical eviction without a formal Rent Court decree is criminal trespass. Kindly restore essential services immediately.',
        whatToSay_hi: 'बिजली या पानी काटना किरायेदारी कानून की धारा 20 के तहत अपराध है। बिना कोर्ट आदेश जबरन मकान खाली कराना अवैध है। कृपया आवश्यक सेवाएं तुरंत बहाल करें।',
        actionItems: [
          'Send 48-hour formal legal notice via Registered Post / WhatsApp.',
          'File emergency application before Rent Controller / SDM for utility restoration.',
          'Lodge police station diary entry for criminal intimidation & trespass.'
        ],
        actionItems_hi: [
          '48 घंटे का कानूनी नोटिस तुरंत भेजें।',
          'किराया अधिकरण (Rent Controller) में आपातकालीन अर्जी लगाएं।',
          'थाने में आपराधिक अतिचार और धमकी की लिखित शिकायत दर्ज करें।'
        ],
        helpline: '1915',
        helplineName: 'National Consumer / Tenant Grievance',
        relatedRightId: 'landlord-utility-cut'
      };
      break;

    case 'banking':
      evaluation = {
        crisisId: 'banking',
        status: isProtected ? 'VIOLATION_CONFIRMED' : 'PROCEDURAL_CLEARANCE',
        confidenceScore: 97,
        verdictTitle: isProtected ? 'Disproportionate Cyber Debit Freeze Contestable' : 'Account Lien Subject to Clarification',
        verdictTitle_hi: isProtected ? 'पूरे बैंक खाते को फ्रीज करना कानूनी रूप से चुनौती योग्य' : 'खाता फ्रीज पर कानूनी स्पष्टीकरण आवश्यक',
        verdictSubtitle: isProtected
          ? 'Section 106 BNSS & High Court precedents limit freeze strictly to the disputed quantum.'
          : 'Request notice under 94 BNSS from bank branch manager.',
        verdictSubtitle_hi: isProtected
          ? 'बीएनएसएस धारा 106 व हाईकोर्ट के अनुसार केवल विवादित रकम पर ही रोक लगाई जा सकती है, पूरे खाते पर नहीं।'
          : 'बैंक शाखा प्रबंधक से धारा 94 बीएनएसएस का नोटिस मांगें।',
        statutoryBasis: 'BNSS 2023 Sec 106 & RBI Circular on Golden Hour Liability',
        whatToSay: 'Manager, as per Supreme Court and High Court precedents under BNSS Section 106, debit freeze can only be applied to the specific disputed transaction amount, not the entire operational savings account. Kindly permit operations on the balance funds.',
        whatToSay_hi: 'प्रबंधक महोदय, उच्च न्यायालय के निर्णयों और धारा 106 बीएनएसएस के तहत केवल विवादित राशि पर रोक लगाई जा सकती है, पूरे खाते पर नहीं। कृपया शेष राशि के संचालन की अनुमति दें।',
        actionItems: [
          'Collect the Ack number, IO name, Police Station and state from the bank nodal officer.',
          'Submit bona fide trade proofs / tax invoices under Section 497 BNSS.',
          'Approach Chief Judicial Magistrate (CJM) for defreeze on indemnity bond.'
        ],
        actionItems_hi: [
          'बैंक से पुलिस स्टेशन, जांच अधिकारी का नाम और शिकायत संख्या लें।',
          'वैध लेन-देन के बिल व चैट धारा 497 के तहत जांच अधिकारी को सौंपें।',
          'सीजेएम (CJM) कोर्ट में खाता अनफ्रीज करने की अर्जी दाखिल करें।'
        ],
        helpline: '1930',
        helplineName: 'Cyber Crime Helpline 1930',
        relatedRightId: 'p2p-crypto-bank-freeze'
      };
      break;

    case 'hospital':
      evaluation = {
        crisisId: 'hospital',
        status: isProtected ? 'VIOLATION_CONFIRMED' : 'PROCEDURAL_CLEARANCE',
        confidenceScore: 100,
        verdictTitle: isProtected ? 'Strict Statutory Violation of Patient Rights' : 'Standard Medical Administration',
        verdictTitle_hi: isProtected ? 'रोगी अधिकारों व सुप्रीम कोर्ट आदेश का गंभीर उल्लंघन' : 'चिकित्सा प्रक्रिया के नियम',
        verdictSubtitle: isProtected
          ? 'Parmanand Katara landmark SC ruling & Sec 12 CEA mandate emergency stabilization; detaining bodies is illegal confinement.'
          : 'Request detailed itemized medical bill and medical superintendent audit.',
        verdictSubtitle_hi: isProtected
          ? 'सुप्रीम कोर्ट के परमानंद कटारा फैसले अनुसार बिना अग्रिम भुगतान आपातकालीन इलाज अनिवार्य है।'
          : 'अस्पताल अधीक्षक से विस्तृत बिल और मेडिकल रिपोर्ट मांगें।',
        statutoryBasis: 'Supreme Court Parmanand Katara, Sec 12 Clinical Establishments Act & Sec 127 BNS',
        whatToSay: 'Under the landmark Supreme Court ruling in Parmanand Katara vs Union of India, you are statutorily bound to start emergency stabilization without advance deposits. Detaining a patient or body for unpaid fees is illegal confinement under Section 127 BNS.',
        whatToSay_hi: 'सुप्रीम कोर्ट के परमानंद कटारा फैसले के तहत आपातकालीन जीवनरक्षक इलाज शुरू करना कानूनी रूप से अनिवार्य है। बिल के लिए शव रोकना बीएनएस धारा 127 में संज्ञेय अपराध है।',
        actionItems: [
          'Demand immediate triage from Emergency Medical Officer (CMO).',
          'Dial 112 directly from reception if emergency care is withheld.',
          'Report hospital to State Clinical Establishments Council for license cancellation.'
        ],
        actionItems_hi: [
          'इमरजेंसी मेडिकल ऑफिसर (CMO) से तुरंत इलाज शुरू करने की मांग करें।',
          'इलाज रोके जाने पर रिसेप्शन से ही सीधे 112 पर पुलिस को कॉल करें।',
          'अस्पताल का लाइसेंस रद्द कराने के लिए राज्य स्वास्थ्य परिषद में शिकायत करें।'
        ],
        helpline: '112',
        helplineName: 'Emergency Police & Medical 112',
        relatedRightId: 'emergency-hospital-treatment'
      };
      break;

    case 'workplace':
      evaluation = {
        crisisId: 'workplace',
        status: isProtected ? 'VIOLATION_CONFIRMED' : 'PROCEDURAL_CLEARANCE',
        confidenceScore: 98,
        verdictTitle: isProtected ? 'POSH Statutory Safeguard Triggered' : 'HR Grievance Procedure Active',
        verdictTitle_hi: isProtected ? 'पॉश कानून के तहत कानूनी सुरक्षा अधिकार सक्रिय' : 'एचआर शिकायत प्रक्रिया लागू',
        verdictSubtitle: isProtected
          ? 'Mandatory ICC committee in 10+ worker units; 90-day paid interim leave & anti-retaliation under Section 12.'
          : 'Document incidents with date, time, and witness logs.',
        verdictSubtitle_hi: isProtected
          ? 'धारा 12 के तहत 90 दिन की सवैतनिक छुट्टी व जांच चलने तक उत्पीड़न से पूर्ण संरक्षण।'
          : 'तारीख, समय और गवाहों के साथ घटनाओं का लिखित रिकॉर्ड रखें।',
        statutoryBasis: 'Sexual Harassment of Women at Workplace (POSH) Act 2013 Sec 4, 12 & 16',
        whatToSay: 'Under Section 12 of the POSH Act 2013, I am formally requesting 90 days paid interim leave during the pendency of inquiry, along with strict anti-retaliation safeguards. Non-constitution of an ICC attracts ₹50,000 fine under Section 26.',
        whatToSay_hi: 'पॉश कानून 2013 की धारा 12 के तहत जांच चलने तक 90 दिनों की सवैतनिक छुट्टी और सुरक्षा की मांग करता/करती हूं। ICC न होने पर धारा 26 में 50,000 रुपये का जुर्माना है।',
        actionItems: [
          'Submit formal written complaint to Presiding Officer of ICC or Local Complaints Committee (LCC).',
          'Exercise right to transfer or paid leave under Section 12.',
          'Contact NCW 24x7 Helpline at 1091 if organization fails to act.'
        ],
        actionItems_hi: [
          'आंतरिक शिकायत समिति (ICC) की पीठासीन अधिकारी को लिखित शिकायत दें।',
          'धारा 12 के तहत सवैतनिक छुट्टी या विभाग बदलने के अधिकार का उपयोग करें।',
          'कार्रवाई न होने पर राष्ट्रीय महिला आयोग (NCW) हेल्पलाइन 1091 पर संपर्क करें।'
        ],
        helpline: '1091',
        helplineName: 'NCW 24x7 Women Helpline 1091',
        relatedRightId: 'posh-workplace-icc'
      };
      break;

    case 'consumer':
      evaluation = {
        crisisId: 'consumer',
        status: isProtected ? 'VIOLATION_CONFIRMED' : 'PROCEDURAL_CLEARANCE',
        confidenceScore: 97,
        verdictTitle: isProtected ? 'Consumer Rights Violation Confirmed' : 'Standard E-Commerce Transaction Under Review',
        verdictTitle_hi: isProtected ? 'उपभोक्ता संरक्षण कानून के उल्लंघन की पुष्टि' : 'ई-कॉमर्स लेन-देन की समीक्षा',
        verdictSubtitle: isProtected
          ? 'Under CPA 2019 Section 35 & 84, sellers & e-commerce platforms bear strict liability for counterfeit/defective goods and non-refund.'
          : 'Preserve product unboxing video, tax invoice, and seller delivery chats.',
        verdictSubtitle_hi: isProtected
          ? 'उपभोक्ता कानून की धारा 35 व 84 के तहत खराब सामान व रिफंड न देने पर प्लेटफॉर्म पर पूर्ण जिम्मेदारी है।'
          : 'अनबॉक्सिंग वीडियो, इनवॉइस और चैट सुरक्षित रखें।',
        statutoryBasis: 'Consumer Protection Act 2019 Sec 35, 84 & Consumer E-Commerce Rules 2020',
        whatToSay: 'Under Section 35 and 84 of the Consumer Protection Act 2019, you are strictly liable for product deficiency. I demand a full statutory refund or replacement within 48 hours, failing which a formal grievance will be lodged on the National Consumer Helpline (1915) and e-Daakhil commission.',
        whatToSay_hi: 'उपभोक्ता संरक्षण कानून 2019 की धारा 35 व 84 के तहत आप दोषपूर्ण सामान के लिए जिम्मेदार हैं। मैं 48 घंटे में पूरे रिफंड की मांग करता हूं, अन्यथा राष्ट्रीय उपभोक्ता आयोग (1915) में शिकायत दर्ज होगी।',
        actionItems: [
          'Register official complaint on National Consumer Helpline (consumerhelpline.gov.in / 1915).',
          'Issue formal 48-hour Legal Demand Notice via email to company grievance officer.',
          'File e-Daakhil complaint before the District Consumer Commission for refund plus compensation.'
        ],
        actionItems_hi: [
          'राष्ट्रीय उपभोक्ता हेल्पलाइन (1915) या पोर्टल पर तुरंत शिकायत दर्ज कराएं।',
          'कंपनी के नोडल अधिकारी को 48 घंटे का कानूनी नोटिस ईमेल करें।',
          'ई-दाखिल पोर्टल पर जिला उपभोक्ता आयोग में हर्जाने का वाद दायर करें।'
        ],
        helpline: '1915',
        helplineName: 'National Consumer Helpline 1915',
        relatedRightId: 'consumer-deficiency-refund'
      };
      break;

    case 'cheque':
      evaluation = {
        crisisId: 'cheque',
        status: isProtected ? 'VIOLATION_CONFIRMED' : 'PROCEDURAL_CLEARANCE',
        confidenceScore: 98,
        verdictTitle: isProtected ? 'Section 138 NI Act Offence Established' : 'Cheque Dispute Pending Verification',
        verdictTitle_hi: isProtected ? 'धारा 138 चेक बाउंस अपराध स्थापित' : 'चेक विवाद सत्यापन प्रक्रिया',
        verdictSubtitle: isProtected
          ? 'Bank return memo triggers Section 138 Negotiable Instruments Act. Mandatory 15-day statutory demand notice is required within 30 days.'
          : 'Ensure the cheque was presented within its 3-month validity window.',
        verdictSubtitle_hi: isProtected
          ? 'बैंक रिटर्न मेमो धारा 138 लागू करता है। 30 दिन के भीतर 15 दिन का कानूनी नोटिस भेजना अनिवार्य है।'
          : 'सुनिश्चित करें कि चेक 3 महीने की वैधता के भीतर बैंक में लगाया गया था।',
        statutoryBasis: 'Negotiable Instruments Act 1881 Sec 138 & 142',
        whatToSay: 'Under Section 138 of the Negotiable Instruments Act, dishonour of cheque is a cognizable offence punishable with up to 2 years imprisonment and double the cheque amount. You are formally demanded to clear the dues within 15 days of notice.',
        whatToSay_hi: 'नेगोशिएबल इंस्ट्रूमेंट्स एक्ट की धारा 138 के तहत चेक बाउंस 2 साल की सजा और दोगुने जुर्माने का अपराध है। नोटिस के 15 दिनों के भीतर पूरी राशि चुकाने की मांग की जाती है।',
        actionItems: [
          'Serve statutory demand notice through registered speed post within 30 days of memo.',
          'Wait for the mandatory 15-day cure period for the drawer to pay.',
          'File criminal complaint under Section 142 before Judicial Magistrate First Class within 30 days of period expiry.'
        ],
        actionItems_hi: [
          'बैंक मेमो मिलने के 30 दिनों के भीतर स्पीड पोस्ट से 15 दिन का कानूनी नोटिस भेजें।',
          'भुगतान के लिए अनिवार्य 15 दिन के समय की प्रतीक्षा करें।',
          'भुगतान न होने पर 30 दिन के अंदर न्यायिक मजिस्ट्रेट के समक्ष धारा 142 में वाद दायर करें।'
        ],
        helpline: '15100',
        helplineName: 'NALSA Legal Aid 15100',
        relatedRightId: 'cheque-bounce-notice'
      };
      break;

    default:
      evaluation = {
        crisisId: 'police',
        status: isProtected ? 'VIOLATION_CONFIRMED' : 'PROCEDURAL_CLEARANCE',
        confidenceScore: 95,
        verdictTitle: isProtected ? 'Statutory Protection Established' : 'Procedural Standards Verified',
        verdictTitle_hi: isProtected ? 'कानूनी सुरक्षा अधिकार स्थापित' : 'वैधानिक प्रक्रिया सत्यापित',
        verdictSubtitle: isProtected
          ? 'Statutory provisions protect you against coercive arbitrary state or civil action.'
          : 'Follow procedural requirements and request written receipts.',
        verdictSubtitle_hi: isProtected
          ? 'कानूनी प्रावधान आपको मनमानी प्रशासनिक या दीवानी कार्रवाई से सुरक्षा प्रदान करते हैं।'
          : 'प्रक्रियात्मक नियमों का पालन करें और लिखित पावती मांगें।',
        statutoryBasis: 'Constitution of India Art 21 & Statutory Provisions',
        whatToSay: 'I am asserting my statutory rights under Indian law. Kindly document this interaction and provide written legal authority.',
        whatToSay_hi: 'मैं भारतीय कानून के तहत अपने संवैधानिक अधिकारों का प्रयोग कर रहा/रही हूं। कृपया इस बातचीत को लिखित में दर्ज करें।',
        actionItems: [
          'Document date, time, badge number, or official personnel details.',
          'Insist on written receipts for all payments and communications.',
          'Dial Free Legal Aid at 15100 if assistance is required.'
        ],
        actionItems_hi: [
          'अधिकारी का नाम, समय और तारीख का लिखित रिकॉर्ड रखें।',
          'सभी लेन-देन की सरकारी रसीद मांगें।',
          'मदद के लिए मुफ्त कानूनी सहायता 15100 पर कॉल करें।'
        ],
        helpline: '15100',
        helplineName: 'National Legal Aid 15100',
        relatedRightId: 'police-appearance-notice-35'
      };
      break;
  }

  evaluation.isUnlawful = isProtected;
  return evaluation;
}