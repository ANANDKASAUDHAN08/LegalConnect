export interface ResourceTypeConfig {
  value: string;
  label: string;
  labelHi: string;
  badgeClass: string;
  pinColor: string;
  icon: string;
  description: string;
}

export const RESOURCE_TYPE_CONFIG: Record<string, ResourceTypeConfig> = {
  Court: {
    value: 'Court',
    label: 'District Court',
    labelHi: 'जिला न्यायालय',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    pinColor: '#3b82f6',
    icon: 'landmark',
    description: 'District & Sessions Courts, Civil Courts, and High Court benches'
  },
  LegalAid: {
    value: 'LegalAid',
    label: 'Legal Aid Center',
    labelHi: 'कानूनी सहायता केंद्र',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    pinColor: '#a855f7',
    icon: 'shield',
    description: 'DLSA, SLSA, and TLSC free legal defense desks with panel lawyers'
  },
  PoliceStation: {
    value: 'PoliceStation',
    label: 'Police Station',
    labelHi: 'पुलिस स्टेशन',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    pinColor: '#ef4444',
    icon: 'alert-triangle',
    description: 'Jurisdictional police stations, cyber crime cells, and women help desks'
  },
  GovernmentOffice: {
    value: 'GovernmentOffice',
    label: 'Government Office',
    labelHi: 'सरकारी कार्यालय',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    pinColor: '#f59e0b',
    icon: 'briefcase',
    description: 'Sub-Divisional Magistrate (SDM), Tehsil, and revenue administrative offices'
  },
  Helpline: {
    value: 'Helpline',
    label: 'Helpline',
    labelHi: 'हेल्पलाइन',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    pinColor: '#f43f5e',
    icon: 'phone',
    description: 'Emergency 24/7 legal aid, women distress, and cyber fraud tele-counseling'
  },
  Notary: {
    value: 'Notary',
    label: 'Public Notary',
    labelHi: 'पब्लिक नोटरी',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    pinColor: '#10b981',
    icon: 'file-text',
    description: 'Government certified notaries for affidavit attestation & agreement stamping'
  },
  LokAdalat: {
    value: 'LokAdalat',
    label: 'Lok Adalat',
    labelHi: 'लोक अदालत',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    pinColor: '#14b8a6',
    icon: 'scale',
    description: 'People\'s courts for rapid pre-litigation and pending dispute settlements'
  },
  MediationCenter: {
    value: 'MediationCenter',
    label: 'Mediation Center',
    labelHi: 'मध्यस्थता केंद्र',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    pinColor: '#06b6d4',
    icon: 'users',
    description: 'Court-annexed ADR mediation centers for amicable civil and marital resolution'
  },
  BarAssociation: {
    value: 'BarAssociation',
    label: 'Bar Association',
    labelHi: 'बार एसोसिएशन',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    pinColor: '#6366f1',
    icon: 'award',
    description: 'Court complex advocates bar associations and legal practitioner chambers'
  }
};

export const CANONICAL_RESOURCE_TYPES = Object.values(RESOURCE_TYPE_CONFIG);

/** 28 Indian States */
export const INDIAN_STATES: readonly string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

