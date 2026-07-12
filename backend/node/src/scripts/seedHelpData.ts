import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import HelpCategory from '../models/HelpCategory';
import HelpRoadmap from '../models/HelpRoadmap';
import HelpHelpline from '../models/HelpHelpline';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const categories = [
  {
    id: 'Property Dispute',
    name: 'Property Dispute',
    icon: 'home',
    description: 'Legal issues related to land ownership, tenancy, builder disputes, RERA complaints, and property registration.',
    subcategories: ['Land Ownership', 'Tenancy Dispute', 'Builder Fraud', 'RERA Complaint', 'Property Registration', 'Ancestral Property', 'Encroachment']
  },
  {
    id: 'Family Law',
    name: 'Family Law',
    icon: 'users',
    description: 'Matters regarding marriage, divorce, child custody, alimony, and inheritance.',
    subcategories: ['Divorce', 'Mutual Divorce', 'Child Custody', 'Alimony / Maintenance', 'Inheritance', 'Wills & Estates']
  },
  {
    id: 'Consumer Complaint',
    name: 'Consumer Complaint',
    icon: 'shopping-cart',
    description: 'Redressal against defective goods, deficient services, overcharging, and unfair trade practices.',
    subcategories: ['Product Defect', 'Service Deficiency', 'Online Scam', 'Insurance Claim', 'Banking Dispute', 'Medical Negligence']
  },
  {
    id: 'Labour Issue',
    name: 'Labour Issue',
    icon: 'briefcase',
    description: 'Employee-employer disputes, wage claims, wrongful termination, and workplace harassment.',
    subcategories: ['Unpaid Wages', 'Wrongful Termination', 'PF / Gratuity Dispute', 'Workplace Harassment', 'Contract Breach']
  },
  {
    id: 'Criminal Matter',
    name: 'Criminal Matter',
    icon: 'scale',
    description: 'Defense representation, bail applications, police harassment, and filing FIRs.',
    subcategories: ['FIR Filing', 'Bail Application', 'Anticipatory Bail', 'Police Harassment', 'Cheque Bounce']
  },
  {
    id: 'Business Dispute',
    name: 'Business Dispute',
    icon: 'building',
    description: 'Company formation, partnership disputes, commercial contracts, and intellectual property rights.',
    subcategories: ['Contract Violation', 'Partnership Dispute', 'IPR Infringement', 'Taxation Issue', 'Debt Recovery']
  },
  {
    id: 'Cyber Crime',
    name: 'Cyber Crime',
    icon: 'shield',
    description: 'Reporting phishing scams, online identity theft, hacking, cyberbullying, and financial frauds.',
    subcategories: ['Phishing / Online Scam', 'Hacking', 'Identity Theft', 'Cyber Bullying', 'Financial Fraud']
  },
  {
    id: 'Other / Not Sure',
    name: 'Other / Not Sure',
    icon: 'question',
    description: 'Describe your situation to our AI Assistant to find relevant resources and categories.',
    subcategories: ['General Consultation', 'Unsure of Category']
  }
];

