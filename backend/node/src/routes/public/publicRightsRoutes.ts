import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

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
  };
  keyProtections: string[];
  actionableSteps: string[];
  legalRemedy: string;
  emergencyHelpline?: {
    name: string;
    number: string;
    description: string;
  };
  penaltiesForViolation?: string;
  frequentlyAskedQuestions?: Array<{ question: string; answer: string }>;
  verifiedDate: string;
  isPopular?: boolean;
}

export const citizenRightsCatalog: StatutoryRightItem[] = [
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
      sections: ['Article 14', 'Article 19', 'Article 21', 'Article 32'],
      actUrl: '/laws/Constitution'
    },
    keyProtections: [
      'Inherent right to live with human dignity and clean environment (Francis Coralie Mullin vs. UT of Delhi).',
      'Fundamental right to informational privacy and bodily autonomy (K.S. Puttaswamy vs. Union of India).',
      'Right to speedy trial and protection against custodial torture or unauthorized solitary confinement.',
      'Right to seek immediate habeas corpus remedy directly before the Supreme Court under Article 32 or High Courts under Article 226.'
    ],
    actionableSteps: [
      'If unlawfully detained, family members can immediately instruct an advocate to file a Writ Petition of Habeas Corpus.',
      'Invoke Article 226 in the jurisdictional High Court for immediate relief against arbitrary executive orders.',
      'Contact the National Legal Services Authority (NALSA) if unable to afford private constitutional legal representation.'
    ],
    legalRemedy: 'Direct constitutional Writ Petition (Habeas Corpus, Mandamus, Certiorari) under Article 32 (Supreme Court) or Article 226 (High Court).',
    emergencyHelpline: {
      name: 'NALSA Legal Aid Helpline',
      number: '15100',
      description: '24x7 Free Legal Aid for Undertrials and Indigent Citizens across India'
    },
    penaltiesForViolation: 'Supreme Court and High Courts can award monetary compensation against the State and initiate departmental contempt proceedings.',
    frequentlyAskedQuestions: [
      {
        question: 'Can the Right to Life under Article 21 ever be suspended during an Emergency?',
        answer: 'No. Following the 44th Constitutional Amendment Act 1978, the enforcement of Article 20 and Article 21 can never be suspended, even during a proclamation of National Emergency.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: true
  },
  {
    id: 'arrest-detainment-safeguards',
    slug: 'safeguards-against-arbitrary-arrest',
    title: 'Arrestee Safeguards & Police Detainment Rules',
    category: 'Police & Criminal Justice',
    icon: 'shield',
    summary: 'Statutory protections governing the arrest of any person by law enforcement, codifying the historic D.K. Basu guidelines into modern procedural law.',
    statutoryBasis: {
      actName: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023',
      shortAct: 'BNSS',
      sections: ['Section 35', 'Section 47', 'Section 48', 'Section 50', 'Section 51'],
      actUrl: '/laws/BNSS'
    },
    keyProtections: [
      'Police officers must display clear, visible name identification with designations at all times during arrest and interrogation.',
      'A formal Arrest Memo must be prepared at the time of arrest, witnessed by at least one family member or respectable neighborhood citizen.',
      'The arrestee has the absolute statutory right to inform one relative or friend of their arrest and whereabouts within 1 hour.',
      'Mandatory production before the nearest Judicial Magistrate within 24 hours of arrest (excluding journey time) is non-negotiable under BNSS Section 58 and Article 22(2).',
      'Special Women Protection: No woman can be arrested after sunset and before sunrise without prior written permission from the Judicial Magistrate First Class.'
    ],
    actionableSteps: [
      'Politely ask the arresting officer for their identification and request a copy of the formal Arrest Memo.',
      'Refuse to sign blank sheets of paper or coercive statements without an advocate present.',
      'Demand an immediate medical examination under BNSS Section 53 to document any existing injuries.',
      'Ensure family members contact an advocate or local Legal Services Authority (DLSA) within the first 12 hours.'
    ],
    legalRemedy: 'Filing of immediate regular or anticipatory bail before the Judicial Magistrate or Sessions Court under BNSS Section 480 / 482.',
    emergencyHelpline: {
      name: 'National Emergency Response System',
      number: '112',
      description: 'Immediate all-India police, fire, and emergency medical assistance'
    },
    penaltiesForViolation: 'Police officers violating arrest guidelines face departmental inquiry, suspension, and prosecution under BNS Section 198 (Public servant disobeying law).',
    frequentlyAskedQuestions: [
      {
        question: 'What happens if the police do not present the arrestee before a magistrate within 24 hours?',
        answer: 'The detention becomes illegal and unconstitutional. An advocate can immediately approach the High Court for a Writ of Habeas Corpus to secure the arrestee’s unconditional release and seek custodial compensation.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: true
  },
  {
    id: 'consumer-protection-rights',
    slug: 'consumer-rights-redressal-cpa-2019',
    title: 'Consumer Rights & Deficient Service Redressal',
    category: 'Consumer Protection',
    icon: 'shield-check',
    summary: 'Comprehensive rights protecting consumers from adulterated goods, misleading advertisements, insurance repudiation, defective products, and predatory business practices.',
    statutoryBasis: {
      actName: 'Consumer Protection Act, 2019',
      shortAct: 'CPA 2019',
      sections: ['Section 2(9)', 'Section 35', 'Section 38', 'Section 84'],
      actUrl: '/laws/CPA'
    },
    keyProtections: [
      'Right to safety against goods and services that are hazardous to life and property.',
      'Right to be informed about the quality, quantity, potency, purity, standard, and price of goods or services.',
      'Right to seek redressal against unfair trade practices, restrictive trade practices, or unscrupulous exploitation.',
      'Strict Product Liability: Manufacturers, service providers, and product sellers are directly liable for compensating harm caused by defective products.',
      'E-Commerce Protection: Online platforms are prohibited from arbitrary cancellation fees or manipulation of product pricing.'
    ],
    actionableSteps: [
      'Preserve the original purchase invoice, warranty card, payment receipts, and written correspondence with the seller.',
      'Send a formal legal notice giving the merchant 15 days to replace the defective item or refund the consideration.',
      'Lodge a free complaint online on the INGRAM National Consumer Helpline portal (consumerhelpline.gov.in).',
      'File an e-complaint on the E-Daakhil portal before the District Consumer Disputes Redressal Commission without needing an advocate.'
    ],
    legalRemedy: 'Filing of complaint before District Consumer Commission (claims up to ₹50 Lakh) or State Commission (₹50 Lakh to ₹2 Crore) under Section 35.',
    emergencyHelpline: {
      name: 'National Consumer Helpline (NCH)',
      number: '1915',
      description: 'Ministry of Consumer Affairs grievance desk for fast-track dispute conciliation'
    },
    penaltiesForViolation: 'Imprisonment up to 3 years and fines up to ₹1 Lakh for failure to comply with Consumer Commission orders (Section 72).',
    frequentlyAskedQuestions: [
      {
        question: 'Do I need to hire a lawyer to file a case in the Consumer Forum?',
        answer: 'No. The Consumer Protection Act allows consumers to argue their own complaints in person or through a representative without mandatory advocate representation.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: true
  },
  {
    id: 'tenant-renter-protections',
    slug: 'tenant-protections-rent-control',
    title: 'Tenant Rights Against Unlawful Eviction',
    category: 'Housing & Tenancy',
    icon: 'home',
    summary: 'Statutory protections safeguarding residential and commercial tenants against coercive lockouts, arbitrary rent hikes, and summary eviction.',
    statutoryBasis: {
      actName: 'Transfer of Property Act 1882 & Model Tenancy Act',
      shortAct: 'TPA',
      sections: ['Section 106', 'Section 108', 'Model Tenancy Act Provisions'],
      actUrl: '/laws/TPA'
    },
    keyProtections: [
      'Landlords cannot forcibly evict a tenant or change door locks without a formal decree from the Rent Court or Civil Court.',
      'A minimum statutory 30-day written notice must be served to terminate month-to-month leases under Section 106 of the Transfer of Property Act.',
      'Landlords are strictly prohibited from severing essential municipal utilities (electricity, drinking water, lift access) during rent disputes.',
      'Security deposits for residential tenancies are capped at a maximum of two months rent under the Model Tenancy Act framework.'
    ],
    actionableSteps: [
      'Always execute a registered or notarized Lease and License agreement detailing security deposit terms and notice periods.',
      'Retain digital receipts or bank transfer statements for all monthly rental payments.',
      'If a landlord disconnects utilities or threatens unlawful eviction, immediately lodge a police station diary complaint.',
      'Approach the local Rent Authority or Civil Court for an interim injunction restraining dispossession.'
    ],
    legalRemedy: 'Suit for Permanent Injunction against unlawful dispossession and petition for mandatory restoration of essential utility amenities.',
    emergencyHelpline: {
      name: 'State Rent Authority & DLSA Desk',
      number: '15100',
      description: 'Free legal advice on tenancy disputes and arbitrary landlord harassment'
    },
    penaltiesForViolation: 'Landlords cutting essential services face heavy daily penalties from the Rent Court and liability for criminal intimidation under BNS Section 351.',
    frequentlyAskedQuestions: [
      {
        question: 'Can my landlord enter my rented home without informing me?',
        answer: 'No. Under the Model Tenancy Act, a landlord must provide at least 24 hours advance written notice (electronic or physical) before entering premises for inspection.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: true
  },
  {
    id: 'domestic-violence-protection',
    slug: 'domestic-violence-safeguards-pwdva',
    title: 'Women’s Rights Against Domestic Violence (PWDVA)',
    category: 'Women & Family Safety',
    icon: 'heart',
    summary: 'Comprehensive civil and quasi-criminal protection for women against domestic abuse, emotional harassment, sexual cruelty, and financial deprivation.',
    statutoryBasis: {
      actName: 'Protection of Women from Domestic Violence Act, 2005',
      shortAct: 'PWDVA',
      sections: ['Section 12', 'Section 17', 'Section 18', 'Section 19', 'Section 20'],
      actUrl: '/laws/PWDVA'
    },
    keyProtections: [
      'Right to reside in the shared household regardless of whether the woman holds title ownership or tenant rights (Section 17).',
      'Protection Orders: Immediate court orders restraining the abuser from entering the woman’s residence, workplace, or contacting her.',
      'Monetary Relief: Right to claim emergency monthly maintenance, medical expenses, and loss of earnings caused by violence.',
      'Temporary custody of children to prevent coercive separation by abusive partners.',
      'Right to free legal aid through the District Legal Services Authority (DLSA) and support from statutory Protection Officers.'
    ],
    actionableSteps: [
      'Dial Women Helpline 1091 or 112 if in immediate physical danger.',
      'Seek medical care at a government hospital and preserve medical examination records detailing injuries.',
      'Approach a local Protection Officer, service provider NGO, or Magistrate to file a Domestic Incident Report (DIR).',
      'File an application under Section 12 of PWDVA for immediate interim ex-parte protection and maintenance orders.'
    ],
    legalRemedy: 'Filing petition under Section 12 PWDVA before the Metropolitan Magistrate or Judicial Magistrate First Class.',
    emergencyHelpline: {
      name: 'National Women Helpline',
      number: '1091',
      description: '24x7 toll-free emergency response for women facing domestic or public harassment'
    },
    penaltiesForViolation: 'Breach of a Protection Order is a cognizable and non-bailable offense punishable by up to 1 year imprisonment and ₹20,000 fine (Section 31).',
    frequentlyAskedQuestions: [
      {
        question: 'Can in-laws evict a daughter-in-law from a house owned solely by them?',
        answer: 'The Supreme Court in Satish Chander Ahuja vs. Sneha Ahuja held that a woman has the statutory right of residence in the shared household even if owned by father-in-law or mother-in-law, until alternative accommodation is provided.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: true
  },
  {
    id: 'digital-data-privacy-dpdp',
    slug: 'data-principal-rights-dpdp-2023',
    title: 'Citizen Data Privacy & Digital Rights (DPDP Act)',
    category: 'Digital Privacy & Technology',
    icon: 'lock',
    summary: 'Codifies statutory control for Indian citizens over their personal data processed by technology corporations, banks, and digital intermediaries.',
    statutoryBasis: {
      actName: 'Digital Personal Data Protection Act, 2023',
      shortAct: 'DPDP Act',
      sections: ['Section 6', 'Section 11', 'Section 12', 'Section 13', 'Section 14'],
      actUrl: '/laws/DPDP'
    },
    keyProtections: [
      'Right to access a summary of personal data being processed and the identities of third parties with whom it has been shared.',
      'Right to correction, completion, and updating of inaccurate or misleading personal records.',
      'Right to erasure of personal data once the specified purpose of collection is completed.',
      'Right to readily accessible grievance redressal provided by the Data Fiduciary within prescribed timeframes.',
      'Right to nominate an individual to exercise data rights in the event of death or physical incapacity.'
    ],
    actionableSteps: [
      'Review the Privacy Notice presented by platforms before clicking consent checkboxes.',
      'Submit a formal Data Subject Request to the Data Protection Officer (DPO) of the service provider.',
      'If the enterprise fails to address the request within statutory SLA, escalate the complaint to the Data Protection Board of India (DPBI).'
    ],
    legalRemedy: 'Formal complaint before the Data Protection Board of India (DPBI) and appellate remedies before TDSAT.',
    emergencyHelpline: {
      name: 'LegalConnect Grievance & DPO Desk',
      number: '1800-LC-DPDP',
      description: 'Statutory compliance grievance desk for data principal rights exercise'
    },
    penaltiesForViolation: 'Data Fiduciaries face financial penalties up to ₹250 Crore for failure to observe data security safeguards and up to ₹200 Crore for failure to notify data breaches.',
    frequentlyAskedQuestions: [
      {
        question: 'Can I withdraw my consent from an application after giving it?',
        answer: 'Yes. Section 6(4) of the DPDP Act provides that a Data Principal has the right to withdraw consent at any time with the same ease with which it was given.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: true
  },
  {
    id: 'right-to-information-transparency',
    slug: 'citizen-transparency-rti-act',
    title: 'Right to Information & Public Accountability',
    category: 'Transparency & Governance',
    icon: 'info',
    summary: 'Empowers any citizen to inspect public records, examine infrastructure works, and secure certified copies of government files to combat corruption.',
    statutoryBasis: {
      actName: 'Right to Information Act, 2005',
      shortAct: 'RTI Act',
      sections: ['Section 6', 'Section 7', 'Section 19', 'Section 20'],
      actUrl: '/laws/RTI'
    },
    keyProtections: [
      'Every citizen has the statutory right to request information, inspect works, documents, and records of any public authority.',
      'Strict 30-day timeline: The Public Information Officer (PIO) must provide requested information within 30 days of application receipt.',
      'Life and Liberty Emergency: If the requested information concerns the life or liberty of a citizen, it must be provided within 48 hours.',
      'Nominal Application Fee: Central government requests cost just ₹10, and citizens below the poverty line (BPL) are exempt from all fees.'
    ],
    actionableSteps: [
      'Draft a clear, concise question addressed to the Central Public Information Officer (CPIO) of the relevant ministry.',
      'File the application online via the rtionline.gov.in portal or submit physically with a ₹10 postal order.',
      'If no response is received within 30 days or info is falsely denied, file a First Appeal to the First Appellate Authority within 30 days.',
      'If the First Appeal is unsatisfied, file a Second Appeal before the Central Information Commission (CIC).'
    ],
    legalRemedy: 'First Appeal under Section 19(1) and Second Appeal before the Central/State Information Commission under Section 19(3).',
    emergencyHelpline: {
      name: 'RTI Online Support Helpline',
      number: '011-24622690',
      description: 'Department of Personnel and Training (DoPT) RTI portal assistance'
    },
    penaltiesForViolation: 'The Information Commission can levy a mandatory penalty of ₹250 per day up to ₹25,000 on the PIO for unreasonable delays or false refusals.',
    frequentlyAskedQuestions: [
      {
        question: 'Do I have to state the reason why I am requesting the information in my RTI application?',
        answer: 'No. Section 6(2) explicitly states that an applicant is not required to give any reason for requesting the information or any other personal details except those necessary for contacting them.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: false
  },
  {
    id: 'cyber-fraud-banking-protection',
    slug: 'unauthorized-banking-transaction-remedies',
    title: 'Zero Customer Liability in Cyber Banking Fraud',
    category: 'Banking & Cyber Security',
    icon: 'zap',
    summary: 'Statutory protection insulating account holders from financial losses caused by unauthorized electronic banking, ATM cloning, and UPI cyber breaches.',
    statutoryBasis: {
      actName: 'RBI Master Circular on Customer Protection & IT Act 2000',
      shortAct: 'RBI Circular',
      sections: ['Circular DBR.No.Leg.BC.78/09.07.005/2017-18', 'IT Act Section 43A'],
      actUrl: '/laws/IT'
    },
    keyProtections: [
      'Zero Liability: If the fraud occurs due to contributory negligence or deficiency on the part of the bank, the customer has zero liability.',
      'Third-Party Breach Protection: Zero liability if the unauthorized transaction is notified by the customer to the bank within 3 working days.',
      'Limited Liability Cap: If reported between 4 to 7 working days, customer liability is strictly capped at ₹5,000 (basic savings/credit card up to ₹5 Lakh limit) or ₹10,000.',
      'Shadow Credit Within 10 Days: The bank must credit the disputed amount back to the customer’s account within 10 working days of complaint receipt.'
    ],
    actionableSteps: [
      'Immediately call your bank’s 24x7 emergency helpline to freeze the account, block debit/credit cards, and disable UPI access.',
      'Dial National Cyber Crime Reporting Helpline 1930 immediately to register a financial freeze on the fraudster’s wallet/account.',
      'Submit a formal written complaint with transaction SMS logs to the home branch manager and obtain an acknowledgment stamp.',
      'If the bank does not reverse funds within 30 days, escalate to the RBI Banking Ombudsman (cms.rbi.org.in).'
    ],
    legalRemedy: 'Complaint before the RBI Banking Ombudsman and complaint under Section 46 of the IT Act before the State IT Adjudicating Officer.',
    emergencyHelpline: {
      name: 'National Cyber Crime Financial Helpline',
      number: '1930',
      description: 'Indian Cyber Crime Coordination Centre (I4C) emergency transaction recall hotline'
    },
    penaltiesForViolation: 'Banks failing to follow RBI customer protection circulars face regulatory penalties and must pay interest on delayed refund amounts.',
    frequentlyAskedQuestions: [
      {
        question: 'Who bears the burden of proof in an unauthorized electronic banking transaction?',
        answer: 'The RBI circular explicitly mandates that the burden of proving that the customer was negligent or shared credentials lies entirely upon the bank.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: true
  },
  {
    id: 'senior-citizens-maintenance',
    slug: 'senior-citizens-parents-maintenance-act',
    title: 'Senior Citizen Maintenance & Property Protection',
    category: 'Senior Citizens & Family',
    icon: 'users',
    summary: 'Protects the dignity and physical welfare of parents and senior citizens, empowering tribunals to void abusive property transfers and enforce maintenance.',
    statutoryBasis: {
      actName: 'Maintenance and Welfare of Parents and Senior Citizens Act, 2007',
      shortAct: 'MWPSC Act',
      sections: ['Section 4', 'Section 5', 'Section 9', 'Section 23'],
      actUrl: '/laws/SeniorCitizen'
    },
    keyProtections: [
      'Elderly parents unable to maintain themselves can claim monthly maintenance allowance from adult children or legal heirs possessing inheritance interest.',
      'Void Property Transfers: If a senior citizen gifted property on condition of basic care, and children fail to provide it, Section 23 allows the Tribunal to declare the transfer null and void.',
      'Summary Inexpensive Proceedings: Hearings are conducted by the Sub-Divisional Magistrate (SDM) without complex civil court technicalities.',
      'Protection against abandonment: Abandoning an elderly parent is a criminal offense punishable with imprisonment up to 3 months or fine.'
    ],
    actionableSteps: [
      'Draft a simple application stating family relationships, income status, and failure of children to provide basic food, shelter, or medicines.',
      'File the petition before the Maintenance Tribunal presided by the Sub-Divisional Magistrate (SDM).',
      'No advocate is strictly required; senior citizen can present their facts directly or seek assistance from a Conciliation Officer.',
      'Tribunals typically conclude hearings within 90 days of notice service.'
    ],
    legalRemedy: 'Application for Maintenance and Revocation of Property Deeds before the Maintenance Tribunal (SDM Office).',
    emergencyHelpline: {
      name: 'Elderline National Senior Helpline',
      number: '14567',
      description: 'Ministry of Social Justice & Empowerment helpline for emotional support, rescue, and legal aid'
    },
    penaltiesForViolation: 'Failure to pay ordered maintenance without reasonable cause can result in arrest warrants and imprisonment up to 1 month for each month of default.',
    frequentlyAskedQuestions: [
      {
        question: 'Can daughters also be ordered to pay maintenance to elderly parents?',
        answer: 'Yes. The Act defines children to include both adult sons and adult daughters, biological or adopted.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: false
  },
  {
    id: 'equal-work-maternity-rights',
    slug: 'equal-pay-and-maternity-benefits',
    title: 'Equal Remuneration & Maternity Protection',
    category: 'Workplace & Employment',
    icon: 'briefcase',
    summary: 'Guarantees equal wages for equal work without gender discrimination and secures 26 weeks of paid maternity leave with job security for working women.',
    statutoryBasis: {
      actName: 'Code on Wages 2019 & Maternity Benefit (Amendment) Act 2017',
      shortAct: 'Maternity Act',
      sections: ['Section 3 Code on Wages', 'Section 5 Maternity Benefit Act', 'Section 11 Creche Facility'],
      actUrl: '/laws/Labor'
    },
    keyProtections: [
      'Prohibition of wage disparity based on gender for the same work or work of similar nature.',
      '26 weeks (182 calendar days) of fully paid maternity leave for women employees in any establishment with 10 or more workers.',
      'Protection from termination: Employers cannot lawfully dismiss or discharge a woman during her maternity leave absence.',
      'Mandatory creche facility within 500 meters for every establishment employing 50 or more employees, with 4 daily visits allowed.'
    ],
    actionableSteps: [
      'Submit written maternity notice to the employer at least 7 weeks prior to expected delivery date.',
      'If denied statutory maternity benefits, preserve wage slips, employment contracts, and email correspondence.',
      'Lodge a formal complaint with the State Labor Commissioner or the Chief Inspector of Factories.',
      'File an application for recovery of maternity wages before the statutory Competent Authority.'
    ],
    legalRemedy: 'Complaint before the Labor Commissioner / Inspector under Section 17 of the Maternity Benefit Act.',
    emergencyHelpline: {
      name: 'Ministry of Labour Helpline',
      number: '14434',
      description: 'National helpline for workers grievance registration and social security claims'
    },
    penaltiesForViolation: 'Employers refusing maternity benefits face mandatory imprisonment from 3 months to 1 year and fines up to ₹50,000.',
    frequentlyAskedQuestions: [
      {
        question: 'Does the 26-week paid maternity benefit apply to contractual or temporary women employees?',
        answer: 'Yes. The Supreme Court in Municipal Corporation of Delhi vs. Female Workers held that maternity benefits apply equally to regular, daily wage, and contractual women workers.'
      }
    ],
    verifiedDate: '2026-08-15',
    isPopular: false
  }
];

// 1. GET /api/info/rights - List all rights with filtering, searching, and category counts
router.get('/rights', asyncHandler(async (req: Request, res: Response) => {
  const category = (req.query['category'] as string) || 'All';
  const query = (req.query['q'] as string) || '';
  const sort = (req.query['sort'] as string) || 'popular';

  let filtered = citizenRightsCatalog.filter(r => {
    const matchesCat = category === 'All' || r.category.toLowerCase() === category.toLowerCase();
    const qLower = query.toLowerCase().trim();
    const matchesQ = !qLower ||
      r.title.toLowerCase().includes(qLower) ||
      r.summary.toLowerCase().includes(qLower) ||
      r.category.toLowerCase().includes(qLower) ||
      r.statutoryBasis.actName.toLowerCase().includes(qLower) ||
      r.statutoryBasis.sections.some(s => s.toLowerCase().includes(qLower)) ||
      r.keyProtections.some(p => p.toLowerCase().includes(qLower)) ||
      r.actionableSteps.some(a => a.toLowerCase().includes(qLower));

    return matchesCat && matchesQ;
  });

  if (sort === 'alpha-asc') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'alpha-desc') {
    filtered.sort((a, b) => b.title.localeCompare(a.title));
  } else {
    // Popular first
    filtered.sort((a, b) => {
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      return 0;
    });
  }

  const allCategories = ['All', ...Array.from(new Set(citizenRightsCatalog.map(r => r.category)))];
  const categoriesWithCounts = allCategories.map(cat => ({
    name: cat,
    count: cat === 'All' ? citizenRightsCatalog.length : citizenRightsCatalog.filter(r => r.category === cat).length
  }));

  res.json({
    success: true,
    totalCount: filtered.length,
    categories: categoriesWithCounts,
    data: filtered
  });
}));

// 2. GET /api/info/rights/:slug - Retrieve single statutory right
router.get('/rights/:slug', asyncHandler(async (req: Request, res: Response) => {
  const rawSlug = req.params['slug'];
  const slug = (Array.isArray(rawSlug) ? rawSlug[0] : (rawSlug as string)) || '';
  const target = citizenRightsCatalog.find(
    r => r.slug === slug || r.id === slug
  );

  if (!target) {
    res.status(404).json({ success: false, message: 'Statutory citizen right entry not found.' });
    return;
  }

  res.json({
    success: true,
    data: target
  });
}));

export default router;