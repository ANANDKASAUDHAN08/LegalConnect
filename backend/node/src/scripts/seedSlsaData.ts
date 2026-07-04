import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import LegalResource from '../models/LegalResource';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// State capitals approximate coordinates for map pins
const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  'Andhra Pradesh': { lat: 15.9129, lng: 79.7400 },
  'Arunachal Pradesh': { lat: 27.1004, lng: 93.6167 },
  'Assam': { lat: 26.2006, lng: 92.9376 },
  'Bihar': { lat: 25.5941, lng: 85.1376 },
  'Chhattisgarh': { lat: 22.0920, lng: 82.1887 },
  'Goa': { lat: 15.4909, lng: 73.8278 },
  'Gujarat': { lat: 23.2156, lng: 72.6369 },
  'Haryana': { lat: 30.7333, lng: 76.7794 },
  'Himachal Pradesh': { lat: 31.1048, lng: 77.1734 },
  'Jammu & Kashmir': { lat: 32.7266, lng: 74.8570 },
  'Jharkhand': { lat: 23.3441, lng: 85.3096 },
  'Karnataka': { lat: 12.9716, lng: 77.5946 },
  'Kerala': { lat: 9.9312, lng: 76.2673 },
  'Madhya Pradesh': { lat: 23.1815, lng: 79.9864 },
  'Maharashtra': { lat: 19.0760, lng: 72.8777 },
  'Manipur': { lat: 24.8170, lng: 93.9368 },
  'Meghalaya': { lat: 25.5788, lng: 91.8933 },
  'Mizoram': { lat: 23.7271, lng: 92.7176 },
  'Nagaland': { lat: 25.6667, lng: 94.1167 },
  'Odisha': { lat: 20.4625, lng: 85.8828 },
  'Punjab': { lat: 30.7333, lng: 76.7794 },
  'Rajasthan': { lat: 26.9124, lng: 75.7873 },
  'Sikkim': { lat: 27.3389, lng: 88.6065 },
  'Telangana': { lat: 17.3850, lng: 78.4867 },
  'Tamil Nadu': { lat: 13.0827, lng: 80.2707 },
  'Tripura': { lat: 23.8315, lng: 91.2868 },
  'Uttar Pradesh': { lat: 26.8467, lng: 80.9462 },
  'Uttarakhand': { lat: 29.3803, lng: 79.4636 },
  'West Bengal': { lat: 22.5726, lng: 88.3639 },
  'Andaman & Nicobar': { lat: 11.7401, lng: 92.6586 },
  'Chandigarh': { lat: 30.7333, lng: 76.7794 },
  'Dadra & Nagar Haveli': { lat: 20.1809, lng: 73.0169 },
  'Daman & Diu': { lat: 20.3974, lng: 72.8328 },
  'Delhi': { lat: 28.6139, lng: 77.2090 },
  'Ladakh': { lat: 34.1526, lng: 77.5771 },
  'Lakshadweep': { lat: 10.5593, lng: 72.6358 },
  'Puducherry': { lat: 11.9416, lng: 79.8083 },
};

// State capitals / authority headquarters cities
const STATE_CITY: Record<string, string> = {
  'Andhra Pradesh': 'Guntur',
  'Arunachal Pradesh': 'Itanagar',
  'Assam': 'Guwahati',
  'Bihar': 'Patna',
  'Chhattisgarh': 'Bilaspur',
  'Goa': 'Panaji',
  'Gujarat': 'Ahmedabad',
  'Haryana': 'Panchkula',
  'Himachal Pradesh': 'Shimla',
  'Jammu & Kashmir': 'Jammu',
  'Jharkhand': 'Ranchi',
  'Karnataka': 'Bengaluru',
  'Kerala': 'Kochi',
  'Madhya Pradesh': 'Jabalpur',
  'Maharashtra': 'Mumbai',
  'Manipur': 'Imphal',
  'Meghalaya': 'Shillong',
  'Mizoram': 'Aizawl',
  'Nagaland': 'Kohima',
  'Odisha': 'Cuttack',
  'Punjab': 'Mohali',
  'Rajasthan': 'Jaipur',
  'Sikkim': 'Gangtok',
  'Telangana': 'Hyderabad',
  'Tamil Nadu': 'Chennai',
  'Tripura': 'Agartala',
  'Uttar Pradesh': 'Lucknow',
  'Uttarakhand': 'Nainital',
  'West Bengal': 'Kolkata',
  'Andaman & Nicobar': 'Port Blair',
  'Chandigarh': 'Chandigarh',
  'Dadra & Nagar Haveli': 'Silvassa',
  'Daman & Diu': 'Daman',
  'Delhi': 'New Delhi',
  'Ladakh': 'Leh',
  'Lakshadweep': 'Kavaratti',
  'Puducherry': 'Puducherry',
};

