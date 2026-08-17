/**
 * Centralized category configuration — replaces all hardcoded category data
 * spread across getCategoryInsights(), getCategoryDescription(), getCategoryCardClasses(), etc.
 * 
 * This is the single source of truth for all category-related metadata.
 * When new categories are added, only this file needs updating.
 */

export interface CategoryColorConfig {
  bg: string;
  text: string;
  border: string;
  bgHover: string;
  activeBorder: string;
  activeBg: string;
  activeIconBg: string;
  inactiveBg: string;
  inactiveBorder: string;
}

export interface CategoryInsight {
  faqs: { q: string; a: string }[];
  prompts: string[];
  stats: string[];
}

export interface CategoryMeta {
  shortDesc: string;       // Mobile description
  fullDesc: string;        // Desktop description
  colors: CategoryColorConfig;
  insights: CategoryInsight;
}

/** Master category metadata registry — fully dynamic, extensible */
const CATEGORY_REGISTRY: Record<string, CategoryMeta> = {
  'Property Dispute': {
    shortDesc: 'Land, Rent, Housing',
    fullDesc: 'Land, Rent, Inheritance, Housing',
    colors: {
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/20 dark:border-amber-400/20',
      bgHover: 'hover:bg-amber-500/5 dark:hover:bg-amber-400/5',
      activeBorder: 'border-amber-500 dark:border-amber-400',
      activeBg: 'bg-amber-500/5 dark:bg-slate-900/60',
      activeIconBg: 'bg-amber-500 text-white dark:bg-amber-400 dark:text-slate-950',
      inactiveBg: 'bg-amber-500/[0.01] dark:bg-slate-950',
      inactiveBorder: 'border-amber-500/20 dark:border-amber-400/10'
    },
    insights: {
      faqs: [
        { q: 'How do I check Land Records (Bhulekh)?', a: 'Visit your state\'s online Bhulekh portal and enter the Khata/Khasra number to fetch ownership details.' },
        { q: 'What is RERA\'s role in builder disputes?', a: 'RERA mandates that builders register projects, offering a fast-track tribunal for delayed possession or fraud.' }
      ],
      prompts: [
        'How to verify land title ownership before buying',
        'Filing a complaint against builder delay under RERA'
      ],
      stats: ['4-6 Mo:Avg Resolution', '120+:Legal Aid Lawyers', '3:Specialized Courts']
    }
  },
  'Family Law': {
    shortDesc: 'Divorce, Custody',
    fullDesc: 'Divorce, Custody, Maintenance',
    colors: {
      bg: 'bg-rose-500/10 dark:bg-rose-400/10',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-500/20 dark:border-rose-400/20',
      bgHover: 'hover:bg-rose-500/5 dark:hover:bg-rose-400/5',
      activeBorder: 'border-rose-500 dark:border-rose-400',
      activeBg: 'bg-rose-500/5 dark:bg-slate-900/60',
      activeIconBg: 'bg-rose-500 text-white dark:bg-rose-400 dark:text-slate-950',
      inactiveBg: 'bg-rose-500/[0.01] dark:bg-slate-950',
      inactiveBorder: 'border-rose-500/20 dark:border-rose-400/10'
    },
    insights: {
      faqs: [
        { q: 'What is the difference between mutual and contested divorce?', a: 'Mutual divorce is filed jointly with agreed terms and is faster. Contested divorce is filed by one spouse on specific grounds.' },
        { q: 'How is child custody decided in India?', a: 'Courts prioritize the child\'s welfare over parental rights, considering age, financial support, and attachment.' }
      ],
      prompts: [
        'Steps to file for mutual consent divorce',
        'How to claim child custody and maintenance'
      ],
      stats: ['74%:Mediation Success', '3:Family Courts', '2-4 Mo:Mutual Consent Avg']
    }
  },
  'Consumer Complaint': {
    shortDesc: 'Fraud, Faulty Products',
    fullDesc: 'Faulty Products, Fraud, Bills',
    colors: {
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/20 dark:border-emerald-400/20',
      bgHover: 'hover:bg-emerald-500/5 dark:hover:bg-emerald-400/5',
      activeBorder: 'border-emerald-500 dark:border-emerald-400',
      activeBg: 'bg-emerald-500/5 dark:bg-slate-900/60',
      activeIconBg: 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-slate-950',
      inactiveBg: 'bg-emerald-500/[0.01] dark:bg-slate-950',
      inactiveBorder: 'border-emerald-500/20 dark:border-emerald-400/10'
    },
    insights: {
      faqs: [
        { q: 'When can I file a case in the Consumer Forum?', a: 'You can file if a product is defective, service is deficient, or you were charged above MRP, after sending a notice.' },
        { q: 'What is the e-Daakhil portal?', a: 'e-Daakhil allows consumer complaints to be filed online from anywhere without visiting the forum physically.' }
      ],
      prompts: [
        'Drafting a consumer complaint for defective phone',
        'Filing complaint on e-Daakhil for refund delay'
      ],
      stats: ['82%:Forum Success Rate', '1:District Commission', '30 Days:Max Notice Period']
    }
  },
  'Labour Issue': {
    shortDesc: 'Wages, Contracts',
    fullDesc: 'Wages, Harassment, Contracts',
    colors: {
      bg: 'bg-violet-500/10 dark:bg-violet-400/10',
      text: 'text-violet-600 dark:text-violet-400',
      border: 'border-violet-500/20 dark:border-violet-400/20',
      bgHover: 'hover:bg-violet-500/5 dark:hover:bg-violet-400/5',
      activeBorder: 'border-violet-500 dark:border-violet-400',
      activeBg: 'bg-violet-500/5 dark:bg-slate-900/60',
      activeIconBg: 'bg-violet-500 text-white dark:bg-violet-400 dark:text-slate-950',
      inactiveBg: 'bg-violet-500/[0.01] dark:bg-slate-950',
      inactiveBorder: 'border-violet-500/20 dark:border-violet-400/10'
    },
    insights: {
      faqs: [
        { q: 'What can I do if my employer holds my salary?', a: 'You can send a legal notice, file a complaint with the Labour Commissioner, or approach the Labour Court.' },
        { q: 'Are verbal employment contracts legally binding?', a: 'Yes, but written contracts or bank salary transfer statements make it much easier to prove employment and wages.' }
      ],
      prompts: [
        'Drafting legal notice for unpaid salary',
        'Filing wage dispute with Labour Commissioner'
      ],
      stats: ['2-3 Mo:Avg Settlement', '4:Labour Inspectors', '92%:Settled via Mediation']
    }
  },
  'Criminal Matter': {
    shortDesc: 'Theft, Assault',
    fullDesc: 'Theft, Assault, Police Reports',
    colors: {
      bg: 'bg-red-500/10 dark:bg-red-400/10',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-500/20 dark:border-red-400/20',
      bgHover: 'hover:bg-red-500/5 dark:hover:bg-red-400/5',
      activeBorder: 'border-red-500 dark:border-red-400',
      activeBg: 'bg-red-500/5 dark:bg-slate-900/60',
      activeIconBg: 'bg-red-500 text-white dark:bg-red-400 dark:text-slate-950',
      inactiveBg: 'bg-red-500/[0.01] dark:bg-slate-950',
      inactiveBorder: 'border-red-500/20 dark:border-red-400/10'
    },
    insights: {
      faqs: [
        { q: 'What should I do if the police refuse to file an FIR?', a: 'You can write to the Superintendent of Police (SP) or file a private complaint in the Magistrate\'s court.' },
        { q: 'What is the difference between bailable and non-bailable?', a: 'Bailable offences grant bail as a matter of right at the police station. Non-bailable offences require a judge\'s decision.' }
      ],
      prompts: [
        'What to do if police refuse to file my FIR',
        'Steps to apply for anticipatory bail'
      ],
      stats: ['24/7:Emergency Line 112', '18:Police Stations', '15 Days:Max Remand Period']
    }
  },
  'Business Dispute': {
    shortDesc: 'Tax, Contracts',
    fullDesc: 'Partnerships, Tax, Contracts',
    colors: {
      bg: 'bg-indigo-500/10 dark:bg-indigo-400/10',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-500/20 dark:border-indigo-400/20',
      bgHover: 'hover:bg-indigo-500/5 dark:hover:bg-indigo-400/5',
      activeBorder: 'border-indigo-500 dark:border-indigo-400',
      activeBg: 'bg-indigo-500/5 dark:bg-slate-900/60',
      activeIconBg: 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950',
      inactiveBg: 'bg-indigo-500/[0.01] dark:bg-slate-950',
      inactiveBorder: 'border-indigo-500/20 dark:border-indigo-400/10'
    },
    insights: {
      faqs: [
        { q: 'How do I resolve a contract breach?', a: 'Review the dispute clause. If it specifies arbitration or mediation, you must attempt that before filing a civil suit.' },
        { q: 'What is the MSME Samadhaan portal?', a: 'It enables MSMEs to file cases online against buyers for delayed payments, with interest mandated by law.' }
      ],
      prompts: [
        'Resolving MSME delayed payment on Samadhaan',
        'Steps to file arbitration for contract breach'
      ],
      stats: ['6-12 Mo:Arbitration Avg', '2:Commercial Courts', '3x:MSME Delayed Interest']
    }
  },
  'Cyber Crime': {
    shortDesc: 'Hacking, Online Scams',
    fullDesc: 'Hacking, Online Scam, Phishing',
    colors: {
      bg: 'bg-cyan-500/10 dark:bg-cyan-400/10',
      text: 'text-cyan-600 dark:text-cyan-400',
      border: 'border-cyan-500/20 dark:border-cyan-400/20',
      bgHover: 'hover:bg-cyan-500/5 dark:hover:bg-cyan-400/5',
      activeBorder: 'border-cyan-500 dark:border-cyan-400',
      activeBg: 'bg-cyan-500/5 dark:bg-slate-900/60',
      activeIconBg: 'bg-cyan-500 text-white dark:bg-cyan-400 dark:text-slate-950',
      inactiveBg: 'bg-cyan-500/[0.01] dark:bg-slate-950',
      inactiveBorder: 'border-cyan-500/20 dark:border-cyan-400/10'
    },
    insights: {
      faqs: [
        { q: 'Where do I report online financial fraud?', a: 'Report instantly at cybercrime.gov.in or call 1930 within the golden hour to freeze the fraudster\'s bank account.' },
        { q: 'What constitutes online harassment or stalking?', a: 'Sending unsolicited explicit messages, morphing photos, or tracking someone online is punishable under the IT Act.' }
      ],
      prompts: [
        'How to block fraud bank transactions after scam',
        'Filing anonymous complaint on Cyber Cell'
      ],
      stats: ['68%:Freeze Rate (<1hr)', '1930:National Helpline', '24 Hrs:FIR Filing Window']
    }
  },
  'Other / Not Sure': {
    shortDesc: 'Chat with AI Helper',
    fullDesc: 'Chat with our smart AI assistant',
    colors: {
      bg: 'bg-blue-500/10 dark:bg-blue-400/10',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500/20 dark:border-blue-400/20',
      bgHover: 'hover:bg-blue-500/5 dark:hover:bg-blue-400/5',
      activeBorder: 'border-blue-600 dark:border-blue-400',
      activeBg: 'bg-blue-50/50 dark:bg-slate-900/60',
      activeIconBg: 'bg-blue-600 text-white dark:bg-blue-400 dark:text-slate-950',
      inactiveBg: 'bg-white dark:bg-slate-950',
      inactiveBorder: 'border-blue-500/20 dark:border-blue-400/10'
    },
    insights: {
      faqs: [
        { q: 'How can the AI Scenario Solver help me?', a: 'Describe your situation in simple local language. The AI will extract the legal topic, suggest laws, and list roadmaps.' },
        { q: 'Are AI suggestions legally binding?', a: 'No, they provide initial legal literacy and guidance. Always verify with an attorney.' }
      ],
      prompts: [
        'Describe my property dispute to AI',
        'How to get a government advocate for free'
      ],
      stats: ['<3 Sec:AI Response', '2:Languages (EN/HI)', 'Free:Access for All']
    }
  }
};