const helplines = [
  // General Helplines
  {
    name: 'National Legal Aid Helpline (NALSA)',
    number: '15100',
    description: 'Free legal aid services and counseling available 24/7 across India. Click to connect to a DLSA front office.',
    category: 'General'
  },
  {
    name: 'Emergency Police Support',
    number: '112',
    description: 'National emergency service provider for police, fire, and ambulance.',
    category: 'General'
  },
  {
    name: 'Elderline (Senior Citizens)',
    number: '14567',
    description: 'National helpline for senior citizens providing advice, guidance, and rescue services.',
    category: 'General'
  },
  // Cyber Crime
  {
    name: 'National Cyber Crime Helpline',
    number: '1930',
    description: 'Toll-free emergency number to report financial cyber fraud immediately (Golden Hour window).',
    category: 'Cyber Crime'
  },
  {
    name: 'State Bank of India (SBI) Fraud Block Helpline',
    number: '1800111109',
    description: 'Immediate toll-free hotline to report unauthorized transactions and block SBI credit/debit cards and netbanking.',
    category: 'Cyber Crime'
  },
  {
    name: 'HDFC Bank Cyber Fraud Support',
    number: '18002664332',
    description: 'Direct HDFC customer security hotline to block accounts, credit cards, and UPI handlers following cyber theft.',
    category: 'Cyber Crime'
  },
  {
    name: 'ICICI Bank Fraud Reporting Desk',
    number: '18002662',
    description: '24/7 dedicated ICICI toll-free customer desk to freeze compromised digital banking services.',
    category: 'Cyber Crime'
  },
  {
    name: 'Axis Bank Emergency Blocking Hotline',
    number: '18604195555',
    description: 'Axis bank hotline to freeze netbanking access, block UPI transactions, and deactivate credit/debit cards.',
    category: 'Cyber Crime'
  },
  // Family Law & Domestic Abuse
  {
    name: 'National Women Helpline (NCW)',
    number: '1091',
    description: 'Dedicated helpline for women facing harassment or domestic distress.',
    category: 'Family Law'
  },
  {
    name: 'Women & Child Helpline',
    number: '181',
    description: 'Single contact number for women in distress, functioning 24/7.',
    category: 'Family Law'
  },
  {
    name: 'Childline India',
    number: '1098',
    description: '24/7 free emergency phone outreach service for children in need of care and protection.',
    category: 'Family Law'
  },
  // Consumer
  {
    name: 'National Consumer Helpline',
    number: '1915',
    description: 'Government toll-free helpline for consumer grievance registration and company resolution.',
    category: 'Consumer Complaint'
  },
  // Labour
  {
    name: 'Labour Grievance Cell',
    number: '155214',
    description: 'Shram Suvidha helpline for workers and industrial dispute guidance.',
    category: 'Labour Issue'
  }
];