const slsaEntries = [
  {
    state: 'Andhra Pradesh',
    executiveChairman: 'Executive Chairman, Andhra Pradesh State Legal Services Authority',
    memberSecretary: 'Smt. B.S.V.Himabindu, Member Secretary',
    address: 'H.No.2-273/54-A, B.S.R Commercial Complex, Malkapuram Village, Andhra Pradesh Secretariat Road, Opposite to Traffic Police Station, Thulluru Mandal, Guntur District – 522 238',
    // O: 0863-2372755-60 → main number 0863-2372755 (lines -60 is extension range)
    contactNumber: ['0863-2372755'],
    email: ['apslsauthority@yahoo.com'],
    website: 'http://www.apslsa.ap.nic.in/',
    languages: ['English', 'Telugu', 'Hindi'],
  },
  {
    state: 'Arunachal Pradesh',
    executiveChairman: 'Hon\'ble Mr. Justice Sanjay Kumar Medhi, Executive Chairman',
    memberSecretary: 'Sh. Tadu Tamang, Member Secretary',
    address: 'Tower-1 Apartment, Zoo Road, Chimpu, Itanagar, Arunachal Pradesh – 791113',
    // O: 0360-2310999, 2310116-17 → two numbers with same STD code 0360
    contactNumber: ['0360-2310999', '0360-2310116'],
    email: ['apslsa2013@rediffmail.com'],
    website: 'http://arunachalpradesh.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Assam',
    executiveChairman: 'Hon\'ble Mr. Justice Michael Zothankhuma, Executive Chairman',
    memberSecretary: 'Sh. Debasish Bhattacharjee, Member Secretary',
    address: 'Gauhati High Court, Old Block, 1st Floor, Guwahati – 781001',
    // O: 0361-2601843/2516367 → two numbers separated by /
    contactNumber: ['0361-2601843', '0361-2516367'],
    email: ['aslsa.guwahati2020@gmail.com', 'aslsa@gmail.com', 'assamslsa1@gmail.com'],
    website: 'http://www.aslsa.assam.gov.in/',
    languages: ['English', 'Hindi', 'Assamese'],
  },
  {
    state: 'Bihar',
    executiveChairman: 'Hon\'ble Mr. Justice Sudhir Singh, Executive Chairman',
    memberSecretary: 'Sh. Dharmendra Kumar Singh, Member Secretary',
    address: 'Opposite Patna Museum, Buddha Marg, Patna – 800 001',
    // O: 0612-2508943, 2508390 → two numbers with same STD code 0612
    contactNumber: ['0612-2508943', '0612-2508390'],
    faxNumber: ['0612-2201390'],
    email: ['ms.bslsa-bih@gov.in'],
    website: 'http://www.patnahighcourt.gov.in/bslsa',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Chhattisgarh',
    executiveChairman: 'Hon\'ble Mr. Justice Sanjay K. Agrawal, Executive Chairman',
    memberSecretary: 'Sh. L.D. Yadav, Member Secretary',
    address: 'Old High Court Building, Bilaspur – 495001, Chhattisgarh',
    contactNumber: ['07752-410210'],
    email: ['cgslsa.cg@nic.in'],
    website: 'http://chhattisgarh.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Goa',
    executiveChairman: 'Hon\'ble Mr. Justice Suman Shyam, Executive Chairman',
    memberSecretary: 'Smt. Durga V. Madkaikar, Member Secretary',
    address: 'High Court of Bombay at Goa, Penha-de-franca, Porvorim – Goa',
    // O:0832-2492614, 2492664 → two numbers with same STD code 0832
    contactNumber: ['0832-2492614', '0832-2492664'],
    email: ['reg-high.goa@nic.in', 'ms-gslsa.goa@nic.in'],
    website: 'http://goa.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Konkani'],
  },
  {
    state: 'Gujarat',
    executiveChairman: 'Hon\'ble Mr. Justice Alpesh Y Kogje, Executive Chairman',
    memberSecretary: 'Ms. Hetal M. Pavar, Member Secretary',
    address: '3rd Floor, Near Gujarat High Court Post Office, Gujarat High Court Complex, Sola, Ahmedabad – 380 060',
    // O: 079-27664964/27665296 + Toll-Free: 1800-233-7966
    contactNumber: ['079-27664964', '079-27665296', '1800-233-7966'],
    email: ['msguj.lsa@nic.in'],
    website: 'http://gujarat.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Gujarati'],
  },
  {
    state: 'Haryana',
    executiveChairman: 'Hon\'ble Mrs. Justice Deepak Sibal, Executive Chairman',
    memberSecretary: 'Sh. Jagdeep Singh, Member Secretary',
    address: 'Institutional Plot No.9, Sector-14, Panchkula (Haryana) – 134109',
    // O: 0172-2583309/2586309 + 2561309 → three numbers with same STD code 0172
    contactNumber: ['0172-2583309', '0172-2586309', '0172-2561309'],
    email: ['hslsa.haryana@gmail.com'],
    website: 'http://haryana.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Punjabi'],
  },
  {
    state: 'Himachal Pradesh',
    executiveChairman: 'Hon\'ble Mr. Justice Vivek Singh Thakur, Executive Chairman',
    memberSecretary: 'Sh. Ranjeet Singh, Member Secretary',
    address: 'Block No.22, SDA Complex, Kusumpti, Shimla – 171 009',
    contactNumber: ['0177-2623862'],
    email: ['mslegal-hp@nic.in'],
    website: 'http://himachalpradesh.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Jammu & Kashmir',
    executiveChairman: 'Hon\'ble Mr. Justice Sanjeev Kumar, Executive Chairman',
    memberSecretary: 'Ms. Shazia Tabassum, Member Secretary',
    address: 'Winter (Nov–Apr): JDA Complex, Janipur, Jammu – 180007 | Summer (May–Oct): Old Secretariat, Srinagar – 190001',
    // Jammu: 0191-2539962, 2539679 | Srinagar: 0194-2480408, 2476945
    contactNumber: ['0191-2539962', '0191-2539679', '0194-2480408', '0194-2476945'],
    email: ['jkslsa1234@gmail.com'],
    website: 'http://jammukashmir.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Urdu', 'Kashmiri'],
  },
  {
    state: 'Jharkhand',
    executiveChairman: 'Hon\'ble Mr. Justice Sujit Narayan Prasad, Executive Chairman',
    memberSecretary: 'Ms. Ranjana Asthana, Member Secretary',
    address: 'Jharkhand State Legal Services Authority, "NYAYA SADAN", Near AG Office, Doranda, Ranchi – 834 002',
    // O: 0651-2481520, 2482392
    contactNumber: ['0651-2481520', '0651-2482392'],
    email: ['jhalsaranchi@gmail.com', 'jhalsa_ranchi@yahoo.co.in'],
    website: 'http://www.jhalsa.org/',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Karnataka',
    executiveChairman: 'Hon\'ble Mrs. Justice Anu Sivaraman, Executive Chairman',
    memberSecretary: 'Sh. H. Shashidhara Shetty, Member Secretary',
    address: 'Nyaya Degula, 1st Floor, H.Siddaiah Road, Bangalore – 560 027',
    // O: 080-22111875, 22111714
    contactNumber: ['080-22111875', '080-22111714'],
    faxNumber: ['080-22112935'],
    email: ['karslsa@gmail.com', 'mskar-slsa@hck.gov.in'],
    website: 'https://karnataka.nalsa.gov.in/',
    languages: ['English', 'Hindi', 'Kannada'],
  },
  {
    state: 'Kerala',
    executiveChairman: 'Hon\'ble Dr. Justice A. K Jayasankaran Nambiar, Executive Chairman',
    memberSecretary: 'Sh. Anil Bhaskara, Member Secretary',
    address: 'Niyama Sahaya Bhavan, High Court Compound, Ernakulum, Kochi – 682 031',
    // O: 0484-2396717, 2562919, 2395717
    contactNumber: ['0484-2396717', '0484-2562919', '0484-2395717'],
    email: ['kelsakerala@nic.in'],
    website: 'https://kelsa.keralacourts.in/',
    languages: ['English', 'Malayalam', 'Hindi'],
  },
  {
    state: 'Madhya Pradesh',
    executiveChairman: 'Hon\'ble Mr. Justice Vivek Rusia, Executive Chairman',
    memberSecretary: 'Ku. Suman Shrivastava, Member Secretary',
    address: 'C-2, South Civil Lines, Pachpedi, Jabalpur – 482001',
    // O:0761-2678352, 2627370
    contactNumber: ['0761-2678352', '0761-2627370'],
    faxNumber: ['0761-2678537'],
    email: ['mplsajab@nic.in'],
    website: 'http://madhyapradesh.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Maharashtra',
    executiveChairman: 'Hon\'ble Mr. Justice Ravindra V Ghuge, Executive Chairman',
    memberSecretary: 'Sh. M.S.Azmi, Member Secretary',
    address: '105, High Court, PWD Building, Fort, Mumbai – 400 032',
    // O: 022-22691395, 22691358
    contactNumber: ['022-22691395', '022-22691358'],
    faxNumber: ['022-22674295'],
    email: ['mslsa-bhc@nic.in', 'legalservices@maharashtra.gov.in'],
    website: 'https://maharashtra.nalsa.gov.in/',
    languages: ['English', 'Hindi', 'Marathi'],
  },
  {
    state: 'Manipur',
    executiveChairman: 'Hon\'ble Mr. Justice A. Bimol Singh, Executive Chairman',
    memberSecretary: 'Sh. Alek Muivah, Member Secretary',
    address: 'ADR Centre, Lamphel Court Complex, Lamphelpat – 795 004, Imphal West District, Manipur',
    // Helpline only — no office phone listed
    contactNumber: ['9436239666'],
    email: ['maslsa.imphal@gmail.com'],
    website: 'http://www.mslsa.nic.in/',
    languages: ['English', 'Hindi', 'Meitei'],
  },
  {
    state: 'Meghalaya',
    executiveChairman: 'Hon\'ble Mr. Justice H.S.Thangkhiew, Executive Chairman',
    memberSecretary: 'Sh. E. Kharumnuid, Member Secretary',
    address: 'R.No.120, MATI Building, Additional Secretariat, Shillong – 793 001',
    contactNumber: ['0364-2501051'],
    faxNumber: ['0364-2501051'],
    email: ['mslsa-meg@nic.in'],
    website: 'http://meghalaya.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Khasi'],
  },
  {
    state: 'Mizoram',
    executiveChairman: 'Hon\'ble Mr. Justice Nelson Sailo, Executive Chairman',
    memberSecretary: 'Ms. Vincent Lalrokima, Member Secretary',
    address: 'Behind New District Court Building, High Court Complex, MINECO, Aizawl, Mizoram – 796001',
    contactNumber: ['0389-2336621'],
    faxNumber: ['0389-2336619'],
    email: ['slsamizoram@gmail.com'],
    website: 'http://mizoram.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Mizo'],
  },
  {
    state: 'Nagaland',
    executiveChairman: 'Hon\'ble Mr. Justice Kalyan Rai Surana, Executive Chairman',
    memberSecretary: 'Sh. Neiko Akami, Member Secretary',
    address: 'KDPA Building, Top Floor, D.C. Office Compound, Kohima – 797001',
    contactNumber: ['0370-2290153'],
    email: ['nslsa.nagaland@yahoo.in'],
    website: 'http://nagaland.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Odisha',
    executiveChairman: 'Hon\'ble Mr. Justice Manash Ranjan Pathak, Executive Chairman',
    memberSecretary: 'Sh. Aurbindo Pattanaik, Member Secretary',
    address: 'AAIN Seva Bhawan, Sector-1, CDA, Cuttack – 753014, Odisha',
    // O: 0671-2307678, 2304389, 2307071
    contactNumber: ['0671-2307678', '0671-2304389', '0671-2307071'],
    faxNumber: ['0671-2305702'],
    email: ['oslsa1997@gmail.com'],
    // No website listed in NALSA HTML for Odisha
    website: 'http://odisha.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Odia'],
  },
  {
    state: 'Punjab',
    executiveChairman: 'Hon\'ble Mr. Justice Ashwani Kumar Mishra, Executive Chairman',
    memberSecretary: 'Ms. Jagdeep Kaur Virk, Addl. Member Secretary',
    address: 'Site No.126, Opposite GMADA Community Centre, Sector 69, S.A.S.Nagar, Mohali',
    // O: 0172-2216690, 2216750
    contactNumber: ['0172-2216690', '0172-2216750'],
    email: ['ms@punjab.gov.in'],
    website: 'http://www.pulsa.punjab.gov.in/',
    languages: ['English', 'Hindi', 'Punjabi'],
  },
  {
    state: 'Rajasthan',
    executiveChairman: 'Hon\'ble Mr. Justice Sanjeev Prakash Sharma, Executive Chairman',
    memberSecretary: 'Sh. Hari Om Sharma Attri, Member Secretary',
    address: 'Rajasthan High Court Building, Jaipur – 302 005',
    contactNumber: ['0141-2227481'],
    faxNumber: ['0141-2227602'],
    email: ['rslsajp@gmail.com'],
    website: 'http://rajasthan.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Sikkim',
    executiveChairman: 'Hon\'ble Mrs. Justice Meenakshi Madan Rai, Executive Chairman',
    memberSecretary: 'Ms. Samita Sharma, Member Secretary',
    address: 'Sikkim State Legal Services Authority, Development Area, Gangtok, East Sikkim – 737101',
    // TF (Toll-Free): 03592-207753
    contactNumber: ['03592-207753'],
    email: ['sikkim_slsa@live.com'],
    website: 'http://sikkim.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Nepali'],
  },
  {
    state: 'Telangana',
    executiveChairman: 'Hon\'ble Mr. Justice P.Sam Koshy, Executive Chairman',
    memberSecretary: 'Sh. C.H. Panchakshari, Member Secretary',
    address: '1st & 2nd Floor, Nyaya Seva Sadan, Near Nagamata Temple, Gate No.2, High Court Premises, Hyderabad – 500 066',
    contactNumber: ['040-23446725'],
    email: ['telenganaslsa@gmail.com'],
    website: 'http://telangana.nalsa.gov.in/',
    languages: ['English', 'Hindi', 'Telugu'],
  },
  {
    state: 'Tamil Nadu',
    executiveChairman: 'Hon\'ble Mr. Justice R. Suresh Kumar, Executive Chairman',
    memberSecretary: 'Mr. S. Balakrishnan, Member Secretary',
    address: 'Tamil Nadu State Legal Services Authority, North Fort Road, High Court Campus, Chennai – 600 104',
    // (O) 044-25342834 + (O) 25235767 → second needs STD code 044
    contactNumber: ['044-25342834', '044-25235767'],
    faxNumber: ['044-25342268'],
    email: ['tnslsa@dataone.in', 'tnslsa@gmail.com'],
    website: 'http://tamilnadu.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Tamil'],
  },
  {
    state: 'Tripura',
    executiveChairman: 'Hon\'ble Mr. Justice T. Amarnath Goud, Executive Chairman',
    memberSecretary: 'Mr. Veda Pratim Debbarma, Member Secretary',
    address: 'Old District and Sessions Judge Court, Near Fire Brigade Chowmuhani, Agartala, Tripura (W) – 799 001',
    contactNumber: ['0381-2322481'],
    faxNumber: ['0381-2328998'],
    email: ['salsatripura@gmail.com', 'tslsaagt@gmail.com'],
    website: 'http://www.slsa.tripura.gov.in/',
    languages: ['English', 'Hindi', 'Bengali'],
  },
  {
    state: 'Uttar Pradesh',
    executiveChairman: 'Hon\'ble Mr. Justice Mahesh Chandra Tripathi, Executive Chairman',
    memberSecretary: 'Dr. Manu Kalia, Member Secretary',
    address: '3rd Floor, Jawahar Bhavan Annexe, Lucknow – 226 001',
    // (O) 0522-2286395, 2287972
    contactNumber: ['0522-2286395', '0522-2287972'],
    faxNumber: ['0522-2286260'],
    email: ['upslsa@nic.in'],
    website: 'http://uttarpradesh.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Uttarakhand',
    executiveChairman: 'Hon\'ble Mr. Justice Manoj Kumar Tiwari, Executive Chairman',
    memberSecretary: 'Sh. Pradeep Kumar Mani, Member Secretary',
    address: 'ADR Center, High Court Campus, Nainital – 263002',
    contactNumber: ['05942-236762'],
    email: ['ukslsanainial@gmail.com', 'slsa-uk@nic.in', 'highcourt_ua@nic.in'],
    website: 'http://uttarakhand.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'West Bengal',
    executiveChairman: 'Hon\'ble Mr. Justice Tapabarata Chakraborty, Executive Chairman',
    memberSecretary: 'Sh. Satya Arnab Ghosal, Member Secretary',
    address: 'City Civil Court Building (1st Floor), 2 & 3, Kiron Sankar Roy Road, Kolkata – 700 001',
    contactNumber: ['033-22483892'],
    email: ['wbstatelegal@gmail.com'],
    website: 'http://westbengal.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Bengali'],
  },
  // Union Territories
  {
    state: 'Andaman & Nicobar',
    executiveChairman: 'Hon\'ble Mr. Justice Sabyasachi Bhattacharyya, Executive Chairman',
    memberSecretary: 'Sh. Rashid Alam, Member Secretary',
    address: 'Secretariat, A&N Administration, Port Blair – 744 101',
    // (O) 03192-232835 + DS (Direct): 09476035538
    contactNumber: ['03192-232835', '09476035538'],
    faxNumber: ['03192-244083'],
    email: ['secy.law2016@gmail.com', 'legalsect.secretariat@gmail.com'],
    website: 'http://andaman.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Chandigarh',
    executiveChairman: 'Hon\'ble Mr. Justice Harsimran Singh Sethi, Executive Chairman',
    memberSecretary: 'Sh. Arun Kumar Aggarwal, Member Secretary',
    address: 'Additional Deluxe Building, Ground Floor, Sector 9-D, Chandigarh – 160009',
    contactNumber: ['0172-2742999'],
    faxNumber: ['0172-2742888'],
    email: ['slsa_utchd@yahoo.com'],
    website: 'https://chdslsa.gov.in/',
    languages: ['English', 'Hindi', 'Punjabi'],
  },
  {
    state: 'Dadra & Nagar Haveli',
    executiveChairman: 'Hon\'ble Smt. Justice Bharati Dangre, Executive Chairman',
    memberSecretary: 'Smt V.P.Ingle, Member Secretary',
    address: 'District & Sessions Court, Tokarkhada, Silvassa, Dadra and Nagar Haveli (U.T.) – 396 230',
    contactNumber: ['0260-2641337'],
    email: ['reg.slsa-dnh@gov.in', 'dj-dnh@nic.in'],
    website: 'http://dadraandnagarhaveli.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Gujarati'],
  },
  {
    state: 'Daman & Diu',
    executiveChairman: 'Hon\'ble Smt. Justice Bharati Dangre, Executive Chairman',
    memberSecretary: 'Sh. R.S. Tiwari, Ad-hoc Member Secretary',
    address: 'District & Sessions Court, Fort Area, Moti Daman, Daman – 396220',
    contactNumber: ['0260-2230887'],
    email: ['slsa-damandiu@daman.nic.in'],
    website: 'http://damananddiu.nalsa.gov.in/',
    languages: ['English', 'Hindi', 'Gujarati'],
  },
  {
    state: 'Delhi',
    executiveChairman: 'Hon\'ble Mr. Justice V. Kameshwar Rao, Executive Chairman',
    memberSecretary: 'Sh. Rajeev Bansal, Member Secretary',
    address: 'Central Office, 3rd Floor, Rouse Avenue District Court Complex, Pt. Deen Dayal Upadhyaya Marg, New Delhi – 110002',
    contactNumber: ['011-23232273'],
    email: ['dslsa-phc@nic.in'],
    website: 'http://delhi.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Ladakh',
    executiveChairman: 'Hon\'ble Mrs. Justice Sindhu Sharma, Executive Chairman',
    memberSecretary: 'Ms. Spalazes Angmo, Member Secretary (Officiating)',
    address: 'UT of Ladakh Legal Services Authority, Dambuchan, Akling, Leh, Ladakh – 194101',
    contactNumber: [], // No phone listed in NALSA official data
    email: ['ladakhlsa1234@gmail.com'],
    website: 'http://ladakh.nalsa.gov.in',
    languages: ['English', 'Hindi'],
  },
  {
    state: 'Lakshadweep',
    executiveChairman: 'Hon\'ble Dr. Justice A. K Jayasankaran Nambiar, Executive Chairman',
    memberSecretary: 'Smt. Bindukumari V S, Member Secretary',
    address: 'District & Sessions Judge, Lakshadweep, Kavaratti Islands – 682 555',
    // (O) 04896 26 3422 → formatted as 04896-263422
    contactNumber: ['04896-263422'],
    faxNumber: ['04896-262184', '04896-262307'],
    email: ['lakshadweepjusticeforall@gmail.com'],
    // No website listed in NALSA HTML for Lakshadweep
    website: 'http://lakshadweep.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Malayalam'],
  },
  {
    state: 'Puducherry',
    executiveChairman: 'Hon\'ble Mr. Justice S.M.Subramaniam, Executive Chairperson',
    memberSecretary: 'Ms. G. T. Ambika, Member Secretary',
    address: 'No.3, Lal Bahadur Shastri Street, Puducherry – 605 001',
    contactNumber: ['0413-2338831'],
    email: ['msutplsa@gmail.com'],
    website: 'http://puducherry.nalsa.gov.in',
    languages: ['English', 'Hindi', 'Tamil', 'French'],
  },
];

