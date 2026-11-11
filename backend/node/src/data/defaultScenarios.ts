export interface DefaultScenarioItem {
  tag: string;
  label: string;
  label_hi?: string;
  icon: string;
  color: string;
  description: string;
  description_hi?: string;
  subtext?: string;
  subtext_hi?: string;
  badge?: string;
  filterKeywords?: string[];
  sortOrder?: number;
}

export const DEFAULT_SCENARIOS: DefaultScenarioItem[] = [
  {
    tag: 'police-stop',
    label: 'Police & Custody',
    label_hi: 'पुलिस और हिरासत',
    icon: 'shield',
    color: 'blue',
    description: 'Arrest memo, 24-hr magistrate rule, D.K. Basu guidelines, sunset female arrest ban',
    description_hi: 'गिरफ्तारी ज्ञापन, 24 घंटे मजिस्ट्रेट नियम, डी.के. बसु दिशानिर्देश',
    subtext: 'Arrest Memo & BNSS §35',
    subtext_hi: 'गिरफ्तारी ज्ञापन और BNSS §35',
    badge: 'BNSS §35',
    filterKeywords: ['police', 'arrest', 'custody', 'detention', 'bnss', 'criminal'],
    sortOrder: 1
  },
  {
    tag: 'traffic-police',
    label: 'Traffic Police',
    label_hi: 'ट्रैफिक पुलिस',
    icon: 'shield-check',
    color: 'amber',
    description: 'DigiLocker Rule 139 validity, ban on vehicle key removal, virtual court contest',
    description_hi: 'डिजिलॉकर नियम 139, वाहन चाबी जब्ती प्रतिबंध, वर्चुअल कोर्ट',
    subtext: 'DigiLocker & Rule 139',
    subtext_hi: 'डिजिलॉकर और नियम 139',
    badge: 'Rule 139',
    filterKeywords: ['traffic', 'challan', 'digilocker', 'vehicle', 'driving'],
    sortOrder: 2
  },
  {
    tag: 'cyber-scam',
    label: 'Cyber & UPI Fraud',
    label_hi: 'साइबर और UPI धोखाधड़ी',
    icon: 'lock',
    color: 'emerald',
    description: 'RBI Zero Liability within 3 days, 1930 Cyber helpline, 10-day shadow refund',
    description_hi: 'RBI 72 घंटे जीरो लायबिलिटी, 1930 हेल्पलाइन, 10 दिन रिफंड',
    subtext: 'Helpline 1930 & 72h Window',
    subtext_hi: 'हेल्पलाइन 1930 और 72 घंटे',
    badge: '1930 / 72h',
    filterKeywords: ['cyber', 'banking', 'scam', 'fraud', 'upi', 'bank'],
    sortOrder: 3
  },
  {
    tag: 'tenant-eviction',
    label: 'Landlord Lockout',
    label_hi: 'मकान मालिक बेदखली',
    icon: 'home',
    color: 'indigo',
    description: 'Ban on cutting electricity/water, 30-day notice, 2-month deposit cap under MTA',
    description_hi: 'बिजली/पानी काटने पर प्रतिबंध, 30 दिन नोटिस, MTA के तहत 2 महीने जमा सीमा',
    subtext: 'Essential Services & Tenancy',
    subtext_hi: 'आवश्यक सेवाएं और किरायेदारी',
    badge: 'BNS §432',
    filterKeywords: ['tenant', 'landlord', 'eviction', 'housing', 'rent'],
    sortOrder: 4
  },
  {
    tag: 'medical-emergency',
    label: 'Hospital Refusal',
    label_hi: 'अस्पताल इनकार',
    icon: 'heart',
    color: 'rose',
    description: 'Unconditional emergency treatment under Katara verdict, ban on corpse detention',
    description_hi: 'कटारा फैसले के तहत बिना शर्त आपातकालीन उपचार, शव रोकने पर प्रतिबंध',
    subtext: 'Emergency Care Mandate',
    subtext_hi: 'आपातकालीन देखभाल आदेश',
    badge: 'Article 21',
    filterKeywords: ['medical', 'hospital', 'patient', 'health', 'emergency'],
    sortOrder: 5
  },
  {
    tag: 'women-safety',
    label: 'Women Safety',
    label_hi: 'महिला सुरक्षा',
    icon: 'users',
    color: 'purple',
    description: 'Sunset arrest ban for women, Zero FIR, POSH Act ICC mandatory committee',
    description_hi: 'महिलाओं के लिए सूर्यास्त गिरफ्तारी प्रतिबंध, जीरो FIR, POSH अधिनियम',
    subtext: 'Sunset Arrest Ban & 1090',
    subtext_hi: 'सूर्यास्त गिरफ्तारी प्रतिबंध और 1090',
    badge: 'Zero FIR',
    filterKeywords: ['women', 'domestic', 'posh', 'workplace-harassment'],
    sortOrder: 6
  },
  {
    tag: 'consumer-refund',
    label: 'Consumer & Scams',
    label_hi: 'उपभोक्ता और धोखाधड़ी',
    icon: 'shopping-cart',
    color: 'amber',
    description: 'Consumer Protection Act 2019: dark patterns ban, E-Daakhil filing, NCH 1915',
    description_hi: 'उपभोक्ता संरक्षण अधिनियम 2019: ई-दाखिल, NCH 1915',
    subtext: 'Defective Goods & 1915',
    subtext_hi: 'दोषपूर्ण सामान और 1915',
    badge: 'CPA §2(47)',
    filterKeywords: ['consumer', 'ecommerce', 'refund', 'defective'],
    sortOrder: 7
  },
  {
    tag: 'flight-delay',
    label: 'Flight Delay',
    label_hi: 'उड़ान विलंब',
    icon: 'globe',
    color: 'sky',
    description: 'DGCA Passenger Charter: compensation up to ₹20,000, free meals & hotels',
    description_hi: 'DGCA यात्री चार्टर: ₹20,000 तक मुआवजा, मुफ्त भोजन और होटल',
    subtext: 'DGCA Passenger Charter',
    subtext_hi: 'DGCA यात्री चार्टर',
    badge: 'DGCA CAR',
    filterKeywords: ['flight', 'airline', 'airport', 'dgca', 'aviation'],
    sortOrder: 8
  },
  {
    tag: 'workplace-harassment',
    label: 'Workplace / POSH',
    label_hi: 'कार्यस्थल / POSH',
    icon: 'briefcase',
    color: 'purple',
    description: 'POSH Act 2013: mandatory Internal Committee, confidentiality, 90-day inquiry',
    description_hi: 'POSH अधिनियम 2013: अनिवार्य आंतरिक समिति, गोपनीयता, 90 दिन जांच',
    subtext: 'POSH Act & ICC',
    subtext_hi: 'POSH अधिनियम और ICC',
    badge: 'POSH 2013',
    filterKeywords: ['workplace', 'harassment', 'posh', 'icc', 'employer'],
    sortOrder: 9
  }
];