const DEFAULT_META: CategoryMeta = CATEGORY_REGISTRY['Other / Not Sure'];

/**
 * Get the full metadata config for a category ID.
 * Falls back to default (Other / Not Sure) for unknown categories.
 */
export function getCategoryMeta(catId: string): CategoryMeta {
  return CATEGORY_REGISTRY[catId] || DEFAULT_META;
}

/**
 * Get color config for a category name (used in autocomplete, suggestions).
 * Matches by keyword in the name for flexibility.
 */
export function getCategoryColorByName(categoryName: string): CategoryColorConfig {
  const meta = CATEGORY_REGISTRY[categoryName];
  if (meta) return meta.colors;

  // Fuzzy keyword fallback
  const name = categoryName.toLowerCase();
  if (name.includes('property') || name.includes('home')) return CATEGORY_REGISTRY['Property Dispute'].colors;
  if (name.includes('family') || name.includes('divorce')) return CATEGORY_REGISTRY['Family Law'].colors;
  if (name.includes('consumer') || name.includes('shopping')) return CATEGORY_REGISTRY['Consumer Complaint'].colors;
  if (name.includes('labour') || name.includes('employment') || name.includes('work')) return CATEGORY_REGISTRY['Labour Issue'].colors;
  if (name.includes('criminal') || name.includes('police')) return CATEGORY_REGISTRY['Criminal Matter'].colors;
  if (name.includes('business') || name.includes('corporate')) return CATEGORY_REGISTRY['Business Dispute'].colors;
  if (name.includes('cyber') || name.includes('shield')) return CATEGORY_REGISTRY['Cyber Crime'].colors;

  return DEFAULT_META.colors;
}