async function seedSlsaData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    // Remove old SLSA and NALSA HQ entries before re-seeding
    const deleted = await LegalResource.deleteMany({
      $or: [{ isStateAuthority: true }, { isNationalAuthority: true }]
    });
    console.log(`🗑️  Deleted ${deleted.deletedCount} old SLSA/NALSA HQ entries`);

    const docs: any[] = slsaEntries.map((entry) => {
      const coords = STATE_COORDS[entry.state] || { lat: 20.5937, lng: 78.9629 };
      const city = STATE_CITY[entry.state] || entry.state;
      return {
        name: `${entry.state} State Legal Services Authority (SLSA)`,
        type: 'LegalAid' as const,
        categories: [
          'Property Dispute', 'Family Law', 'Consumer Complaint',
          'Labour Issue', 'Criminal Matter', 'Business Dispute',
          'Cyber Crime', 'Other / Not Sure'
        ],
        subcategories: ['Free Legal Aid', 'Lok Adalat', 'Mediation'],
        city,
        state: entry.state,
        address: entry.address,
        contactNumber: entry.contactNumber || [],
        faxNumber: entry.faxNumber || [],
        email: entry.email || [],
        website: entry.website,
        operatingHours: 'Mon–Fri: 10:00 AM – 5:00 PM',
        isOpenNow: true,
        isVerified: true,
        languages: entry.languages,
        coordinates: coords,
        source: 'nalsa.gov.in',
        status: 'approved' as const,
        isStateAuthority: true,
        isNationalAuthority: false,
        executiveChairman: entry.executiveChairman,
        memberSecretary: entry.memberSecretary,
        tags: ['SLSA', 'Government', 'Free Legal Aid', 'NALSA', 'Official'],
      };
    });

    // Add National HQ (Supreme Court)
    docs.push({
      name: 'National Legal Services Authority (NALSA) HQ',
      type: 'LegalAid' as const,
      categories: [
        'Property Dispute', 'Family Law', 'Consumer Complaint',
        'Labour Issue', 'Criminal Matter', 'Business Dispute',
        'Cyber Crime', 'Other / Not Sure'
      ],
      subcategories: ['Free Legal Aid', 'Lok Adalat', 'Mediation'],
      city: 'New Delhi',
      state: 'Delhi',
      address: 'B-Block, Ground Floor, New Additional Building Complex, Supreme Court of India, New Delhi – 110001',
      alternateAddress: 'Ground Floor, Double Story Building, Jaisalmer House, 26, Man Singh Road, New Delhi – 110011',
      contactNumber: ['011-23382778', '011-23382121', '15100'],
      faxNumber: ['011-23385315'],
      email: ['nalsa-dla@nic.in'],
      website: 'https://nalsa.gov.in',
      operatingHours: 'Mon–Fri: 10:00 AM – 5:00 PM',
      isOpenNow: true,
      isVerified: true,
      languages: ['English', 'Hindi'],
      coordinates: { lat: 28.6139, lng: 77.2305 },
      source: 'nalsa.gov.in',
      status: 'approved' as const,
      isStateAuthority: false,
      isNationalAuthority: true,
      patronInChief: 'Hon\'ble Mr. Justice Surya Kant, Chief Justice of India & Patron-in-Chief, NALSA',
      executiveChairman: 'Hon\'ble Mr. Justice Vikram Nath, Judge Supreme Court of India & Executive Chairman, NALSA',
      sclscChairman: 'Hon\'ble Mr. Justice J.K. Maheshwari, Judge Supreme Court of India & Chairman, SCLSC',
      memberSecretary: 'Sh. Sanjiv Pandey, Member Secretary, National Legal Services Authority',
      sclscSecretary: 'Mr. Santosh Kumar, Secretary, Supreme Court Legal Services Committee, Room No. 124-128, B-Block, First Floor, Administrative Buildings Complex, New Delhi-110001 | Tel: 23112153, 23772154 | Fax: 23073970, 23388597 | Email: sclsc@nic.in | Web: www.sclsc.nic.in',
      sclscAddress: 'Room No. 124–128, B-Block, First Floor, Administrative Buildings Complex, Supreme Court of India, Mathura Road, Near Supreme Court Metro Station, New Delhi–110001',
      additionalStaff: [
        { name: 'Sh. Kunal Vepa', role: 'Director' },
        { name: 'Ms. Shikha Srivastava', role: 'OSD' },
        { name: 'Ms. Amandeep Sibia', role: 'OSD' },
        { name: 'Ms. Richa Upadhyay', role: 'OSD' },
        { name: 'Ms. Aavritee Naithani', role: 'OSD' },
        { name: 'Sh. Rajeev Kumar Yadav', role: 'Deputy Secretary' },
        { name: 'Sh. Ajay Kumar', role: 'Principal Private Secretary' }
      ],
      tags: ['NALSA', 'HQ', 'Government', 'Supreme Court', 'Free Legal Aid', 'Official'],
    });

    const result = await LegalResource.insertMany(docs);
    console.log(`🎉 Seeded ${result.length} SLSA entries successfully!`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedSlsaData();