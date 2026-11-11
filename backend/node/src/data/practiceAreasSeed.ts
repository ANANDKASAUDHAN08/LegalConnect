export interface PracticeAreaSeedItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  subfields: string[];
  relevantActs: string[];
  typicalForums: string[];
  popular?: boolean;
}

export const practiceAreasSeedCatalog: PracticeAreaSeedItem[] = [
  {
    id: 'criminal-law',
    name: 'Criminal Law',
    icon: 'scale',
    category: 'Criminal Justice',
    description: 'Defense against statutory criminal charges under the Bharatiya Nyaya Sanhita (BNS) and legacy IPC, covering bail hearings, trials, and High Court appeals.',
    subfields: ['NDPS Cases', 'Bail Matters', 'Criminal Appeals', 'Trials', 'White Collar Defense'],
    relevantActs: ['Bharatiya Nyaya Sanhita (BNS)', 'Bharatiya Nagarik Suraksha Sanhita (BNSS)', 'Arms Act'],
    typicalForums: ['Sessions Court', 'High Court', 'Supreme Court of India'],
    popular: true
  },
  {
    id: 'bail-matters',
    name: 'Bail Matters & Remand',
    icon: 'key',
    category: 'Criminal Justice',
    description: 'Emergency legal representation for securing anticipatory bail, transit bail, regular bail, and statutory default bail under BNSS provisions.',
    subfields: ['Anticipatory Bail', 'Regular Bail', 'Transit Bail', 'Default Bail (Sec 479 BNSS)'],
    relevantActs: ['BNSS 2023 Sec 480', 'BNSS 2023 Sec 482', 'Constitution Art 21'],
    typicalForums: ['Magistrate Court', 'Sessions Court', 'High Court'],
    popular: true
  },
  {
    id: 'ndps-cases',
    name: 'NDPS & Narcotics Defense',
    icon: 'shield',
    category: 'Criminal Justice',
    description: 'Specialized legal counsel for offenses under the Narcotic Drugs and Psychotropic Substances Act, focusing on search-and-seizure compliance and Section 37 bail.',
    subfields: ['Section 37 Bail', 'Commercial Quantity Defense', 'Procedural Non-Compliance', 'NCB Inquiries'],
    relevantActs: ['NDPS Act 1985', 'BNSS 2023'],
    typicalForums: ['Special NDPS Court', 'High Court'],
    popular: false
  },
  {
    id: 'cyber-crime',
    name: 'Cyber Crime & Online Fraud',
    icon: 'lock',
    category: 'Technology & Privacy',
    description: 'Representation in online financial scams, phishing attacks, identity theft, data breach investigations, and IT Act infractions.',
    subfields: ['UPI Fraud', 'Phishing & Identity Theft', 'Section 66D IT Act', 'Crypto Scam Inquiries'],
    relevantActs: ['Information Technology Act 2000', 'BNS 2023', 'DPDP Act 2023'],
    typicalForums: ['Cyber Crime Police Stations', 'Adjudicating Officer IT Act', 'Sessions Court'],
    popular: true
  },
  {
    id: 'property-disputes',
    name: 'Property Disputes & Land Law',
    icon: 'home',
    category: 'Real Estate & Property',
    description: 'Resolution of property conflicts regarding clear titles, partition suits, boundary disputes, unlawful possession, and ancestral estate claims.',
    subfields: ['Title Verification', 'Partition Suits', 'Encroachment Actions', 'Inheritance Disputes'],
    relevantActs: ['Transfer of Property Act 1882', 'Specific Relief Act 1963', 'Registration Act 1908'],
    typicalForums: ['Civil Court (Senior Division)', 'District Court', 'Revenue Tribunal'],
    popular: true
  },
  {
    id: 'rera-compliance',
    name: 'RERA & Builder Disputes',
    icon: 'building',
    category: 'Real Estate & Property',
    description: 'Enforcement of homebuyer rights against delayed possessions, structural defects, misleading promises, and builder insolvency under RERA regulations.',
    subfields: ['Delayed Possession Compensation', 'Refund Petitions', 'RERA Registration Disputes', 'Builder Execution'],
    relevantActs: ['Real Estate (Regulation and Development) Act 2016'],
    typicalForums: ['State RERA Authority', 'RERA Appellate Tribunal (REAT)', 'High Court'],
    popular: true
  },
  {
    id: 'civil-litigation',
    name: 'Civil Law & Contracts',
    icon: 'landmark',
    category: 'Litigation & Disputes',
    description: 'Comprehensive representation in non-criminal disputes including money recovery, breach of commercial contracts, injunctions, and declaratory suits.',
    subfields: ['Summary Suits (Order 37 CPC)', 'Interim Injunctions', 'Specific Performance', 'Money Recovery'],
    relevantActs: ['Code of Civil Procedure 1908', 'Indian Contract Act 1872', 'Specific Relief Act 1963'],
    typicalForums: ['City Civil Court', 'District Court', 'High Court'],
    popular: true
  },
  {
    id: 'arbitration-adr',
    name: 'Arbitration & Mediation (ADR)',
    icon: 'scale',
    category: 'Corporate & Commercial',
    description: 'Expert representation in institutional and ad-hoc domestic arbitrations, enforcement of arbitral awards under Section 34 & 36, and commercial mediation.',
    subfields: ['Section 9 Interim Relief', 'Section 11 Arbitrator Appointment', 'Section 34 Award Challenge', 'Mediation Conciliation'],
    relevantActs: ['Arbitration and Conciliation Act 1996', 'Mediation Act 2023'],
    typicalForums: ['High Court (Arbitration Bench)', 'Arbitral Tribunals', 'Commercial Court'],
    popular: false
  },
  {
    id: 'consumer-protection',
    name: 'Consumer Disputes & Deficiencies',
    icon: 'shield-check',
    category: 'Consumer & Trade',
    description: 'Legal redressal against defective electronics, deficiency in airline/hospitality services, insurance repudiations, and deceptive e-commerce practices.',
    subfields: ['Insurance Repudiation Claims', 'Defective Goods Compensation', 'Unfair Trade Practices', 'Medical Negligence Claims'],
    relevantActs: ['Consumer Protection Act 2019', 'E-Commerce Rules 2020'],
    typicalForums: ['District Consumer Commission (DCDRC)', 'State Consumer Commission (SCDRC)', 'National Commission (NCDRC)'],
    popular: true
  },
  {
    id: 'family-matrimonial',
    name: 'Matrimonial & Divorce Law',
    icon: 'heart',
    category: 'Family & Personal Law',
    description: 'Sensitive legal counsel for mutual consent divorce, contested divorce, interim and permanent maintenance, child custody, and domestic violence remedies.',
    subfields: ['Mutual Consent Divorce (13B)', 'Contested Separation', 'Child Custody Petitions', 'Section 125 Maintenance'],
    relevantActs: ['Hindu Marriage Act 1955', 'Special Marriage Act 1954', 'Protection of Women from Domestic Violence Act 2005'],
    typicalForums: ['Family Court', 'High Court'],
    popular: true
  },
  {
    id: 'labour-employment',
    name: 'Labour & Workplace Law',
    icon: 'briefcase',
    category: 'Labour & Employment',
    description: 'Representation in illegal terminations, unpaid severance, non-compete enforceability, gratuity disputes, and internal sexual harassment inquiries under POSH.',
    subfields: ['POSH Inquiries', 'Wrongful Termination', 'Gratuity & PF Recovery', 'Industrial Disputes'],
    relevantActs: ['Industrial Disputes Act 1947', 'Payment of Gratuity Act 1972', 'POSH Act 2013'],
    typicalForums: ['Labour Court', 'Industrial Tribunal', 'High Court'],
    popular: true
  },
  {
    id: 'intellectual-property',
    name: 'Intellectual Property (IPR)',
    icon: 'zap',
    category: 'Intellectual Property',
    description: 'Trademark registrations, copyright infringement litigation, design registrations, patent oppositions, and trade secret enforcement.',
    subfields: ['Trademark Infringement Suits', 'Copyright Cease & Desist', 'Passing-off Actions', 'IP Licensing Agreements'],
    relevantActs: ['Trade Marks Act 1999', 'Copyright Act 1957', 'Patents Act 1970'],
    typicalForums: ['Commercial Court (IPD)', 'High Court IP Division', 'Trade Marks Registry'],
    popular: true
  },
  {
    id: 'cheque-bounce-ni-act',
    name: 'Cheque Bounce (Sec 138 NI Act)',
    icon: 'credit-card',
    category: 'Commercial & Banking',
    description: 'Filing statutory demand notices, complaint petitions, and defense in criminal cheque dishonour proceedings under Section 138 of the Negotiable Instruments Act.',
    subfields: ['Statutory 15-Day Demand Notice', 'Section 138 Criminal Complaint', 'Interim Compensation (Sec 143A)', 'Compoundable Settlement'],
    relevantActs: ['Negotiable Instruments Act 1881', 'BNSS 2023'],
    typicalForums: ['Metropolitan Magistrate Court', 'Judicial Magistrate First Class (JMFC)'],
    popular: true
  },
  {
    id: 'motor-accident-claims',
    name: 'Motor Accident Claims (MACT)',
    icon: 'truck',
    category: 'Insurance & Claims',
    description: 'Securing fair compensation for road accident victims, permanent disability claims, third-party liability disputes, and hit-and-run fund settlements.',
    subfields: ['MACT Compensation Petitions', 'Hit & Run Solatium Claims', 'Disability Assessment Suits', 'Insurance Appeals'],
    relevantActs: ['Motor Vehicles Act 1988 (Sec 166)', 'Central Motor Vehicles Rules'],
    typicalForums: ['Motor Accident Claims Tribunal (MACT)', 'High Court'],
    popular: false
  },
  {
    id: 'immigration-law',
    name: 'Immigration & Citizenship',
    icon: 'globe',
    category: 'International & Immigration',
    description: 'Assisting non-resident Indians and foreign nationals with visa cancellations, deportation defense, OCI card revocations, and naturalization.',
    subfields: ['OCI Card Registrations', 'Visa Rejections & Appeals', 'FRRO Inquiries', 'Dual Citizenship Advocacy'],
    relevantActs: ['Citizenship Act 1955', 'Passports Act 1967', 'Foreigners Act 1946'],
    typicalForums: ['FRRO Offices', 'Ministry of Home Affairs', 'High Court'],
    popular: true
  },
  {
    id: 'insolvency-bankruptcy',
    name: 'Insolvency & Bankruptcy (IBC)',
    icon: 'landmark',
    category: 'Corporate & Commercial',
    description: 'Representing financial creditors, operational creditors, and corporate debtors in insolvency resolution proceedings and liquidation before NCLT.',
    subfields: ['Section 7 Financial Creditor Petitions', 'Section 9 Operational Claims', 'Resolution Plans', 'SARFAESI Recovery'],
    relevantActs: ['Insolvency and Bankruptcy Code (IBC) 2016', 'SARFAESI Act 2002'],
    typicalForums: ['NCLT', 'NCLAT', 'Debt Recovery Tribunal (DRT)'],
    popular: false
  },
  {
    id: 'public-interest-litigation',
    name: 'Constitutional Law & PIL',
    icon: 'scale',
    category: 'Litigation & Disputes',
    description: 'Challenging arbitrary executive actions, enforcing fundamental human rights, and filing Public Interest Litigations (PIL) for systemic reforms.',
    subfields: ['Writ of Habeas Corpus', 'Writ of Mandamus', 'Environmental PILs', 'Constitutional Challenges'],
    relevantActs: ['Constitution of India (Articles 32 & 226)'],
    typicalForums: ['High Court', 'Supreme Court of India'],
    popular: false
  }
];