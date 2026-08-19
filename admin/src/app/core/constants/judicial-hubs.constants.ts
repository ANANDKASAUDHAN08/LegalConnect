import { INDIAN_STATES, INDIAN_STATES_DISTRICTS, getStateDistricts } from './geo.constants';

export interface LocationSearchResult {
  title: string;
  subtitle: string;
  address: string;
  district: string;
  state: string;
  city: string;
  pincode?: string;
  lat: number;
  lng: number;
  type: 'judicial_hub' | 'district' | 'state' | 'geocoded';
}

/**
 * Benchmark Indian Judicial Institutions & High Court complexes with verified coordinates
 */
export const MAJOR_JUDICIAL_HUBS: LocationSearchResult[] = [
  {
    title: 'Supreme Court of India (Apex Court)',
    subtitle: 'Tilak Marg, Mandi House, New Delhi',
    address: 'Tilak Marg, Mandi House, New Delhi, Delhi 110001',
    district: 'New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    lat: 28.6225,
    lng: 77.2393,
    type: 'judicial_hub'
  },
  {
    title: 'High Court of Delhi',
    subtitle: 'Sher Shah Road, Justice SB Marg, New Delhi',
    address: 'Sher Shah Road, Near India Gate, New Delhi, Delhi 110503',
    district: 'New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110503',
    lat: 28.6083,
    lng: 77.2378,
    type: 'judicial_hub'
  },
  {
    title: 'Tis Hazari District & Sessions Courts',
    subtitle: 'Morigate, Old Delhi Judicial Complex',
    address: 'Tis Hazari Court Complex, Morigate, Delhi 110054',
    district: 'Central Delhi',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110054',
    lat: 28.6675,
    lng: 77.2183,
    type: 'judicial_hub'
  },
  {
    title: 'Saket District Courts & DLSA South',
    subtitle: 'Press Enclave Road, Saket, New Delhi',
    address: 'District Court Complex, Press Enclave Road, Saket, New Delhi, Delhi 110017',
    district: 'South Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110017',
    lat: 28.5284,
    lng: 77.2182,
    type: 'judicial_hub'
  },
  {
    title: 'Patiala House District Courts & DLSA',
    subtitle: 'India Gate Circle, New Delhi',
    address: 'Patiala House Court Complex, India Gate, New Delhi, Delhi 110001',
    district: 'New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    lat: 28.6143,
    lng: 77.2348,
    type: 'judicial_hub'
  },
  {
    title: 'Karkardooma District Courts Complex',
    subtitle: 'Surajmal Vihar, Shahdara, East Delhi',
    address: 'Karkardooma Courts Complex, Maharaj Surajmal Marg, Delhi 110032',
    district: 'East Delhi',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110032',
    lat: 28.6534,
    lng: 77.2978,
    type: 'judicial_hub'
  },
  {
    title: 'High Court of Judicature at Bombay (Mumbai)',
    subtitle: 'Fort, Mumbai, Maharashtra',
    address: 'Dr. Kane Road, Fort, Mumbai, Maharashtra 400032',
    district: 'Mumbai City',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400032',
    lat: 18.9298,
    lng: 72.8301,
    type: 'judicial_hub'
  },
  {
    title: 'High Court of Karnataka (Principal Bench)',
    subtitle: 'Attara Kacheri, Opp. Vidhana Soudha, Bengaluru',
    address: 'Opp. Vidhana Soudha, Ambedkar Veedhi, Bengaluru, Karnataka 560001',
    district: 'Bengaluru Urban',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    lat: 12.9786,
    lng: 77.5919,
    type: 'judicial_hub'
  },
  {
    title: 'High Court of Calcutta (Kolkata)',
    subtitle: 'Esplanade Row West, BBD Bagh, Kolkata',
    address: '3, Esplanade Row West, B.B.D. Bagh, Kolkata, West Bengal 700001',
    district: 'Kolkata',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700001',
    lat: 22.5684,
    lng: 88.3432,
    type: 'judicial_hub'
  },
  {
    title: 'High Court of Judicature at Madras (Chennai)',
    subtitle: 'George Town, Chennai, Tamil Nadu',
    address: 'High Court Building, N.S.C. Bose Road, George Town, Chennai, Tamil Nadu 600104',
    district: 'Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600104',
    lat: 13.0882,
    lng: 80.2882,
    type: 'judicial_hub'
  },
  {
    title: 'High Court of Judicature at Allahabad (Prayagraj)',
    subtitle: 'Nyaya Marg, Canton, Prayagraj',
    address: 'Nyaya Marg, Cantonment, Prayagraj (Allahabad), Uttar Pradesh 211017',
    district: 'Prayagraj (Allahabad)',
    city: 'Prayagraj',
    state: 'Uttar Pradesh',
    pincode: '211017',
    lat: 25.4528,
    lng: 81.8219,
    type: 'judicial_hub'
  },
  {
    title: 'High Court of Gujarat (Ahmedabad)',
    subtitle: 'S.G. Highway, Sola, Ahmedabad',
    address: 'Sarkhej - Gandhinagar Hwy, Sola, Ahmedabad, Gujarat 380060',
    district: 'Ahmedabad',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380060',
    lat: 23.0768,
    lng: 72.5298,
    type: 'judicial_hub'
  },
  {
    title: 'High Court of Telangana (Hyderabad)',
    subtitle: 'High Court Road, Ghansi Bazaar, Hyderabad',
    address: 'High Court Rd, Near City College, Ghansi Bazaar, Hyderabad, Telangana 500066',
    district: 'Hyderabad',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500066',
    lat: 17.3686,
    lng: 78.4721,
    type: 'judicial_hub'
  },
  {
    title: 'Punjab and Haryana High Court (Chandigarh)',
    subtitle: 'Capitol Complex, Sector 1, Chandigarh',
    address: 'Capitol Complex, Sector 1, Chandigarh, 160001',
    district: 'Chandigarh',
    city: 'Chandigarh',
    state: 'Chandigarh',
    pincode: '160001',
    lat: 30.7587,
    lng: 76.8041,
    type: 'judicial_hub'
  },
  {
    title: 'High Court of Kerala (Ernakulam/Kochi)',
    subtitle: 'Marine Drive, Ernakulam, Kochi',
    address: 'High Court Rd, Marine Drive, Ernakulam, Kochi, Kerala 682031',
    district: 'Ernakulam (Kochi)',
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682031',
    lat: 9.9839,
    lng: 76.2764,
    type: 'judicial_hub'
  },
  {
    title: 'Rajasthan High Court (Jaipur Bench)',
    subtitle: 'Janpath, Near Secretariat, Jaipur',
    address: 'Janpath, Bhagwan Das Road, C Scheme, Ashok Nagar, Jaipur, Rajasthan 302005',
    district: 'Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302005',
    lat: 26.9048,
    lng: 75.8024,
    type: 'judicial_hub'
  },
  {
    title: 'Patna High Court',
    subtitle: 'Bailey Road, Patna, Bihar',
    address: 'Jawaharlal Nehru Marg, Bailey Rd, Patna, Bihar 800028',
    district: 'Patna',
    city: 'Patna',
    state: 'Bihar',
    pincode: '800028',
    lat: 25.6094,
    lng: 85.1276,
    type: 'judicial_hub'
  }
];