/** All category IDs in display order */
export function getAllCategoryIds(): string[] {
  return Object.keys(CATEGORY_REGISTRY);
}

/** Emergency helpline data — single source of truth */
export interface EmergencyHelpline {
  label: string;
  number: string;
  shortLabel?: string;
}

export const EMERGENCY_HELPLINES: EmergencyHelpline[] = [
  { label: 'National Emergency (All-in-One)', number: '112' },
  { label: 'Domestic Violence', number: '1091' },
  { label: 'Cyber Crime', number: '1930' },
  { label: 'Women Helpline', number: '181' },
  { label: 'Legal Aid', number: '15100' }
];

/** City to coordinates map — used for map centering fallback */
export const CITY_COORDINATES: Record<string, [number, number]> = {
  'mumbai': [19.0760, 72.8777],
  'bengaluru': [12.9716, 77.5946],
  'bangalore': [12.9716, 77.5946],
  'chennai': [13.0827, 80.2707],
  'kolkata': [22.5726, 88.3639],
  'hyderabad': [17.3850, 78.4867],
  'pune': [18.5204, 73.8567],
  'ahmedabad': [23.0225, 72.5714],
  'jaipur': [26.9124, 75.7873],
  'lucknow': [26.8467, 80.9462],
  'ayodhya': [26.7922, 82.1998],
  'varanasi': [25.3176, 82.9739],
  'agra': [27.1767, 78.0081],
  'kanpur': [26.4499, 80.3319],
  'patna': [25.5941, 85.1376],
  'bhopal': [23.2599, 77.4126],
  'indore': [22.7196, 75.8577],
  'nagpur': [21.1458, 79.0882],
  'surat': [21.1702, 72.8311],
  'chandigarh': [30.7333, 76.7794],
  'new delhi': [28.6139, 77.2090],
  'delhi': [28.6139, 77.2090],
  'noida': [28.5355, 77.3910],
  'gurgaon': [28.4595, 77.0266],
  'gurugram': [28.4595, 77.0266],
  'thiruvananthapuram': [8.5241, 76.9366],
  'kochi': [9.9312, 76.2673],
  'coimbatore': [11.0168, 76.9558],
  'visakhapatnam': [17.6868, 83.2185],
  'dehradun': [30.3165, 78.0322],
  'ranchi': [23.3441, 85.3096],
  'guwahati': [26.1445, 91.7362],
  'raipur': [21.2514, 81.6296],
};

/** Indian states list — used for state extraction from address */
export const INDIAN_STATES: string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman & Nicobar', 'Chandigarh',
  'Dadra & Nagar Haveli', 'Daman & Diu', 'Delhi', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

/** AI fallback keyword → category mapping */
export const AI_KEYWORD_CATEGORY_MAP: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['rent', 'land', 'tenant', 'builder', 'property', 'house', 'flat', 'plot'], category: 'Property Dispute' },
  { keywords: ['divorce', 'custody', 'maintenance', 'marriage', 'alimony', 'dowry'], category: 'Family Law' },
  { keywords: ['salary', 'fired', 'unpaid', 'wage', 'employer', 'termination', 'labour'], category: 'Labour Issue' },
  { keywords: ['scam', 'refund', 'defect', 'consumer', 'product', 'warranty', 'billing'], category: 'Consumer Complaint' },
  { keywords: ['police', 'fir', 'bail', 'arrest', 'theft', 'assault', 'murder'], category: 'Criminal Matter' },
  { keywords: ['hack', 'cyber', 'online fraud', 'phishing', 'upi', 'otp'], category: 'Cyber Crime' },
  { keywords: ['business', 'contract', 'partner', 'msme', 'gst', 'tax'], category: 'Business Dispute' }
];