/** 8 Union Territories */
export const UNION_TERRITORIES: readonly string[] = [
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

/** Canonical list of all 36 States & Union Territories */
export const INDIAN_STATES_AND_UTS: readonly string[] = [
  ...INDIAN_STATES,
  ...UNION_TERRITORIES
];

/**
 * Resolves standard human-friendly label for any resource type with bilingual support
 */
export function getResourceTypeLabel(type?: string | null, lang: 'en' | 'hi' = 'en'): string {
  if (!type) return 'Institution';
  const conf = RESOURCE_TYPE_CONFIG[type];
  if (!conf) return type;
  return lang === 'hi' ? conf.labelHi : conf.label;
}

/**
 * Resolves consistent Tailwind badge CSS classes for any resource type
 */
export function getResourceTypeBadgeClass(type?: string | null): string {
  if (!type) return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
  return RESOURCE_TYPE_CONFIG[type]?.badgeClass || 'bg-slate-500/10 text-slate-600 border-slate-500/20';
}

/**
 * Resolves icon name for <app-icon> corresponding to the resource type
 */
export function getResourceTypeIcon(type?: string | null): string {
  if (!type) return 'landmark';
  return RESOURCE_TYPE_CONFIG[type]?.icon || 'landmark';
}

/** Contributor Roles for Resource Suggestions */
export const SUBMITTER_ROLES = [
  { value: 'Citizen', label: 'Citizen / Beneficiary', icon: 'user', desc: 'Seeking or using local legal services' },
  { value: 'Advocate', label: 'Practicing Advocate', icon: 'award', desc: 'Member of State Bar Council' },
  { value: 'CourtOfficial', label: 'Court / DLSA Official', icon: 'landmark', desc: 'Institutional staff / Registry officer' },
  { value: 'NGO', label: 'NGO / Legal Aid Worker', icon: 'shield', desc: 'Civil rights organization / Paralegal' }
] as const;

/** Affordability & Cost Structure Options */
export const RESOURCE_FEE_TYPES = [
  { value: 'FreeLegalAid', label: '100% Free Legal Aid', icon: 'shield-check', color: 'emerald', desc: 'Govt NALSA / DLSA free representation' },
  { value: 'ProBono', label: 'Pro Bono (Free)', icon: 'heart', color: 'indigo', desc: 'Voluntary free defense by advocates / NGOs' },
  { value: 'StatutoryNotary', label: 'Statutory Govt / Notary Fees', icon: 'file-text', color: 'amber', desc: 'Standard regulated stamping & affidavit rates' },
  { value: 'Subsidized', label: 'Subsidized / Sliding Scale', icon: 'dollar-sign', color: 'purple', desc: 'Income-based nominal charges' }
] as const;

/** Operational Schedule Presets */
export const OPERATING_SCHEDULE_OPTIONS = [
  { value: 'Mon-Sat', label: 'Mon – Sat (Standard)', hours: '09:30 AM - 05:00 PM' },
  { value: 'Mon-Fri', label: 'Mon – Fri (Court Days)', hours: '10:00 AM - 05:00 PM' },
  { value: 'WeekendsOnly', label: 'Weekend Clinic Only', hours: '10:00 AM - 02:00 PM (Sat/Sun)' },
  { value: '24x7Emergency', label: '24x7 Emergency Helpdesk', hours: 'Round-the-clock 24/7' }
] as const;

/** Target Citizen Groups & Specialized Focus Desks */
export const TARGET_BENEFICIARY_TAGS = [
  { key: 'Women & Mahila Cell', label: 'Women & Mahila Desk (181 / DV Act)', icon: 'shield' },
  { key: 'Senior Citizens', label: 'Senior Citizens & Maintenance', icon: 'user-check' },
  { key: 'Under-trials & Bail', label: 'Under-trials & Bail Defense (LADCS)', icon: 'scale' },
  { key: 'POCSO & Children', label: 'Children / POCSO & Juvenile Justice', icon: 'heart' },
  { key: 'Cyber Crime', label: 'Cyber Crime & Online Fraud Cell', icon: 'globe' },
  { key: 'Labor & Workers', label: 'Labor & Industrial Disputes', icon: 'briefcase' },
  { key: 'General Public', label: 'General Public (All Civic Matters)', icon: 'users' }
] as const;

/** Canonical Indian State and City Coordinates [lat, lng] */
export const INDIAN_GEO_CENTROIDS: Record<string, [number, number]> = {
  // Major Metros & Cities
  'delhi': [28.6139, 77.2090],
  'new delhi': [28.6139, 77.2090],
  'central delhi': [28.6517, 77.2219],
  'mumbai': [19.0760, 72.8777],
  'bengaluru': [12.9716, 77.5946],
  'bangalore': [12.9716, 77.5946],
  'hyderabad': [17.3850, 78.4867],
  'chennai': [13.0827, 80.2707],
  'kolkata': [22.5726, 88.3639],
  'ahmedabad': [23.0225, 72.5714],
  'pune': [18.5204, 73.8567],
  'jaipur': [26.9124, 75.7873],
  'lucknow': [26.8467, 80.9462],
  'patna': [25.5941, 85.1376],
  'chandigarh': [30.7333, 76.7794],
  'bhopal': [23.2599, 77.4126],
  'ranchi': [23.3441, 85.3096],
  'guwahati': [26.1445, 91.7362],
  'thiruvananthapuram': [8.5241, 76.9366],
  'kochi': [9.9312, 76.2673],
  'shimla': [31.1048, 77.1734],
  'dehradun': [30.3165, 78.0322],
  'bhubaneswar': [20.2961, 85.8245],
  'cuttack': [20.4625, 85.8828],
  'raipur': [21.2514, 81.6296],
  'srinagar': [34.0837, 74.7973],
  'jammu': [32.7266, 74.8570],
  'surat': [21.1702, 72.8311],
  'varanasi': [25.3176, 82.9739],
  'agra': [27.1767, 78.0081],
  'indore': [22.7196, 75.8577],
  'nagpur': [21.1458, 79.0882],
  'visakhapatnam': [17.6868, 83.2185],
  'amritsar': [31.6340, 74.8723],
  'ludhiana': [30.9010, 75.8573],
  'kanpur': [26.4499, 80.3319],
  'allahabad': [25.4358, 81.8463],
  'prayagraj': [25.4358, 81.8463],
  'meerut': [28.9845, 77.7064],
  'noida': [28.5355, 77.3910],
  'greater noida': [28.4744, 77.5040],
  'ghaziabad': [28.6692, 77.4538],
  'gurugram': [28.4595, 77.0266],
  'gurgaon': [28.4595, 77.0266],
  'faridabad': [28.4089, 77.3178],
  // Tier 2/3 Cities & District Headquarters
  'coimbatore': [11.0168, 76.9558],
  'madurai': [9.9252, 78.1198],
  'jodhpur': [26.2389, 73.0243],
  'nashik': [19.9975, 73.7898],
  'vijayawada': [16.5062, 80.6480],
  'rajkot': [22.3039, 70.8022],
  'vadodara': [22.3072, 73.1812],
  'gwalior': [26.2183, 78.1828],
  'jabalpur': [23.1815, 79.9864],
  'udaipur': [24.5854, 73.7125],
  'ayodhya': [26.7922, 82.1998],
  'gorakhpur': [26.7606, 83.3732],
  'bareilly': [28.3670, 79.4304],
  'aligarh': [27.8974, 78.0880],
  'moradabad': [28.8389, 78.7768],
  'jhansi': [25.4484, 78.5685],
  'mathura': [27.4924, 77.6737],
  'muzaffarnagar': [29.4727, 77.7085],
  'saharanpur': [29.9680, 77.5510],
  // NE State Capitals
  'panaji': [15.4909, 73.8278],
  'imphal': [24.8170, 93.9368],
  'shillong': [25.5788, 91.8933],
  'kohima': [25.6751, 94.1086],
  'gangtok': [27.3389, 88.6065],
  'aizawl': [23.7271, 92.7176],
  'agartala': [23.8315, 91.2868],
  'itanagar': [27.0844, 93.6053],
  'port blair': [11.6234, 92.7265],
  'leh': [34.1526, 77.5771],
  // States & UTs
  'andhra pradesh': [15.9129, 79.7400],
  'arunachal pradesh': [28.2180, 94.7278],
  'assam': [26.2006, 92.9376],
  'bihar': [25.0961, 85.3131],
  'chhattisgarh': [21.2787, 81.8661],
  'goa': [15.2993, 74.1240],
  'gujarat': [22.2587, 71.1924],
  'haryana': [29.0588, 76.0856],
  'himachal pradesh': [31.1048, 77.1734],
  'jharkhand': [23.6102, 85.2799],
  'karnataka': [15.3173, 75.7139],
  'kerala': [10.8505, 76.2711],
  'madhya pradesh': [22.9734, 78.6569],
  'maharashtra': [19.7515, 75.7139],
  'manipur': [24.6637, 93.9063],
  'meghalaya': [25.4670, 91.3662],
  'mizoram': [23.1645, 92.9376],
  'nagaland': [26.1584, 94.5624],
  'odisha': [20.9517, 85.0985],
  'punjab': [31.1471, 75.3412],
  'rajasthan': [27.0238, 74.2179],
  'sikkim': [27.5330, 88.5122],
  'tamil nadu': [11.1271, 78.6569],
  'telangana': [18.1124, 79.0193],
  'tripura': [23.9408, 91.9882],
  'uttar pradesh': [26.8467, 80.9462],
  'uttarakhand': [30.0668, 79.0193],
  'west bengal': [22.9868, 87.8550],
  'andaman and nicobar islands': [11.7401, 92.6586],
  'ladakh': [34.1526, 77.5771],
  'jammu and kashmir': [33.7782, 76.5762],
  'puducherry': [11.9416, 79.8083]
};

/**
 * Resolves standard coordinates for any Indian city or state
 */
export function getGeoCentroid(locationKey?: string): [number, number] {
  if (!locationKey) return [28.6139, 77.2090];
  const clean = locationKey.toLowerCase().trim();
  return INDIAN_GEO_CENTROIDS[clean] || [28.6139, 77.2090];
}

/** Canonical Validation Constraints (Mirroring Backend API Rules) */
export const RESOURCE_VALIDATION_RULES = {
  name: { min: 3, max: 200 },
  type: { max: 30 },
  city: { max: 100 },
  district: { max: 100 },
  state: { max: 60 },
  pincode: { length: 6, regex: /^\d{6}$/ },
  address: { max: 500 },
  website: { max: 200 },
  operatingHours: { max: 100 },
  operatingDays: { max: 30 },
  lunchBreak: { max: 50 },
  feeType: { max: 30 },
  notes: { max: 1000 },
  contactNumber: { max: 50 },
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  coordinateBounds: {
    minLat: -90,
    maxLat: 90,
    minLng: -180,
    maxLng: 180
  },
  imageUpload: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  }
} as const;