const roadmaps = [
  {
    category: 'Property Dispute',
    steps: [
      { title: 'Verify Land Records', detail: 'Check online land records (e.g. DLRC, Kaveri) or inspect the registry details at the Sub-Registrar Office to verify the chain of title.' },
      { title: 'Check RERA Registry', detail: 'For builder delays or fraud, confirm if the project and builder are registered under RERA and check past complaints against them.' },
      { title: 'Send a Legal Notice', detail: 'Draft and send a formal legal notice to the opposite party giving them 15 days to resolve the dispute or hand over possession.' },
      { title: 'File a Conciliation / Suit', detail: 'If unresolved, file a petition with the State RERA, Land Revenue Tribunal, or a civil suit in court.' }
    ],
    documents: ['Registered Sale Deed', 'Parent Deeds / Chain of Title Documents', 'Approved Building Plan', 'Possession Letter / Allotment Letter', 'Property Tax Receipts', 'Copy of Legal Notice sent'],
    onlineLinks: [
      { name: 'Delhi Land Records (DLRC)', url: 'https://dlrc.delhigovt.nic.in' },
      { name: 'Karnataka Kaveri Services', url: 'https://kaverionline.karnataka.gov.in' },
      { name: 'National RERA Portal', url: 'https://rera.delhi.gov.in' }
    ],
    lokAdalatGuidance: 'Property partition suits, boundary disputes, and tenancy rent disagreements can be settled quickly in Lok Adalats with full refund of court fees upon mutual agreement.'
  },
  {
    category: 'Family Law',
    steps: [
      { title: 'Seek Counseling / Mediation', detail: 'Matrimonial disputes in India are first sent to court-annexed mediation cells to explore reconciliation or mutual settlement.' },
      { title: 'Gather Incident Logs', detail: 'For domestic abuse, record dates, times, and descriptions of incidents, physical injuries, and preserve WhatsApp messages or emails.' },
      { title: 'File Maintenance / Domestic Incident Report', detail: 'Submit a DIR under Section 12 of the DV Act to the Protection Officer, or file for maintenance under Section 125 of CrPC/Section 144 of BNSS.' },
      { title: 'Initiate Divorce / Custody Suit', detail: 'File a petition for mutual consent divorce or contested divorce, along with custody applications in Family Court.' }
    ],
    documents: ['Marriage Certificate', 'Wedding Photographs / Invitation Card', 'Asset List & Joint Accounts details', 'Income tax returns (last 3 years) of both spouses', 'Medical records / Medico-legal reports (if domestic abuse)', 'Detailed incident timeline log'],
    onlineLinks: [
      { name: 'National Commission for Women', url: 'http://ncw.nic.in' },
      { name: 'Delhi Family Courts Directory', url: 'https://districts.ecourts.gov.in/delhi' }
    ],
    lokAdalatGuidance: 'Family courts regularly refer alimony, maintenance disputes, and compoundable family arguments to Lok Adalats for quick and amicable family settlements.'
  },
  {
    category: 'Consumer Complaint',
    steps: [
      { title: 'Register NCH Grievance', detail: 'Call 1915 or log on to consumerhelpline.gov.in to lodge a grievance against the vendor. Many companies resolve disputes at this stage.' },
      { title: 'Send a Formal Notice', detail: 'If NCH fails, mail a written notice demanding a refund or replacement within 15 days. Send it by Registered Post.' },
      { title: 'File via e-Daakhil Portal', detail: 'Submit your complaint online using the official e-Daakhil website. There is no need to hire a lawyer for consumer commission complaints.' }
    ],
    documents: ['Invoice / Cash Memo', 'Warranty Card / Guarantee Card', 'Photographs of the defective item', 'Emails / Chat history with customer support', 'Proof of dispatch of formal notice'],
    onlineLinks: [
      { name: 'National Consumer Helpline', url: 'https://consumerhelpline.gov.in' },
      { name: 'e-Daakhil Filing Portal', url: 'https://edaakhil.nic.in' }
    ],
    lokAdalatGuidance: 'Bank billing issues, insurance claim delays, and utility bill disputes are heavily settled during National Lok Adalat sessions.'
  },
  {
    category: 'Cyber Crime',
    steps: [
      { title: 'Block Financial Accounts', detail: 'Immediately dial your bank helpline or log in online to freeze your credit card and netbanking (do this within the 2-hour Golden Hour window).' },
      { title: 'Preserve Digital Evidence', detail: 'Take screenshots of transaction SMS, chat history, suspicious website URLs, email headers, and fake profile IDs.' },
      { title: 'File Online Cyber Complaint', detail: 'File a report at cybercrime.gov.in or report to the nearest dedicated Cyber Crime Police Cell immediately.' }
    ],
    documents: ['Bank statements / Transaction SMS details', 'Screenshots of fraud chats / phishing links', 'Email headers or mock emails received', 'Victim Government-issued ID card'],
    onlineLinks: [
      { name: 'National Cyber Crime Reporting', url: 'https://cybercrime.gov.in' },
      { name: 'RBI Ombudsman Grievances', url: 'https://cms.rbi.org.in' }
    ],
    lokAdalatGuidance: 'Core cyber offences are non-compoundable and cannot be sent to Lok Adalats, but commercial recovery of lost funds from merchant wallets can be negotiated.'
  },
  {
    category: 'Labour Issue',
    steps: [
      { title: 'Submit Grievance on Shram Suvidha', detail: 'Log a wage or termination grievance on the Ministry of Labour and Employment Portal.' },
      { title: 'File Conciliation Petition', detail: 'Approach the local Assistant Labour Commissioner (ALC) to initiate conciliation proceedings under the Industrial Disputes Act.' },
      { title: 'Labour Court Reference', detail: 'If conciliation fails, obtain a failure report from the ALC to refer and file your suit in the Labour Court.' }
    ],
    documents: ['Employment Contract / Offer Letter', 'Salary Slips (last 6 months)', 'Bank Statement showing salary credits', 'Termination letter / Show-cause notice', 'Appraisal or work emails'],
    onlineLinks: [
      { name: 'Shram Suvidha Portal', url: 'https://shramsuvidha.gov.in' },
      { name: 'EPFO Grievance Portal', url: 'https://epfigms.gov.in' }
    ],
    lokAdalatGuidance: 'Unpaid wages, gratuity claims, retrenchment compensation, and reinstatement disputes can be settled in Lok Adalats rapidly.'
  },
  {
    category: 'Criminal Matter',
    steps: [
      { title: 'File an FIR', detail: 'Go to the nearest police station to report the offense. If they refuse, send the complaint in writing to the SP or file under Sec 156(3) of CrPC / 175 of BNSS.' },
      { title: 'File for Bail', detail: 'If arrested, apply for regular bail under Section 437/439 of CrPC or 480/483 of BNSS. For threats, apply for anticipatory bail under Section 438 of CrPC / 482 of BNSS.' },
      { title: 'Engage Free DLSA Lawyer', detail: 'If you cannot afford an advocate, request the Court Magistrate to assign a free Legal Aid Defence Counsel (LADC) under the DLSA.' }
    ],
    documents: ['Copy of the FIR (obtained free of cost)', 'Medical reports (in case of physical assault)', 'Anticipatory bail applications / Vakalatnama', 'Identity cards and local address proofs'],
    onlineLinks: [
      { name: 'e-Courts Services India', url: 'https://ecourts.gov.in' },
      { name: 'Delhi Police Online FIR status', url: 'https://www.delhipolice.nic.in' }
    ],
    lokAdalatGuidance: 'Only compoundable offences (like minor fights, cheque bounce, compoundable theft under IPC/BNS) can be settled in Lok Adalats.'
  },
  {
    category: 'Business Dispute',
    steps: [
      { title: 'Examine Contract Clauses', detail: 'Check for alternative dispute resolution (ADR) clauses like mediation or arbitration before going to Court.' },
      { title: 'Send Notice under Section 138 (Cheque Bounce)', detail: 'In case of bounced payments, send a statutory demand notice to the drawer within 30 days of receiving the memo.' },
      { title: 'Approach Commercial Court', detail: 'File a suit in Commercial Court. Pre-institution mediation is mandatory for commercial disputes in India unless urgent relief is needed.' }
    ],
    documents: ['Commercial Agreement / Partnership Deed', 'Invoices, Purchase Orders & Delivery Challans', 'Bounced Cheque and Bank Return Memo', '30-day Cheque Bounce Notice & Speed Post receipts', 'Company registration certificates'],
    onlineLinks: [
      { name: 'Ministry of Corporate Affairs (MCA)', url: 'https://mca.gov.in' },
      { name: 'National Company Law Tribunal', url: 'https://nclt.gov.in' }
    ],
    lokAdalatGuidance: 'Cheque bounce disputes (Sec 138 of NI Act) are among the most successfully settled categories in Lok Adalats, with complete stamp duty returns.'
  },
  {
    category: 'Other / Not Sure',
    steps: [
      { title: 'Describe Case to AI Assistant', detail: 'Use the search bar above or speak your problem to receive an automatic category assignment.' },
      { title: 'Visit DLSA Front Office', detail: 'Visit the District Court DLSA office near you for a free face-to-face evaluation by a Legal Aid Retainer Lawyer.' }
    ],
    documents: ['Government ID Proof (Aadhaar / Voter ID)', 'Any documents, letters, or bills related to your dispute'],
    onlineLinks: [
      { name: 'NALSA Portal', url: 'https://nalsa.gov.in' }
    ],
    lokAdalatGuidance: 'If you are unsure whether your case is eligible for a Lok Adalat, consult a DLSA retainer lawyer at the front office for free counsel.'
  }
];

