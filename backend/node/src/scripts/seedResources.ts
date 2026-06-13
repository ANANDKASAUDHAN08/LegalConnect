import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import LegalResource from '../models/LegalResource';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const resources = [
  // ==================== NEW DELHI ====================
  // Legal Aid Centers
  {
    name: 'Delhi District Legal Services Authority (Central DLSA)',
    type: 'LegalAid',
    categories: ['General', 'Property Dispute', 'Family Law', 'Consumer Complaint', 'Labour Issue', 'Criminal Matter', 'Business Dispute'],
    subcategories: ['Legal Aid', 'Free Advice', 'Mediation', 'Lok Adalat'],
    city: 'New Delhi',
    address: 'Room No. 287, Tis Hazari Courts Complex, Delhi - 110054',
    contactNumber: '011-23968470',
    website: 'https://dlsa.delhi.gov.in',
    operatingHours: '10:00 AM - 5:00 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi', 'Punjabi'],
    coordinates: { lat: 28.6625, lng: 77.2104 }
  },
  {
    name: 'New Delhi District Legal Services Authority (NDDLA)',
    type: 'LegalAid',
    categories: ['General', 'Family Law', 'Consumer Complaint', 'Criminal Matter'],
    subcategories: ['Free Representation', 'Legal Awareness'],
    city: 'New Delhi',
    address: 'Patiala House Courts Complex, New Delhi - 110001',
    contactNumber: '011-23072418',
    website: 'https://dlsa.delhi.gov.in',
    operatingHours: '10:00 AM - 5:00 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi'],
    coordinates: { lat: 28.6186, lng: 77.2281 }
  },
  // Courts
  {
    name: 'Tis Hazari District Court',
    type: 'Court',
    categories: ['Property Dispute', 'Criminal Matter', 'Labour Issue', 'Family Law', 'Business Dispute'],
    subcategories: ['Civil Suit', 'Property Dispute', 'Tenancy Dispute', 'Criminal Trial', 'Cheque Bounce'],
    city: 'New Delhi',
    address: 'Tis Hazari Court Complex, Near Tis Hazari Metro Station, Delhi - 110054',
    contactNumber: '011-23961172',
    website: 'https://districts.ecourts.gov.in/tis-hazari',
    operatingHours: '10:00 AM - 4:00 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi'],
    coordinates: { lat: 28.6620, lng: 77.2095 }
  },
  {
    name: 'District Consumer Disputes Redressal Commission (Central)',
    type: 'Court',
    categories: ['Consumer Complaint'],
    subcategories: ['Consumer Court', 'Product Liability', 'Service Defect', 'Insurance Claim'],
    city: 'New Delhi',
    address: 'ISBT Kashmere Gate Complex, Delhi - 110006',
    contactNumber: '011-23861215',
    website: 'http://www.ncdrc.nic.in',
    operatingHours: '10:30 AM - 4:30 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi'],
    coordinates: { lat: 28.6685, lng: 77.2295 }
  },
  {
    name: 'Patiala House Family Court',
    type: 'Court',
    categories: ['Family Law'],
    subcategories: ['Divorce', 'Child Custody', 'Maintenance', 'Domestic Violence Case'],
    city: 'New Delhi',
    address: 'Patiala House Courts Complex, India Gate, New Delhi - 110001',
    contactNumber: '011-23072516',
    website: 'https://districts.ecourts.gov.in/new-delhi',
    operatingHours: '10:00 AM - 4:00 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi'],
    coordinates: { lat: 28.6181, lng: 77.2290 }
  },
  // Police Stations
  {
    name: 'Delhi Police Cyber Crime Unit (Special Cell)',
    type: 'PoliceStation',
    categories: ['Cyber Crime'],
    subcategories: ['Phishing', 'Online Fraud', 'Hacking', 'Identity Theft', 'Cyber Bullying'],
    city: 'New Delhi',
    address: 'Sector 12, Dwarka, Near Dwarka Sector 12 Metro Station, New Delhi - 110075',
    contactNumber: '011-28031130',
    website: 'https://cybercelldelhi.in',
    operatingHours: '24 Hours',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi'],
    coordinates: { lat: 28.5921, lng: 77.0620 }
  },
  {
    name: 'Parliament Street Police Station (Cyber Cell Branch)',
    type: 'PoliceStation',
    categories: ['Cyber Crime', 'Criminal Matter'],
    subcategories: ['Cyber Complaint', 'FIR Lodging', 'Criminal Investigation'],
    city: 'New Delhi',
    address: 'Parliament Street, Sansad Marg Area, New Delhi - 110001',
    contactNumber: '011-23744622',
    website: 'https://www.delhipolice.nic.in',
    operatingHours: '24 Hours',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi'],
    coordinates: { lat: 28.6258, lng: 77.2155 }
  },
  {
    name: 'Crime Against Women (CAW) Cell - Central District',
    type: 'PoliceStation',
    categories: ['Family Law', 'Criminal Matter'],
    subcategories: ['Domestic Violence Helpline', 'Matrimonial Dispute Resolution', 'CAW Cell'],
    city: 'New Delhi',
    address: 'Darya Ganj Police Station Complex, Darya Ganj, New Delhi - 110002',
    contactNumber: '011-23274683',
    website: 'https://www.delhipolice.nic.in',
    operatingHours: '10:00 AM - 6:00 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi'],
    coordinates: { lat: 28.6430, lng: 77.2395 }
  },
  // Government Offices
  {
    name: 'Sub-Registrar Office VIII (Rohini)',
    type: 'GovernmentOffice',
    categories: ['Property Dispute', 'Business Dispute'],
    subcategories: ['Property Registration', 'Title Deed Registration', 'Sale Deed', 'Land Records'],
    city: 'New Delhi',
    address: 'DDA Office Complex, Sector 3, Rohini, New Delhi - 110085',
    contactNumber: '011-27513108',
    website: 'https://revenue.delhi.gov.in',
    operatingHours: '9:30 AM - 5:00 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi'],
    coordinates: { lat: 28.7100, lng: 77.1200 }
  },
  {
    name: 'Office of the Assistant Labour Commissioner (Central District)',
    type: 'GovernmentOffice',
    categories: ['Labour Issue'],
    subcategories: ['Labour Grievance', 'Minimum Wages Dispute', 'Industrial Dispute Act', 'Gratuity Conciliation'],
    city: 'New Delhi',
    address: '5, Sham Nath Marg, Civil Lines, Delhi - 110054',
    contactNumber: '011-23963891',
    website: 'https://labour.delhi.gov.in',
    operatingHours: '9:30 AM - 6:00 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Hindi'],
    coordinates: { lat: 28.6734, lng: 77.2255 }
  },

  // ==================== BENGALURU ====================
  // Legal Aid Centers
  {
    name: 'Karnataka State Legal Services Authority (KSLSA)',
    type: 'LegalAid',
    categories: ['General', 'Property Dispute', 'Family Law', 'Consumer Complaint', 'Labour Issue', 'Criminal Matter', 'Business Dispute'],
    subcategories: ['Legal Aid', 'Lok Adalat', 'Free Representation'],
    city: 'Bengaluru',
    address: 'Nyaya Degula, H. Siddaiah Road, Bengaluru - 560027',
    contactNumber: '080-22111717',
    website: 'https://kslsa.kar.nic.in',
    operatingHours: '10:00 AM - 5:30 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Kannada', 'Hindi'],
    coordinates: { lat: 12.9592, lng: 77.5982 }
  },
  // Courts
  {
    name: 'City Civil Court Bengaluru',
    type: 'Court',
    categories: ['Property Dispute', 'Criminal Matter', 'Labour Issue', 'Family Law', 'Business Dispute'],
    subcategories: ['Civil Suit', 'Property Dispute', 'Matrimonial Dispute', 'Commercial Suit'],
    city: 'Bengaluru',
    address: 'City Civil Court Complex, KG Road, Majestic, Bengaluru - 560009',
    contactNumber: '080-22268481',
    website: 'https://districts.ecourts.gov.in/bengaluru',
    operatingHours: '10:30 AM - 5:00 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Kannada'],
    coordinates: { lat: 12.9780, lng: 77.5750 }
  },
  // Police Stations
  {
    name: 'CID Cyber Crime Police Station Karnataka',
    type: 'PoliceStation',
    categories: ['Cyber Crime'],
    subcategories: ['Phishing', 'Online Ransom', 'Bank Fraud', 'Cyber Complaint Filing'],
    city: 'Bengaluru',
    address: '# 1, Carlton House, Palace Road, Bengaluru - 560001',
    contactNumber: '080-22094498',
    website: 'https://ksp.karnataka.gov.in',
    operatingHours: '24 Hours',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Kannada'],
    coordinates: { lat: 12.9830, lng: 77.5850 }
  },
  // Government Offices
  {
    name: 'Sub-Registrar Office Jayanagar',
    type: 'GovernmentOffice',
    categories: ['Property Dispute'],
    subcategories: ['Property Registration', 'Sale Deed', 'Guideline Value Check', 'Property Khata Support'],
    city: 'Bengaluru',
    address: 'Shopping Complex, 4th Block, Jayanagar, Bengaluru - 560011',
    contactNumber: '080-22442436',
    website: 'https://kaverionline.karnataka.gov.in',
    operatingHours: '10:00 AM - 5:30 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Kannada'],
    coordinates: { lat: 12.9250, lng: 77.5900 }
  },

  // ==================== MUMBAI ====================
  // Legal Aid Centers
  {
    name: 'Maharashtra State Legal Services Authority (MSLSA)',
    type: 'LegalAid',
    categories: ['General', 'Property Dispute', 'Family Law', 'Consumer Complaint', 'Labour Issue', 'Criminal Matter', 'Business Dispute'],
    subcategories: ['Legal Aid', 'Free Representation', 'ADR Cell', 'Lok Adalat Portal'],
    city: 'Mumbai',
    address: 'High Court Extension Building, Fort, Mumbai - 400032',
    contactNumber: '022-22835354',
    website: 'https://legalaid.maharashtra.gov.in',
    operatingHours: '10:00 AM - 5:30 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Marathi', 'Hindi'],
    coordinates: { lat: 18.9304, lng: 72.8311 }
  },
  // Courts
  {
    name: 'Bombay High Court (Pro Bono Cell)',
    type: 'Court',
    categories: ['Property Dispute', 'Criminal Matter', 'Labour Issue', 'Family Law', 'Business Dispute'],
    subcategories: ['Appeals', 'Writ Petitions', 'Property Title Litigation', 'Public Interest Litigation'],
    city: 'Mumbai',
    address: 'Dr. Kane Road, Fort, Mumbai - 400032',
    contactNumber: '022-22676767',
    website: 'https://bombayhighcourt.nic.in',
    operatingHours: '10:30 AM - 4:30 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Marathi'],
    coordinates: { lat: 18.9308, lng: 72.8305 }
  },
  // Police Stations
  {
    name: 'Cyber Police Station BKC Mumbai',
    type: 'PoliceStation',
    categories: ['Cyber Crime'],
    subcategories: ['Cyber Espionage', 'Credit Card Fraud', 'Social Media Harassment', 'Online Identity Theft'],
    city: 'Mumbai',
    address: '4th Floor, Police Commissionerate, Bandra Kurla Complex, Mumbai - 400051',
    contactNumber: '022-26504000',
    website: 'http://mumbaipolice.gov.in',
    operatingHours: '24 Hours',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Marathi', 'Hindi'],
    coordinates: { lat: 19.0658, lng: 72.8685 }
  },
  // Government Offices
  {
    name: 'Sub-Registrar Office Bandra',
    type: 'GovernmentOffice',
    categories: ['Property Dispute'],
    subcategories: ['Property Registration', 'Stamp Duty Collection', 'Deed Search'],
    city: 'Mumbai',
    address: 'Bandra Administrative Building, Near Chetana College, Bandra East, Mumbai - 400051',
    contactNumber: '022-26514751',
    website: 'https://igrmaharashtra.gov.in',
    operatingHours: '9:45 AM - 5:30 PM',
    isOpenNow: true,
    isVerified: true,
    languages: ['English', 'Marathi', 'Hindi'],
    coordinates: { lat: 19.0596, lng: 72.8302 }
  }
];

const seedResources = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI as string;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is missing.');
    }
    console.log('📦 Connecting to MongoDB to seed resources...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB!');

    console.log('🗑️  Clearing existing LegalResources...');
    await LegalResource.deleteMany({});
    console.log('💾 Seeding LegalResources database...');

    for (const res of resources) {
      const newResource = new LegalResource(res);
      await newResource.save();
      console.log(`  ✅ Inserted resource: "${res.name}" (${res.city})`);
    }

    console.log('\n🎉 LegalResources database seeded successfully!');
    console.log(`   Total resources inserted: ${resources.length}`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding resources failed:', error.message);
    process.exit(1);
  }
};

seedResources();
