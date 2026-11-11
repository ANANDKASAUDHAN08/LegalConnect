export interface StatutoryRightItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  icon: string;
  summary: string;
  statutoryBasis: {
    actName: string;
    shortAct: string;
    sections: string[];
    actUrl: string;
    landmarkCases?: string[];
  };
  keyProtections: string[];
  actionableSteps: string[];
  legalRemedy: string;
  emergencyHelpline?: {
    name: string;
    number: string;
    description: string;
    portalUrl?: string;
  };
  penaltiesForViolation?: string;
  frequentlyAskedQuestions?: Array<{ question: string; answer: string }>;
  tags: string[];
  scenarioTag?: string;
  whatToSay?: string;
  dos?: string[];
  donts?: string[];
  title_hi?: string;
  summary_hi?: string;
  whatToSay_hi?: string;
  dos_hi?: string[];
  donts_hi?: string[];
  verifiedDate: string;
  verifiedBy: string;
  isPopular?: boolean;
  isPublished?: boolean;
}

export const statutoryRightsCatalog: StatutoryRightItem[] = [
  // 1. Constitutional
  {
    id: 'right-to-life-liberty',
    slug: 'fundamental-freedoms-art-21',
    title: 'Right to Life, Dignity & Personal Liberty',
    category: 'Constitutional & Civil Liberties',
    icon: 'scale',
    summary: 'Guaranteed under Article 21 of the Indian Constitution, no citizen or person shall be deprived of their life or personal liberty except according to procedure established by law.',
    statutoryBasis: {
      actName: 'Constitution of India, 1950',
      shortAct: 'Constitution',
      sections: ['Article 14', 'Article 19', 'Article 21', 'Article 32', 'Article 226'],
      actUrl: '/laws/Constitution',
      landmarkCases: [
        'Maneka Gandhi vs. Union of India (1978) - Procedure must be just, fair and reasonable',
        'Francis Coralie Mullin vs. UT of Delhi (1981) - Right to live with human dignity',
        'K.S. Puttaswamy vs. Union of India (2017) - Fundamental right to privacy'
      ]
    },
    keyProtections: [
      'Inherent right to live with human dignity, bodily autonomy, and clean environment.',
      'Protection against unlawful state surveillance, custodial torture, and arbitrary arrest.',
      'Statutory right to speedy trial and access to fair legal representation.',
      'Immediate writ remedy: Direct access to Supreme Court (Art 32) or High Courts (Art 226).'
    ],
    actionableSteps: [
      'If unlawfully detained or liberties curtailed, immediately instruct an advocate to file a Writ Petition of Habeas Corpus.',
      'Invoke Article 226 in the jurisdictional High Court for urgent interim injunctions against arbitrary executive actions.',
      'Contact the National Legal Services Authority (NALSA) at 15100 if unable to afford private constitutional representation.'
    ],
    legalRemedy: 'Direct constitutional Writ Petition (Habeas Corpus, Mandamus, Quo Warranto, Certiorari) under Article 32 or 226.',
    emergencyHelpline: {
      name: 'NALSA Legal Aid Helpline',
      number: '15100',
      description: '24x7 Free Legal Aid for Undertrials and Indigent Citizens across all Indian States',
      portalUrl: 'https://nalsa.gov.in'
    },
    penaltiesForViolation: 'Constitutional Courts award substantial monetary compensation against the State and initiate departmental disciplinary/contempt proceedings.',
    frequentlyAskedQuestions: [
      {
        question: 'Can the Right to Life under Article 21 ever be suspended during an Emergency?',
        answer: 'No. Following the 44th Constitutional Amendment Act 1978, the enforcement of Article 20 and Article 21 can never be suspended under any circumstances, even during a National Emergency.'
      }
    ],
    tags: ['constitution', 'article 21', 'liberty', 'dignity', 'habeas corpus', 'fundamental rights'],
    scenarioTag: 'civil-liberties',
    whatToSay: "I am asserting my fundamental right to bodily autonomy and human dignity under Article 21 of the Constitution of India. Any restraint on my liberty must strictly adhere to just, fair, and reasonable legal procedure as mandated by the Supreme Court in Maneka Gandhi.",
    whatToSay_hi: "मैं भारत के संविधान के अनुच्छेद 21 के तहत अपनी शारीरिक स्वायत्तता और मानवीय गरिमा के मौलिक अधिकार का दावा करता हूं। मेनका गांधी मामले में सर्वोच्च न्यायालय के फैसले के अनुसार मेरी स्वतंत्रता पर कोई भी रोक उचित, निष्पक्ष और कानूनी प्रक्रिया के तहत होनी चाहिए।",
    dos: [
      "Demand written statutory justification for any detention or movement restriction.",
      "Instruct family or legal counsel to file a Habeas Corpus petition under Article 226/32 if unlawfully restrained.",
      "Dial NALSA free legal aid at 15100 if state authorities curtail basic liberties."
],
    donts: [
      "Do NOT submit to unrecorded, undocumented executive custody or search.",
      "Do NOT waive your right to legal representation under any pressure.",
      "Do NOT sign self-incriminating statements without presence of an advocate."
],
    dos_hi: [
      "किसी भी हिरासत या रोक के लिए लिखित कानूनी आधार की मांग करें।",
      "अवैध रूप से रोके जाने पर अनुच्छेद 226/32 के तहत बंदी प्रत्यक्षीकरण (Habeas Corpus) याचिका दायर करने का निर्देश दें।",
      "मौलिक अधिकारों के हनन पर नालसा निःशुल्क कानूनी सहायता 15100 पर तुरंत संपर्क करें।"
],
    donts_hi: [
      "बिना आधिकारिक रिकॉर्ड वाली गैर-कानूनी हिरासत को स्वीकार न करें।",
      "किसी भी दबाव में कानूनी सहायता के अपने अधिकार का परित्याग न करें।",
      "वकील की अनुपस्थिति में किसी भी स्व-दोषी बयान पर हस्ताक्षर न करें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Constitutional Review Directorate',
    isPopular: true,
    isPublished: true
  },

  // 2. Police & Criminal Justice
  {
    id: 'arrest-detainment-safeguards',
    slug: 'safeguards-against-arbitrary-arrest',
    title: 'Arrestee Safeguards & Police Detainment Rules',
    category: 'Police & Criminal Justice',
    icon: 'shield',
    summary: 'Codified procedural safeguards governing police detainment and arrest under Bharatiya Nagarik Suraksha Sanhita (BNSS 2023), establishing strict accountability for law enforcement.',
    statutoryBasis: {
      actName: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023',
      shortAct: 'BNSS 2023',
      sections: ['Section 35', 'Section 47', 'Section 48', 'Section 50', 'Section 51', 'Section 58'],
      actUrl: '/laws/BNSS',
      landmarkCases: [
        'D.K. Basu vs. State of West Bengal (1997) - Binding arrest guidelines',
        'Arnesh Kumar vs. State of Bihar (2014) - Mandatory notice under Sec 41A/BNSS 35 before arrest in offenses < 7 years',
        'Prem Shankar Shukla vs. Delhi Admin - Ban on routine handcuffing'
      ]
    },
    keyProtections: [
      'Mandatory identification: Arresting officers must display clear name tags and official designation badges.',
      'Mandatory Arrest Memo: Must record exact time, date, place of arrest and be countersigned by at least one family member or respectable local witness.',
      'Right to inform: Arrestee has an absolute statutory right to inform one relative or friend within 1 hour of custody.',
      '24-Hour Magistrate Production: Arrestee must be produced before the nearest Judicial Magistrate within 24 hours (excluding transit) under BNSS Section 58.',
      'Sunset-to-Sunrise Rule: No female can be arrested between sunset and sunrise without prior written order from a Judicial Magistrate First Class.',
      'Right to Medical Examination: Independent medical checkup every 48 hours and upon arrest under BNSS Section 53 to record existing bodily condition.'
    ],
    actionableSteps: [
      'Demand to inspect the officer’s police ID card and ask for the formal Arrest Memo copy.',
      'Exercise your right to silence regarding incriminating statements; never sign blank sheets or coerced confession sheets.',
      'Insist on immediate notification of your nominated relative and lawyer.',
      'Request immediate medical examination if subjected to physical intimidation or abuse.'
    ],
    legalRemedy: 'Regular or Anticipatory Bail before the Judicial Magistrate or Sessions Court under BNSS Section 480 / 482; Habeas Corpus for illegal custody beyond 24 hours.',
    emergencyHelpline: {
      name: 'National Emergency Response System',
      number: '112',
      description: 'Immediate all-India police emergency assistance and oversight hotline',
      portalUrl: 'https://112.gov.in'
    },
    penaltiesForViolation: 'Violating officers face criminal prosecution under BNS Section 198 (Public servant disobeying direction of law) and contempt of court proceedings.',
    frequentlyAskedQuestions: [
      {
        question: 'Can police arrest a citizen without a warrant for any minor allegation?',
        answer: 'No. In offenses punishable with imprisonment up to 7 years, BNSS Section 35 mandates serving a Notice of Appearance first. Arrest without warrant requires recorded written reasons demonstrating risk of absconding or tampering.'
      }
    ],
    tags: ['arrest', 'police', 'bnss', 'bail', 'dk basu', 'detention', 'handcuffs'],
    scenarioTag: 'police-stop',
    whatToSay: 'Officer, under Section 35(3) of the Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) and the Supreme Court mandate in Arnesh Kumar, a written Notice of Appearance is mandatory prior to arrest. May I respectfully see the formal grounds of arrest and exercise my statutory right to notify my family under Section 47?',
    whatToSay_hi: 'अधिकारी महोदय, भारतीय नागरिक सुरक्षा संहिता (BNSS 2023) की धारा 35(3) और सर्वोच्च न्यायालय के अर्नेश कुमार दिशा-निर्देशों के अनुसार, गिरफ्तारी से पहले उपस्थिति का लिखित नोटिस अनिवार्य है। कृपया मुझे गिरफ्तारी के लिखित कारण बताएं और धारा 47 के तहत अपने परिजनों व वकील को सूचित करने का अधिकार दें।',
    dos: [
      'Request the officer\'s formal identification and written grounds of arrest under BNSS §35.',
      'Ensure the formal Arrest Memo is signed by at least one family member or local witness.',
      'Immediately contact your advocate or dial NALSA free legal aid at 15100.'
    ],
    donts: [
      'Do NOT sign blank sheets of paper or coerced, unverified statements.',
      'Women CANNOT be arrested between sunset and sunrise without a Judicial Magistrate\'s written order.',
      'Do NOT resist physically; calmly state you are exercising your right to silence.'
    ],
    dos_hi: [
      'अधिकारी का पहचान पत्र और गिरफ्तारी का लिखित आधार मांगें।',
      'सुनिश्चित करें कि अरेस्ट मेमो पर परिवार या स्थानीय गवाह के हस्ताक्षर हों।',
      'तुरंत अपने वकील या नालसा फ्री लीगल एड 15100 पर संपर्क करें।'
    ],
    donts_hi: [
      'किसी भी कोरे कागज या बिना पढ़े बयान पर हस्ताक्षर न करें।',
      'सूर्यास्त के बाद महिलाओं की गिरफ्तारी मजिस्ट्रेट के आदेश बिना वर्जित है।',
      'हिंसक विरोध न करें; शांतिपूर्वक अपने मौन रहने के अधिकार का प्रयोग करें।'
    ],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Criminal Procedural Directorate',
    isPopular: true,
    isPublished: true
  },

  // 3. Traffic & Motor Vehicles
  {
    id: 'traffic-police-challan-rights',
    slug: 'motor-vehicle-traffic-challan-safeguards',
    title: 'Traffic Police Checks, DigiLocker & Challan Safeguards',
    category: 'Traffic & Motor Vehicles',
    icon: 'zap',
    summary: 'Statutory protections governing vehicular inspections, digital document validation, on-the-spot compounding, and protection against unauthorized key confiscation.',
    statutoryBasis: {
      actName: 'Motor Vehicles (Amendment) Act, 2019 & Central Motor Vehicles Rules',
      shortAct: 'MVA 2019',
      sections: ['Section 130', 'Section 134', 'Section 206', 'CMVR Rule 139'],
      actUrl: '/laws/MVA',
      landmarkCases: [
        'Ministry of Road Transport Notifications RT-11036/64/2017-MVL - Mandatory electronic documents acceptance',
        'State Police Manuals - Prohibition of vehicle key snatching'
      ]
    },
    keyProtections: [
      'Digital Documents Acceptance: Driving License, Registration Certificate (RC), Insurance, and PUC shown via DigiLocker or mParivahan are legally equivalent to physical copies under Rule 139.',
      'No Physical Key Confiscation: Traffic personnel have no statutory power to forcefully remove vehicle keys or deflate tyres.',
      'Rank Authorization: Only officers of the rank of Sub-Inspector (SI) or Assistant Sub-Inspector (ASI) with official e-challan machines can issue compounding fines.',
      'Breath Analyzer Integrity: Citizen has the right to demand that a fresh, sealed sterile blowpipe is used during alcohol breath testing.',
      'Seizure of License: Physical seizure of license is strictly limited to specified red-light jumping, drunken driving, over-speeding, or mobile phone usage while driving.'
    ],
    actionableSteps: [
      'Show your verified digital Driving License and RC directly from the DigiLocker app on your mobile screen.',
      'If an officer demands cash without generating an official printed or SMS e-challan, politely ask for their name and badge number.',
      'If wrongfully challaned, opt to contest the notice in the Virtual Traffic Court instead of paying spot compounding fees.',
      'Preserve dashcam or mobile video records if an officer behaves aggressively or attempts illegal key seizure.'
    ],
    legalRemedy: 'Contest challan before the Virtual Court / Metropolitan Magistrate Traffic Court; file complaint on National Grievance Portal CPGRAMS or State Traffic Vigilance.',
    emergencyHelpline: {
      name: 'Traffic Police Emergency & Vigilance',
      number: '1095',
      description: 'Traffic advisory, roadside harassment, and vigilance grievance desk',
      portalUrl: 'https://echallan.parivahan.gov.in'
    },
    penaltiesForViolation: 'Corrupt or abusive traffic officials face disciplinary suspension and departmental vigilance inquiry under Police Service Conduct Rules.',
    frequentlyAskedQuestions: [
      {
        question: 'Can a traffic police officer seize my physical phone if I show my documents on DigiLocker?',
        answer: 'No. Officers are only authorized to view the electronic credentials. They cannot seize your personal smartphone or insist on physical documents when DigiLocker verification is shown.'
      }
    ],
    tags: ['traffic', 'challan', 'digilocker', 'mparivahan', 'police', 'vehicle', 'driving license'],
    scenarioTag: 'traffic-police',
    whatToSay: 'Officer, under Rule 139 of the Central Motor Vehicles Rules and Section 4 of the Information Technology Act, electronic credentials verified through DigiLocker or mParivahan are statutory originals. Furthermore, vehicle ignition keys cannot be forcefully confiscated without an official seizure memo.',
    whatToSay_hi: 'अधिकारी महोदय, केंद्रीय मोटर वाहन नियम 139 और आईटी अधिनियम की धारा 4 के अनुसार, डिजिलॉकर और एम-परिवहन पर दिखाए गए डिजिटल दस्तावेज मूल प्रमाण पत्र के समान कानूनी रूप से मान्य हैं। इसके अतिरिक्त, बिना वैध चालान के वाहन की चाबी निकालना नियमों के विरुद्ध है।',
    dos: [
      'Present Driving License & RC via official DigiLocker or mParivahan app QR code.',
      'Politely record the officer\'s name, designation, and uniform badge number.',
      'Demand a computerized e-challan or elect to contest via the Virtual Traffic Court.'
    ],
    donts: [
      'Do NOT hand over cash bribes without a valid government-issued e-receipt.',
      'Do NOT permit the officer to forcefully confiscate or remove vehicle keys.',
      'Do NOT get into physical arguments; politely record video or audio if harassed.'
    ],
    dos_hi: [
      'डिजिलॉकर या एम-परिवहन ऐप से वैध क्यूआर कोड दिखाएं।',
      'अधिकारी का नाम, पद और वर्दी पर लगा बैच नंबर नोट करें।',
      'कंप्यूटर जनरेटेड ई-चालान मांगें या वर्चुअल कोर्ट में चुनौती दें।'
    ],
    donts_hi: [
      'बिना वैध सरकारी रसीद के नकद जुर्माना न दें।',
      'अधिकारी को जबरन गाड़ी की चाबी निकालने न दें।',
      'उग्र बहस न करें; यदि दुर्व्यवहार हो तो शांतिपूर्वक वीडियो/ऑडियो रिकॉर्ड करें।'
    ],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Transport Legal Desk',
    isPopular: true,
    isPublished: true
  },

  // 4. Cyber Fraud & Banking
  {
    id: 'cyber-fraud-banking-protection',
    slug: 'unauthorized-banking-transaction-remedies',
    title: 'Zero Customer Liability in Cyber Banking & UPI Fraud',
    category: 'Banking & Cyber Security',
    icon: 'lock',
    summary: 'RBI mandated insulation protecting account holders from financial losses caused by unauthorized electronic banking, ATM cloning, SIM-swap, and UPI breaches.',
    statutoryBasis: {
      actName: 'RBI Master Circular on Customer Protection & Information Technology Act',
      shortAct: 'RBI Circular & IT Act',
      sections: ['Circular DBR.No.Leg.BC.78/09.07.005/2017-18', 'IT Act Section 43A', 'IT Act Section 46'],
      actUrl: '/laws/IT',
      landmarkCases: [
        'RBI Master Directions on Electronic Banking Transactions (2017)',
        'State Bank of India vs. K.P. Chacko - Bank’s primary duty to protect account security'
      ]
    },
    keyProtections: [
      'Zero Liability Window: 100% zero liability if the customer notifies the bank of an unauthorized electronic transaction within 3 working days.',
      'Limited Liability Cap: If reported between 4 to 7 working days, customer liability is strictly capped at ₹5,000 (basic accounts/cards) or ₹10,000.',
      'Mandatory Shadow Credit Within 10 Days: The bank must credit the disputed amount back to the customer’s account within 10 working days of complaint receipt.',
      'Bank Bears Burden of Proof: The statutory burden of proving that the customer was negligent or willingly shared OTP/credentials lies entirely on the bank.',
      'Resolution Deadline: Bank must resolve the entire complaint within a maximum period of 90 days.'
    ],
    actionableSteps: [
      'Immediately dial Cyber Helpline 1930 within the golden hour to request immediate inter-bank freeze of the recipient wallet.',
      'Block your debit/credit card and internet banking credentials immediately via your bank’s 24x7 IVR helpline.',
      'Submit a formal written complaint with transaction SMS logs to the branch manager and obtain an official stamped acknowledgment.',
      'Lodge a cyber fraud complaint online at cybercrime.gov.in and obtain an NCRP acknowledgment number.',
      'If unresolved in 30 days, file an online dispute before the RBI Banking Ombudsman (cms.rbi.org.in).'
    ],
    legalRemedy: 'Complaint before the RBI Banking Ombudsman; petition before the State IT Adjudicating Officer under IT Act Section 46.',
    emergencyHelpline: {
      name: 'National Cyber Crime Financial Helpline',
      number: '1930',
      description: 'Indian Cyber Crime Coordination Centre (I4C) emergency fund recall hotline',
      portalUrl: 'https://cybercrime.gov.in'
    },
    penaltiesForViolation: 'Banks failing to credit shadow reversal within 10 days face penal interest levies and regulatory censure from Reserve Bank of India.',
    frequentlyAskedQuestions: [
      {
        question: 'What if the bank claims I shared my OTP when my phone was actually cloned or SIM-swapped?',
        answer: 'The bank must provide forensic technical proof. Under RBI regulations, the burden of proving customer negligence rests on the bank, not the victim.'
      }
    ],
    tags: ['cybercrime', 'banking fraud', 'upi', 'rbi', '1930', 'unauthorized transaction', 'otp'],
    scenarioTag: 'cyber-scam',
    whatToSay: 'I am formally reporting an unauthorized transaction within the RBI 72-Hour Zero-Liability window. Please record the transaction UTR, initiate an immediate freeze on the recipient beneficiary wallet under National Cyber Protocol (Helpline 1930), and furnish an official complaint acknowledgment.',
    whatToSay_hi: 'मैं आरबीआई के 72-घंटे जीरो-लायबिलिटी नियम के तहत अनाधिकृत वित्तीय लेनदेन की तत्काल शिकायत कर रहा हूँ। कृपया इस यूटीआर नंबर को दर्ज कर नेशनल साइबर क्राइम हेल्पलाइन 1930 प्रोटोकॉल के तहत लाभार्थी खाते को तुरंत फ्रीज करें और मुझे पावती संख्या प्रदान करें।',
    dos: [
      'Call Cyber Crime Helpline 1930 immediately within the first 2 hours (Golden Hour).',
      'Lodge a formal complaint on cybercrime.gov.in and retain the acknowledgment PDF.',
      'Notify your bank in writing within 72 hours to secure 100% Zero Customer Liability.'
    ],
    donts: [
      'Do NOT click on any unauthorized recovery links sent on WhatsApp or Telegram.',
      'Do NOT delete OTP SMS messages, transaction emails, or fraudulent call logs.',
      'Do NOT share your ATM PIN, net-banking password, or OTP with anyone.'
    ],
    dos_hi: [
      'पहले 2 घंटे (गोल्डन ऑवर) में हेल्पलाइन 1930 पर तुरंत कॉल करें।',
      'cybercrime.gov.in पर आधिकारिक शिकायत दर्ज कर पावती सहेजें।',
      'शून्य ग्राहक देनदारी के लिए 72 घंटे के भीतर बैंक को लिखित सूचना दें।'
    ],
    donts_hi: [
      'व्हाट्सएप या टेलीग्राम पर आए किसी भी रिकवरी लिंक या ऐप पर क्लिक न करें।',
      'ओटीपी, बैंक मैसेज, कॉल हिस्ट्री या लेनदेन का रिकॉर्ड कभी डिलीट न करें।',
      'बैंक अधिकारी या पुलिस बताकर बात करने वाले से ओटीपी या पिन साझा न करें।'
    ],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Banking & Fintech Legal Council',
    isPopular: true,
    isPublished: true
  },

  // 5. Consumer Protection & E-Commerce
  {
    id: 'consumer-protection-rights',
    slug: 'consumer-rights-redressal-cpa-2019',
    title: 'Consumer Rights, E-Commerce Refunds & Defective Goods',
    category: 'Consumer Protection',
    icon: 'shield-check',
    summary: 'Comprehensive statutory protections shielding consumers from defective products, deceptive advertisements, unauthorized cancellation fees, and unfair trade practices.',
    statutoryBasis: {
      actName: 'Consumer Protection Act, 2019 & E-Commerce Rules, 2020',
      shortAct: 'CPA 2019',
      sections: ['Section 2(9)', 'Section 35', 'Section 38', 'Section 84', 'Rule 5 E-Commerce Rules'],
      actUrl: '/laws/CPA',
      landmarkCases: [
        'National Consumer Commission Ruling on Dark Patterns & Hidden Charges (2023)',
        'Supreme Court in Lucknow Development Authority vs. M.K. Gupta - Broad definition of service consumer'
      ]
    },
    keyProtections: [
      'Strict Product Liability: Manufacturers, service providers, and sellers are directly liable for compensating any harm caused by defective products.',
      'Dark Patterns Ban: E-commerce platforms cannot engage in false urgency, basket sneaking, forced continuity, or hidden drip pricing.',
      'Equal Treatment for Online Buyers: Rights of online consumers are identical to offline physical store purchases.',
      'No Advocate Required: Citizens can directly file and argue their own case without hiring a lawyer.',
      'E-Daakhil Online Filing: Instant online petition submission from home without physical court visits.'
    ],
    actionableSteps: [
      'Preserve tax invoice, warranty cards, delivery photos/unboxing videos, and customer support chat transcripts.',
      'Lodge a free grievance on the National Consumer Helpline portal (consumerhelpline.gov.in) or call 1915.',
      'Send a formal legal notice giving the merchant 15 days to replace or refund.',
      'File an online complaint on E-Daakhil (edaakhil.nic.in) before the District Consumer Commission.'
    ],
    legalRemedy: 'Filing of complaint before District Consumer Commission (claims up to ₹50 Lakh) or State Commission (₹50 Lakh to ₹2 Crore) under Section 35.',
    emergencyHelpline: {
      name: 'National Consumer Helpline (NCH)',
      number: '1915',
      description: 'Ministry of Consumer Affairs grievance portal for rapid merchant dispute conciliation',
      portalUrl: 'https://consumerhelpline.gov.in'
    },
    penaltiesForViolation: 'Imprisonment up to 3 years and fines up to ₹1 Lakh for failure to comply with Consumer Commission orders (Section 72).',
    frequentlyAskedQuestions: [
      {
        question: 'Can an e-commerce platform refuse return/refund by stating "Goods once sold will not be taken back"?',
        answer: 'No. The Consumer Protection Act declares "no refund under any condition" clauses as an unfair contract term, rendering it legally null and void.'
      }
    ],
    tags: ['consumer', 'refund', 'ecommerce', 'cpa 2019', 'e-daakhil', 'defective product'],
    scenarioTag: 'ecommerce-refund',
    whatToSay: 'Under Section 2(47) of the Consumer Protection Act 2019 and E-Commerce Rules, refusing a refund for a defective product constitutes an unfair trade practice. I demand an immediate reversal within 48 hours, failing which a formal petition will be submitted via the National Consumer Helpline (1915) and e-Daakhil.',
    whatToSay_hi: 'उपभोक्ता संरक्षण अधिनियम 2019 की धारा 2(47) के अनुसार, दोषपूर्ण उत्पाद की वापसी या रिफंड से इनकार करना अनफेयर ट्रेड प्रैक्टिस है। मैं 48 घंटों में रिफंड की मांग करता हूँ अन्यथा राष्ट्रीय उपभोक्ता हेल्पलाइन 1915 व ई-दाखिल पर मामला दर्ज किया जाएगा।',
    dos: [
      'Lodge an official grievance on consumerhelpline.gov.in or dial 1915.',
      'Preserve unboxing videos, invoice receipts, defect photos, and courier delivery logs.',
      'Send a formal statutory notice giving 15 days to refund before filing on e-Daakhil.'
    ],
    donts: [
      'Do NOT accept store vouchers or wallet credits if a delivered item was defective or fake.',
      'Do NOT accept arbitrary return denial policies that contradict CPA 2019 E-Commerce Rules.',
      'Do NOT dispose of the damaged item before formal inspection or resolution.'
    ],
    dos_hi: [
      'consumerhelpline.gov.in पर शिकायत दर्ज करें या 1915 पर कॉल करें।',
      'अनबॉक्सिंग वीडियो, इनवॉइस रसीद, दोष फोटो और कूरियर डिलीवरी लॉग सुरक्षित रखें।',
      'ई-दाखिल पर दायर करने से पहले 15 दिन का विधिक नोटिस भेजें।'
    ],
    donts_hi: [
      'दोषपूर्ण उत्पाद के बदले स्टोर वाउचर या वॉलेट क्रेडिट स्वीकार न करें।',
      'CPA 2019 ई-कॉमर्स नियमों के विरुद्ध मनमानी रिटर्न नीतियाँ स्वीकार न करें।',
      'औपचारिक निरीक्षण या समाधान से पहले क्षतिग्रस्त वस्तु को नष्ट न करें।'
    ],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Consumer Redressal Council',
    isPopular: true,
    isPublished: true
  },

  // 6. Medical & Patient Rights
  {
    id: 'patient-rights-emergency-care',
    slug: 'patient-rights-emergency-medical-care',
    title: 'Emergency Patient Care & Hospital Charter of Rights',
    category: 'Health & Patient Rights',
    icon: 'heart',
    summary: 'Binding statutory rights ensuring emergency medical stabilization without upfront payment, access to medical records within 72 hours, and protection against corpse detention.',
    statutoryBasis: {
      actName: 'Clinical Establishments Act, 2010 & NHRC Patient Rights Charter',
      shortAct: 'CEA 2010 & NHRC Charter',
      sections: ['Section 12(2) CEA', 'NHRC Charter Article 1 to 17', 'Article 21 Constitution'],
      actUrl: '/laws/CEA',
      landmarkCases: [
        'Parmanand Katara vs. Union of India (1989) - Unconditional emergency treatment duty of every doctor',
        'Pravat Kumar Mukherjee vs. Ruby General Hospital - Deficiency in emergency medical care',
        'Delhi High Court in Deen Dayal Upadhyay Hospital Case - Strict prohibition on body detention'
      ]
    },
    keyProtections: [
      'Unconditional Emergency Care: Every hospital, government or private, must immediately provide emergency medical care to any person in critical condition without demanding prior deposit.',
      'Right to Medical Records: Patient or nominated family has the statutory right to receive complete case records and diagnostic summaries within 72 hours of written request.',
      'Prohibition on Body Detention: Hospitals cannot lawfully detain a deceased patient’s body over pending or disputed hospital bills.',
      'Informed Consent: Right to receive clear explanation regarding procedures, risks, alternative treatments, and detailed estimated costs before treatment.',
      'Right to Second Opinion: Hospital must facilitate access to external expert consultation without retaliatory denial of care.'
    ],
    actionableSteps: [
      'If a hospital refuses emergency stabilization, quote Supreme Court ruling Parmanand Katara vs. UOI and CEA Section 12(2).',
      'Submit a formal written request to the Medical Superintendent for certified medical summaries.',
      'If a hospital withholds a deceased body for unpaid bills, call Police 112 immediately to record an extortion/wrongful confinement complaint.',
      'Lodge a formal medical negligence/deficiency complaint before the State Medical Council and District Consumer Commission.'
    ],
    legalRemedy: 'Emergency writ petition in High Court under Article 226; complaint before State Medical Council; claim before Consumer Disputes Redressal Commission.',
    emergencyHelpline: {
      name: 'National Health Authority Grievance Desk',
      number: '14555',
      description: 'National helpline for PM-JAY and hospital treatment denials',
      portalUrl: 'https://nha.gov.in'
    },
    penaltiesForViolation: 'Clinical establishments face cancellation of operating licenses, heavy fines under CEA 2010, and doctors face suspension by National Medical Commission.',
    frequentlyAskedQuestions: [
      {
        question: 'Can a private hospital refuse to admit an accident victim until police arrive?',
        answer: 'No. The Supreme Court in Parmanand Katara held that saving human life is the supreme duty. Doctors must begin emergency treatment immediately without waiting for police formalities.'
      }
    ],
    tags: ['hospital', 'patient rights', 'medical', 'emergency', 'nhrc', 'body detention', 'bills'],
    scenarioTag: 'medical-emergency',
    whatToSay: 'Under the landmark Supreme Court ruling in Parmanand Katara vs. Union of India and Article 21, all hospitals are legally mandated to provide immediate emergency trauma stabilization without demanding advance monetary deposits or police clearance.',
    whatToSay_hi: 'सर्वोच्च न्यायालय के परमानंद कटारा बनाम भारत संघ फैसले और संविधान के अनुच्छेद 21 के तहत, कोई भी अस्पताल आपातकालीन ट्रॉमा इलाज के लिए अग्रिम पैसे या पुलिस औपचारिकता की मांग नहीं कर सकता। कृपया तुरंत आपातकालीन उपचार शुरू करें।',
    dos: [
      'Demand immediate emergency trauma stabilization under Supreme Court ruling Parmanand Katara.',
      'Inform the medical director that demanding upfront deposits in an emergency violates Article 21.',
      'Retain copies of admission slips, clinical triage notes, and diagnostic reports.'
    ],
    donts: [
      'Do NOT accept an unsafe transfer without stabilization and a fully equipped ambulance.',
      'Do NOT delay critical medical care waiting for police clearance memos (MLC).',
      'Do NOT leave the medical facility without written reasons if admission is denied.'
    ],
    dos_hi: [
      'सुप्रीम कोर्ट के परमानंद कटारा फैसले के तहत तुरंत आपातकालीन ट्रॉमा इलाज मांगें।',
      'अस्पताल प्रबंधन को स्पष्ट बताएं कि अग्रिम पैसे मांगना अनुच्छेद 21 का उल्लंघन है।',
      'सभी मेडिकल पर्चे, डॉक्टर के नोट्स और बिलों की प्रतियां सुरक्षित रखें।'
    ],
    donts_hi: [
      'बिना प्राथमिक उपचार और एम्बुलेंस सुविधा के दूसरे अस्पताल का रेफरल स्वीकार न करें।',
      'आपातकालीन स्थिति में पुलिस क्लीयरेंस (MLC) का इंतजार न करें।',
      'यदि इलाज से मना किया जाए तो बिना लिखित कारण लिए परिसर न छोड़ें।'
    ],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Medico-Legal Advisory Board',
    isPopular: true,
    isPublished: true
  },

  // 7. Housing & Tenancy
  {
    id: 'tenant-renter-protections',
    slug: 'tenant-protections-rent-control',
    title: 'Tenant Rights Against Unlawful Eviction & Utility Cutoff',
    category: 'Housing & Tenancy',
    icon: 'home',
    summary: 'Statutory safeguards protecting residential tenants from coercive lockouts, sudden utility disconnection, arbitrary rent increases, and privacy invasions.',
    statutoryBasis: {
      actName: 'Transfer of Property Act, 1882 & Model Tenancy Act',
      shortAct: 'TPA 1882 & MTA',
      sections: ['Section 106 TPA', 'Section 108 TPA', 'Model Tenancy Act Provisions'],
      actUrl: '/laws/TPA',
      landmarkCases: [
        'Supreme Court in State of UP vs. Maharaja Dharmander Prasad - Lawful possession cannot be disrupted by force',
        'Delhi Rent Control Tribunal rulings on essential amenities'
      ]
    },
    keyProtections: [
      'No Forcible Dispossession: Landlords cannot forcefully evict a tenant or change door locks without a formal decree from the Rent Court.',
      'Mandatory 30-Day Notice: A minimum 30-day written notice must be served for lease termination under Section 106 TPA.',
      'Prohibition on Cutting Utilities: Landlords are strictly barred from severing electricity, water, or elevator services during rental disagreements.',
      'Security Deposit Cap: Residential tenancy deposits are capped at maximum 2 months rent under the Model Tenancy Act framework.',
      '24-Hour Entry Notice: Landlord must provide at least 24 hours advance notice before entering rented premises for repairs or inspection.'
    ],
    actionableSteps: [
      'Always execute a registered or notarized agreement detailing deposit refund timelines and notice periods.',
      'Retain digital receipts or bank transfer proofs for all monthly rental remittances.',
      'If utilities are disconnected or eviction threatened, lodge an immediate station diary entry at the local police station.',
      'Approach the local Rent Authority or Civil Court for an interim temporary injunction restraining illegal dispossession.'
    ],
    legalRemedy: 'Suit for Permanent Injunction against unlawful dispossession; petition before the Rent Court for mandatory restoration of essential utilities.',
    emergencyHelpline: {
      name: 'State Rent Authority & DLSA Desk',
      number: '15100',
      description: 'Free legal guidance on rental disputes and landlord harassment',
      portalUrl: 'https://nalsa.gov.in'
    },
    penaltiesForViolation: 'Landlords cutting essential utilities face daily pecuniary penalties from the Rent Authority and criminal liability for criminal intimidation under BNS Section 351.',
    frequentlyAskedQuestions: [
      {
        question: 'Can my landlord refuse to return my security deposit by making false claims of normal wear and tear?',
        answer: 'No. Security deposits must be refunded within 30 days of vacating. Landlords cannot deduct costs for routine painting and normal wear and tear unless explicitly proven in the move-in inspection report.'
      }
    ],
    tags: ['tenant', 'rent', 'landlord', 'eviction', 'deposit', 'electricity', 'model tenancy'],
    scenarioTag: 'tenant-eviction',
    whatToSay: 'Under the Model Tenancy Act and Section 432 of the Bharatiya Nyaya Sanhita (BNS), cutting off essential water or electricity or locking out a tenant without a competent court decree constitutes criminal trespass and illegal dispossession.',
    whatToSay_hi: 'मॉडल टेनेंसी एक्ट और भारतीय न्याय संहिता की धारा 432 के तहत सक्षम रेंट प्राधिकरण के कानूनी आदेश के बिना पानी, बिजली काटना या घर से बेदखल करना एक दंडनीय अपराध है। कृपया आवश्यक आपूर्ति तुरंत बहाल करें।',
    dos: [
      'Retain digital bank transfer logs, rent receipts, and your signed lease agreement.',
      'Report any disconnection of essential water/power supplies to local police as criminal trespass.',
      'Insist on formal statutory notice as mandated under the Model Tenancy Act before vacating.'
    ],
    donts: [
      'Do NOT vacate premises under verbal threats without a decree from a Rent Authority.',
      'Do NOT engage in physical scuffles; document photographs/videos of locks and utilities.',
      'Do NOT hand over keys without a signed acknowledgment confirming full deposit refund.'
    ],
    dos_hi: [
      'किराये के सभी ऑनलाइन बैंक ट्रांसफर और रसीदें सुरक्षित रखें।',
      'पानी या बिजली काटने पर तुरंत स्थानीय थाने में आपराधिक शिकायत दर्ज कराएं।',
      'घर खाली करने से पहले मॉडल टेनेंसी एक्ट के तहत लिखित नोटिस की मांग करें।'
    ],
    donts_hi: [
      'सक्षम रेंट अथॉरिटी के कानूनी आदेश के बिना केवल मौखिक धमकी पर घर खाली न करें।',
      'शारीरिक विवाद में न पड़ें; टूटे ताले या अवरोधों का वीडियो/फोटो साक्ष्य बनाएं।',
      'पूरी सिक्योरिटी डिपॉजिट की लिखित वापसी रसीद के बिना चाबी न सौंपें।'
    ],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Real Estate & Tenancy Division',
    isPopular: true,
    isPublished: true
  },

  // 8. Women & Family Safety
  {
    id: 'domestic-violence-protection',
    slug: 'domestic-violence-safeguards-pwdva',
    title: 'Women’s Rights Against Domestic Violence (PWDVA)',
    category: 'Women & Family Safety',
    icon: 'heart',
    summary: 'Comprehensive legal protections for women against physical abuse, emotional cruelty, financial deprivation, and sexual violence in domestic relationships.',
    statutoryBasis: {
      actName: 'Protection of Women from Domestic Violence Act, 2005',
      shortAct: 'PWDVA 2005',
      sections: ['Section 12', 'Section 17', 'Section 18', 'Section 19', 'Section 20', 'Section 22'],
      actUrl: '/laws/PWDVA',
      landmarkCases: [
        'Satish Chander Ahuja vs. Sneha Ahuja (2020) - Absolute right of residence in shared household',
        'Rajnesh vs. Neha (2020) - Guidelines on comprehensive interim maintenance'
      ]
    },
    keyProtections: [
      'Right to Shared Household: Right to reside in the matrimonial or shared home regardless of whether the woman holds title ownership.',
      'Protection Orders: Immediate court orders restraining the abuser from entering the woman’s residence, place of employment, or contacting her.',
      'Emergency Monetary Relief: Right to claim monthly maintenance, medical reimbursement, and loss of earnings caused by violence.',
      'Temporary Child Custody: Judicial orders preventing abusive spouses from snatching children.',
      'Free Protection Officer & Legal Aid: Assistance from statutory Protection Officers and free legal representation through DLSA.'
    ],
    actionableSteps: [
      'Call Women Helpline 1091 or Emergency 112 immediately if in immediate danger.',
      'Seek treatment at a government hospital and preserve medical records documenting injuries.',
      'Contact the local Protection Officer or Magistrate to file a Domestic Incident Report (DIR).',
      'File an application under Section 12 PWDVA for immediate ex-parte protection and maintenance orders.'
    ],
    legalRemedy: 'Filing petition under Section 12 PWDVA before the Judicial Magistrate First Class or Metropolitan Magistrate.',
    emergencyHelpline: {
      name: 'National Women Helpline',
      number: '1091',
      description: '24x7 all-India emergency response for women facing domestic or public abuse',
      portalUrl: 'https://ncw.nic.in'
    },
    penaltiesForViolation: 'Breach of a Protection Order is a cognizable and non-bailable offense punishable by up to 1 year imprisonment and ₹20,000 fine (Section 31).',
    frequentlyAskedQuestions: [
      {
        question: 'Can in-laws evict a daughter-in-law from a house owned solely by them?',
        answer: 'The Supreme Court in Satish Chander Ahuja held that a woman has the statutory right of residence in the shared household even if owned by father-in-law or mother-in-law, until alternative suitable accommodation is provided.'
      }
    ],
    tags: ['women', 'domestic violence', 'pwdva', 'maintenance', 'shared household', '1091'],
    scenarioTag: 'women-safety',
    whatToSay: 'Under Section 35(7) of the BNSS 2023, no woman can be arrested after sunset and before sunrise without prior written permission from a Judicial Magistrate. Furthermore, under BNSS Section 173, filing a Zero FIR is mandatory at any police station.',
    whatToSay_hi: 'बीएनएसएस धारा 35(7) के तहत सूर्यास्त के बाद और सूर्योदय से पहले किसी भी महिला को न्यायिक मजिस्ट्रेट की पूर्व लिखित अनुमति के बिना गिरफ्तार नहीं किया जा सकता। इसके अतिरिक्त, बीएनएसएस धारा 173 के तहत जीरो एफआईआर किसी भी थाने में दर्ज कराना हमारा कानूनी अधिकार है।',
    dos: [
      'Insist on registering a Zero FIR at ANY police station under BNSS Section 173.',
      'Demand that your statement is recorded by a female officer or woman magistrate.',
      'Dial 24x7 Women Helpline 1090 or 181 for immediate institutional protection.'
    ],
    donts: [
      'Women CANNOT be arrested after sunset and before sunrise without prior Magistrate order.',
      'Women and children under 15 CANNOT be summoned to police stations for questioning.',
      'Do NOT permit any body search without a female police officer acting with strict decency.'
    ],
    dos_hi: [
      'बीएनएसएस धारा 173 के तहत किसी भी नजदीकी थाने में जीरो एफआईआर दर्ज कराएं।',
      'महिला पुलिस अधिकारी या महिला मजिस्ट्रेट के समक्ष बयान दर्ज कराने की मांग करें।',
      'तुरंत 24x7 महिला सुरक्षा हेल्पलाइन 1090 या 181 पर कॉल करें।'
    ],
    donts_hi: [
      'सूर्यास्त के बाद और सूर्योदय से पहले मजिस्ट्रेट की अनुमति बिना गिरफ्तारी स्वीकार न करें।',
      'महिलाओं और 15 वर्ष से कम बच्चों को पूछताछ के लिए थाने नहीं बुलाया जा सकता।',
      'महिला पुलिसकर्मी के बिना किसी भी प्रकार की शारीरिक तलाशी न होने दें।'
    ],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Family Law Directorate',
    isPopular: true,
    isPublished: true
  },

  // 9. Digital Privacy & Technology
  {
    id: 'digital-data-privacy-dpdp',
    slug: 'data-principal-rights-dpdp-2023',
    title: 'Citizen Data Privacy & Digital Rights (DPDP Act)',
    category: 'Digital Privacy & Technology',
    icon: 'lock',
    summary: 'Codifies statutory control for Indian citizens over their personal data processed by technology corporations, banks, and digital intermediaries under DPDP Act 2023.',
    statutoryBasis: {
      actName: 'Digital Personal Data Protection Act, 2023',
      shortAct: 'DPDP Act 2023',
      sections: ['Section 6', 'Section 11', 'Section 12', 'Section 13', 'Section 14'],
      actUrl: '/laws/DPDP',
      landmarkCases: [
        'Justice K.S. Puttaswamy (Retd.) vs. Union of India (2017) - Privacy as fundamental right',
        'Data Protection Board of India Regulatory Framework'
      ]
    },
    keyProtections: [
      'Right to Access Summary: Citizens can demand a clear summary of all personal data being processed and third parties with whom it was shared.',
      'Right to Correction & Erasure: Data Principals can demand completion, correction, and permanent deletion of outdated or inaccurate personal data.',
      'Right to Withdraw Consent: Citizens have the statutory right to withdraw data consent at any time with the same ease with which consent was granted.',
      'Right to Redressal: Data Fiduciaries must maintain accessible grievance redressal mechanisms with fixed resolution timelines.',
      'Right to Nominate: Citizens can nominate a trusted individual to exercise data rights in case of death or incapacity.'
    ],
    actionableSteps: [
      'Submit a formal Data Subject Request to the Data Protection Officer (DPO) of the enterprise.',
      'Review permission requests in apps and withdraw microphone, camera, or contact permissions.',
      'If the enterprise fails to respond within prescribed SLAs, file a formal complaint before the Data Protection Board of India (DPBI).'
    ],
    legalRemedy: 'Formal complaint before the Data Protection Board of India (DPBI) and appellate remedies before TDSAT.',
    emergencyHelpline: {
      name: 'Data Protection Board of India Desk',
      number: '1800-LC-DPDP',
      description: 'Statutory compliance grievance desk for data principal rights exercise',
      portalUrl: 'https://meity.gov.in'
    },
    penaltiesForViolation: 'Data Fiduciaries face financial penalties up to ₹250 Crore for failing to observe security safeguards and up to ₹200 Crore for failing to notify data breaches.',
    frequentlyAskedQuestions: [
      {
        question: 'Can digital lenders or loan apps access all phone contacts and photos under DPDP?',
        answer: 'No. The DPDP Act mandates strict purpose limitation. Apps cannot force blanket consent for irrelevant permissions like phone galleries or contact books.'
      }
    ],
    tags: ['dpdp', 'privacy', 'data protection', 'erasure', 'consent', 'dpo'],
    scenarioTag: 'digital-privacy',
    whatToSay: "Under Section 6 and Section 12 of the Digital Personal Data Protection Act, 2023, I have the statutory right to withdraw consent and demand erasure of my personal data. Please provide written confirmation of data deletion and state the purpose limitation of any processed records.",
    whatToSay_hi: "डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 की धारा 6 और 12 के तहत मुझे सहमति वापस लेने और अपने व्यक्तिगत डेटा को मिटाने का वैधानिक अधिकार है। कृपया डेटा हटाने की लिखित पुष्टि दें और रिकॉर्ड के उपयोग का उद्देश्य स्पष्ट करें।",
    dos: [
      "Exercise your right to access and correct inaccurate digital personal data.",
      "Lodge formal grievance with the Data Fiduciary's designated Grievance Officer.",
      "Escalate unresolved privacy violations to the Data Protection Board of India (DPBI)."
],
    donts: [
      "Do NOT provide Aadhaar or biometric data to private commercial apps where not mandated by law.",
      "Do NOT accept bundled consent terms that force consent for marketing as a condition of service.",
      "Do NOT share OTPs or authentication tokens with customer support personnel."
],
    dos_hi: [
      "गलत या पुराने डिजिटल डेटा को सुधारने और मिटाने के अधिकार का प्रयोग करें।",
      "डेटा फिड्यूशरी के अधिकृत शिकायत अधिकारी के पास लिखित शिकायत दर्ज करें।",
      "अनसुलझे मामलों की शिकायत भारतीय डेटा संरक्षण बोर्ड (DPBI) को भेजें।"
],
    donts_hi: [
      "निजी ऐप्स को कानूनन गैर-अनिवार्य मामलों में आधार या बायोमेट्रिक्स न सौंपें।",
      "सेवा प्राप्त करने के लिए गैर-जरूरी मार्केटिंग सहमति वाले फॉर्म स्वीकार न करें।",
      "किसी भी ग्राहक सेवा प्रतिनिधि के साथ ओटीपी या पासवर्ड साझा न करें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Digital Technology Council',
    isPopular: true,
    isPublished: true
  },

  // 10. Workplace Sexual Harassment (POSH)
  {
    id: 'posh-workplace-harassment',
    slug: 'posh-act-workplace-harassment-safeguards',
    title: 'Workplace Sexual Harassment Protections (POSH Act)',
    category: 'Workplace & Employment',
    icon: 'briefcase',
    summary: 'Binding statutory framework ensuring a safe workplace for women, mandating Internal Complaints Committees (ICC), confidentiality, and protection from employer retaliation.',
    statutoryBasis: {
      actName: 'Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013',
      shortAct: 'POSH Act 2013',
      sections: ['Section 4', 'Section 9', 'Section 11', 'Section 12', 'Section 16'],
      actUrl: '/laws/POSH',
      landmarkCases: [
        'Vishaka vs. State of Rajasthan (1997) - Historic workplace safety guidelines',
        'Aureliano Fernandes vs. State of Goa (2023) - Supreme Court directives on strict POSH compliance across private and public sectors'
      ]
    },
    keyProtections: [
      'Mandatory Internal Committee (IC): Every organization with 10 or more employees must constitute an IC headed by a senior woman employee and an external NGO member.',
      'Broad Workplace Definition: Covers office premises, work-from-home (WFH), corporate transportation, off-site client meetings, and official social gatherings.',
      'Interim Relief: Complainant has the right to seek paid leave up to 3 months or transfer to another team/branch during inquiry.',
      'Strict Identity Confidentiality: Section 16 strictly prohibits publishing or leaking the name, address, or identity of the complainant or witnesses.',
      '90-Day Inquiry Deadline: The Internal Committee must complete its formal inquiry within 90 calendar days.'
    ],
    actionableSteps: [
      'Preserve screenshots, emails, WhatsApp messages, call records, and contemporaneous notes.',
      'Submit a written complaint to the Presiding Officer of the Internal Committee within 3 months of the incident.',
      'If the employer has fewer than 10 workers or the complaint is against the employer, file with the District Officer’s Local Complaints Committee (LCC).',
      'If the organization lacks an IC, lodge a complaint on the She-Box portal (shebox.nic.in).'
    ],
    legalRemedy: 'Inquiry before the Internal Committee (IC) / Local Committee (LC); appeal before the Appellate Authority under industrial employment rules or High Court.',
    emergencyHelpline: {
      name: 'She-Box National Portal & Women Helpline',
      number: '1091',
      description: 'Ministry of Women & Child Development online portal for registering workplace sexual harassment complaints',
      portalUrl: 'https://shebox.nic.in'
    },
    penaltiesForViolation: 'Employers failing to constitute an IC face a fine of ₹50,000, doubling on repeated violations with cancellation of business operating licenses.',
    frequentlyAskedQuestions: [
      {
        question: 'Does the POSH Act protect interns, trainees, and contract workers?',
        answer: 'Yes. Section 2(a) broadly protects women employees whether employed directly, through a contractor, on probation, trainee, intern, or honorary capacity.'
      }
    ],
    tags: ['posh', 'workplace', 'harassment', 'internal committee', 'vishaka', 'shebox'],
    scenarioTag: 'workplace-harassment',
    whatToSay: "I am formally reporting an incident of unwelcome conduct under Section 9 of the POSH Act, 2013. I request the Internal Committee to register my complaint, maintain strict confidentiality under Section 16, and grant interim relief under Section 12.",
    whatToSay_hi: "मैं POSH अधिनियम 2013 की धारा 9 के तहत औपचारिक शिकायत दर्ज कर रही हूं। मैं आंतरिक शिकायत समिति (ICC) से धारा 16 के तहत पूर्ण गोपनीयता बनाए रखने और धारा 12 के तहत अंतरिम राहत प्रदान करने का अनुरोध करती हूं।",
    dos: [
      "Submit written complaint to the Internal Committee (IC) within 3 months of the incident.",
      "Preserve all digital evidence including emails, chat logs, voice recordings, and CCTV timestamps.",
      "Apply for interim relief: transfer, work-from-home, or up to 90 days paid leave under Section 12."
],
    donts: [
      "Do NOT allow management to resolve sexual harassment through informal HR warnings.",
      "Do NOT publish identity or inquiry proceedings on social media (barred under Section 16).",
      "Do NOT hesitate to approach Local Committee (LC) at District Magistrate office if company lacks an IC."
],
    dos_hi: [
      "घटना के 3 महीने के भीतर आंतरिक समिति (IC) को लिखित शिकायत सौंपें।",
      "ईमेल, चैट संदेश, कॉल रिकॉर्डिंग और सीसीटीवी टाइमस्टैम्प सुरक्षित रखें।",
      "धारा 12 के तहत ट्रांसफर या 90 दिनों तक की सवैतनिक छुट्टी की अंतरिम राहत मांगें।"
],
    donts_hi: [
      "प्रबंधन को अनौपचारिक चेतावनी देकर मामला दबाने की अनुमति न दें।",
      "सोशल मीडिया पर जांच या पीड़ित की पहचान उजागर न करें (धारा 16 द्वारा वर्जित)।",
      "कंपनी में समिति न होने पर जिला स्तर की स्थानीय समिति (LC) जाने में संकोच न करें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Labour & Employment Division',
    isPopular: true,
    isPublished: true
  },

  // 11. Air Passenger Rights (DGCA)
  {
    id: 'air-passenger-flight-rights',
    slug: 'dgca-air-passenger-charter-rights',
    title: 'Air Passenger Rights for Flight Delays, Cancellations & Baggage',
    category: 'Air Travel & Consumer Rights',
    icon: 'globe',
    summary: 'Binding statutory protections under the DGCA Passenger Charter guaranteeing compensation, free meals, alternative flights, and refunds for airline defaults.',
    statutoryBasis: {
      actName: 'DGCA Civil Aviation Requirements (CAR) Section 3, Series M, Part IV',
      shortAct: 'DGCA CAR Series M',
      sections: ['Clause 3.3 Delay Remedies', 'Clause 3.4 Cancellation Compensation', 'Clause 3.5 Denied Boarding'],
      actUrl: '/laws/Aviation',
      landmarkCases: [
        'DGCA Civil Aviation Guidelines on Passenger Facilitation (2022 Amendments)',
        'National Consumer Commission rulings holding airlines strictly accountable for scheduling lapses'
      ]
    },
    keyProtections: [
      'Denied Boarding Compensation: If denied boarding due to airline overbooking, airline must arrange alternate flight within 1 hour or pay compensation up to ₹20,000 + ticket refund.',
      'Flight Cancellation: If informed less than 2 weeks to 24 hours before departure, airline must offer alternate flight or refund + compensation up to ₹10,000.',
      'Flight Delays: Delays over 2 to 4 hours entitle passengers to free meals and refreshments; delays exceeding 6 hours require alternate flight or full refund.',
      'Overnight Delay: Airline must provide free hotel accommodation and transfers if a flight is delayed overnight or rescheduled.',
      'Lost / Damaged Baggage: Statutory baggage liability up to ₹20,000 per passenger under Carriage by Air Act.'
    ],
    actionableSteps: [
      'Request written confirmation of delay or cancellation reason directly from the airline duty manager at the airport counter.',
      'Insist on complimentary refreshments or hotel vouchers at the airport terminal.',
      'Lodge a formal dispute on the Ministry of Civil Aviation AirSewa portal (airsewa.gov.in).',
      'If the airline repudiates valid statutory compensation, file an E-Daakhil claim before the Consumer Disputes Commission.'
    ],
    legalRemedy: 'Grievance through DGCA AirSewa portal; complaint before the District Consumer Commission for deficiency in service and mental harassment.',
    emergencyHelpline: {
      name: 'AirSewa Grievance Desk',
      number: '1800-11-2005',
      description: 'Ministry of Civil Aviation passenger charter escalation hotline',
      portalUrl: 'https://airsewa.gov.in'
    },
    penaltiesForViolation: 'Airlines violating DGCA CAR regulations face severe financial penalties and regulatory flight slot restrictions from the DGCA.',
    frequentlyAskedQuestions: [
      {
        question: 'Can airlines blame "operational reasons" to avoid paying delay compensation?',
        answer: 'No. DGCA mandates that airlines can only claim exemption under extraordinary circumstances like acts of God or severe air traffic control weather groundings that could not be avoided.'
      }
    ],
    tags: ['flight delay', 'dgca', 'airline refund', 'airsewa', 'baggage', 'denied boarding'],
    scenarioTag: 'flight-delay',
    whatToSay: "Under DGCA Civil Aviation Requirements (CAR Section 3, Series M, Part IV), as my flight is delayed beyond statutory thresholds, the airline is legally obligated to provide complimentary refreshments, hotel accommodation, or an immediate full refund.",
    whatToSay_hi: "डीजीसीए नागरिक उड्डयन नियमों (CAR Section 3, Series M, Part IV) के तहत, उड़ान में वैधानिक सीमा से अधिक देरी होने पर एयरलाइन मानार्थ भोजन, होटल आवास या तत्काल पूर्ण रिफंड देने के लिए कानूनी रूप से बाध्य है।",
    dos: [
      "Demand written delay endorsement on boarding pass from the duty airline station manager.",
      "Insist on complimentary food and refreshments if flight delay exceeds 2 hours.",
      "Lodge immediate complaint on AirSewa portal (airsewa.gov.in) if compensation is denied."
],
    donts: [
      "Do NOT accept airline travel vouchers if you prefer a direct monetary bank refund.",
      "Do NOT leave the airport without filing a Property Irregularity Report (PIR) for lost or damaged luggage.",
      "Do NOT settle for informal verbal promises from gate agents."
],
    dos_hi: [
      "बोर्डिंग पास पर एयरलाइन स्टेशन मैनेजर से उड़ान देरी की लिखित मोहर लें।",
      "2 घंटे से अधिक देरी होने पर मानार्थ भोजन और पानी की मांग करें।",
      "मुआवजा न मिलने पर एयरसेवा पोर्टल (airsewa.gov.in) पर तुरंत शिकायत दर्ज करें।"
],
    donts_hi: [
      "यदि आप बैंक खाते में नकद रिफंड चाहते हैं तो जबरन दिए जा रहे वाउचर स्वीकार न करें।",
      "सामान खोने या टूटने पर बिना पीआईआर (PIR) रिपोर्ट दर्ज कराए हवाई अड्डा न छोड़ें।",
      "गेट कर्मचारियों के केवल मौखिक आश्वासनों पर निर्भर न रहें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Consumer & Aviation Desk',
    isPopular: true,
    isPublished: true
  },

  // 12. Real Estate Homebuyers (RERA)
  {
    id: 'rera-homebuyer-protection',
    slug: 'rera-homebuyer-rights-possession-delay',
    title: 'Homebuyer Rights Against Possession Delays (RERA Act)',
    category: 'Real Estate & Homebuyers',
    icon: 'home',
    summary: 'Statutory protections under RERA 2016 empowering allottees to claim monthly interest for delayed possession, full refunds with interest, and 5-year defect warranties.',
    statutoryBasis: {
      actName: 'Real Estate (Regulation and Development) Act, 2016',
      shortAct: 'RERA Act 2016',
      sections: ['Section 14', 'Section 18', 'Section 19', 'Section 31'],
      actUrl: '/laws/RERA',
      landmarkCases: [
        'Newtech Promoters and Developers vs. State of UP (Supreme Court 2021) - Allottees have absolute right to refund with interest upon delay',
        'Bikram Chatterji vs. Union of India (Amrapali Matter) - Protection of homebuyer investments'
      ]
    },
    keyProtections: [
      'Absolute Right to Refund: If a builder fails to deliver possession within the committed agreement date, homebuyer has the right to withdraw and demand full refund with interest.',
      'Monthly Delay Interest: If the buyer chooses not to withdraw, the promoter must pay monthly interest at SBI Marginal Cost of Funds Based Lending Rate (MCLR) + 2% until possession.',
      '5-Year Structural Defect Guarantee: Builder is statutorily liable to rectify any structural defect or poor workmanship for 5 years without additional charge within 30 days.',
      'No Advance Beyond 10%: Builders cannot collect more than 10% of apartment cost without executing a registered Agreement for Sale.',
      'No Unauthorized Layout Alteration: Promoters cannot alter sanctioned architectural plans without prior written consent from 2/3rd of allottees.'
    ],
    actionableSteps: [
      'Verify builder’s RERA registration number and quarterly project progress disclosures on the State RERA portal.',
      'Issue a formal legal notice demanding possession or interest under RERA Section 18.',
      'File an online complaint before the State Real Estate Regulatory Authority (RERA) under Section 31.',
      'If aggrieved by an adjudicating officer order, appeal before the Real Estate Appellate Tribunal (REAT).'
    ],
    legalRemedy: 'Complaint under Section 31 before the State Real Estate Regulatory Authority (RERA); claim before Adjudicating Officer for compensation.',
    emergencyHelpline: {
      name: 'State RERA Public Grievance Desk',
      number: '1800-RERA-AID',
      description: 'Regulatory assistance desk for tracking project complaints and builder default notices',
      portalUrl: 'https://mohua.gov.in'
    },
    penaltiesForViolation: 'Promoters violating RERA orders face imprisonment up to 3 years and penalty up to 10% of total estimated project cost.',
    frequentlyAskedQuestions: [
      {
        question: 'Can a builder force buyers into arbitration to prevent them from approaching RERA?',
        answer: 'No. The Supreme Court has repeatedly held that RERA remedies are concurrent and arbitration clauses cannot oust the statutory jurisdiction of RERA or Consumer Forums.'
      }
    ],
    tags: ['rera', 'homebuyer', 'flat possession', 'builder delay', 'refund', 'structural defect'],
    scenarioTag: 'builder-delay',
    whatToSay: "Under Section 18 of the Real Estate (Regulation and Development) Act, 2016, the promoter is strictly liable to pay monthly interest at SBI MCLR + 2% for every month of delayed possession, or refund the entire paid amount with statutory interest.",
    whatToSay_hi: "रेरा अधिनियम 2016 की धारा 18 के तहत, पजेशन में देरी होने पर बिल्डर प्रत्येक महीने के लिए एसबीआई एमसीएलआर + 2% की दर से मासिक ब्याज देने या ब्याज सहित पूरी राशि वापस करने के लिए बाध्य है।",
    dos: [
      "Issue a formal legal notice claiming monthly delay interest under Section 18.",
      "File an online complaint with the State RERA Authority under Section 31.",
      "Verify the builder's escrow account and construction milestones on the official RERA portal."
],
    donts: [
      "Do NOT sign unilateral agreement amendments extending completion deadlines without compensation.",
      "Do NOT accept verbal handover promises without an official Occupancy Certificate (OC).",
      "Do NOT pay remaining installments if project construction is completely stalled."
],
    dos_hi: [
      "धारा 18 के तहत मासिक विलंब ब्याज का दावा करते हुए औपचारिक कानूनी नोटिस भेजें।",
      "धारा 31 के तहत राज्य रेरा प्राधिकरण की वेबसाइट पर ऑनलाइन शिकायत दर्ज करें।",
      "रेरा पोर्टल पर प्रोजेक्ट के एस्क्रो खाते और निर्माण प्रगति की पुष्टि करें।"
],
    donts_hi: [
      "बिना मुआवजे के कब्जा तिथि बढ़ाने वाले एकतरफा बिल्डर समझौतों पर हस्ताक्षर न करें।",
      "बिना ऑक्यूपेंसी सर्टिफिकेट (OC) के अवैध रूप से चाबी स्वीकार न करें।",
      "यदि निर्माण कार्य पूरी तरह रुका हुआ है तो आगे की किस्तों का भुगतान न करें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Real Estate Regulatory Council',
    isPopular: true,
    isPublished: true
  },

  // 13. Senior Citizens
  {
    id: 'senior-citizens-maintenance',
    slug: 'senior-citizens-parents-maintenance-act',
    title: 'Senior Citizen Maintenance & Property Gift Deed Revocation',
    category: 'Senior Citizens & Family',
    icon: 'users',
    summary: 'Protects the dignity, health, and property of elderly parents, empowering SDM Maintenance Tribunals to void abusive property transfers and enforce maintenance.',
    statutoryBasis: {
      actName: 'Maintenance and Welfare of Parents and Senior Citizens Act, 2007',
      shortAct: 'MWPSC Act 2007',
      sections: ['Section 4', 'Section 5', 'Section 9', 'Section 23'],
      actUrl: '/laws/SeniorCitizen',
      landmarkCases: [
        'Sudesh Chhikara vs. Ramti Devi (Supreme Court 2022) - Conditions for voiding gift deeds under Section 23',
        'High Court rulings enforcing eviction of abusive adult children from elderly parents’ self-acquired homes'
      ]
    },
    keyProtections: [
      'Monthly Maintenance Allowance: Elderly parents unable to maintain themselves can claim maintenance from adult children or grandchildren possessing inheritance interest.',
      'Void Property Transfers: If a senior citizen transferred property subject to the condition of care, Section 23 empowers tribunals to declare the transfer null and void upon neglect.',
      'Eviction of Abusive Heirs: Tribunals can order summary eviction of abusive children or relatives from self-acquired homes of elderly parents.',
      'Speedy Summary Hearings: Proceedings conducted before the Sub-Divisional Magistrate (SDM) must conclude within 90 days.',
      'Criminalization of Abandonment: Abandoning a senior citizen is a criminal offense punishable with imprisonment up to 3 months or fine.'
    ],
    actionableSteps: [
      'Draft a simple application stating family relationships, income status, and failure of children to provide basic food, shelter, or medicines.',
      'File the petition before the Maintenance Tribunal presided by the Sub-Divisional Magistrate (SDM).',
      'No advocate is strictly required; senior citizen can present their facts directly or seek assistance from a Conciliation Officer.',
      'Seek assistance from the National Elderline 14567 for free counseling and rescue assistance.'
    ],
    legalRemedy: 'Application for Maintenance and Revocation of Property Deeds before the Maintenance Tribunal (SDM Office).',
    emergencyHelpline: {
      name: 'Elderline National Senior Helpline',
      number: '14567',
      description: 'Ministry of Social Justice & Empowerment helpline for elder rescue, emotional support, and legal guidance',
      portalUrl: 'https://elderline.dosje.gov.in'
    },
    penaltiesForViolation: 'Failure to pay ordered maintenance without reasonable cause can result in arrest warrants and imprisonment up to 1 month for each month of default.',
    frequentlyAskedQuestions: [
      {
        question: 'Can daughters also be ordered to pay maintenance to elderly parents?',
        answer: 'Yes. The Act defines children to include both adult sons and adult daughters, biological or adopted.'
      }
    ],
    tags: ['senior citizens', 'parents', 'maintenance', 'gift deed revocation', 'elderline', '14567'],
    scenarioTag: 'senior-citizens',
    whatToSay: "Under Section 23 of the Maintenance and Welfare of Parents and Senior Citizens Act, 2007, any gift deed or property transfer executed in favor of children is deemed void if the transferee fails to provide basic amenities and physical care to the senior citizen.",
    whatToSay_hi: "माता-पिता एवं वरिष्ठ नागरिक भरण-पोषण अधिनियम 2007 की धारा 23 के तहत बच्चों को हस्तांतरित किया गया कोई भी गिफ्ट डीड शून्य माना जा सकता है यदि वे वरिष्ठ नागरिक की बुनियादी जरूरतों और देखभाल की उपेक्षा करते हैं।",
    dos: [
      "File an application before the Sub-Divisional Magistrate (SDM) Maintenance Tribunal.",
      "Dial National Senior Citizen Helpline 14567 (Elderline) for legal aid and social protection.",
      "Claim monthly maintenance allowance up to statutory limits under Section 4."
],
    donts: [
      "Do NOT execute absolute unconditional property transfer deeds without care contingency clauses.",
      "Do NOT vacate your own self-acquired home under pressure from relatives.",
      "Do NOT undergo complex civil court litigation when the summary SDM tribunal provides swift 90-day relief."
],
    dos_hi: [
      "एसडीएम (SDM) वरिष्ठ नागरिक भरण-पोषण ट्रिब्यूनल के समक्ष तत्काल अर्जी दाखिल करें।",
      "राष्ट्रीय वरिष्ठ नागरिक हेल्पलाइन 14567 (एल्डरलाइन) पर कानूनी सुरक्षा के लिए कॉल करें।",
      "धारा 4 के तहत प्रतिमाह भरण-पोषण भत्ते का दावा प्रस्तुत करें।"
],
    donts_hi: [
      "बिना देखभाल की शर्त के अपनी संपत्ति का पूर्ण विलेख बच्चों के नाम न करें।",
      "परिजनों के दबाव में आकर अपने स्वयं के घर को खाली न करें।",
      "लंबी दीवानी मुकदमों में उलझने के बजाय एसडीएम ट्रिब्यूनल से 90 दिन में त्वरित न्याय मांगें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Elderly Rights Advisory',
    isPopular: false,
    isPublished: true
  },

  // 14. Workplace & Employment
  {
    id: 'equal-work-maternity-rights',
    slug: 'equal-pay-and-maternity-benefits',
    title: 'Equal Remuneration & 26-Week Paid Maternity Protection',
    category: 'Workplace & Employment',
    icon: 'briefcase',
    summary: 'Guarantees equal wages for equal work without gender discrimination and secures 26 weeks of paid maternity leave with complete job security for working women.',
    statutoryBasis: {
      actName: 'Code on Wages, 2019 & Maternity Benefit (Amendment) Act, 2017',
      shortAct: 'Maternity Act & Wage Code',
      sections: ['Section 3 Code on Wages', 'Section 5 Maternity Benefit Act', 'Section 11 Creche Facility', 'Section 12 Dismissal Ban'],
      actUrl: '/laws/Labor',
      landmarkCases: [
        'Municipal Corporation of Delhi vs. Female Workers (Supreme Court) - Maternity benefits apply equally to daily wage and contractual women workers',
        'Dr. Kavita Yadav vs. Secretary, Ministry of Health (Supreme Court 2023) - Maternity benefits extend beyond contractual expiration'
      ]
    },
    keyProtections: [
      'Equal Remuneration: Absolute prohibition of wage discrimination based on sex for the same work or work of similar nature.',
      '26 Weeks Paid Leave: 26 weeks (182 calendar days) of fully paid maternity leave for women employees in any establishment with 10 or more workers.',
      'Protection from Dismissal: Employers cannot lawfully dismiss or serve termination notices during maternity leave absence.',
      'Mandatory Creche Facility: Every establishment employing 50 or more employees must provide a creche facility within 500 meters with 4 daily visits allowed.',
      'Work from Home Option: Mutual agreement for remote work after 26 weeks where the nature of work permits.'
    ],
    actionableSteps: [
      'Submit written maternity notice to the employer at least 7 weeks prior to expected delivery date.',
      'If denied statutory maternity benefits, preserve pay slips, employment contract, and written email exchanges.',
      'Lodge a formal complaint with the State Labor Commissioner or Chief Inspector of Factories.',
      'File an application for recovery of maternity wages before the statutory Competent Authority.'
    ],
    legalRemedy: 'Complaint before the Labor Commissioner / Inspector under Section 17 of the Maternity Benefit Act.',
    emergencyHelpline: {
      name: 'Ministry of Labour Helpline',
      number: '14434',
      description: 'National helpline for workers grievance registration and social security claims',
      portalUrl: 'https://labour.gov.in'
    },
    penaltiesForViolation: 'Employers refusing maternity benefits face mandatory imprisonment from 3 months to 1 year and fines up to ₹50,000.',
    frequentlyAskedQuestions: [
      {
        question: 'Does the 26-week paid maternity benefit apply to contractual or temporary women employees?',
        answer: 'Yes. The Supreme Court has affirmed that maternity benefits apply equally to regular, daily wage, probationer, and contractual women workers.'
      }
    ],
    tags: ['maternity leave', 'equal pay', 'labour law', 'creche', 'women workers', 'wages'],
    scenarioTag: 'maternity-rights',
    whatToSay: "Under Section 5 and Section 12 of the Maternity Benefit Act, 1961, it is strictly unlawful for an employer to dismiss or terminate any woman employee on grounds of pregnancy, or deprive her of 26 weeks paid statutory maternity leave.",
    whatToSay_hi: "मातृत्व लाभ अधिनियम 1961 की धारा 5 और 12 के तहत किसी भी नियोक्ता के लिए गर्भवती महिला कर्मचारी को नौकरी से निकालना या 26 सप्ताह के सवैतनिक मातृत्व अवकाश से वंचित करना गैर-कानूनी है।",
    dos: [
      "Submit written pregnancy notice to HR along with expected confinement medical certificate.",
      "Claim statutory paid leave of 26 weeks for up to two surviving children.",
      "Report any unlawful termination or wage deduction to the jurisdictional Labour Commissioner."
],
    donts: [
      "Do NOT resign voluntarily under managerial duress or negative performance appraisal during pregnancy.",
      "Do NOT accept arbitrary deduction of annual appraisal ratings or variable pay due to statutory maternity leave.",
      "Do NOT undertake arduous physical work or night shifts in late pregnancy (prohibited under Section 4)."
],
    dos_hi: [
      "चिकित्सा प्रमाण पत्र के साथ एचआर (HR) को सवैतनिक मातृत्व अवकाश का लिखित नोटिस दें।",
      "प्रथम दो बच्चों के लिए पूर्ण 26 सप्ताह के सवैतनिक अवकाश का लाभ लें।",
      "अवैध निष्कासन की स्थिति में स्थानीय श्रम आयुक्त (Labour Commissioner) को शिकायत भेजें।"
],
    donts_hi: [
      "गर्भावस्था के दौरान कंपनी के दबाव में आकर स्वयं इस्तीफा न दें।",
      "मातृत्व अवकाश के आधार पर वार्षिक रेटिंग या इंसेंटिव में कटौती को स्वीकार न करें।",
      "गर्भावस्था के अंतिम चरणों में कठिन शारीरिक कार्य या रात्रि पाली न करें (धारा 4 द्वारा वर्जित)।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Labor & Employment Division',
    isPopular: false,
    isPublished: true
  },

  // 15. Right to Information (RTI)
  {
    id: 'right-to-information-transparency',
    slug: 'citizen-transparency-rti-act',
    title: 'Right to Information & Public Accountability (RTI Act)',
    category: 'Transparency & Governance',
    icon: 'info',
    summary: 'Empowers any citizen to inspect public records, examine infrastructure works, and secure certified copies of government files within strict statutory timelines.',
    statutoryBasis: {
      actName: 'Right to Information Act, 2005',
      shortAct: 'RTI Act 2005',
      sections: ['Section 6', 'Section 7', 'Section 19', 'Section 20'],
      actUrl: '/laws/RTI',
      landmarkCases: [
        'Central Board of Secondary Education vs. Aditya Bandopadhyay - Scope of public authority disclosure',
        'Supreme Court in Reserve Bank of India vs. Jayantilal Mistry - Transparency over banking inspection reports'
      ]
    },
    keyProtections: [
      'Broad Information Access: Statutory right to request information, inspect works, documents, records, and obtain certified samples from any public authority.',
      'Strict 30-Day Timeline: Public Information Officer (PIO) must provide requested information within 30 days of application receipt.',
      '48-Hour Emergency Window: If the information concerns life or liberty of a citizen, it must be provided within 48 hours.',
      'Nominal Fee: Central government applications cost just ₹10; citizens below poverty line (BPL) are exempt from all fees.',
      'No Reason Required: Citizen is not required to explain why they seek the information.'
    ],
    actionableSteps: [
      'Draft concise, specific questions addressed to the Central/State Public Information Officer (CPIO/SPIO).',
      'File the application online via the rtionline.gov.in portal or submit physically with a ₹10 postal order.',
      'If no response is received in 30 days, file a First Appeal to the designated First Appellate Authority within 30 days.',
      'If unsatisfied with First Appeal order, file a Second Appeal before the Central/State Information Commission.'
    ],
    legalRemedy: 'First Appeal under Section 19(1) and Second Appeal before the Central/State Information Commission under Section 19(3).',
    emergencyHelpline: {
      name: 'RTI Online Support Helpline',
      number: '011-24622690',
      description: 'Department of Personnel and Training (DoPT) RTI portal assistance',
      portalUrl: 'https://rtionline.gov.in'
    },
    penaltiesForViolation: 'The Information Commission can levy a mandatory penalty of ₹250 per day up to ₹25,000 on the PIO for unreasonable delays or false refusals.',
    frequentlyAskedQuestions: [
      {
        question: 'Do I have to state why I am requesting the information in my RTI application?',
        answer: 'No. Section 6(2) explicitly states that an applicant is not required to give any reason for requesting the information or any other personal details except those necessary for contacting them.'
      }
    ],
    tags: ['rti', 'transparency', 'information commission', 'cpio', 'governance'],
    scenarioTag: 'rti-governance',
    whatToSay: "Under Section 6(1) of the Right to Information Act, 2005, as a citizen of India, I am entitled to receive the requested official documents within 30 days. Under Section 7(1), information concerning life or liberty must be provided within 48 hours.",
    whatToSay_hi: "सूचना का अधिकार अधिनियम 2005 की धारा 6(1) के तहत एक भारतीय नागरिक के रूप में मुझे 30 दिनों में वांछित जानकारी प्राप्त करने का अधिकार है। धारा 7(1) के तहत जीवन और स्वतंत्रता से संबंधित सूचना 48 घंटों में देना अनिवार्य है।",
    dos: [
      "Address the RTI application to the Central/State Public Information Officer (CPIO/SPIO).",
      "Affix prescribed fee of ₹10 (or attach BPL card copy for full exemption).",
      "File First Appeal under Section 19(1) if information is denied or not furnished within 30 days."
],
    donts: [
      "Do NOT state reasons for asking for the information (explicitly barred under Section 6(2)).",
      "Do NOT ask questions requiring speculative opinions or interrogations; ask for certified records and files.",
      "Do NOT miss the 30-day limitation window for filing First and Second Appeals."
],
    dos_hi: [
      "संबंधित जन सूचना अधिकारी (PIO) को स्पष्ट और बिंदुवार आरटीआई आवेदन भेजें।",
      "निर्धारित 10 रुपये का शुल्क संलग्न करें (बीपीएल कार्डधारकों के लिए पूर्णतः निःशुल्क)।",
      "30 दिनों में सूचना न मिलने पर धारा 19(1) के तहत प्रथम अपीलीय अधिकारी को अपील करें।"
],
    donts_hi: [
      "सूचना मांगने का कारण बताने की कोई आवश्यकता नहीं है (धारा 6(2) द्वारा स्पष्ट छूट)।",
      "अधिकारियों से राय या सलाह न मांगें; केवल सरकारी फाइलों व आदेशों की प्रमाणित प्रतियां मांगें।",
      "अपील दायर करने के लिए निर्धारित 30 दिनों की समय-सीमा न चूकें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Administrative Law Directorate',
    isPopular: false,
    isPublished: true
  },

  // 16. Persons with Disabilities (RPwD)
  {
    id: 'rights-persons-with-disabilities',
    slug: 'disability-rights-accessibility-rpwd',
    title: 'Equal Opportunities & Accessibility Rights (RPwD Act)',
    category: 'Disability & Accessibility',
    icon: 'accessibility',
    summary: 'Statutory guarantees ensuring non-discrimination, 4% job reservation, accessible public infrastructure, and legal capacity for persons with disabilities.',
    statutoryBasis: {
      actName: 'Rights of Persons with Disabilities Act, 2016',
      shortAct: 'RPwD Act 2016',
      sections: ['Section 3', 'Section 20', 'Section 34', 'Section 40', 'Section 42'],
      actUrl: '/laws/RPwD',
      landmarkCases: [
        'Vikash Kumar vs. UPSC (Supreme Court 2021) - Principle of reasonable accommodation as a core component of equality',
        'Rajive Raturi vs. Union of India - Supreme Court directives on accessibility of public spaces and transport'
      ]
    },
    keyProtections: [
      'Principle of Reasonable Accommodation: Employers and institutions must provide necessary modifications to enable full participation.',
      'Prohibition of Discrimination: No person with disability can be denied employment, promotion, or education on grounds of disability.',
      '4% Government Job Reservation: Mandatory minimum 4% reservation in government posts for benchmark disabilities.',
      'Mandatory Accessibility: Public buildings, transport facilities, websites, and consumer services must comply with harmonized accessibility guidelines.',
      'Right to Legal Capacity: Persons with disabilities enjoy legal capacity on an equal basis with others in financial and property matters.'
    ],
    actionableSteps: [
      'Obtain Unique Disability ID (UDID) certificate through the Swavlamban portal (swavlamban.gov.in).',
      'Submit written request for reasonable accommodation to employer or educational institution.',
      'If faced with discrimination or inaccessible public facilities, file a complaint before the State Commissioner for Persons with Disabilities.',
      'Contact Disability Rights Helpline 1800-11-4515 for free advocacy support.'
    ],
    legalRemedy: 'Complaint before the Chief Commissioner or State Commissioner for Persons with Disabilities under Section 75 / 80; writ petition in High Court.',
    emergencyHelpline: {
      name: 'Disability Rights & Swavlamban Desk',
      number: '1800-11-4515',
      description: 'Helpline for persons with disabilities facing accessibility denial or discrimination',
      portalUrl: 'https://swavlamban.gov.in'
    },
    penaltiesForViolation: 'Offenses against persons with disabilities attract imprisonment up to 5 years and fines under Section 92 of RPwD Act.',
    frequentlyAskedQuestions: [
      {
        question: 'Can an employer demote or fire an employee who acquires a disability during service?',
        answer: 'No. Section 20(4) explicitly forbids terminating or demoting an employee who acquires a disability during employment. They must be shifted to a suitable post with equal pay and benefits.'
      }
    ],
    tags: ['disability', 'rpwd', 'accessibility', 'udid', 'reasonable accommodation', 'wheelchair'],
    scenarioTag: 'disability-rights',
    whatToSay: "Under Section 3 and Section 40 of the Rights of Persons with Disabilities Act, 2016, denial of reasonable accommodation, public accessibility, or discrimination in employment constitutes a punishable statutory offense.",
    whatToSay_hi: "दिव्यांगजन अधिकार अधिनियम 2016 की धारा 3 और 40 के तहत उचित सुविधा (Reasonable Accommodation) देने से मना करना, सार्वजनिक स्थलों पर बाधा रहित पहुंच न देना या रोजगार में भेदभाव करना दंडनीय अपराध है।",
    dos: [
      "Demand universal accessible infrastructure including ramps, tactile paths, and accessible restrooms.",
      "Report discrimination to the State/Chief Commissioner for Persons with Disabilities under Section 75.",
      "Utilize Unique Disability ID (UDID) card for statutory concessions and reservations."
],
    donts: [
      "Do NOT tolerate denial of entry to public venues, transport, or educational institutions.",
      "Do NOT accept denial of promotion or employment solely on grounds of physical or sensory impairment.",
      "Do NOT allow public establishments to operate without mandatory accessibility compliance."
],
    dos_hi: [
      "सार्वजनिक भवनों और परिवहन में रैंप, लिफ्ट और स्पर्शनीय मार्गों (Tactile Paths) की मांग करें।",
      "भेदभाव होने पर दिव्यांगजन राज्य आयुक्त (State Commissioner) के समक्ष शिकायत दर्ज करें।",
      "सरकारी आरक्षण और सुविधाओं के लिए यूडीआईडी (UDID) कार्ड का उपयोग करें।"
],
    donts_hi: [
      "सार्वजनिक स्थलों, बसों, ट्रेनों या स्कूलों में प्रवेश रोके जाने को सहन न करें।",
      "दिव्यांगता के आधार पर पदोन्नति या वेतन वृद्धि रोके जाने को कतई स्वीकार न करें।",
      "सरकारी व निजी संस्थानों को बिना सुगम्यता मानकों के संचालित न होने दें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Accessibility & Human Rights Directorate',
    isPopular: false,
    isPublished: true
  },

  // 17. Child Protection & POCSO
  {
    id: 'child-protection-safeguards-pocso',
    slug: 'child-protection-pocso-juvenile-justice',
    title: 'Child Safeguards & Abuse Protection (POCSO & JJ Act)',
    category: 'Child & Minor Protection',
    icon: 'shield',
    summary: 'Stringent statutory safeguards shielding minors from sexual offenses, cruelty, and child labor, with child-friendly court procedures and mandatory reporting.',
    statutoryBasis: {
      actName: 'POCSO Act, 2012 & Juvenile Justice (Care and Protection of Children) Act, 2015',
      shortAct: 'POCSO & JJ Act',
      sections: ['Section 19 POCSO', 'Section 24 POCSO', 'Section 33 POCSO', 'Section 75 JJ Act'],
      actUrl: '/laws/POCSO',
      landmarkCases: [
        'Supreme Court in Alakh Alok Srivastava vs. Union of India - Strict time-bound trial in POCSO cases',
        'Independent Thought vs. Union of India (2017) - Criminalization of sexual intercourse with minor wife'
      ]
    },
    keyProtections: [
      'Mandatory Reporting Duty: Any person or institution having knowledge of child abuse is statutorily bound to report it to Special Juvenile Police Unit or Childline 1098.',
      'Child-Friendly Police Procedures: Recording statements at the child’s residence without police officers in uniform; no child detained in police lockup overnight.',
      'In-Camera Trial & Identity Shield: Identity, school, or photographs of the child victim can never be published in media.',
      'Interim Compensation: Mandatory fast-track interim relief awarded by Special Court for rehabilitation and medical care.',
      'Support Person: Child has the right to a qualified psychologist, legal aid counsel, and support person throughout the proceedings.'
    ],
    actionableSteps: [
      'Call Childline 1098 immediately or visit the nearest police station to report any incident.',
      'Demand recording of the statement by a female police officer at the child’s residence under POCSO Section 24.',
      'Approach the Child Welfare Committee (CWC) for care, counseling, and protective shelter orders.',
      'Apply to the Special Court for immediate interim monetary compensation.'
    ],
    legalRemedy: 'Cognizance before the Special POCSO Court; Child Welfare Committee (CWC) orders under Juvenile Justice Act.',
    emergencyHelpline: {
      name: 'National Childline Emergency',
      number: '1098',
      description: '24x7 toll-free emergency response for children in distress, abuse, or exploitation',
      portalUrl: 'https://childlineindia.org'
    },
    penaltiesForViolation: 'Severe imprisonment from 20 years to life imprisonment or capital punishment for aggravated offenses; failure to report attracts up to 6 months imprisonment.',
    frequentlyAskedQuestions: [
      {
        question: 'What happens if a school administrator tries to hush up an abuse incident to protect the school’s reputation?',
        answer: 'Section 21 of POCSO mandates that any person in charge of an institution who fails to report abuse faces mandatory criminal prosecution and imprisonment up to 1 year and fines.'
      }
    ],
    tags: ['pocso', 'childline 1098', 'juvenile justice', 'child protection', 'cwc'],
    scenarioTag: 'child-protection',
    whatToSay: "Under Section 19 of the POCSO Act, 2012 and Section 75 of the Juvenile Justice Act, reporting child abuse or distress is a mandatory legal obligation. The identity of the child victim must remain strictly confidential under Section 23.",
    whatToSay_hi: "पॉक्सो अधिनियम 2012 की धारा 19 और किशोर न्याय अधिनियम की धारा 75 के तहत बाल शोषण की सूचना देना अनिवार्य कानूनी दायित्व है। धारा 23 के तहत पीड़ित बच्चे की पहचान पूर्णतः गोपनीय रखना बाध्यकारी है।",
    dos: [
      "Immediately dial Childline 1098 or 112 to report any child in physical or emotional distress.",
      "Ensure the victim child is produced before the local Child Welfare Committee (CWC).",
      "Insist on recording child statements in child-friendly environment without police uniforms."
],
    donts: [
      "Do NOT reveal or publish the child victim's name, school, photograph, or address on any platform.",
      "Do NOT subject the child to repetitive cross-examination or hostile questioning.",
      "Do NOT fail to report suspected child abuse (failure to report is punishable under POCSO Section 21)."
],
    dos_hi: [
      "संकट में घिरे बच्चे की सुरक्षा के लिए तुरंत चाइल्डलाइन 1098 या 112 पर कॉल करें।",
      "बच्चे को तत्काल स्थानीय बाल कल्याण समिति (CWC) के समक्ष प्रस्तुत कराएं।",
      "बच्चे का बयान सादे कपड़ों में महिला पुलिस अधिकारी द्वारा बाल-सुलभ वातावरण में दर्ज कराएं।"
],
    donts_hi: [
      "पीड़ित बच्चे का नाम, फोटो, स्कूल या पता किसी भी स्थिति में सार्वजनिक न करें।",
      "बच्चे से डरावने या अपमानजनक सवाल न पूछें।",
      "बाल उत्पीड़न की जानकारी छिपाएं नहीं (सूचना न देना धारा 21 के तहत स्वयं दंडनीय अपराध है)।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Child Safeguards Directorate',
    isPopular: false,
    isPublished: true
  },

  // 18. Mental Healthcare
  {
    id: 'mental-healthcare-patient-rights',
    slug: 'mental-health-care-patient-autonomy-rights',
    title: 'Mental Health Patient Autonomy & Advance Directives',
    category: 'Health & Patient Rights',
    icon: 'heart',
    summary: 'Guarantees the dignity, confidentiality, and autonomy of persons with mental illness, decriminalizes suicide attempts, and introduces binding Advance Directives.',
    statutoryBasis: {
      actName: 'Mental Healthcare Act, 2017',
      shortAct: 'MHCA 2017',
      sections: ['Section 5', 'Section 18', 'Section 21', 'Section 95', 'Section 115'],
      actUrl: '/laws/MHCA',
      landmarkCases: [
        'Supreme Court in Navtej Singh Johar vs. UOI - Individual autonomy and mental health dignity',
        'Indian Psychiatric Society Guidelines on Advance Directives'
      ]
    },
    keyProtections: [
      'Right to Advance Directive: Every adult has the statutory right to specify in advance how they wish to be treated for mental illness and nominate a representative.',
      'Decriminalization of Suicide Attempts: Section 115 presumes severe stress and explicitly prohibits criminal prosecution of suicide attempts.',
      'Ban on Inhumane Treatments: Total prohibition of electroconvulsive therapy (ECT) without muscle relaxants and anesthesia, and ban on solitary confinement.',
      'Equal Health Insurance: Insurance companies must provide medical insurance for treatment of mental illness on the same basis as physical illness.',
      'Absolute Right to Confidentiality: Mental health status cannot be disclosed to third parties without express informed consent.'
    ],
    actionableSteps: [
      'Draft and register an Advance Directive in the prescribed form with your nominated representative.',
      'If an insurance company rejects claims for mental health treatment, cite Section 21(4) MHCA and approach the Insurance Ombudsman.',
      'Call Tele-MANAS 14416 for 24x7 free mental health counseling and crisis intervention.',
      'Lodge a complaint before the State Mental Health Review Board for violations of patient rights.'
    ],
    legalRemedy: 'Complaint before the Mental Health Review Board; appeal before the High Court; complaint to Insurance Ombudsman.',
    emergencyHelpline: {
      name: 'Tele-MANAS National Mental Health Helpline',
      number: '14416',
      description: '24x7 free, comprehensive tele-mental health counseling service across 20+ regional languages',
      portalUrl: 'https://telemanas.mohfw.gov.in'
    },
    penaltiesForViolation: 'Violations of patient rights or unlawful treatments attract imprisonment up to 6 months and fines up to ₹5 Lakh under MHCA Section 108.',
    frequentlyAskedQuestions: [
      {
        question: 'Can insurance companies deny cashless treatment for psychiatric hospitalizations?',
        answer: 'No. Section 21(4) of MHCA mandates that insurers treat mental illness on equal footing with physical illness. Blanket exclusions of psychiatric care are illegal.'
      }
    ],
    tags: ['mental health', 'tele-manas', 'advance directive', 'suicide decriminalization', 'mhca 2017'],
    scenarioTag: 'mental-health',
    whatToSay: "Under Section 5 and Section 20 of the Mental Healthcare Act, 2017, every patient has the right to nominate a representative and issue an Advance Directive. Direct administration of ECT without anesthesia or sterilization is strictly prohibited by law.",
    whatToSay_hi: "मानसिक स्वास्थ्य देखभाल अधिनियम 2017 की धारा 5 और 20 के तहत रोगी को अग्रिम निर्देश (Advance Directive) देने का अधिकार है। बिना एनेस्थीसिया के ईसीटी (ECT) देना या जबरन बंधक बनाना कानूनन पूरी तरह प्रतिबंधित है।",
    dos: [
      "Execute a legally valid Advance Directive specifying treatment preferences under Section 5.",
      "Nominate a trusted Nominated Representative under Section 14 to make decisions during acute distress.",
      "Report abusive custodial confinement in psychiatric facilities to Mental Health Review Board (MHRB)."
],
    donts: [
      "Do NOT permit physical chaining, isolation, or inhuman custodial detention.",
      "Do NOT permit surgical sterilization or ECT without muscle relaxants and anesthesia (strictly illegal).",
      "Do NOT disclose psychiatric records to employers or third parties without explicit consent."
],
    dos_hi: [
      "भविष्य के उपचार संबंधी प्राथमिकताओं को स्पष्ट करते हुए अग्रिम निर्देश (Advance Directive) दर्ज करें।",
      "कठिन समय में कानूनी निर्णय लेने के लिए धारा 14 के तहत अपना अधिकृत प्रतिनिधि नामांकित करें।",
      "मानसिक स्वास्थ्य समीक्षा बोर्ड (MHRB) के पास अवैध हिरासत व प्रताड़ना की शिकायत दर्ज करें।"
],
    donts_hi: [
      "रोगी को जंजीरों से बांधने, एकांत कारावास में रखने या अमानवीय व्यवहार की अनुमति न दें।",
      "बिना एनेस्थीसिया के बिजली के झटके (ECT) देने की अनुमति न दें (यह कानूनन अपराध है)।",
      "रोगी की सहमति के बिना उसकी मेडिकल रिपोर्ट नियोक्ता या किसी तीसरे व्यक्ति को न सौंपें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Healthcare Law Council',
    isPopular: false,
    isPublished: true
  },

  // 19. Street Vendors
  {
    id: 'street-vendors-livelihood-protection',
    slug: 'street-vendors-protection-of-livelihood',
    title: 'Street Vendors & Hawking Livelihood Rights',
    category: 'Workplace & Employment',
    icon: 'briefcase',
    summary: 'Protects street vendors and informal traders from arbitrary harassment and unlawful confiscation, guaranteeing town vending surveys and 30-day eviction notices.',
    statutoryBasis: {
      actName: 'Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014',
      shortAct: 'Street Vendors Act 2014',
      sections: ['Section 3', 'Section 12', 'Section 18', 'Section 20'],
      actUrl: '/laws/StreetVendors',
      landmarkCases: [
        'Maharashtra Ekta Hawkers Union vs. Municipal Corporation of Greater Mumbai (Supreme Court)',
        'Delhi High Court in Hawkers Joint Action Committee - Immunity until survey completion'
      ]
    },
    keyProtections: [
      'Survey Protection: No street vendor shall be evicted until the Town Vending Committee (TVC) completes a comprehensive city vending survey.',
      'Vending Certificate: Every surveyed vendor has the statutory right to receive an official Vending Certificate and identity card.',
      '30-Day Relocation Notice: No vendor can be relocated without a minimum 30 days prior written notice specifying the alternate vending zone.',
      'Confiscation Safeguards: Seized vending goods must be recorded on a formal seizure list, and perishable items must be returned within 24 hours upon nominal fee.',
      '40% Vendor Representation: Town Vending Committees must have at least 40% representation elected from registered street vendors.'
    ],
    actionableSteps: [
      'Ensure enrollment in the Town Vending Committee (TVC) survey and obtain your Vending Certificate.',
      'Display your vendor ID card and receipt of municipal vending fees at your vending stall.',
      'If faced with arbitrary eviction without notice, cite Supreme Court rulings and Section 3(3) of the Act.',
      'File a grievance before the statutory Dispute Redressal Committee headed by a retired civil judge.'
    ],
    legalRemedy: 'Grievance before the Street Vendors Dispute Redressal Committee under Section 20; writ petition in High Court.',
    emergencyHelpline: {
      name: 'PM SVANidhi & Vendor Support Desk',
      number: '1800-11-1979',
      description: 'Ministry of Housing & Urban Affairs street vendor welfare and grievance desk',
      portalUrl: 'https://pmsvanidhi.mohua.gov.in'
    },
    penaltiesForViolation: 'Municipal officials conducting unauthorized evictions without TVC approval face contempt of court and disciplinary proceedings.',
    frequentlyAskedQuestions: [
      {
        question: 'Can municipal authorities seize a vendor’s cart without giving a receipt?',
        answer: 'No. Section 19 mandates that municipal officials must issue a signed inventory receipt detailing all seized goods immediately.'
      }
    ],
    tags: ['street vendors', 'hawkers', 'pmsvanidhi', 'tvc', 'livelihood'],
    scenarioTag: 'street-vendors',
    whatToSay: "Under Section 3(3) of the Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014, no street vendor shall be evicted until the mandatory municipal survey is conducted and a Vending Certificate is issued by the Town Vending Committee (TVC).",
    whatToSay_hi: "स्ट्रीट वेंडर्स (आजीविका संरक्षण) अधिनियम 2014 की धारा 3(3) के अनुसार, जब तक टाउन वेंडिंग कमेटी (TVC) द्वारा सर्वेक्षण पूरा नहीं होता और प्रमाण पत्र नहीं मिलता, तब तक किसी भी विक्रेता को हटाया नहीं जा सकता।",
    dos: [
      "Keep certified copy of Town Vending Committee (TVC) survey slip or Vending Certificate displayed.",
      "Pay prescribed municipal vending fees and retain official payment receipts.",
      "Approach the statutory Grievance Redressal Committee under Section 20 if evicted unlawfully."
],
    donts: [
      "Do NOT allow seizure of vending carts or goods without an official written inventory receipt.",
      "Do NOT submit to extortion or unauthorized collections by municipal staff or police.",
      "Do NOT set up stalls in strictly marked non-vending arterial transit lanes."
],
    dos_hi: [
      "टाउन वेंडिंग कमेटी (TVC) की सर्वेक्षण रसीद या वेंडिंग प्रमाण पत्र अपने पास रखें।",
      "नगर पालिका के आधिकारिक शुल्क का भुगतान कर उसकी रसीद सुरक्षित रखें।",
      "अवैध निष्कासन होने पर धारा 20 के तहत शिकायत निवारण समिति के समक्ष गुहार लगाएं।"
],
    donts_hi: [
      "बिना जब्ती रसीद (Inventory List) दिए नगर निगम कर्मचारियों को अपना सामान या ठेला न ले जाने दें।",
      "पुलिस या नगर पालिका कर्मचारियों द्वारा अवैध वसूली का विरोध करें।",
      "घोषित नो-वेंडिंग जोन या व्यस्त चौराहों पर अनधिकृत ठेला न लगाएं।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Informal Labor Rights Desk',
    isPopular: false,
    isPublished: true
  },

  // 20. Right to Education (RTE)
  {
    id: 'right-to-education-rte-act',
    slug: 'free-compulsory-education-rte-act',
    title: 'Free & Compulsory Education Rights (RTE Act & Art 21A)',
    category: 'Constitutional & Civil Liberties',
    icon: 'book-open',
    summary: 'Constitutional guarantee under Article 21A securing free and compulsory education for children aged 6 to 14, with a mandatory 25% quota in private unaided schools.',
    statutoryBasis: {
      actName: 'Right of Children to Free and Compulsory Education Act, 2009',
      shortAct: 'RTE Act 2009',
      sections: ['Article 21A Constitution', 'Section 3 RTE', 'Section 12(1)(c)', 'Section 16', 'Section 17'],
      actUrl: '/laws/RTE',
      landmarkCases: [
        'Society for Unaided Private Schools of Rajasthan vs. Union of India (Supreme Court 2012) - Constitutional validity of 25% quota upheld',
        'Pramati Educational & Cultural Trust vs. UOI - Application of RTE'
      ]
    },
    keyProtections: [
      '25% Private School Quota: Private unaided schools must reserve at least 25% of entry-level seats for children from economically weaker sections (EWS) and disadvantaged groups.',
      'Zero Fees for 6-14 Years: Free tuition, textbooks, uniforms, and mid-day meals in government and aided schools without hidden fees.',
      'No Capitation Fee: Stringent prohibition against schools demanding screening tests, parent interviews, or capitation donations.',
      'Absolute Ban on Corporal Punishment: Physical punishment and mental harassment of children in schools are criminalized under Section 17.',
      'No Expulsion Policy: Children cannot be expelled or held back until the completion of elementary education (Class 8).'
    ],
    actionableSteps: [
      'Apply online for EWS/Disadvantaged quota admissions on your State RTE portal during the announced lottery schedule.',
      'If a school demands donation or screening interviews, report the violation to the State Commission for Protection of Child Rights (SCPCR).',
      'Preserve income certificates, birth certificates, and residence proofs for validation.',
      'Lodge a formal complaint with the District Education Officer (DEO).'
    ],
    legalRemedy: 'Complaint before the State Commission for Protection of Child Rights (SCPCR) / NCPCR; writ petition under Article 226 in High Court.',
    emergencyHelpline: {
      name: 'NCPCR RTE Public Grievance Helpline',
      number: '1800-121-2830',
      description: 'National Commission for Protection of Child Rights education grievance hotline',
      portalUrl: 'https://ncpcr.gov.in'
    },
    penaltiesForViolation: 'Schools charging capitation fees face fines up to 10 times the amount charged; conducting screening tests attracts fines up to ₹50,000.',
    frequentlyAskedQuestions: [
      {
        question: 'Can a private school deny admission under the RTE 25% quota citing lack of birth certificate?',
        answer: 'No. Section 14 explicitly provides that lack of birth certificate cannot be a ground for denying school admission; a parent affidavit is legally sufficient.'
      }
    ],
    tags: ['rte', 'education', 'article 21a', '25% quota', 'ews admission', 'school'],
    scenarioTag: 'education-rights',
    whatToSay: "Under Article 21A of the Constitution and Section 3 of the Right of Children to Free and Compulsory Education (RTE) Act, 2009, my child has a fundamental right to free education. Section 12(1)(c) mandates 25% admission for disadvantaged groups.",
    whatToSay_hi: "संविधान के अनुच्छेद 21A और आरटीई (RTE) अधिनियम 2009 की धारा 3 के तहत मेरे बच्चे को निःशुल्क शिक्षा का मौलिक अधिकार है। धारा 12(1)(c) के तहत निजी स्कूलों में 25% सीटें वंचित वर्ग के लिए आरक्षित हैं।",
    dos: [
      "Apply under Section 12(1)(c) for 25% free seats in private unaided neighborhood schools.",
      "Ensure birth certificate or self-declaration affidavit is accepted for admission without delay.",
      "Report illegal screening procedures or capitation fee demands to National Commission for Protection of Child Rights (NCPCR)."
],
    donts: [
      "Do NOT pay any capitation fee or donation for elementary school admission (prohibited under Section 13).",
      "Do NOT subject children to admission interviews, screening tests, or parental tests.",
      "Do NOT permit physical punishment, corporal punishment, or mental harassment in schools (strictly barred under Section 17)."
],
    dos_hi: [
      "धारा 12(1)(c) के तहत निजी स्कूलों में 25% आरक्षित सीटों पर निःशुल्क प्रवेश का आवेदन करें।",
      "जन्म प्रमाण पत्र या स्व-घोषणा पत्र के आधार पर स्कूल में तुरंत दाखिला लें।",
      "डोनेशन मांगने वाले स्कूलों की शिकायत राष्ट्रीय बाल अधिकार संरक्षण आयोग (NCPCR) को करें।"
],
    donts_hi: [
      "प्रवेश के लिए कोई भी डोनेशन या कैपिटेशन फीस न दें (धारा 13 द्वारा पूरी तरह वर्जित)।",
      "बच्चे या माता-पिता का कोई भी साक्षात्कार या स्क्रीनिंग टेस्ट न होने दें।",
      "स्कूलों में शारीरिक दंड या मानसिक प्रताड़ना को बर्दाश्त न करें (धारा 17 द्वारा दंडनीय)।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Constitutional & Education Council',
    isPopular: false,
    isPublished: true
  },

  // 21. Transgender Persons Rights
  {
    id: 'transgender-persons-protection-rights',
    slug: 'transgender-persons-equality-identity-rights',
    title: 'Self-Perceived Gender Identity & Equality (Transgender Act)',
    category: 'Constitutional & Civil Liberties',
    icon: 'scale',
    summary: 'Secures the fundamental right of transgender persons to self-perceived gender identity without medical procedures, guaranteeing non-discrimination across all spheres.',
    statutoryBasis: {
      actName: 'Transgender Persons (Protection of Rights) Act, 2019',
      shortAct: 'Transgender Act 2019',
      sections: ['Section 3', 'Section 4', 'Section 5', 'Section 6', 'Section 16'],
      actUrl: '/laws/Transgender',
      landmarkCases: [
        'National Legal Services Authority (NALSA) vs. Union of India (Supreme Court 2014) - Historic recognition of Third Gender and self-determination',
        'Navtej Singh Johar vs. UOI (2018) - Decriminalization of Section 377 IPC'
      ]
    },
    keyProtections: [
      'Right to Self-Identified Gender: Absolute statutory right to recognize one’s self-perceived gender identity without mandatory sex reassignment surgery (SRS).',
      'National Identity Card: Online application and issuance of Gender Certificate through the National Portal for Transgender Persons.',
      'Prohibition of Discrimination: Zero discrimination in education, employment, healthcare, housing, public amenities, and government schemes.',
      'Equal Employment Opportunity: Every establishment must formulate an Equal Opportunity Policy and designate a Complaint Officer.',
      'Right of Residence: No transgender person shall be separated from parents or family on grounds of being transgender.'
    ],
    actionableSteps: [
      'Apply online on the National Portal for Transgender Persons (transgender.dosje.gov.in) for identity card issuance.',
      'Submit written grievance to the Complaint Officer of the educational institution or employer.',
      'Lodge a formal discrimination complaint with the District Magistrate or State Human Rights Commission.',
      'Call the National Transgender Helpline at 011-24369835 for legal aid and counseling.'
    ],
    legalRemedy: 'Grievance before the District Magistrate / Complaint Officer; petition before the National/State Human Rights Commission; Article 226 High Court writ.',
    emergencyHelpline: {
      name: 'National Transgender Support Helpline',
      number: '011-24369835',
      description: 'Ministry of Social Justice & Empowerment helpline for identity certification and legal aid',
      portalUrl: 'https://transgender.dosje.gov.in'
    },
    penaltiesForViolation: 'Forcing transgender persons into bonded labor or inflicting physical/sexual harm is punishable by imprisonment from 6 months to 2 years and fines.',
    frequentlyAskedQuestions: [
      {
        question: 'Does obtaining a Transgender Certificate require undergoing medical surgery?',
        answer: 'No. Under Section 4 & 5, a person can obtain a certificate indicating gender as "Transgender" solely based on self-identification without any medical examination or surgery.'
      }
    ],
    tags: ['transgender', 'nalsa', 'gender identity', 'lgbtq', 'human rights'],
    scenarioTag: 'transgender-rights',
    whatToSay: "Under Section 4 and Section 9 of the Transgender Persons (Protection of Rights) Act, 2019, I have the statutory right to my self-perceived gender identity. Discrimination in employment, healthcare, or housing is a cognizable legal violation.",
    whatToSay_hi: "ट्रांसजेंडर व्यक्ति (अधिकारों का संरक्षण) अधिनियम 2019 की धारा 4 और 9 के तहत मुझे अपनी स्व-अनुभूत लैंगिक पहचान का वैधानिक अधिकार है। रोजगार, चिकित्सा या आवास में भेदभाव करना कानूनन अपराध है।",
    dos: [
      "Apply online on National Portal for Transgender Persons (transgender.dosje.gov.in) for District Certificate of Identity.",
      "Seek reasonable accommodation and gender-neutral restrooms in workplaces and universities.",
      "File police complaint under Section 18 for any verbal abuse, denial of access, or physical violence."
],
    donts: [
      "Do NOT submit to intrusive medical or physical examinations to prove gender identity.",
      "Do NOT accept denial of housing, tenancy, or hospital admission on grounds of gender diversity.",
      "Do NOT permit forced separation from family or community under unauthorized executive orders."
],
    dos_hi: [
      "राष्ट्रीय पोर्टल पर पहचान प्रमाण पत्र और ट्रांसजेंडर आईडी कार्ड के लिए आवेदन करें।",
      "कार्यस्थलों और कॉलेजों में जेंडर-न्यूट्रल शौचालय और गैर-भेदभावपूर्ण नीतियों की मांग करें।",
      "अपमानजनक भाषा या हिंसा होने पर धारा 18 के तहत पुलिस में प्राथमिकी (FIR) दर्ज कराएं।"
],
    donts_hi: [
      "पहचान साबित करने के लिए किसी भी अपमानजनक शारीरिक या मेडिकल जांच को स्वीकार न करें।",
      "किराये पर मकान या अस्पताल में इलाज देने से इनकार को कतई सहन न करें।",
      "परिवार या समुदाय से जबरन अलग किए जाने के प्रशासनिक आदेशों का विरोध करें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Civil Liberties Directorate',
    isPopular: false,
    isPublished: true
  },

  // 22. Environmental Rights
  {
    id: 'environmental-right-clean-air-water',
    slug: 'environmental-protection-ngt-clean-air-water',
    title: 'Right to Clean Environment, Air & Water (NGT Act & Art 21)',
    category: 'Environmental & Public Health',
    icon: 'globe',
    summary: 'Recognizes the right to pollution-free air and water as an integral facet of Article 21, empowering citizens to approach the National Green Tribunal directly.',
    statutoryBasis: {
      actName: 'National Green Tribunal Act, 2010 & Environment (Protection) Act, 1986',
      shortAct: 'NGT Act 2010',
      sections: ['Article 21 Constitution', 'Section 14 NGT', 'Section 15 NGT', 'Section 19 NGT'],
      actUrl: '/laws/Environment',
      landmarkCases: [
        'M.C. Mehta vs. Union of India (Oleum Gas Leak & Ganga Pollution) - Polluter Pays Principle and Absolute Liability',
        'Vellore Citizens Welfare Forum vs. UOI - Precautionary principle incorporated into Indian law'
      ]
    },
    keyProtections: [
      'Fundamental Right to Clean Air & Water: Pollution-free environment is an unalienable fundamental right under Article 21.',
      'Direct Citizen Petitions: Any affected citizen or NGO can file an application directly before the National Green Tribunal (NGT) without proving personal injury.',
      'Polluter Pays Principle: Industries causing environmental degradation are strictly liable for the entire financial cost of environmental remediation.',
      'Compensation for Victims: NGT has statutory authority to award immediate compensation to victims of chemical contamination, hazardous waste, or pollution.',
      'Public Trust Doctrine: The State holds natural water bodies, forests, and air as a public trustee for the benefit of all citizens.'
    ],
    actionableSteps: [
      'Collect documentary, photographic, or air quality index (AQI) evidence of industrial pollution, tree felling, or unauthorized waste dumping.',
      'File a complaint with the State Pollution Control Board (SPCB) or Central Pollution Control Board (CPCB).',
      'File an Original Application before the National Green Tribunal (NGT) on the e-filing portal (ngt.gov.in).',
      'Contact LegalConnect Environmental Desk or DLSA for pro-bono environmental litigation support.'
    ],
    legalRemedy: 'Original Application under Section 14/15 before the National Green Tribunal; writ petition in High Court under Article 226.',
    emergencyHelpline: {
      name: 'CPCB Environmental Pollution Desk',
      number: '011-43102430',
      description: 'Central Pollution Control Board industrial pollution monitoring desk',
      portalUrl: 'https://cpcb.nic.in'
    },
    penaltiesForViolation: 'Failure to comply with NGT orders attracts imprisonment up to 3 years or fines up to ₹10 Crore for individuals and ₹25 Crore for corporate polluters.',
    frequentlyAskedQuestions: [
      {
        question: 'Do I need to be personally injured or own land near a polluting factory to file an NGT petition?',
        answer: 'No. The NGT Act recognizes broad locus standi. Any citizen concerned with a substantial question relating to the environment can file a petition before the Tribunal.'
      }
    ],
    tags: ['environment', 'ngt', 'clean air', 'water pollution', 'polluter pays', 'article 21'],
    scenarioTag: 'environmental-rights',
    whatToSay: "Under Article 21 of the Constitution and Section 14 of the National Green Tribunal Act, 2010, the Polluter Pays Principle is legally binding. Contaminating drinking water or emitting illegal industrial emissions is a substantial environmental violation.",
    whatToSay_hi: "संविधान के अनुच्छेद 21 और राष्ट्रीय हरित अधिकरण (NGT) अधिनियम 2010 की धारा 14 के तहत \"प्रदूषणकर्ता भुगतान सिद्धांत\" बाध्यकारी है। पेयजल दूषित करना या अवैध औद्योगिक उत्सर्जन करना कानून का गंभीर उल्लंघन है।",
    dos: [
      "Report illegal waste burning, untreated industrial discharge, or groundwater contamination to State Pollution Control Board (SPCB).",
      "File Original Application before the National Green Tribunal (NGT) under Section 14 for environmental restoration.",
      "Collect photographic evidence and water/soil test laboratory reports."
],
    donts: [
      "Do NOT dispose of untreated toxic e-waste or industrial effluents into public storm drains.",
      "Do NOT fell heritage trees without permission from the jurisdictional Tree Officer.",
      "Do NOT ignore construction sites violating National Clean Air Programme (NCAP) dust mitigation rules."
],
    dos_hi: [
      "अवैध कचरा जलाने या रासायनिक अपशिष्ट बहाने की शिकायत राज्य प्रदूषण नियंत्रण बोर्ड (SPCB) से करें।",
      "पर्यावरण क्षतिपूर्ति के लिए एनजीटी (NGT) के समक्ष धारा 14 के तहत मूल आवेदन दाखिल करें।",
      "प्रदूषण के फोटो, वीडियो और अधिकृत प्रयोगशाला से पानी/मिट्टी की जांच रिपोर्ट एकत्र करें।"
],
    donts_hi: [
      "सार्वजनिक नालों या जलस्रोतों में जहरीला कचरा न फेंकें।",
      "वृक्ष संरक्षण अधिकारी (Tree Officer) की अनुमति के बिना पुराने पेड़ों को न काटें।",
      "धूल नियंत्रण नियमों का उल्लंघन करने वाले निर्माण स्थलों की अनदेखी न करें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Environmental Law Division',
    isPopular: false,
    isPublished: true
  },

  // 23. Undertrial Prisoners & Free Legal Aid
  {
    id: 'undertrial-prisoner-bail-rights',
    slug: 'undertrial-prisoner-bail-free-legal-aid',
    title: 'Undertrial Bail Rights & Mandatory Free Legal Aid (Art 39A)',
    category: 'Police & Criminal Justice',
    icon: 'scale',
    summary: 'Codifies the constitutional right to free legal representation under Article 39A and maximum statutory custody limits ensuring undertrials are released on personal bond.',
    statutoryBasis: {
      actName: 'Legal Services Authorities Act, 1987 & BNSS 2023',
      shortAct: 'LSAA 1987 & BNSS',
      sections: ['Article 39A Constitution', 'Section 12 LSAA', 'Section 479 BNSS 2023', 'Section 340 BNSS'],
      actUrl: '/laws/BNSS',
      landmarkCases: [
        'Hussainara Khatoon vs. Home Secretary, State of Bihar (1979) - Right to speedy trial and free legal aid',
        'In Re: Inhuman Conditions in 1382 Prisons (Supreme Court) - Directives on Undertrial Review Committees'
      ]
    },
    keyProtections: [
      'Statutory Bail for Undertrials: Under BNSS Section 479, an undertrial prisoner who has served one-third (first-time offender) or one-half of the maximum sentence must be released on personal bond.',
      '100% Free Legal Representation: Any undertrial prisoner, indigent citizen, woman, or child is statutorily entitled to free advocate assistance through DLSA.',
      'Mandatory Undertrial Review: District Undertrial Review Committees (UTRC) must meet every month to identify eligible undertrials for bail.',
      'Legal Aid Defense Counsel System (LADCS): Full-time dedicated public defense lawyers stationed in every district court.',
      'Right Against Handcuffing: Undertrial prisoners cannot be handcuffed while being escorted to court without written judicial sanction.'
    ],
    actionableSteps: [
      'Inform the jail superintendent or visiting magistrate of the desire to receive free legal aid.',
      'Family members can visit the District Legal Services Authority (DLSA) office in the court complex.',
      'Apply under BNSS Section 479 before the trial court for release on personal bond.',
      'Call NALSA Free Legal Aid Helpline 15100.'
    ],
    legalRemedy: 'Bail application under BNSS Section 479 / 480; Habeas Corpus before the High Court; intervention through the District Legal Services Authority.',
    emergencyHelpline: {
      name: 'NALSA 24x7 Legal Aid Hotline',
      number: '15100',
      description: 'Free legal aid allocation for undertrials, victims, and indigent citizens',
      portalUrl: 'https://nalsa.gov.in'
    },
    penaltiesForViolation: 'Holding an undertrial in illegal custody beyond statutory limits attracts judicial strictures and state monetary compensation for wrongful confinement.',
    frequentlyAskedQuestions: [
      {
        question: 'Can an undertrial be kept in jail simply because they cannot afford monetary surety for bail?',
        answer: 'No. The Supreme Court in Moti Ram vs. State of MP held that bail cannot be denied due to poverty. Courts must accept personal bonds without financial sureties for impoverished undertrials.'
      }
    ],
    tags: ['undertrial', 'bail', 'nalsa', 'free legal aid', 'bnss 479', 'prison'],
    scenarioTag: 'undertrial-bail',
    whatToSay: "Under Section 479 of the Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) and Article 39A, having served the statutory detention threshold, the undertrial is legally entitled to release on personal bond with free legal aid representation.",
    whatToSay_hi: "भारतीय नागरिक सुरक्षा संहिता (BNSS 2023) की धारा 479 और अनुच्छेद 39A के अनुसार, निर्धारित अवधि की कैद पूरी करने पर विचाराधीन कैदी व्यक्तिगत मुचलके पर निःशुल्क कानूनी सहायता के साथ जमानत पाने का वैधानिक हकदार है।",
    dos: [
      "Apply to the Jail Under-Trial Review Committee (UTRC) for personal bond release under BNSS §479.",
      "Demand immediate assignment of a free Legal Aid Defense Counsel (LADC) via District Legal Services Authority (DLSA).",
      "Ensure the prisoner is produced virtually or physically at every statutory remand date."
],
    donts: [
      "Do NOT allow undertrials to remain incarcerated merely due to inability to furnish heavy monetary surety.",
      "Do NOT accept prolonged detention beyond statutory charge-sheet filing limits (BNSS Section 187).",
      "Do NOT pay any informal fees or bribes for free legal aid services."
],
    dos_hi: [
      "जेल अंडर-ट्रायल रिव्यू कमेटी (UTRC) के समक्ष धारा 479 के तहत व्यक्तिगत मुचलके पर रिहाई की अर्जी दें।",
      "जिला विधिक सेवा प्राधिकरण (DLSA) से तुरंत निःशुल्क कानूनी सहायता वकील (LADC) की मांग करें।",
      "प्रत्येक रिमांड तिथि पर बंदी की नियमित अदालती पेशी सुनिश्चित कराएं।"
],
    donts_hi: [
      "केवल भारी जमानत राशि न जुटा पाने के कारण गरीब विचाराधीन कैदी को जेल में बंद न रहने दें।",
      "चार्जशीट दाखिल करने की वैधानिक समय-सीमा (60/90 दिन) बीतने के बाद जेल में रहना स्वीकार न करें।",
      "निःशुल्क सरकारी कानूनी सहायता के लिए किसी भी व्यक्ति को रिश्वत न दें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Legal Aid & Human Rights Cell',
    isPopular: false,
    isPublished: true
  },

  // 24. Whistleblower Protection
  {
    id: 'whistleblower-protection-anti-corruption',
    slug: 'whistleblower-protection-against-victimization',
    title: 'Whistleblower Safeguards & Anti-Corruption Reporting',
    category: 'Transparency & Governance',
    icon: 'shield',
    summary: 'Safeguards citizens and public servants who expose corruption, misuse of power, or criminal offenses from administrative victimization and physical threats.',
    statutoryBasis: {
      actName: 'Whistle Blowers Protection Act, 2014 & Central Vigilance Commission Act',
      shortAct: 'WBPA 2014 & CVC Act',
      sections: ['Section 4 WBPA', 'Section 11 WBPA', 'Section 12 WBPA', 'PIDPI Resolution'],
      actUrl: '/laws/CVC',
      landmarkCases: [
        'Satyendra Dubey Case (Supreme Court 2004) - Origin of Public Interest Disclosure and Protection of Informers (PIDPI)',
        'CVC Directives on complete anonymity of whistleblowers'
      ]
    },
    keyProtections: [
      'Complete Identity Confidentiality: The Central Vigilance Commission (CVC) is statutorily bound to conceal the whistleblower’s name and details throughout investigations.',
      'Protection from Administrative Victimization: Public authorities cannot demote, withhold promotions, or transfer a whistleblower in retaliation.',
      'Police Protection: If a whistleblower faces physical threats, the Competent Authority must order the police to provide immediate armed security.',
      'Restoration of Status: The Competent Authority can reverse retaliatory administrative orders passed against whistleblowers.',
      'Public Interest Disclosure: Any citizen, NGO, or public employee can submit protected disclosures regarding corruption.'
    ],
    actionableSteps: [
      'Submit a confidential disclosure under the PIDPI resolution addressed to the Central Vigilance Commission (CVC).',
      'Ensure the envelope is clearly marked "PIDPI" and do not include personal identity inside the body of the disclosure.',
      'If subjected to departmental retaliation or threats, file an immediate victimization petition before the CVC.',
      'Seek assistance from the National Anti-Corruption Helpline 1964.'
    ],
    legalRemedy: 'Petition before the Central Vigilance Commission (CVC) under PIDPI; writ petition in High Court under Article 226 for protective orders.',
    emergencyHelpline: {
      name: 'CVC Vigilance Helpline',
      number: '1964',
      description: 'Central Vigilance Commission toll-free anti-corruption and whistleblower desk',
      portalUrl: 'https://cvc.gov.in'
    },
    penaltiesForViolation: 'Any public servant who negligently or willfully reveals the identity of a whistleblower faces imprisonment up to 3 years and fines under WBPA Section 16.',
    frequentlyAskedQuestions: [
      {
        question: 'Can my employer terminate me for reporting corporate fraud to regulatory authorities?',
        answer: 'No. Both the Companies Act Section 177 (Vigil Mechanism) and the Whistle Blowers Protection Act provide strict immunity against employment termination for whistleblowing.'
      }
    ],
    tags: ['whistleblower', 'cvc', 'anti-corruption', 'pidpi', 'victimization'],
    scenarioTag: 'whistleblower',
    whatToSay: "Under Section 4 of the Whistle Blowers Protection Act, 2014 and the Central Vigilance Commission (CVC) PIDPI guidelines, my identity must be kept strictly anonymous. Any administrative harassment or retaliation is a punishable statutory violation.",
    whatToSay_hi: "व्हिसलब्लोअर्स संरक्षण अधिनियम 2014 की धारा 4 और केंद्रीय सतर्कता आयोग (CVC) की पीआईडीपीआई नीति के अनुसार मेरी पहचान पूर्णतः गुप्त रखी जानी चाहिए। किसी भी प्रकार का प्रशासनिक उत्पीड़न या प्रतिशोध दंडनीय अपराध है।",
    dos: [
      "Mark the complaint envelope as \"Public Interest Disclosure (PIDPI)\" addressed to the Central Vigilance Commission (CVC).",
      "Maintain certified copies of all documentary proof regarding the financial irregularity.",
      "Seek immediate police protection and administrative transfer if subjected to physical threats."
],
    donts: [
      "Do NOT disclose your whistleblower identity on social media or public online platforms.",
      "Do NOT transmit confidential leak files over unsecured personal messaging apps.",
      "Do NOT submit frivolous, unverified, or defamatory allegations without verifiable documentation."
],
    dos_hi: [
      "केंद्रीय सतर्कता आयोग (CVC) को \"पब्लिक इंटरेस्ट डिस्क्लोजर (PIDPI)\" लिखकर सीलबंद शिकायत भेजें।",
      "वित्तीय अनियमितता या भ्रष्टाचार से संबंधित सभी दस्तावेजों की प्रमाणित प्रतियां सुरक्षित रखें।",
      "जान का खतरा होने पर तत्काल पुलिस सुरक्षा और आधिकारिक स्थानांतरण की मांग करें।"
],
    donts_hi: [
      "सोशल मीडिया या सार्वजनिक मंचों पर अपनी पहचान उजागर न करें।",
      "असुरक्षित पर्सनल चैट ऐप्स पर गोपनीय सरकारी दस्तावेज न भेजें।",
      "बिना ठोस दस्तावेजी प्रमाण के कोई भी तथ्यहीन या दुर्भावनापूर्ण आरोप न लगाएं।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Governance & Anti-Corruption Bureau',
    isPopular: false,
    isPublished: true
  },

  // 25. Land Acquisition & Fair Compensation
  {
    id: 'land-acquisition-fair-compensation',
    slug: 'fair-compensation-rehabilitation-rfctlarr',
    title: 'Fair Land Acquisition Compensation & Resettlement Rights',
    category: 'Real Estate & Property',
    icon: 'home',
    summary: 'Guarantees landowners and affected families up to 4x market value compensation, mandatory Social Impact Assessments, and statutory rehabilitation.',
    statutoryBasis: {
      actName: 'Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013 (RFCTLARR)',
      shortAct: 'RFCTLARR Act 2013',
      sections: ['Section 4', 'Section 16', 'Section 26', 'Section 30', 'Section 31', 'Section 64'],
      actUrl: '/laws/LandAcquisition',
      landmarkCases: [
        'Indore Development Authority vs. Manoharlal (Supreme Court Constitutional Bench 2020) - Interpretation of Section 24 on lapsing of land acquisition',
        'State of Haryana vs. Gurcharan Singh - Multiplier factors for rural compensation'
      ]
    },
    keyProtections: [
      'Up to 4x Market Value in Rural Areas: Rural land acquisitions receive a mandatory multiplier of up to 2 times market value + 100% solatium (total up to 4x).',
      '2x Market Value in Urban Areas: Urban land acquisitions receive market value + 100% solatium (total 2x).',
      'Mandatory Social Impact Assessment (SIA): Public hearings and SIA studies are legally mandatory before any acquisition notification.',
      'Comprehensive Rehabilitation & Resettlement (R&R): Affected families (including landless laborers and tenants) are entitled to housing units, subsistence grants, and employment.',
      'Consent Requirement: 70% consent required for public-private partnership (PPP) projects; 80% consent for private commercial acquisitions.'
    ],
    actionableSteps: [
      'Participate in the public hearing during the Social Impact Assessment (SIA) study and submit written objections.',
      'If the compensation award is undervalued, refuse to accept without protest and file an objection under Section 64 within 6 weeks.',
      'Demand referral of the dispute to the Land Acquisition, Rehabilitation and Resettlement Authority (LARR Authority).',
      'Preserve registered sale deeds of comparable neighboring properties to prove real market valuations.'
    ],
    legalRemedy: 'Reference before the Land Acquisition, Rehabilitation and Resettlement Authority (LARR Authority) under Section 64; appeal before the High Court.',
    emergencyHelpline: {
      name: 'Department of Land Resources Desk',
      number: '011-23062454',
      description: 'Ministry of Rural Development land acquisition guidance desk',
      portalUrl: 'https://dolr.gov.in'
    },
    penaltiesForViolation: 'Acquisitions conducted without complying with SIA or fair market value multipliers are liable to be quashed by the High Court.',
    frequentlyAskedQuestions: [
      {
        question: 'Does the 100% solatium apply on top of the calculated market value of the acquired land?',
        answer: 'Yes. Section 30 of the RFCTLARR Act mandates that a solatium amount equivalent to 100% of the total compensation figure must be paid in addition to the market valuation.'
      }
    ],
    tags: ['land acquisition', 'rfctlarr', 'compensation', 'solatium', 'rehabilitation', 'sia'],
    scenarioTag: 'land-acquisition',
    whatToSay: "Under Sections 26-30 of the RFCTLARR Act, 2013, the Collector is legally bound to compute compensation at market value multiplied by rural factors plus 100% statutory solatium. Possession cannot be taken without full prior payment.",
    whatToSay_hi: "भूमि अधिग्रहण अधिनियम (RFCTLARR 2013) की धारा 26-30 के तहत कलेक्टर ग्रामीण क्षेत्रों में बाजार मूल्य का गुणक और 100% अतिरिक्त सांत्वना राशि (Solatium) देने के लिए बाध्य है। पूर्ण भुगतान से पहले कब्जा नहीं लिया जा सकता।",
    dos: [
      "Verify that the Social Impact Assessment (SIA) study was conducted under Section 4.",
      "Demand 100% Solatium (additional bonus compensation) under Section 30.",
      "File an objection before the Land Acquisition, Rehabilitation and Resettlement Authority under Section 64."
],
    donts: [
      "Do NOT surrender physical land possession until 100% awarded compensation is credited to your bank account.",
      "Do NOT sign consent awards without independent legal verification of prevailing market registry rates.",
      "Do NOT allow agricultural multi-crop irrigated land acquisition without compliance with Section 10 restrictions."
],
    dos_hi: [
      "जांच करें कि धारा 4 के तहत सामाजिक प्रभाव आकलन (SIA) अध्ययन हुआ है या नहीं।",
      "धारा 30 के तहत 100% सांत्वना राशि (Solatium) का अनिवार्य भुगतान मांगें।",
      "मुआवजा कम होने पर धारा 64 के तहत पुनर्वास एवं पुनर्व्यवस्थापन प्राधिकरण के समक्ष आपत्ति दर्ज करें।"
],
    donts_hi: [
      "जब तक पूरा मुआवजा बैंक खाते में जमा न हो जाए, तब तक जमीन का भौतिक कब्जा न छोड़ें।",
      "सर्किल रेट और बाजार भाव की कानूनी जांच किए बिना सहमति पत्र पर हस्ताक्षर न करें।",
      "बहुफसली सिंचित कृषि भूमि के अधिग्रहण में धारा 10 के कड़े नियमों की अनदेखी न होने दें।"
],
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Property & Land Acquisition Council',
    isPopular: false,
    isPublished: true
  },

  // 26. Traffic: Prohibition on Towing with Passenger Inside
  {
    id: 'mva-towing-prohibition',
    slug: 'vehicle-towing-passenger-prohibition',
    title: 'Right Against Vehicle Towing with Passenger Inside',
    title_hi: 'यात्री के अंदर रहते हुए वाहन टो (क्रेन से उठाने) के खिलाफ अधिकार',
    category: 'Traffic & Motor Vehicles',
    icon: 'truck',
    summary: 'Traffic authorities are legally forbidden from towing or hoisting any motor vehicle while the driver or passengers are sitting inside. Towing can only commence after safe evacuation and issuing a formal physical or e-challan receipt.',
    summary_hi: 'मोटर वाहन नियमों के अनुसार यदि चालक या कोई भी सवारी वाहन के अंदर बैठी है, तो ट्रैफिक क्रेन उस वाहन को उठा या खींच नहीं सकती। क्रेन उठाने से पहले सुरक्षित रूप से उतारना और चालान देना अनिवार्य है।',
    statutoryBasis: {
      actName: 'Motor Vehicles (Amendment) Act, 2019 & State Police Towing Regulations',
      shortAct: 'MVA 2019 Sec 127',
      sections: ['Section 127', 'Section 201'],
      actUrl: '/laws/MotorVehicles',
      landmarkCases: [
        'Bombay High Court Directives (2018) in Public Safety & Towing Ethics',
        'Delhi High Court in Court on Its Own Motion vs. Delhi Police (Towing Safety Directives)'
      ]
    },
    keyProtections: [
      'Absolute Bar on Occupied Vehicle Towing: Traffic cranes cannot lift or tow any four-wheeler or two-wheeler if any human occupant or minor is inside.',
      'Mandatory Verbal Warning First: Traffic police must first honk, blow whistle, or give a verbal warning to move the wrongfully parked vehicle before calling a tow crane.',
      'Only Parking Fine Payable if Driver Arrives: If the driver arrives before the vehicle is hoisted, only the unauthorized parking fine (e-challan) can be charged; towing charges cannot be levied.'
    ],
    actionableSteps: [
      'If inside the car, remain seated calmly, roll down the window, and inform the crane operator that you are present inside.',
      'Politely state that under Section 127 of the MVA, an occupied car cannot be hoisted.',
      'Request the traffic officer to issue a standard e-challan for the parking violation and offer to move the vehicle immediately.',
      'If the operator insists on towing while you are inside, film a video calmly as proof and dial 112 or the Traffic Helpline.'
    ],
    legalRemedy: 'Grievance before the Joint Commissioner of Police (Traffic), State Human Rights Commission, or Lok Adalat for endangerment under Section 279/336 IPC / BNS Section 106/281.',
    emergencyHelpline: {
      name: 'National Highway & Traffic Helpline',
      number: '1033',
      description: '24/7 Traffic safety & highway emergency assistance',
      portalUrl: 'https://morth.nic.in'
    },
    penaltiesForViolation: 'Police/Contractor towing an occupied car is punishable for rash act endangering life under BNS Section 125 alongside departmental suspension.',
    whatToSay: 'Officer, under Traffic Police Towing Regulations and Section 127 of the Motor Vehicles Act, you cannot hoist or tow this vehicle while I am inside. Please issue an e-challan for the parking violation and I will move the vehicle immediately.',
    whatToSay_hi: 'अधिकारी महोदय, मोटर वाहन अधिनियम की धारा 127 और ट्रैफिक पुलिस नियमों के तहत जब तक मैं अंदर बैठा हूँ, आप वाहन को क्रेन से नहीं उठा सकते। कृपया पार्किंग उल्लंघन का ई-चालान दें, मैं गाड़ी तुरंत हटा रहा हूँ।',
    dos: [
      'Remain seated calmly and turn on hazard parking lights.',
      'Request an immediate on-the-spot e-challan without tow fees.',
      'Note the crane registration number and traffic police zone batch.'
    ],
    donts: [
      'Do NOT engage in physical scuffles with tow contractors.',
      'Do NOT step out of the car until the crane drops the cable hoist.',
      'Do NOT pay cash fines without an automated official SMS / printed e-challan.'
    ],
    tags: ['traffic', 'towing', 'crane', 'parking', 'mva', 'challan', 'car'],
    scenarioTag: 'traffic-challan',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Traffic & Motor Vehicle Directorate',
    isPopular: true,
    isPublished: true
  },

  // 27. Traffic: DigiLocker & mParivahan Acceptance
  {
    id: 'digilocker-mparivahan-acceptance',
    slug: 'digilocker-mparivahan-digital-license-rc',
    title: 'Mandatory Acceptance of DigiLocker & mParivahan Electronic Documents',
    title_hi: 'डिजिलॉकर और एम-परिवहन डिजिटल ड्राइविंग लाइसेंस व आरसी की कानूनी मान्यता',
    category: 'Traffic & Motor Vehicles',
    icon: 'smartphone',
    summary: 'Digital driving licenses, registration certificates (RC), insurance, and PUC stored in DigiLocker or mParivahan are legally equivalent to original physical documents. Police cannot penalize or demand physical cards.',
    summary_hi: 'डिजिलॉकर या एम-परिवहन ऐप में उपलब्ध ड्राइविंग लाइसेंस, आरसी और बीमा कानूनी रूप से मूल दस्तावेज़ों के बराबर मान्य हैं। पुलिस भौतिक (हार्ड कॉपी) कार्ड की मांग नहीं कर सकती और न ही इसके लिए चालान कर सकती है।',
    statutoryBasis: {
      actName: 'Central Motor Vehicles Rules, 1989 & Information Technology Act, 2000',
      shortAct: 'Rule 139 CMVR & IT Act Sec 4',
      sections: ['Rule 139 CMVR', 'Section 4 IT Act 2000', 'Section 139 MVA'],
      actUrl: '/laws/MotorVehicles',
      landmarkCases: [
        'Ministry of Road Transport & Highways (MoRTH) Standard Operating Procedure Circular RT-11036/64/2017-MVL',
        'Delhi High Court in Legal Status of Electronic Documents'
      ]
    },
    keyProtections: [
      'Equal Statutory Validity: Electronic DL and RC on government-verified DigiLocker/mParivahan apps carry the same statutory force as physical PVC cards under Section 4 of the IT Act.',
      'No Seizure of Physical Documents: For ordinary non-compoundable checks, traffic officers cannot force physical surrender if digital credentials are valid and QR-code scannable.',
      'Protection Against "No Document" Fine: Showing DigiLocker credentials prevents any challan under Section 130/177 of the Motor Vehicles Act.'
    ],
    actionableSteps: [
      'Open the official DigiLocker or mParivahan mobile application and present the digitally verified QR-code certificate.',
      'If the officer refuses, cite MoRTH Notification No. RT-11036/64/2017-MVL dated 17th December 2018.',
      'Request the officer to scan the QR code via their departmental mParivahan / e-Challan enforcement app.',
      'If an unlawful challan is forced, record the officer name, badge number, and contest before the Traffic Virtual Court.'
    ],
    legalRemedy: 'Grievance before the Superintendent of Police (Traffic) or dismissal of challan in the District Virtual Traffic Court.',
    emergencyHelpline: {
      name: 'Parivahan Sarathi Citizen Portal',
      number: '0120-2459169',
      description: 'National Transport Portal Helpdesk for digital licenses',
      portalUrl: 'https://parivahan.gov.in'
    },
    penaltiesForViolation: 'Traffic personnel issuing bogus challans despite valid DigiLocker credentials are liable for disciplinary action and refund of fees.',
    whatToSay: 'Officer, under Rule 139 of the Central Motor Vehicles Rules and MoRTH Notification RT-11036/64/2017, documents on DigiLocker and mParivahan have statutory equivalence under Section 4 of the IT Act. You are legally required to accept this QR-verified digital license.',
    whatToSay_hi: 'अधिकारी महोदय, केंद्रीय मोटर वाहन नियम 139 और सड़क परिवहन मंत्रालय की अधिसूचना के अनुसार डिजिलॉकर में उपलब्ध ड्राइविंग लाइसेंस और आरसी कानूनी रूप से मान्य हैं। आप इसे अस्वीकार नहीं कर सकते।',
    dos: [
      'Keep your DigiLocker and mParivahan apps updated and offline-cached before driving.',
      'Show the active government app directly, not a third-party gallery screenshot.',
      'Ensure the QR code is clearly visible and scannable.'
    ],
    donts: [
      'Do NOT show raw gallery screenshots or unauthorized third-party wallet PDFs.',
      'Do NOT hand over your unlocked phone; simply hold it up for the officer to inspect or scan.',
      'Do NOT accept an offline paper challan for "failure to produce documents".'
    ],
    tags: ['digilocker', 'mparivahan', 'driving license', 'rc', 'traffic', 'challan', 'puc'],
    scenarioTag: 'traffic-challan',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Digital Mobility Council',
    isPopular: true,
    isPublished: true
  },

  // 28. Traffic: Breathalyzer Test Rights
  {
    id: 'breathalyzer-inspection-protocol',
    slug: 'breathalyzer-inspection-fresh-nozzle-rights',
    title: 'Breathalyzer Test Protocol & Fresh Disposable Nozzle Rights',
    title_hi: 'ब्रीथ एनालाइज़र (शराब जांच) परीक्षण नियम व नया सीलबंद नोज़ल मांगने का अधिकार',
    category: 'Traffic & Motor Vehicles',
    icon: 'activity',
    summary: 'Citizens subjected to a suspected drink-and-drive inspection have the strict legal right to inspect the breathalyzer, demand a sealed single-use disposable plastic straw opened in front of them, and receive a printed or digital BAC slip. Readings below 30mg per 100ml blood are non-cognizable.',
    summary_hi: 'शराब पीकर गाड़ी चलाने की जांच के दौरान नागरिक को यह मांग करने का पूर्ण कानूनी अधिकार है कि उसके सामने एक नया सीलबंद प्लास्टिक नोज़ल खोला जाए। मशीन की प्रिंटेड पर्ची मांगें, और यदि रक्त में अल्कोहल 30mg/100ml से कम है, तो कोई जुर्म नहीं बनता।',
    statutoryBasis: {
      actName: 'Motor Vehicles (Amendment) Act, 2019',
      shortAct: 'MVA 2019 Sec 185 & 203',
      sections: ['Section 185', 'Section 203', 'Section 204'],
      actUrl: '/laws/MotorVehicles',
      landmarkCases: [
        'Supreme Court in State of Delhi vs. Sanjeev Nanda (Drink and Drive Guidelines)',
        'Madras High Court on Breathalyzer Hygiene & Sanitation Directives'
      ]
    },
    keyProtections: [
      'Hygienic Disposable Nozzle Mandatory: Police cannot reuse an unsealed, dirty straw; a new medical-grade disposable pipe must be unsealed in the presence of the citizen.',
      'Legal Threshold (30mg / 100ml): No offense is committed unless the breathalyzer detects alcohol exceeding 30 mg per 100 ml of blood.',
      'Right to Confirmatory Medical Test: If the breathalyzer gives an erroneous false-positive reading (e.g. from mouthwash or diabetic ketoacidosis), the citizen has the right to demand a hospital blood test under Section 204 within 2 hours.'
    ],
    actionableSteps: [
      'Cooperate politely and request the officer to unseal a fresh, single-use disposable plastic straw in your presence.',
      'Blow steadily as instructed until the machine beeps.',
      'Check the digital screen and demand a printed slip or official reading record.',
      'If you have not consumed alcohol but the test shows positive, immediately demand a hospital blood test under Section 204.'
    ],
    legalRemedy: 'Contest the challan before the Metropolitan / Judicial Magistrate Court by presenting negative blood test results.',
    emergencyHelpline: {
      name: 'National Police Emergency',
      number: '112',
      description: 'Unified Citizen Police Dispatch',
      portalUrl: 'https://112.gov.in'
    },
    penaltiesForViolation: 'Forcing a citizen to use an unhygienic reused pipe violates health protocols and can lead to quashing of the police report.',
    whatToSay: 'Officer, under Section 203 of the Motor Vehicles Act, I consent to the breath test, but you must open a sealed, sterile disposable nozzle in front of me and provide the machine reading slip.',
    whatToSay_hi: 'अधिकारी महोदय, मोटर वाहन अधिनियम की धारा 203 के तहत मैं श्वास परीक्षण के लिए तैयार हूँ, लेकिन आपको मेरे सामने एक नया सीलबंद प्लास्टिक नोज़ल खोलना होगा और मशीन की प्रिंटेड पर्ची देनी होगी।',
    dos: [
      'Comply politely with the test request; refusal can result in detention for medical exam under Sec 203(3).',
      'Verify that the sealed packet is opened in front of you.',
      'Demand to see the digital reading and preserve the printed ticket.'
    ],
    donts: [
      'Do NOT put your mouth on an already mounted or open pipe.',
      'Do NOT physically resist officers; instead, demand a hospital blood test.',
      'Do NOT flee a checkpoint, as it creates an adverse legal presumption.'
    ],
    tags: ['breathalyzer', 'drink and drive', 'alcohol', 'traffic', 'challan', 'police', 'mva'],
    scenarioTag: 'traffic-challan',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Traffic & Motor Vehicle Directorate',
    isPopular: true,
    isPublished: true
  },

  // 29. Healthcare: Emergency Medical Stabilization Without Advance
  {
    id: 'emergency-medical-stabilization',
    slug: 'emergency-medical-stabilization-no-deposit',
    title: 'Mandatory Emergency Stabilization Without Advance Deposit',
    title_hi: 'अस्पतालों द्वारा अग्रिम भुगतान के बिना अनिवार्य आपातकालीन प्राथमिक उपचार का अधिकार',
    category: 'Healthcare & Patient Charters',
    icon: 'heart',
    summary: 'Both government and private hospitals are legally mandated to immediately provide first-aid, resuscitation, and emergency stabilization to any critical or trauma victim without demanding advance money, police FIR formalities, or insurance approvals first.',
    summary_hi: 'सुप्रीम कोर्ट के ऐतिहासिक फैसले के अनुसार हर सरकारी व निजी अस्पताल का यह कानूनी कर्तव्य है कि दुर्घटना या गंभीर बीमारी में मरीज को बिना अग्रिम पैसे, बिना पुलिस रिपोर्ट और बिना बीमा क्लीयरेंस के तुरंत प्राथमिक जीवनरक्षक उपचार दे।',
    statutoryBasis: {
      actName: 'Clinical Establishments (Registration and Regulation) Act, 2010 & Article 21',
      shortAct: 'Clinical Establishments Act & Art 21',
      sections: ['Section 12(2) CEA', 'Article 21 Constitution', 'Section 134 MVA'],
      actUrl: '/laws/Constitution',
      landmarkCases: [
        'Pt. Parmanand Katara vs. Union of India (1989 AIR 2039) - Preservation of human life is paramount; no medical treatment can be delayed for medico-legal formalities',
        'Paschim Banga Khet Mazdoor Samity vs. State of West Bengal (1996 4 SCC 37) - Failure to provide timely emergency medical treatment violates Article 21'
      ]
    },
    keyProtections: [
      'No Advance Deposit for Emergency Stabilization: Hospitals cannot turn away a patient gasping for breath or hemorrhaging simply because their credit card or cash deposit is pending.',
      'No Medico-Legal Formalities Barrier: Doctors do NOT need to wait for local police arrival before treating road accident, poisoning, or assault victims.',
      'Good Samaritan Immunity: Any bystander who brings an injured victim to a hospital cannot be forced to pay bills, reveal contact details, or participate in police inquiries.'
    ],
    actionableSteps: [
      'Demand immediate triage and resuscitation from the Chief Medical Officer on duty.',
      'State firmly that under the Supreme Court Parmanand Katara ruling and Section 12(2) CEA, emergency stabilization is mandatory.',
      'If hospital admin refuses to touch the patient without advance cash, record audio/video proof and immediately dial 112.',
      'Once patient is stabilized, administrative and financial billing arrangements can be discussed.'
    ],
    legalRemedy: 'Complaint before the State Clinical Establishments Authority, National Human Rights Commission (NHRC), and writ petition under Article 226 for medical negligence.',
    emergencyHelpline: {
      name: 'National Emergency Ambulance Service',
      number: '108',
      description: '24/7 National Emergency Medical & Ambulance Service',
      portalUrl: 'https://nhm.gov.in'
    },
    penaltiesForViolation: 'Refusal of emergency care is grounds for immediate cancellation of the hospital clinical establishment license and criminal prosecution under BNS Section 106.',
    whatToSay: 'Doctor/Admin, under the Supreme Court landmark ruling in Parmanand Katara and Section 12 of the Clinical Establishments Act, you cannot withhold emergency life-saving stabilization for advance payment or police formalities. You must start treatment immediately.',
    whatToSay_hi: 'डॉक्टर और अस्पताल प्रशासन, सुप्रीम कोर्ट के परमानंद कटारा फैसले और क्लिनिकल प्रतिष्ठान कानून के तहत आप अग्रिम भुगतान या पुलिस औपचारिकताओं के लिए आपातकालीन उपचार नहीं रोक सकते। कृपया तुरंत इलाज शुरू करें।',
    dos: [
      'Prioritize getting the patient onto a stretcher and into the ICU/casualty ward.',
      'Cite the Parmanand Katara judgment to hospital billing staff.',
      'Keep a record of the refusal if hospital staff causes unreasonable delays.'
    ],
    donts: [
      'Do NOT waste precious golden-hour minutes arguing at the billing counter.',
      'Do NOT allow the hospital to transfer an unstable, critical patient without life support.',
      'Do NOT let hospital staff compel good samaritans to sign admission liability forms.'
    ],
    tags: ['hospital', 'emergency', 'medical', 'parmanand katara', 'doctor', 'treatment', 'advance'],
    scenarioTag: 'medical-refusal',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Medico-Legal Council',
    isPopular: true,
    isPublished: true
  },

  // 30. Healthcare: Ban on Detaining Patients or Deceased Bodies for Unpaid Bills
  {
    id: 'hospital-dead-body-detention-ban',
    slug: 'prohibition-detaining-patient-dead-body-bills',
    title: 'Absolute Prohibition Against Detaining Patients or Deceased Bodies for Unpaid Bills',
    title_hi: 'अस्पतालों द्वारा बकाया बिल के लिए शव या मरीज को बंधक बनाने पर पूर्ण प्रतिबंध',
    category: 'Healthcare & Patient Charters',
    icon: 'shield',
    summary: 'Hospitals have zero statutory authority to hold a patient captive or refuse release of a deceased human body over pending financial invoices. Doing so constitutes wrongful confinement and criminal extortion under the law.',
    summary_hi: 'किसी भी अस्पताल को बकाया बिल के लिए किसी मरीज को रोके रखने या मृतक के शव को परिजनों को सौंपने से इनकार करने का कोई कानूनी अधिकार नहीं है। ऐसा करना बीएनएस की धारा 127 के तहत अवैध बंधक और गंभीर अपराध है।',
    statutoryBasis: {
      actName: 'Charter of Patient Rights (NHRC/MoHFW) & Bharatiya Nyaya Sanhita, 2023',
      shortAct: 'NHRC Patient Charter & BNS Sec 127',
      sections: ['Section 127 BNS (Old Sec 342 IPC)', 'Section 308 BNS (Extortion)', 'Article 21 Constitution'],
      actUrl: '/laws/BNS',
      landmarkCases: [
        'Bombay High Court in Sanjay S. Prajapati vs. State of Maharashtra (2017) - Detaining a dead body for hospital bills is an unconstitutional extortion and assault on human dignity',
        'Delhi High Court in Deeksha Sharma vs. Max Hospital (2019 directives on patient dignity)'
      ]
    },
    keyProtections: [
      'Absolute Bar on Body Withholding: A hospital cannot hold a corpse as a financial hostage or lien; the deceased has a fundamental right to dignified funeral rites under Article 21.',
      'No Physical Detention of Discharged Patients: A patient who has recovered cannot be locked in a room or prevented from leaving due to insurance delays or disputed bills.',
      'Civil Remedies Only for Billing Disputes: If bill dues are legitimately disputed, the hospital must file a civil summary suit under Order 37 CPC; physical hostage-taking is a cognizable crime.'
    ],
    actionableSteps: [
      'Firmly notify the Hospital Medical Superintendent that detaining a patient or body is wrongful confinement under Section 127 BNS.',
      'Immediately dial 112 and request a local police sub-inspector to visit the hospital casualty desk.',
      'Submit a written undertaking stating that billing disputes will be resolved through legal channels while demanding immediate handover.',
      'File an emergency grievance before the State Human Rights Commission or High Court Vacation Bench.'
    ],
    legalRemedy: 'Filing of FIR under Section 127/308 BNS for wrongful confinement and extortion; emergency Habeas Corpus petition before the High Court.',
    emergencyHelpline: {
      name: 'National Human Rights Commission (NHRC)',
      number: '14433',
      description: 'Toll-free human rights violation complaint desk',
      portalUrl: 'https://nhrc.nic.in'
    },
    penaltiesForViolation: 'Imprisonment up to 3 years for hospital management under BNS Section 127/308 plus suspension of hospital clinical license.',
    whatToSay: 'Hospital Administration, detaining a deceased body or discharged patient for unpaid bills is illegal confinement under Section 127 of BNS and violates the Supreme Court patient charter. Release the body immediately; financial disputes must be pursued in civil courts, not through detention.',
    whatToSay_hi: 'अस्पताल प्रशासन, बकाया बिल के लिए किसी मृत शरीर या मरीज को रोकना बीएनएस की धारा 127 के तहत गैरकानूनी बंधक और अपराध है। शव को तुरंत परिजनों को सौंपें; वित्तीय विवाद के लिए अदालत जाएं, शव को बंधक नहीं बना सकते।',
    dos: [
      'Demand immediate release of death certificate and custody of the body in writing.',
      'Call local police to the hospital reception to enforce patient charter compliance.',
      'Offer a signed written dispute letter without surrendering custody rights.'
    ],
    donts: [
      'Do NOT accept that hospitals possess any "lien" or property rights over human remains.',
      'Do NOT sign blank high-interest promissory notes under coercive emotional duress.',
      'Do NOT leave without obtaining an official itemized medical billing breakdown.'
    ],
    tags: ['hospital', 'dead body', 'bills', 'patient rights', 'nhrc', 'confinement', 'extortion'],
    scenarioTag: 'medical-refusal',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Medico-Legal Council',
    isPopular: true,
    isPublished: true
  },

  // 31. Workplace: Mandatory Internal Complaints Committee (ICC)
  {
    id: 'posh-icc-mandatory-committee',
    slug: 'mandatory-internal-complaints-committee-posh',
    title: 'Mandatory Internal Complaints Committee (ICC) & Workplace Anti-Harassment Safeguards',
    title_hi: 'कार्यस्थल पर आंतरिक शिकायत समिति (ICC) का अनिवार्य गठन और पॉश कानून के तहत सुरक्षा',
    category: 'Women, POSH & Domestic Safeguards',
    icon: 'users',
    summary: 'Every workplace with 10 or more employees must mandatorily constitute an Internal Complaints Committee (ICC) presided over by a senior woman employee and an external NGO member. Failure incurs a ₹50,000 fine and cancellation of business license.',
    summary_hi: '10 या अधिक कर्मचारियों वाले हर संस्थान में महिलाओं के यौन उत्पीड़न की रोकथाम के लिए आंतरिक शिकायत समिति (ICC) होना अनिवार्य है। इसकी अध्यक्ष एक वरिष्ठ महिला और एक बाहरी निष्पक्ष एनजीओ सदस्य होना चाहिए। उल्लंघन पर ₹50,000 जुर्माना और लाइसेंस रद्द हो सकता है।',
    statutoryBasis: {
      actName: 'Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013 (POSH Act)',
      shortAct: 'POSH Act, 2013',
      sections: ['Section 4', 'Section 9', 'Section 11', 'Section 26'],
      actUrl: '/laws/POSH',
      landmarkCases: [
        'Vishaka vs. State of Rajasthan (1997 AIR 3011) - Landmark workplace safety guidelines',
        'Aureliano Fernandes vs. State of Goa (Supreme Court 2023) - Mandatory enforcement and nationwide audit of POSH committees'
      ]
    },
    keyProtections: [
      'Statutory Composition: ICC must be chaired by a senior woman, have at least 50% women members, and include an external legal/NGO expert to avoid corporate cover-ups.',
      'Time-Bound Investigation (90 Days): The committee must conclude its formal inquiry within 90 days and submit its report to the employer within 10 days thereafter.',
      'Identity Confidentiality: Section 16 strictly forbids publishing or leaking the name, address, or identity of the complainant or witnesses under statutory penalty.'
    ],
    actionableSteps: [
      'Submit a written complaint to the Presiding Officer of the Internal Committee within 3 months of the incident.',
      'Request interim protection measures under Section 12 (transfer, paid leave, restraint orders against the respondent).',
      'If the employer has not formed an ICC, file a direct complaint with the District Local Complaints Committee (LCC) / District Officer.',
      'Preserve all relevant WhatsApp chats, emails, CCTV footage, and eyewitness statements.'
    ],
    legalRemedy: 'Statutory appeal under Section 18 of the POSH Act before the Industrial Tribunal / High Court; criminal complaint under Section 74/75 BNS.',
    emergencyHelpline: {
      name: 'National Commission for Women (NCW)',
      number: '7827170170',
      description: '24/7 NCW Women Helpline & Workplace Harassment Cell',
      portalUrl: 'https://ncw.nic.in'
    },
    penaltiesForViolation: 'Employer non-compliance incurs a fine of ₹50,000; repeat offenses lead to double fine and revocation of business registration or statutory license.',
    whatToSay: 'Management / HR, under Section 4 of the POSH Act 2013, our organization is legally required to have an active Internal Complaints Committee with an independent external member. A formal complaint under Section 9 must be investigated within 90 days with complete identity protection.',
    whatToSay_hi: 'प्रबंधन / एचआर, पॉश अधिनियम 2013 की धारा 4 के अनुसार हमारे संस्थान में एक स्वतंत्र बाहरी सदस्य वाली आंतरिक शिकायत समिति (ICC) होना अनिवार्य है। मेरी शिकायत की 90 दिनों में निष्पक्ष और गोपनीय जांच की जाए।',
    dos: [
      'Document all incidents with date, time, location, and specific words or actions.',
      'Submit your complaint to the ICC in writing within 3 months of the last incident.',
      'Seek interim relief under Section 12 if you feel threatened or unsafe.'
    ],
    donts: [
      'Do NOT accept informal verbal settlements without written documentation.',
      'Do NOT disclose the proceedings to social media, as Sec 16 mandates strict privacy.',
      'Do NOT tolerate retaliatory poor appraisals or workplace isolation.'
    ],
    tags: ['posh', 'icc', 'sexual harassment', 'workplace', 'women', 'hr', 'corporate'],
    scenarioTag: 'domestic-violence',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Workplace Rights Directorate',
    isPopular: true,
    isPublished: true
  },

  // 32. Workplace: POSH Paid Interim Relief Leave
  {
    id: 'posh-paid-interim-leave',
    slug: 'posh-90-days-paid-interim-leave',
    title: 'Right to 90 Days Paid Interim Relief & Transfer During Workplace Harassment Inquiry',
    title_hi: 'पॉश जांच के दौरान 90 दिनों के सवैतनिक अंतरिम अवकाश (Paid Leave) और स्थानांतरण का अधिकार',
    category: 'Women, POSH & Domestic Safeguards',
    icon: 'calendar',
    summary: 'During the pendency of a workplace harassment inquiry, the aggrieved woman has the statutory right to request up to 3 months of paid leave (in addition to her regular annual leave) or transfer to another branch to prevent intimidation.',
    summary_hi: 'कार्यस्थल उत्पीड़न जांच के दौरान पीड़िता को अपनी सामान्य छुट्टियों के अतिरिक्त 3 महीने (90 दिन) तक की सवैतनिक छुट्टी (Paid Leave) या अन्य विभाग/शाखा में स्थानांतरण मांगने का कानूनी अधिकार है।',
    statutoryBasis: {
      actName: 'POSH Act, 2013',
      shortAct: 'POSH Act 2013 Sec 12',
      sections: ['Section 12', 'Rule 8 POSH Rules 2013'],
      actUrl: '/laws/POSH',
      landmarkCases: [
        'Delhi High Court in Shweta Sharma vs. Union of India (2018) - Right to non-retaliatory interim relief is non-negotiable'
      ]
    },
    keyProtections: [
      'Independent of Existing Leave: The 90 days interim leave granted under Section 12 is in addition to the casual/earned leaves the employee is normally entitled to.',
      'Restraint Against Respondent: The ICC can recommend restraining the respondent from reporting on the work performance of the aggrieved woman or evaluating her appraisal.',
      'Protection from Hostile Retaliation: The employer cannot terminate, demote, or penalize the complainant for exercising interim relief rights.'
    ],
    actionableSteps: [
      'Submit a written request to the Internal Committee specifically invoking Section 12 of the POSH Act, 2013.',
      'Specify the relief requested: 90 days paid leave, transfer of self, or transfer of the respondent to another floor/office.',
      'The ICC must recommend the relief to the employer within reasonable time, and the employer must implement it immediately.'
    ],
    legalRemedy: 'If the employer refuses, file an urgent application before the District Local Complaints Committee (LCC) or writ before the High Court.',
    emergencyHelpline: {
      name: 'Ministry of Women & Child Development SHe-Box',
      number: '011-23386423',
      description: 'Central Electronic Harassment Box portal desk',
      portalUrl: 'https://shebox.wcd.gov.in'
    },
    penaltiesForViolation: 'Employer refusal to enforce Section 12 interim recommendations attracts statutory penalties under Section 26 POSH Act.',
    whatToSay: 'HR / ICC, under Section 12 of the POSH Act 2013, I am formally requesting 90 days of paid interim relief leave / department transfer to ensure a safe, non-retaliatory environment during this ongoing inquiry.',
    whatToSay_hi: 'एचआर और आंतरिक समिति, पॉश कानून की धारा 12 के तहत मैं जांच चलने तक 90 दिनों के सवैतनिक अवकाश (Paid Leave) या अन्य विभाग में स्थानांतरण की मांग करती हूँ, ताकि मैं भयमुक्त रह सकूँ।',
    dos: [
      'Request interim relief in writing with reference to Section 12 of POSH Act.',
      'Ensure the leave is coded as "Statutory Interim POSH Leave", not personal sick leave.',
      'Report any subtle retaliation or hostile cold-shouldering immediately to the ICC.'
    ],
    donts: [
      'Do NOT allow HR to deduct this leave from your earned or casual leave balance.',
      'Do NOT agree to reporting to the accused during the inquiry period.',
      'Do NOT resign under pressure; exercise your statutory rights to interim transfer.'
    ],
    tags: ['posh', 'interim leave', 'paid leave', 'women', 'workplace', 'transfer', 'retaliation'],
    scenarioTag: 'domestic-violence',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Workplace Rights Directorate',
    isPopular: false,
    isPublished: true
  },

  // 33. Cyber: Non-consensual Media & Deepfakes
  {
    id: 'cyber-deepfake-nonconsensual-media',
    slug: 'deepfakes-nonconsensual-morphed-media-rights',
    title: 'Right Against Deepfakes, Morphed Images & Non-Consensual Media',
    title_hi: 'डीपफेक, मॉर्फ्ड फोटो और बिना सहमति की अश्लील सामग्री के खिलाफ 24 घंटे में हटाने का अधिकार',
    category: 'Banking, UPI & Cyber Fraud',
    icon: 'eye-off',
    summary: 'Publishing, transmitting, or creating morphed images, deepfakes, or intimate media of a person without explicit consent is punishable with up to 5 years imprisonment. Social media intermediaries are legally obligated to remove such content within 24 hours of grievance receipt.',
    summary_hi: 'बिना सहमति किसी की मॉर्फ्ड (छेड़छाड़ की गई) फोटो, डीपफेक वीडियो या अंतरंग सामग्री पोस्ट करना 5 साल तक की जेल का अपराध है। सोशल मीडिया कंपनियों को शिकायत मिलने के 24 घंटे के भीतर ऐसी सामग्री हटाना कानूनी रूप से अनिवार्य है।',
    statutoryBasis: {
      actName: 'Information Technology Act, 2000 & IT Intermediary Rules, 2021',
      shortAct: 'IT Act Sec 66E, 67A & Rule 3(2)(b)',
      sections: ['Section 66E', 'Section 67A', 'Rule 3(2)(b) IT Rules 2021', 'Section 77 BNS'],
      actUrl: '/laws/CyberLaw',
      landmarkCases: [
        'Delhi High Court in X vs. Union of India (2021) - Non-consensual deepfakes must be stripped from search engines and hosting platforms within 24 hours globally',
        'Supreme Court in Prajwala vs. Union of India on digital dignity'
      ]
    },
    keyProtections: [
      'Mandatory 24-Hour Takedown Rule: Under Rule 3(2)(b) of the IT Rules 2021, any platform (Instagram, X, WhatsApp, Telegram, etc.) MUST take down morphed or intimate media within 24 hours of receiving notice.',
      'Cognizable Criminal Offense: Violators face 3 to 5 years rigorous imprisonment and ₹5 to ₹10 lakh fines under Sections 66E and 67A IT Act.',
      'Global De-Indexing Mandate: Search engines like Google can be compelled to block image hash signatures across all search mirror servers.'
    ],
    actionableSteps: [
      'Immediately file a formal takedown request with the Resident Grievance Officer (RGO) of the hosting social media platform.',
      'File an emergency cyber complaint on the National Cyber Crime Reporting Portal (cybercrime.gov.in) under "Report Women/Child Related Crime".',
      'Register a hash on "StopNCII.org" (Non-Consensual Intimate Image database) to prevent automated viral re-uploads.',
      'Approach the Cyber Cell police station with URLs and screenshots to register an FIR under Section 66E/67A IT Act.'
    ],
    legalRemedy: 'Emergency take-down petition before the High Court; complaint before the Grievance Appellate Committee (GAC) at gac.gov.in.',
    emergencyHelpline: {
      name: 'National Cyber Crime Helpline',
      number: '1930',
      description: '24/7 National Cyber Security & Harassment Reporting Hub',
      portalUrl: 'https://cybercrime.gov.in'
    },
    penaltiesForViolation: 'Imprisonment up to 5 years and fine up to ₹10 lakh; non-compliant intermediaries lose their Safe Harbour immunity under Section 79 IT Act.',
    whatToSay: 'Grievance Officer / Cyber Police, under Rule 3(2)(b) of the Information Technology Rules, 2021 and Section 66E/67A of the IT Act, you are legally mandated to disable access to this non-consensual morphed media within 24 hours of this complaint.',
    whatToSay_hi: 'शिकायत अधिकारी / साइबर सेल, आईटी नियम 2021 के नियम 3(2)(b) और आईटी एक्ट की धारा 66E/67A के तहत बिना सहमति की मॉर्फ्ड/डीपफेक सामग्री को शिकायत के 24 घंटे के भीतर इंटरनेट से हटाना अनिवार्य है।',
    dos: [
      'Take timestamped screenshots and copy exact URLs before requesting deletion.',
      'Submit the complaint directly to the platform designated Grievance Officer.',
      'Use StopNCII.org to generate an encrypted digital hash of the media to block re-uploads.'
    ],
    donts: [
      'Do NOT pay extortion or blackmail ransom to cyber criminals; they rarely delete media.',
      'Do NOT delete your chat history with the perpetrator; it serves as primary digital evidence.',
      'Do NOT blame yourself; non-consensual morphing is a serious cyber felony.'
    ],
    tags: ['cyber', 'deepfake', 'morphing', 'it act', 'privacy', '1930', 'women', 'takedown'],
    scenarioTag: 'cyber-fraud',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Cyber Law Directorate',
    isPopular: true,
    isPublished: true
  },

  // 34. Cyber / Banking: P2P Account Freeze Contestation
  {
    id: 'p2p-bank-freeze-contestation',
    slug: 'p2p-bank-account-cyber-freeze-contestation',
    title: 'Right to Contest Bank Account Lien & Cyber Freeze for Innocent P2P Transactions',
    title_hi: 'साइबर पुलिस द्वारा निर्दोष बैंक खाते को फ्रीज (लेन-देन पर रोक) करने के खिलाफ अधिकार',
    category: 'Banking, UPI & Cyber Fraud',
    icon: 'lock',
    summary: 'Police cannot freeze an entire bank account when only a fraction of funds is disputed in a cyber fraud chain. Citizens have the right to demand restriction of the lien only to the disputed amount, leaving remaining balances free for normal living expenses.',
    summary_hi: 'साइबर पुलिस पूरे बैंक खाते को सीज नहीं कर सकती यदि विवाद केवल कुछ रुपयों के लेन-देन को लेकर है। नागरिक को यह अधिकार है कि केवल विवादित राशि पर ही होल्ड (Lien) लगे और बाकी के सारे वैध पैसे का उपयोग वह सामान्य रूप से कर सके।',
    statutoryBasis: {
      actName: 'Bharatiya Nagarik Suraksha Sanhita, 2023 & Banking Directives',
      shortAct: 'BNSS 2023 Sec 106 & RBI Directions',
      sections: ['Section 106 BNSS (Old Sec 102 CrPC)', 'Article 300A Constitution'],
      actUrl: '/laws/CyberLaw',
      landmarkCases: [
        'State of Maharashtra vs. Tapas D. Neogy (1999 7 SCC 685) - Bank freeze powers under Section 102 CrPC must strictly target tainted property',
        'Madras High Court in P2P Crypto & Cyber Freeze Batch Petitions (2024) - Freezing entire bank accounts for minor disputed transactions is an arbitrary deprivation of livelihood'
      ]
    },
    keyProtections: [
      'Restriction of Lien to Disputed Amount: If the disputed cyber fraud amount is ₹15,000, the bank and police can ONLY freeze ₹15,000; the remaining ₹3,00,000 cannot be locked.',
      'Mandatory Notice of Seizure: Under Section 106(3) BNSS, police must report the bank freeze to the jurisdictional Magistrate forthwith.',
      'Protection of Livelihood: The High Court has repeatedly held that freezing an entire savings or salary account without hearing the account holder violates the constitutional right to property under Article 300A.'
    ],
    actionableSteps: [
      'Obtain the Cyber Cell Crime Notice / Acknowledgement Number (NCRB 1930 / State Cyber Police station) from your bank branch manager.',
      'Send a formal representation to the Investigating Officer (IO) and Bank Nodal Officer proving bona fide innocent transaction (invoices, trade chat records, bank statements).',
      'Demand in writing that the freeze be restricted exclusively to the disputed quantum.',
      'If the IO is unresponsive, file an application under Section 497/503 BNSS (Old Sec 451/457 CrPC) before the Magistrate to de-freeze the account against an indemnity bond.'
    ],
    legalRemedy: 'Application under Section 497 BNSS before the Magistrate Court; Section 528 BNSS / Article 226 writ before the High Court.',
    emergencyHelpline: {
      name: 'National Cyber Financial Fraud Reporting Desk',
      number: '1930',
      description: 'National helpline for cyber banking freezes and liens',
      portalUrl: 'https://cybercrime.gov.in'
    },
    penaltiesForViolation: 'Arbitrary failure by investigating officers to report seizure to Magistrate makes the freeze order illegal and subject to quashing with costs.',
    whatToSay: 'Branch Manager & Investigating Officer, under Section 106 of BNSS and High Court precedents, police can only place a debit freeze on the specific disputed amount in question, not my entire account. I demand immediate unfreezing of all undisputed balances for my essential livelihood.',
    whatToSay_hi: 'शाखा प्रबंधक और जांच अधिकारी, बीएनएसएस की धारा 106 और उच्च न्यायालय के निर्देशों के अनुसार आप केवल विवादित राशि पर ही रोक लगा सकते हैं, पूरे खाते को फ्रीज नहीं कर सकते। कृपया मेरे शेष वैध पैसे को तुरंत चालू (Unfreeze) करें।',
    dos: [
      'Demand the specific Police Notice Number, Station Name, and disputed transaction ID from your bank.',
      'Collect and organize all transaction receipts, chats, and proof of legitimate sale/trade.',
      'Request the bank in writing to limit the debit restriction strictly to the questioned amount.'
    ],
    donts: [
      'Do NOT panic and try to open fraudulent secondary accounts to siphon funds.',
      'Do NOT ignore the freeze; unresolved cyber notices can result in notice under BNSS Sec 94/179.',
      'Do NOT pay unauthorized middle-men claiming to "clear" police cyber complaints.'
    ],
    tags: ['bank freeze', 'cyber lien', 'p2p', '1930', 'upi fraud', 'bnss 106', 'crypto'],
    scenarioTag: 'banking-freeze',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Cyber & Banking Committee',
    isPopular: true,
    isPublished: true
  },

  // 35. Tenancy: Protection Against Utility Disconnection
  {
    id: 'tenant-utility-disconnection-protection',
    slug: 'protection-against-landlord-utility-disconnection',
    title: 'Absolute Protection Against Landlord Utility Disconnections (Water & Electricity)',
    title_hi: 'मकान मालिक द्वारा बिजली-पानी काटने पर पूर्ण कानूनी रोक का अधिकार',
    category: 'Tenancy & Housing Rights',
    icon: 'zap',
    summary: 'Landlords are strictly prohibited from severing essential municipal amenities (drinking water, electricity, lift, or parking) to force a tenant to vacate, even during an active rent dispute. The Rent Authority can fine the landlord up to ₹50,000 and restore connections immediately.',
    summary_hi: 'मकान मालिक को किराएदार पर दबाव बनाने या मकान खाली कराने के लिए बिजली या पानी जैसी मूलभूत सुविधाएं काटने का कोई अधिकार नहीं है। ऐसा करने पर किराया प्राधिकरण मकान मालिक पर ₹50,000 तक का जुर्माना लगा सकता है और बिजली-पानी तुरंत बहाल करने का आदेश देगा।',
    statutoryBasis: {
      actName: 'Model Tenancy Act & State Rent Control Acts',
      shortAct: 'Model Tenancy Act Sec 20 & TPA',
      sections: ['Section 20 Model Tenancy Act', 'Section 108 Transfer of Property Act', 'Section 126 BNS (Wrongful Restraint)'],
      actUrl: '/laws/Tenancy',
      landmarkCases: [
        'Supreme Court in Babu Lal vs. Raj Kumar (Rent Control Jurisprudence) - Essential amenities cannot be withheld to force ejectment',
        'Delhi High Court in Multiple Tenancy Essential Supply Petitions'
      ]
    },
    keyProtections: [
      'Absolute Bar on Cutting Supplies: A landlord cannot tamper with or disconnect the electric meter, water pump, or municipal pipeline, even if rent is overdue.',
      'Fast-Track Restoration Order: Under Section 20(2) of the Tenancy Act, the Rent Authority can pass an emergency interim order restoring utilities within 24 hours.',
      'Statutory Compensation for Tenant: The Rent Authority can direct the offending landlord to pay financial compensation up to ₹50,000 to the tenant for hardship.'
    ],
    actionableSteps: [
      'Send a written legal notice to the landlord immediately demanding reconnection within 24 hours.',
      'Call 112 or visit the local police station to report illegal wrongful restraint and disconnection under Section 126 BNS.',
      'File an emergency petition before the local Rent Authority / Rent Court under Section 20 of the Tenancy Act.',
      'Show paid electricity/water bills and rent payment receipts to the municipal electricity/water board to request direct temporary restoration.'
    ],
    legalRemedy: 'Urgent application before the Rent Authority under Section 20; Section 126 BNS police complaint; civil injunction suit.',
    emergencyHelpline: {
      name: 'Department of Housing & Urban Affairs Citizen Desk',
      number: '011-23063281',
      description: 'Tenancy and housing grievance portal desk',
      portalUrl: 'https://mohua.gov.in'
    },
    penaltiesForViolation: 'Landlord is liable for statutory fines up to ₹50,000 and criminal prosecution for wrongful restraint under BNS Section 126.',
    whatToSay: 'Landlord, under Section 20 of the Tenancy Act, cutting off my electricity or water supply is a cognizable legal offense. If not restored within 24 hours, I will file an urgent petition before the Rent Authority for restoration with statutory penalties.',
    whatToSay_hi: 'मकान मालिक, किरायेदारी अधिनियम की धारा 20 के तहत किराए के विवाद में भी बिजली या पानी काटना गैरकानूनी और दंडनीय अपराध है। यदि 24 घंटे में आपूर्ति बहाल नहीं हुई तो मैं किराया प्राधिकरण में क्षतिपूर्ति की याचिका दायर करूँगा।',
    dos: [
      'Photograph the tampered meter box and document the exact time of disconnection.',
      'Send a formal WhatsApp notice and registered speed post notice immediately.',
      'Continue offering the rent via bank transfer / UPI to prove you are a lawful tenant.'
    ],
    donts: [
      'Do NOT tamper with the high-voltage municipal meter yourself.',
      'Do NOT vacate the house in panic without obtaining a formal court order or legal advice.',
      'Do NOT stop paying basic rent, as it weakens your tenancy locus standi.'
    ],
    tags: ['tenant', 'landlord', 'electricity cut', 'water disconnection', 'rent control', 'eviction'],
    scenarioTag: 'landlord-eviction',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Tenancy & Real Estate Council',
    isPopular: true,
    isPublished: true
  },

  // 36. Tenancy: 30-Day Security Deposit Refund Timeline
  {
    id: 'tenant-security-deposit-refund-timeline',
    slug: 'mandatory-30-day-security-deposit-refund',
    title: 'Mandatory 30-Day Security Deposit Refund & Deduction Safeguards',
    title_hi: 'मकान खाली करने के 30 दिनों में सुरक्षा राशि (Security Deposit) वापसी का अधिकार',
    category: 'Tenancy & Housing Rights',
    icon: 'credit-card',
    summary: 'Landlords must refund the security deposit to the tenant within 30 days of vacating the premises. Deductions can only be made for actual documented structural damages beyond normal wear and tear, accompanied by GST repair invoices.',
    summary_hi: 'मकान खाली करने के 30 दिनों के भीतर मकान मालिक को पूरी सिक्योरिटी राशि लौटानी होगी। मकान मालिक सामान्य टूट-फूट या रंगाई-पुताई के नाम पर मनमानी कटौती नहीं कर सकता। किसी भी कटौती के लिए पक्का बिल देना अनिवार्य है।',
    statutoryBasis: {
      actName: 'Model Tenancy Act, 2021 & Indian Contract Act, 1872',
      shortAct: 'Model Tenancy Act Sec 11',
      sections: ['Section 11 Model Tenancy Act', 'Section 73 Indian Contract Act, 1872'],
      actUrl: '/laws/Tenancy',
      landmarkCases: [
        'Delhi High Court in Tenancy Deposit Disputes - Normal wear and tear is the owner responsibility and cannot be deducted from deposits',
        'Karnataka High Court on arbitrary rental deductions'
      ]
    },
    keyProtections: [
      'Strict 30-Day Refund Deadline: Section 11 mandates that the landlord must return the balance security deposit within 30 days of the tenant handing over vacant possession.',
      'Normal Wear & Tear Protected: Landlords cannot deduct deposit money for routine wall scuffs, natural paint fading, or ordinary age-related plumbing wear.',
      'Itemized Repair Invoices Mandatory: Any legitimate deduction for actual tenant-inflicted damage must be supported by official third-party invoices and receipts.'
    ],
    actionableSteps: [
      'Conduct a joint walk-through inspection with the landlord on the move-out day and film a high-definition video of the clean apartment.',
      'Hand over keys and obtain a signed handover acknowledgement memo.',
      'If the deposit is withheld after 30 days, issue a formal statutory demand notice citing Section 11 of the Model Tenancy Act.',
      'File a claim before the Rent Authority or Consumer Commission claiming the deposit amount plus 18% annual interest for wrongful retention.'
    ],
    legalRemedy: 'Petition before the Rent Authority; Summary recovery suit under Order 37 CPC; Consumer Forum complaint for deficiency in service.',
    emergencyHelpline: {
      name: 'National Consumer Helpline',
      number: '1915',
      description: 'National citizen consumer complaint desk',
      portalUrl: 'https://consumerhelpline.gov.in'
    },
    penaltiesForViolation: 'Wrongful withholding of deposit attracts interest penalties up to 18% p.a. alongside litigation costs awarded to the tenant.',
    whatToSay: 'Landlord, under Section 11 of the Tenancy Act, my security deposit must be refunded within 30 days of handover. Deductions cannot be made for normal wear and tear, and you must provide verified GST invoices for any alleged repairs.',
    whatToSay_hi: 'मकान मालिक, किरायेदारी अधिनियम की धारा 11 के तहत मकान खाली करने के 30 दिनों के भीतर पूरी सुरक्षा राशि (Security Deposit) लौटाना अनिवार्य है। सामान्य टूट-फूट पर कटौती नहीं की जा सकती और हर कटौती का पक्का जीएसटी बिल देना होगा।',
    dos: [
      'Shoot a comprehensive walk-through video of the property right before handing over the keys.',
      'Get the landlord to sign a handover note confirming possession returned in good condition.',
      'Send account bank details in writing for electronic deposit transfer.'
    ],
    donts: [
      'Do NOT surrender all physical keys without an acknowledgement of move-out date.',
      'Do NOT accept arbitrary lump-sum verbal deductions without itemized bills.',
      'Do NOT delay issuing a legal notice if the 30-day timeline lapses.'
    ],
    tags: ['security deposit', 'rent refund', 'tenant', 'landlord', 'wear and tear', 'housing'],
    scenarioTag: 'landlord-eviction',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Tenancy & Housing Council',
    isPopular: true,
    isPublished: true
  },

  // 37. Animal Welfare: Stray Dog Feeding & Caregiver Protection
  {
    id: 'stray-dog-feeding-awbi-protections',
    slug: 'stray-dog-feeding-rwa-harassment-protection',
    title: 'Right to Feed Community Animals & Protection Against RWA Intimidation',
    title_hi: 'बेजुबान जानवरों को खाना खिलाने का संवैधानिक अधिकार और आरडब्ल्यूए उत्पीड़न के खिलाफ सुरक्षा',
    category: 'Constitutional & Civil Liberties',
    icon: 'heart',
    summary: 'Citizens have a constitutional duty and legal right to feed community street dogs in designated areas. Resident Welfare Associations (RWAs) or local societies cannot impose fines, threaten caregivers, or relocate street animals.',
    summary_hi: 'संविधान के अनुच्छेद 51A(g) के अनुसार स्ट्रीट डॉग्स (आवारा कुत्तों) को खाना खिलाना हर नागरिक का संवैधानिक अधिकार और कर्तव्य है। कोई भी आरडब्ल्यूए या सोसायटी खाना खिलाने वालों पर जुर्माना नहीं लगा सकती और न ही कुत्तों को वहां से हटा सकती है।',
    statutoryBasis: {
      actName: 'Prevention of Cruelty to Animals Act, 1960 & Animal Birth Control Rules, 2023',
      shortAct: 'Art 51A(g) & ABC Rules 2023',
      sections: ['Article 51A(g) Constitution', 'Rule 20 ABC Rules 2023', 'Section 11 PCA Act 1960'],
      actUrl: '/laws/AnimalWelfare',
      landmarkCases: [
        'Supreme Court in Animal Welfare Board of India (AWBI) vs. People for Elimination of Stray Troubles (2021) - Relocation of community dogs is illegal',
        'Delhi High Court in Dr. Maya D. Chablani vs. Radha Mittal (2021) - Every animal has inherent dignity and citizens feeding them perform a compassionate public service'
      ]
    },
    keyProtections: [
      'No Arbitrary RWA Fines: Resident societies have zero legal authority to pass resolutions imposing fines, boycotts, or bans on dog feeders.',
      'Prohibition on Relocation: Street dogs cannot be captured and dumped in another neighborhood; they must be vaccinated, sterilized, and returned to their original territory.',
      'Protection of Animal Caregivers: Threatening or intimidating animal caregivers constitutes criminal intimidation under Section 351 BNS (Old Sec 506 IPC).'
    ],
    actionableSteps: [
      'Feed dogs at designated, hygienic community feeding spots during low-footfall hours.',
      'Show the AWBI circular and Rule 20 of the ABC Rules 2023 to the RWA committee.',
      'If society members harass or physically intimidate you, immediately dial 112 and file a police complaint under Section 351/352 BNS and Section 11 PCA Act.',
      'Notify the local Animal Welfare Board representative or SPCA (Society for the Prevention of Cruelty to Animals).'
    ],
    legalRemedy: 'Criminal complaint for criminal intimidation under Section 351 BNS; writ petition before the High Court; complaint to the Animal Welfare Board of India.',
    emergencyHelpline: {
      name: 'Animal Welfare Board of India (AWBI)',
      number: '0129-2555700',
      description: 'Statutory body under Ministry of Fisheries, Animal Husbandry & Dairying',
      portalUrl: 'http://awbi.gov.in'
    },
    penaltiesForViolation: 'Cruelty to animals and harassment of feeders attracts fines and imprisonment under PCA Act Section 11 and BNS Section 325.',
    whatToSay: 'RWA Committee, under Article 51A(g) of the Constitution and Rule 20 of the ABC Rules 2023 affirmed by the Supreme Court, caring for and feeding community animals is a protected constitutional right. Imposing illegal fines or intimidating feeders attracts criminal prosecution under the law.',
    whatToSay_hi: 'आरडब्ल्यूए प्रबंधन, संविधान के अनुच्छेद 51A(g) और पशु जन्म नियंत्रण नियम 2023 के तहत बेजुबान जानवरों को खाना खिलाना हर नागरिक का संवैधानिक कर्तव्य है। खाना खिलाने वालों पर जुर्माना लगाना या धमकाना कानूनी अपराध है।',
    dos: [
      'Feed community dogs in fixed, designated clean spots away from children play areas.',
      'Coordinate with local municipal authorities for ABC (sterilization and anti-rabies vaccination).',
      'Keep copies of the AWBI guidelines and Supreme Court ruling handy.'
    ],
    donts: [
      'Do NOT allow food waste or dirty bowls to litter public walkways.',
      'Do NOT engage in violent verbal shouting matches with aggressive residents; record proof calmly.',
      'Do NOT relocate healthy community dogs outside their natural geographical territory.'
    ],
    tags: ['animal rights', 'stray dogs', 'rwa', 'feeding', 'awbi', 'cruelty to animals', 'pets'],
    scenarioTag: 'domestic-violence',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Civic & Animal Rights Directorate',
    isPopular: false,
    isPublished: true
  },

  // 38. Aviation: DGCA Flight Delay & Cancellation Cash Compensation
  {
    id: 'dgca-flight-delay-cancellation-compensation',
    slug: 'dgca-flight-delay-cancellation-cash-compensation',
    title: 'DGCA Passenger Charter: Cash Compensation & Amenities for Delayed or Cancelled Flights',
    title_hi: 'डीजीसीए पैसेंजर चार्टर: फ्लाइट लेट या कैंसिल होने पर मुफ्त भोजन, होटल व नकद मुआवजे का अधिकार',
    category: 'Aviation & Passenger Charters',
    icon: 'send',
    summary: 'If a flight is delayed by over 2 hours, airlines must provide free meals and refreshments. For cancellations communicated within 24 hours or delays over 6 hours at night, airlines must provide free hotel accommodation or statutory cash compensation up to ₹10,000–₹20,000.',
    summary_hi: 'यदि आपकी उड़ान 2 घंटे से अधिक लेट होती है, तो एयरलाइन को मुफ्त भोजन और नाश्ता देना होगा। यदि फ्लाइट 6 घंटे से अधिक लेट या कैंसिल होती है, तो मुफ्त होटल आवास या ₹10,000 से ₹20,000 तक नकद मुआवजा पाने का कानूनी अधिकार है।',
    statutoryBasis: {
      actName: 'Directorate General of Civil Aviation (DGCA) Civil Aviation Requirements (CAR)',
      shortAct: 'DGCA CAR Section 3 Series M Part IV',
      sections: ['CAR Section 3, Series M, Part IV', 'Consumer Protection Act, 2019'],
      actUrl: '/laws/Aviation',
      landmarkCases: [
        'National Consumer Commission in Multiple Airline Compensation Orders - Technical glitch is not an "extraordinary circumstance" exempting compensation',
        'Delhi High Court Directives on Passenger Charter Compliance'
      ]
    },
    keyProtections: [
      'Mandatory Meals & Refreshments: For flight delays exceeding 2 hours (flights block time < 2.5 hrs) or 3 hours (flights 2.5 to 5 hrs), airlines must provide complimentary meals/refreshments.',
      'Free Hotel Accommodation: If a domestic flight is delayed by more than 6 hours between 8:00 PM and 3:00 AM, the airline must provide free hotel accommodation and ground airport transfers.',
      'Cash Compensation for Cancellations: If a passenger is informed of cancellation less than 24 hours prior or misses a connecting flight due to airline fault, statutory compensation of up to ₹5,000 to ₹10,000 (or ticket price) is payable.'
    ],
    actionableSteps: [
      'Approach the Airline Duty Manager counter at the airport terminal and cite DGCA CAR Section 3, Series M, Part IV.',
      'Demand immediate meal vouchers or hotel booking confirmation for eligible delays.',
      'If compensation is refused, file a complaint on the AirSewa Portal (airsewa.gov.in) with your PNR number and boarding pass.',
      'File a claim on the National E-Daakhil consumer portal for deficiency in service and statutory compensation.'
    ],
    legalRemedy: 'Complaint before the DGCA AirSewa Portal; District Consumer Disputes Redressal Commission.',
    emergencyHelpline: {
      name: 'AirSewa Aviation Grievance Desk',
      number: '1800-180-1408',
      description: 'Ministry of Civil Aviation 24/7 Passenger Support',
      portalUrl: 'https://airsewa.gov.in'
    },
    penaltiesForViolation: 'Airlines violating DGCA CAR regulations face heavy monetary regulatory fines and suspension of operating schedules.',
    whatToSay: 'Airline Duty Manager, under DGCA Passenger Charter CAR Section 3 Series M Part IV, as my flight has been delayed beyond the statutory threshold, you are legally obligated to provide immediate complimentary refreshments/hotel accommodation or alternative routing without surcharge.',
    whatToSay_hi: 'एयरलाइन ड्यूटी मैनेजर, डीजीसीए पैसेंजर चार्टर (CAR Section 3) के अनुसार, मेरी उड़ान निर्धारित समय से अधिक लेट हो चुकी है। आप नियमानुसार मुफ्त भोजन, जलपान और होटल आवास या मुआवजा प्रदान करने के लिए बाध्य हैं।',
    dos: [
      'Preserve your physical or digital boarding pass and all airport departure screen photos.',
      'Obtain a written delay certificate or stamp from the airline ground supervisor.',
      'File your AirSewa grievance within 30 days of the travel date.'
    ],
    donts: [
      'Do NOT accept arbitrary airline blame citing "ATC delay" when other flights are departing normally.',
      'Do NOT leave the airport without demanding your statutory meal or accommodation vouchers.',
      'Do NOT accept airline credit vouchers with restrictive short expiry dates if you prefer a cash bank refund.'
    ],
    tags: ['flight delay', 'airline', 'cancellation', 'dgca', 'airsewa', 'compensation', 'hotel'],
    scenarioTag: 'consumer-refund',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Aviation & Passenger Charter Council',
    isPopular: true,
    isPublished: true
  },

  // 39. Senior Citizens: Revocation of Property Gift Deed for Neglect
  {
    id: 'senior-citizens-gift-deed-revocation',
    slug: 'senior-citizens-property-gift-deed-revocation-neglect',
    title: 'Elderly Parents Right to Revoke Property Gift Deeds for Neglect or Abandonment',
    title_hi: 'वरिष्ठ नागरिक माता-पिता द्वारा उपेक्षा पर बच्चों को दी गई संपत्ति की रजिस्ट्री रद्द कराने का अधिकार',
    category: 'Senior Citizens & Maintenance',
    icon: 'user-check',
    summary: 'If an elderly parent transfers property to their children on the condition that they provide basic physical amenities, and the children neglect them, the Maintenance Tribunal has statutory power under Section 23 to declare the transfer deed void as fraudulent.',
    summary_hi: 'यदि किसी बुजुर्ग माता-पिता ने अपनी संपत्ति बच्चों के नाम की है और बच्चे बाद में उनकी देखभाल, भोजन या दवाइयों की उपेक्षा करते हैं, तो भरण-पोषण ट्रिब्यूनल (SDM कोर्ट) धारा 23 के तहत उस संपत्ति की रजिस्ट्री को रद्द कर माता-पिता को वापस दिला सकता है।',
    statutoryBasis: {
      actName: 'Maintenance and Welfare of Parents and Senior Citizens Act, 2007',
      shortAct: 'Senior Citizens Act 2007 Sec 23',
      sections: ['Section 23', 'Section 4', 'Section 5', 'Section 9'],
      actUrl: '/laws/SeniorCitizens',
      landmarkCases: [
        'Supreme Court in S. Vanitha vs. Deputy Commissioner (2020) - Maintenance Act provides overriding protection to senior citizens against dispossession',
        'Kerala High Court in Sunny Cherian vs. State of Kerala (Affirmation of Section 23 voidance powers)'
      ]
    },
    keyProtections: [
      'Statutory Voidance of Gift Deeds: Section 23 explicitly states that any transfer of property subject to condition of care shall be deemed to have been made by fraud or coercion if the child fails to provide basic needs.',
      'Eviction of Abusive Children: Senior citizen parents can seek eviction of abusive adult children or relatives from their self-acquired or ancestral residential house.',
      'Fast-Track Summary Inquiry: The Maintenance Tribunal (headed by Sub-Divisional Magistrate / SDM) must conclude proceedings within 90 days.'
    ],
    actionableSteps: [
      'File an application before the Sub-Divisional Magistrate (SDM) / Maintenance Tribunal under Section 23 of the Senior Citizens Act, 2007.',
      'Attach copy of the registered gift deed / transfer deed and describe the failure to provide food, medical care, or emotional shelter.',
      'Request both: (a) Cancellation of the transfer deed and restoration of title; and (b) Monthly maintenance allowance under Section 9 (up to ₹10,000/month).',
      'The SDM tribunal issues summons and conducts a summary trial without requiring expensive advocates.'
    ],
    legalRemedy: 'Application before the Sub-Divisional Magistrate (SDM) Maintenance Tribunal; appeal before the District Magistrate (Appellate Tribunal).',
    emergencyHelpline: {
      name: 'National Elder Line',
      number: '14567',
      description: 'Ministry of Social Justice 24/7 Senior Citizen Toll-Free Helpline',
      portalUrl: 'https://socialjustice.gov.in'
    },
    penaltiesForViolation: 'Abandonment of senior citizen parent is punishable with imprisonment up to 3 months and fines under Section 24.',
    whatToSay: 'Under Section 23 of the Maintenance and Welfare of Parents and Senior Citizens Act, 2007, any property transferred to children becomes void if they fail to provide medical care, food, and emotional support. The Sub-Divisional Magistrate Tribunal will cancel the deed and restore possession.',
    whatToSay_hi: 'माता-पिता और वरिष्ठ नागरिक भरण-पोषण अधिनियम 2007 की धारा 23 के तहत, यदि संतान माता-पिता की देखभाल और दवा का ध्यान नहीं रखती, तो एसडीएम ट्रिब्यूनल गिफ्ट की गई संपत्ति की रजिस्ट्री को रद्द कर संपत्ति वापस दिला सकता है।',
    dos: [
      'Keep copies of the original sale deed, gift deed, and medical treatment expense receipts.',
      'Approach the local SDM (Sub-Divisional Magistrate) office directly or dial 14567 for free government aid.',
      'Seek an interim order preventing the children from selling or creating third-party rights on the property.'
    ],
    donts: [
      'Do NOT feel helpless or accept physical/verbal abuse in your own home.',
      'Do NOT get bogged down in endless civil court suits; the Senior Citizens Tribunal is specifically fast-tracked.',
      'Do NOT sign power of attorney papers or blank papers under emotional duress.'
    ],
    tags: ['senior citizens', 'gift deed', 'parents', 'maintenance', 'eviction', '14567', 'sdm'],
    scenarioTag: 'domestic-violence',
    verifiedDate: '2026-08-15',
    verifiedBy: 'LegalConnect Senior Citizens Welfare Council',
    isPopular: true,
    isPublished: true
  }
];