const seedHelpData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI as string;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is missing.');
    }
    console.log('📦 Connecting to MongoDB to seed categories/roadmaps/helplines...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB!');

    console.log('🗑️  Clearing existing HelpCategory, HelpRoadmap, HelpHelpline records...');
    await HelpCategory.deleteMany({});
    await HelpRoadmap.deleteMany({});
    await HelpHelpline.deleteMany({});

    console.log('💾 Seeding HelpCategory records...');
    for (const cat of categories) {
      await new HelpCategory(cat).save();
      console.log(`  ✅ Seeded Category: ${cat.name}`);
    }

    console.log('💾 Seeding HelpRoadmap records...');
    for (const rm of roadmaps) {
      await new HelpRoadmap(rm).save();
      console.log(`  ✅ Seeded Roadmap: ${rm.category}`);
    }

    console.log('💾 Seeding HelpHelpline records...');
    const processedHelplineIds = new Set();
    for (const hp of helplines) {
      const hash = crypto.createHash('md5').update(hp.name).digest('hex');
      const deterministicId = hash.substring(0, 24);
      if (processedHelplineIds.has(deterministicId)) {
        console.log(`  ⚠️ Skipping duplicate helpline: "${hp.name}"`);
        continue;
      }
      processedHelplineIds.add(deterministicId);
      await new HelpHelpline({
        _id: new mongoose.Types.ObjectId(deterministicId),
        ...hp
      }).save();
      console.log(`  ✅ Seeded Helpline: ${hp.name} [ID: ${deterministicId}]`);
    }

    console.log('\n🎉 Help metadata seeded successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding help data failed:', error.message);
    process.exit(1);
  }
};

seedHelpData();