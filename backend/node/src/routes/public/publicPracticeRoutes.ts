import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import Lawyer from '../../models/Lawyer';

const router = Router();

export interface PracticeAreaItem {
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

export const practiceAreasCatalog: PracticeAreaItem[] = [
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
    category: 'Litigation & Disputes',
    description: 'Expedited dispute resolution outside judicial courtrooms, handling commercial arbitration, appointment of arbitrators, and award enforcement.',
    subfields: ['Section 9 Interim Relief', 'Section 11 Arbitrator Appointment', 'Section 34 Award Challenge', 'Mediation'],
    relevantActs: ['Arbitration and Conciliation Act 1996 (as amended)'],
    typicalForums: ['Arbitral Tribunals', 'High Court', 'Supreme Court'],
    popular: false
  },
  {
    id: 'corporate-law',
    name: 'Corporate Law & Governance',
    icon: 'briefcase',
    category: 'Corporate & Commercial',
    description: 'Counseling companies and boards on statutory compliance, shareholder agreements, corporate restructuring, and regulatory disclosures.',
    subfields: ['Company Incorporation', 'Shareholder Disputes', 'Director Liabilities', 'Board Governance'],
    relevantActs: ['Companies Act 2013', 'SEBI Regulations', 'FEMA 1999'],
    typicalForums: ['NCLT', 'NCLAT', 'High Court'],
    popular: true
  },
  {
    id: 'mergers-acquisitions',
    name: 'Mergers & Acquisitions (M&A)',
    icon: 'award',
    category: 'Corporate & Commercial',
    description: 'Structuring corporate sales, statutory consolidations, due diligence investigations, asset acquisitions, and antitrust regulatory clearances.',
    subfields: ['Due Diligence', 'Share Purchase Agreements (SPA)', 'Competition Commission Approvals', 'Joint Ventures'],
    relevantActs: ['Companies Act 2013', 'Competition Act 2002'],
    typicalForums: ['NCLT', 'Competition Commission of India (CCI)'],
    popular: false
  },
  {
    id: 'family-law',
    name: 'Family Law & Domestic Relations',
    icon: 'users',
    category: 'Personal & Family Relations',
    description: 'Holistic handling of sensitive matrimonial matters, personal law rights, mutual consent separations, and division of joint matrimonial assets.',
    subfields: ['Mutual Consent Divorce', 'Contested Divorce', 'Alimony & Maintenance', 'Restitution of Conjugal Rights'],
    relevantActs: ['Hindu Marriage Act 1955', 'Special Marriage Act 1954', 'Indian Divorce Act 1869'],
    typicalForums: ['Family Court', 'High Court'],
    popular: true
  },
  {
    id: 'child-custody',
    name: 'Child Custody & Guardianship',
    icon: 'heart',
    category: 'Personal & Family Relations',
    description: 'Resolving disputes concerning legal guardianship, physical custody, visitation arrangements, and child maintenance with paramount child welfare focus.',
    subfields: ['Visitation Schedules', 'Interim Custody Orders', 'Guardianship Petitions', 'Child Support'],
    relevantActs: ['Guardians and Wards Act 1890', 'Hindu Minority and Guardianship Act 1956'],
    typicalForums: ['Family Court', 'District Court'],
    popular: true
  },
  {
    id: 'consumer-protection',
    name: 'Consumer Complaints & Redressal',
    icon: 'shield',
    category: 'Public & Consumer Rights',
    description: 'Representing consumers against defective goods, airline delays, insurance claim repudiations, medical negligence, and misleading advertising.',
    subfields: ['Defective Products', 'Insurance Claim Rejection', 'E-commerce Defaults', 'Medical Negligence'],
    relevantActs: ['Consumer Protection Act 2019'],
    typicalForums: ['District Consumer Commission', 'State Consumer Commission', 'NCDRC'],
    popular: true
  },
  {
    id: 'right-to-information',
    name: 'Right to Information (RTI)',
    icon: 'info',
    category: 'Public & Consumer Rights',
    description: 'Filing statutory RTI requests, first appeals, and second appeals to mandate transparency and accountability from government authorities.',
    subfields: ['RTI Drafting', 'First Appeals to FAA', 'Second Appeals to CIC/SIC', 'Penalty Proceedings'],
    relevantActs: ['Right to Information Act 2005'],
    typicalForums: ['Public Authorities', 'State Information Commission', 'Central Information Commission'],
    popular: false
  },
  {
    id: 'labour-law',
    name: 'Labour & Industrial Law',
    icon: 'briefcase',
    category: 'Employment & Labor',
    description: 'Navigating employer-employee relationships, trade union disputes, wage compliance, workplace safety standards, and factory statutory regulations.',
    subfields: ['Industrial Disputes', 'Trade Union Matters', 'Factory Act Compliance', 'Contract Labour Regulation'],
    relevantActs: ['Industrial Disputes Act 1947', 'Code on Wages 2019', 'Occupational Safety Code 2020'],
    typicalForums: ['Labour Court', 'Industrial Tribunal', 'High Court'],
    popular: true
  },
  {
    id: 'employment-disputes',
    name: 'Employment Contracts & Severance',
    icon: 'user-check',
    category: 'Employment & Labor',
    description: 'Advising professionals and corporates on wrongful terminations, non-compete covenants, severance agreements, and POSH workplace harassment inquiries.',
    subfields: ['Wrongful Termination', 'POSH Act Inquiries', 'Non-Compete Enforceability', 'Gratuity & PF Recovery'],
    relevantActs: ['POSH Act 2013', 'Payment of Gratuity Act 1972', 'Indian Contract Act 1872'],
    typicalForums: ['Labour Commissioner', 'Internal Committee (IC)', 'Civil Court'],
    popular: true
  },
  {
    id: 'intellectual-property',
    name: 'Intellectual Property (IPR)',
    icon: 'sparkles',
    category: 'Technology & Privacy',
    description: 'Protection and monetization of intangible assets including patents, trademarks, copyright works, trade secrets, and domain disputes.',
    subfields: ['Trademark Registration', 'Patent Filings', 'IP Infringement Suits', 'Software Licensing'],
    relevantActs: ['Trade Marks Act 1999', 'Copyright Act 1957', 'Patents Act 1970'],
    typicalForums: ['Trade Marks Registry', 'Commercial Court', 'High Court (IPD)'],
    popular: true
  },
  {
    id: 'data-privacy',
    name: 'Data Privacy & DPDP Compliance',
    icon: 'shield-check',
    category: 'Technology & Privacy',
    description: 'Guiding enterprises on compliance with the Digital Personal Data Protection Act 2023, cross-border data transfers, and breach response.',
    subfields: ['DPDP Act Audits', 'Privacy Policies & Consents', 'DPO Advisory', 'Data Breach Handling'],
    relevantActs: ['Digital Personal Data Protection Act 2023', 'IT Act 2000'],
    typicalForums: ['Data Protection Board of India (DPBI)', 'TDSAT'],
    popular: true
  },
  {
    id: 'tax-law',
    name: 'Tax Law & Direct Taxation',
    icon: 'file-text',
    category: 'Taxation & Revenue',
    description: 'Advising individuals and corporations on income tax assessments, scrutiny notices, search & seizure proceedings, and ITAT appeals.',
    subfields: ['Income Tax Appeals', 'Scrutiny Notices', 'Tax Evasion Defense', 'Transfer Pricing'],
    relevantActs: ['Income Tax Act 1961', 'Finance Acts'],
    typicalForums: ['CIT (Appeals)', 'Income Tax Appellate Tribunal (ITAT)', 'High Court'],
    popular: true
  },
  {
    id: 'gst-indirect-tax',
    name: 'GST & Indirect Taxes',
    icon: 'layout',
    category: 'Taxation & Revenue',
    description: 'Resolving disputes concerning Goods and Services Tax, input tax credit denials, GST audits, show-cause notices, and customs classifications.',
    subfields: ['Input Tax Credit (ITC)', 'GST Show Cause Notices', 'Customs Duty Inquiries', 'Appellate Litigation'],
    relevantActs: ['Central Goods and Services Tax (CGST) Act 2017', 'Customs Act 1962'],
    typicalForums: ['GST Appellate Authority', 'GSTAT', 'High Court'],
    popular: true
  },
  {
    id: 'immigration-law',
    name: 'Immigration & Citizenship',
    icon: 'globe',
    category: 'International & Immigration',
    description: 'Assisting non-resident Indians and foreign nationals with visa cancellations, deportation defense, OCI card revocatons, and naturalization.',
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

// 1. GET /api/info/practice-areas - Retrieve practice areas with dynamic lawyer counts
router.get('/practice-areas', asyncHandler(async (req: Request, res: Response) => {
  const category = (req.query['category'] as string) || 'All';
  const query = (req.query['q'] as string) || '';
  const sort = (req.query['sort'] as string) || 'popular';

  // Compute live lawyer counts from MongoDB
  const countMap: Record<string, number> = {};
  try {
    const lawyers = await Lawyer.find({}, 'specializations').lean();
    lawyers.forEach(l => {
      if (Array.isArray(l.specializations)) {
        l.specializations.forEach(s => {
          const clean = s.trim();
          countMap[clean] = (countMap[clean] || 0) + 1;
        });
      }
    });
  } catch (err) {
    // If DB is temporarily idle, proceed with defaults
  }

  // Enrich catalog with lawyer counts
  const enrichedCatalog = practiceAreasCatalog.map(item => {
    let count = countMap[item.name] || 0;
    // Also check for subfield matches if direct name has 0
    if (count === 0) {
      Object.keys(countMap).forEach(key => {
        if (key.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(key.toLowerCase())) {
          count += countMap[key];
        }
      });
    }
    return {
      ...item,
      advocateCount: count
    };
  });

  // Filter
  let filtered = enrichedCatalog.filter(item => {
    const matchesCat = category === 'All' || item.category.toLowerCase() === category.toLowerCase();
    const qLower = query.toLowerCase().trim();
    const matchesQ = !qLower ||
      item.name.toLowerCase().includes(qLower) ||
      item.description.toLowerCase().includes(qLower) ||
      item.category.toLowerCase().includes(qLower) ||
      item.subfields.some(sf => sf.toLowerCase().includes(qLower)) ||
      item.relevantActs.some(act => act.toLowerCase().includes(qLower));

    return matchesCat && matchesQ;
  });

  // Sort
  if (sort === 'alpha-asc') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'alpha-desc') {
    filtered.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === 'advocates') {
    filtered.sort((a, b) => (b.advocateCount || 0) - (a.advocateCount || 0));
  } else {
    // popular default: popular items first, then by advocate count
    filtered.sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return (b.advocateCount || 0) - (a.advocateCount || 0);
    });
  }

  // Categories list with counts
  const allCategories = ['All', ...Array.from(new Set(practiceAreasCatalog.map(p => p.category)))];
  const categoriesWithCounts = allCategories.map(cat => ({
    name: cat,
    count: cat === 'All' ? enrichedCatalog.length : enrichedCatalog.filter(p => p.category === cat).length
  }));

  res.json({
    success: true,
    totalCount: filtered.length,
    categories: categoriesWithCounts,
    data: filtered
  });
}));

// 2. GET /api/info/practice-areas/:id - Retrieve detail of single practice area
router.get('/practice-areas/:id', asyncHandler(async (req: Request, res: Response) => {
  const rawId = req.params['id'];
  const id = (Array.isArray(rawId) ? rawId[0] : (rawId as string)) || '';
  const target = practiceAreasCatalog.find(
    p => p.id === id || p.name.toLowerCase() === id.toLowerCase()
  );

  if (!target) {
    res.status(404).json({ success: false, message: 'Practice area not found.' });
    return;
  }

  // Fetch verified advocates for this area
  let matchedLawyers: any[] = [];
  try {
    matchedLawyers = await Lawyer.find({
      specializations: { $regex: new RegExp(target.name, 'i') }
    })
      .select('name city rating experience consultationFee avatarUrl isVerified specializations')
      .limit(6)
      .lean();
  } catch { }

  res.json({
    success: true,
    data: {
      ...target,
      advocateCount: matchedLawyers.length,
      featuredLawyers: matchedLawyers
    }
  });
}));

export default router;