/**
 * 0-Latency Local Jurisdiction Search Engine
 * Searches across Major Judicial Hubs, Indian States, and 750+ Districts
 */
export function searchLocalJurisdictions(query: string, maxResults = 8): LocationSearchResult[] {
  if (!query || !query.trim()) {
    return MAJOR_JUDICIAL_HUBS.slice(0, maxResults);
  }

  const q = query.trim().toLowerCase();
  const results: LocationSearchResult[] = [];
  const seenKeys = new Set<string>();

  // 1. Check Major Judicial Hubs
  for (const hub of MAJOR_JUDICIAL_HUBS) {
    if (
      hub.title.toLowerCase().includes(q) ||
      hub.subtitle.toLowerCase().includes(q) ||
      hub.district.toLowerCase().includes(q) ||
      hub.state.toLowerCase().includes(q) ||
      (hub.pincode && hub.pincode.includes(q))
    ) {
      results.push(hub);
      seenKeys.add(`${hub.title}-${hub.state}`);
    }
  }

  // 2. Check Districts across all states
  for (const [stateName, districts] of Object.entries(INDIAN_STATES_DISTRICTS)) {
    for (const district of districts) {
      const distLower = district.toLowerCase();
      if (distLower.includes(q) || `${distLower}, ${stateName.toLowerCase()}`.includes(q)) {
        const key = `${district}-${stateName}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push({
            title: `${district} District & Sessions Jurisdiction`,
            subtitle: `${stateName}, India`,
            address: `District Court Complex, ${district}, ${stateName}`,
            district: district,
            city: district.split(' ')[0].replace(/[()]/g, ''),
            state: stateName,
            lat: getApproximateStateLat(stateName),
            lng: getApproximateStateLng(stateName),
            type: 'district'
          });
        }
      }
      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }

  // 3. Check State Names
  if (results.length < maxResults) {
    for (const stateName of INDIAN_STATES) {
      if (stateName.toLowerCase().includes(q)) {
        const key = `state-${stateName}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const firstDist = INDIAN_STATES_DISTRICTS[stateName]?.[0] || stateName;
          results.push({
            title: `${stateName} State Judicial Jurisdiction`,
            subtitle: `All ${INDIAN_STATES_DISTRICTS[stateName]?.length || 0} Districts • High Court Jurisdiction`,
            address: `State Legal Services Authority, ${stateName}`,
            district: firstDist,
            city: firstDist.split(' ')[0].replace(/[()]/g, ''),
            state: stateName,
            lat: getApproximateStateLat(stateName),
            lng: getApproximateStateLng(stateName),
            type: 'state'
          });
        }
      }
      if (results.length >= maxResults) break;
    }
  }

  return results.slice(0, maxResults);
}