/**
 * Official dictionary of all 28 Indian States & 8 Union Territories
 * with their respective administrative and judicial districts.
 */
export const INDIAN_STATES_DISTRICTS: Record<string, string[]> = {
  'Andhra Pradesh': [
    'Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool',
    'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa'
  ],
  'Arunachal Pradesh': [
    'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang', 'Itanagar Capital Complex',
    'Lohit', 'Lower Subansiri', 'Papum Pare', 'Tawang', 'Tirap', 'Upper Siang', 'West Kameng'
  ],
  'Assam': [
    'Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang',
    'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Goalpara', 'Golaghat', 'Hailakandi',
    'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan (Guwahati)', 'Karbi Anglong',
    'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari',
    'Sivasagar', 'Sonitpur', 'Tinsukia', 'Udalguri'
  ],
  'Bihar': [
    'Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur',
    'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad',
    'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani',
    'Munger', 'Muzaffarpur', 'Nalanda (Bihar Sharif)', 'Nawada', 'Patna', 'Purnia',
    'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi',
    'Siwan', 'Supaul', 'Vaishali', 'West Champaran'
  ],
  'Chhattisgarh': [
    'Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bijapur', 'Bilaspur',
    'Dantewada', 'Dhamtari', 'Durg', 'Gariaband', 'Janjgir-Champa', 'Jashpur', 'Kabirdham',
    'Kanker', 'Kondagaon', 'Korba', 'Koriya', 'Mahasamund', 'Mungeli', 'Narayanpur',
    'Raigarh', 'Raipur', 'Rajnandgaon', 'Sukma', 'Surajpur', 'Surguja'
  ],
  'Goa': [
    'North Goa (Panaji)', 'South Goa (Margao)'
  ],
  'Gujarat': [
    'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar',
    'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar',
    'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana',
    'Morbi', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot',
    'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'
  ],
  'Haryana': [
    'Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram',
    'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh',
    'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'
  ],
  'Himachal Pradesh': [
    'Bilaspur', 'Chamba', 'Hamirpur', 'Kangra (Dharamshala)', 'Kinnaur', 'Kullu',
    'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'
  ],
  'Jharkhand': [
    'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum (Jamshedpur)',
    'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti',
    'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi',
    'Sahibganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum'
  ],
  'Karnataka': [
    'Bagalkote', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar',
    'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada (Mangaluru)',
    'Davanagere', 'Dharwad (Hubballi)', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi',
    'Kodagu (Madikeri)', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara',
    'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada', 'Vijayapura', 'Yadgir'
  ],
  'Kerala': [
    'Alappuzha', 'Ernakulam (Kochi)', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam',
    'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram',
    'Thrissur', 'Wayanad'
  ],
  'Madhya Pradesh': [
    'Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul',
    'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia',
    'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad (Narmadapuram)',
    'Indore', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur',
    'Morena', 'Narsinghpur', 'Neemuch', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa',
    'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri',
    'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'
  ],
  'Maharashtra': [
    'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad (Chhatrapati Sambhajinagar)', 'Beed',
    'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli',
    'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur',
    'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad (Dharashiv)', 'Palghar', 'Parbhani',
    'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur',
    'Thane', 'Wardha', 'Washim', 'Yavatmal'
  ],
  'Manipur': [
    'Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam',
    'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong',
    'Tengnoupal', 'Thoubal', 'Ukhrul'
  ],
  'Meghalaya': [
    'East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills (Shillong)', 'North Garo Hills',
    'Ri Bhoi', 'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills',
    'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills'
  ],
  'Mizoram': [
    'Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai', 'Lunglei',
    'Mamit', 'Saiha', 'Saitual', 'Serchhip'
  ],
  'Nagaland': [
    'Chumoukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung', 'Mon',
    'Niuland', 'Noklak', 'Peren', 'Phek', 'Shamator', 'Tseminyu', 'Tuensang', 'Wokha', 'Zunheboto'
  ],
  'Odisha': [
    'Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack',
    'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda',
    'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khurda (Bhubaneswar)', 'Koraput',
    'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri', 'Rayagada',
    'Sambalpur', 'Subarnapur', 'Sundargarh'
  ],
  'Punjab': [
    'Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka',
    'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana',
    'Malerkotla', 'Mansa', 'Moga', 'Muktsar', 'Pathankot', 'Patiala', 'Rupnagar',
    'Sahibzada Ajit Singh Nagar (Mohali)', 'Sangrur', 'Shahid Bhagat Singh Nagar (Nawanshahr)',
    'Tarn Taran'
  ],
  'Rajasthan': [
    'Ajmer', 'Alwar', 'Anupgarh', 'Balotra', 'Banswara', 'Baran', 'Barmer', 'Beawar',
    'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa',
    'Deeg', 'Didwana-Kuchaman', 'Dholpur', 'Dudu', 'Dungarpur', 'Ganganagar', 'Gangapur City',
    'Hanumangarh', 'Jaipur', 'Jaipur Rural', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu',
    'Jodhpur', 'Jodhpur Rural', 'Karauli', 'Kekri', 'Khairthal-Tijara', 'Kota', 'Kotputli-Behror',
    'Nagaur', 'Neem Ka Thana', 'Pali', 'Phalodi', 'Pratapgarh', 'Rajsamand', 'Salumbar',
    'Sanchore', 'Sawai Madhopur', 'Shahpura', 'Sikar', 'Sirohi', 'Tonk', 'Udaipur'
  ],
  'Sikkim': [
    'Gangtok', 'Gyalshing', 'Mangan', 'Namchi', 'Pakyong', 'Soreng'
  ],
  'Tamil Nadu': [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
    'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Kanyakumari', 'Karur',
    'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris',
    'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga',
    'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
    'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
    'Viluppuram', 'Virudhunagar'
  ],
  'Telangana': [
    'Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon',
    'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam',
    'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak',
    'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet', 'Nirmal',
    'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet',
    'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 'Hanamkonda', 'Yadadri Bhuvanagiri'
  ],
  'Tripura': [
    'Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala', 'South Tripura',
    'Unakoti', 'West Tripura (Agartala)'
  ],
  'Uttar Pradesh': [
    'Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya',
    'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki',
    'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli',
    'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad',
    'Gautam Buddha Nagar (Noida)', 'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur',
    'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat',
    'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kushinagar', 'Lakhimpur Kheri', 'Lalitpur',
    'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut',
    'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj (Allahabad)',
    'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur',
    'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur',
    'Unnao', 'Varanasi'
  ],
  'Uttarakhand': [
    'Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital',
    'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar',
    'Uttarkashi'
  ],
  'West Bengal': [
    'Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling',
    'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda',
    'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur',
    'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'
  ],

  // Union Territories
  'Andaman and Nicobar Islands': [
    'Nicobar', 'North and Middle Andaman', 'South Andaman (Port Blair)'
  ],
  'Chandigarh': [
    'Chandigarh'
  ],
  'Dadra and Nagar Haveli and Daman and Diu': [
    'Dadra and Nagar Haveli', 'Daman', 'Diu'
  ],
  'Delhi': [
    'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi',
    'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'
  ],
  'Jammu & Kashmir': [
    'Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu',
    'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri',
    'Ramban', 'Reasi', 'Samba', 'Shopian', 'Srinagar', 'Udhampur'
  ],
  'Ladakh': [
    'Kargil', 'Leh'
  ],
  'Lakshadweep': [
    'Lakshadweep (Kavaratti)'
  ],
  'Puducherry': [
    'Karaikal', 'Mahe', 'Puducherry', 'Yanam'
  ]
};

/**
 * Get all districts for a given Indian State or UT with robust fuzzy/normalized key matching
 */
export function getStateDistricts(stateName: string): string[] {
  if (!stateName) return [];
  
  if (INDIAN_STATES_DISTRICTS[stateName]) {
    return [...INDIAN_STATES_DISTRICTS[stateName]];
  }

  const normalize = (s: string) => (s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bislands\b/g, '')
    .replace(/\but\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const targetNorm = normalize(stateName);
  for (const [key, districts] of Object.entries(INDIAN_STATES_DISTRICTS)) {
    if (normalize(key) === targetNorm) {
      return [...districts];
    }
  }

  return [];
}