/**
 * Extract / parse address components from geocoder or freeform text into State, District, PIN
 */
export function parseAddressToJurisdiction(addressStr: string): {
  state: string;
  district: string;
  pincode: string;
} {
  let matchedState = 'Delhi';
  let matchedDistrict = '';
  let matchedPincode = '';

  if (!addressStr) {
    return { state: matchedState, district: matchedDistrict, pincode: matchedPincode };
  }

  // Extract 6-digit PIN
  const pinMatch = addressStr.match(/\b\d{6}\b/);
  if (pinMatch) {
    matchedPincode = pinMatch[0];
  }

  // Match State from longest to shortest name
  const sortedStates = [...INDIAN_STATES].sort((a, b) => b.length - a.length);
  for (const st of sortedStates) {
    const reg = new RegExp(`\\b${st.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (reg.test(addressStr)) {
      matchedState = st;
      break;
    }
  }

  // Match District within that state (or all states if not found)
  const candidateDistricts = INDIAN_STATES_DISTRICTS[matchedState] || [];
  for (const dist of candidateDistricts) {
    const cleanDist = dist.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (cleanDist && new RegExp(`\\b${cleanDist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(addressStr)) {
      matchedDistrict = dist;
      break;
    }
  }

  if (!matchedDistrict && candidateDistricts.length > 0) {
    matchedDistrict = candidateDistricts[0];
  }

  return {
    state: matchedState,
    district: matchedDistrict,
    pincode: matchedPincode
  };
}

/**
 * Fuzzy matcher to find the best matching district option for a given district query
 */
export function findBestMatchingDistrict(stateName: string, districtQuery: string): string {
  const districts = getStateDistricts(stateName);
  if (!districts.length) return districtQuery;
  if (!districtQuery) return districts[0];

  const q = districtQuery.toLowerCase().trim();
  const exact = districts.find(d => d.toLowerCase() === q);
  if (exact) return exact;

  const partial = districts.find(d => d.toLowerCase().includes(q) || q.includes(d.toLowerCase()));
  if (partial) return partial;

  return districts[0];
}

function getApproximateStateLat(stateName: string): number {
  const coords: Record<string, number> = {
    'Delhi': 28.6139,
    'Maharashtra': 18.9298,
    'Karnataka': 12.9786,
    'West Bengal': 22.5684,
    'Tamil Nadu': 13.0882,
    'Uttar Pradesh': 26.8467,
    'Gujarat': 23.0225,
    'Telangana': 17.3850,
    'Kerala': 9.9839,
    'Rajasthan': 26.9124,
    'Bihar': 25.6094,
    'Punjab': 30.7333,
    'Haryana': 30.7333,
    'Chandigarh': 30.7333
  };
  return coords[stateName] || 28.6139;
}

function getApproximateStateLng(stateName: string): number {
  const coords: Record<string, number> = {
    'Delhi': 77.2090,
    'Maharashtra': 72.8301,
    'Karnataka': 77.5919,
    'West Bengal': 88.3432,
    'Tamil Nadu': 80.2882,
    'Uttar Pradesh': 80.9462,
    'Gujarat': 72.5714,
    'Telangana': 78.4867,
    'Kerala': 76.2764,
    'Rajasthan': 75.8024,
    'Bihar': 85.1276,
    'Punjab': 76.7794,
    'Haryana': 76.7794,
    'Chandigarh': 76.7794
  };
  return coords[stateName] || 77.2090;
}