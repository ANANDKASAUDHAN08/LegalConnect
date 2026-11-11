import fs from 'fs';
import path from 'path';

interface RightEnrichment {
  whatToSay: string;
  whatToSay_hi: string;
  dos: string[];
  donts: string[];
  dos_hi: string[];
  donts_hi: string[];
  title_hi?: string;
  summary_hi?: string;
}

const ENRICHMENTS: Record<string, RightEnrichment> = {
  'right-to-life-liberty': {
    title_hi: 'जीवन, गरिमा और व्यक्तिगत स्वतंत्रता का मौलिक अधिकार',
    summary_hi: 'भारतीय संविधान के अनुच्छेद 21 के तहत प्रदत्त, विधि द्वारा स्थापित प्रक्रिया के अतिरिक्त किसी भी व्यक्ति को उसके जीवन या व्यक्तिगत स्वतंत्रता से वंचित नहीं किया जा सकता।',
    whatToSay: 'I am asserting my fundamental right to bodily autonomy and human dignity under Article 21 of the Constitution of India. Any restraint on my liberty must strictly adhere to just, fair, and reasonable legal procedure as mandated by the Supreme Court in Maneka Gandhi.',
    whatToSay_hi: 'मैं भारत के संविधान के अनुच्छेद 21 के तहत अपनी शारीरिक स्वायत्तता और मानवीय गरिमा के मौलिक अधिकार का दावा करता हूं। मेनका गांधी मामले में सर्वोच्च न्यायालय के फैसले के अनुसार मेरी स्वतंत्रता पर कोई भी रोक उचित, निष्पक्ष और कानूनी प्रक्रिया के तहत होनी चाहिए।',
    dos: [
      'Demand written statutory justification for any detention or movement restriction.',
      'Instruct family or legal counsel to file a Habeas Corpus petition under Article 226/32 if unlawfully restrained.',
      'Dial NALSA free legal aid at 15100 if state authorities curtail basic liberties.'
    ],
    donts: [
      'Do NOT submit to unrecorded, undocumented executive custody or search.',
      'Do NOT waive your right to legal representation under any pressure.',
      'Do NOT sign self-incriminating statements without presence of an advocate.'
    ],
    dos_hi: [
      'किसी भी हिरासत या रोक के लिए लिखित कानूनी आधार की मांग करें।',
      'अवैध रूप से रोके जाने पर अनुच्छेद 226/32 के तहत बंदी प्रत्यक्षीकरण (Habeas Corpus) याचिका दायर करने का निर्देश दें।',
      'मौलिक अधिकारों के हनन पर नालसा निःशुल्क कानूनी सहायता 15100 पर तुरंत संपर्क करें।'
    ],
    donts_hi: [
      'बिना आधिकारिक रिकॉर्ड वाली गैर-कानूनी हिरासत को स्वीकार न करें।',
      'किसी भी दबाव में कानूनी सहायता के अपने अधिकार का परित्याग न करें।',
      'वकील की अनुपस्थिति में किसी भी स्व-दोषी बयान पर हस्ताक्षर न करें।'
    ]
  },

  'digital-data-privacy-dpdp': {
    title_hi: 'नागरिक डेटा गोपनीयता एवं डिजिटल अधिकार (DPDP अधिनियम)',
    summary_hi: 'डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम (DPDP 2023) के तहत नागरिकों को अपने व्यक्तिगत डेटा के अनधिकृत संग्रह, सहमति वापसी और मिटाने का कानूनी अधिकार प्राप्त है।',
    whatToSay: 'Under Section 6 and Section 12 of the Digital Personal Data Protection Act, 2023, I have the statutory right to withdraw consent and demand erasure of my personal data. Please provide written confirmation of data deletion and state the purpose limitation of any processed records.',
    whatToSay_hi: 'डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 की धारा 6 और 12 के तहत मुझे सहमति वापस लेने और अपने व्यक्तिगत डेटा को मिटाने का वैधानिक अधिकार है। कृपया डेटा हटाने की लिखित पुष्टि दें और रिकॉर्ड के उपयोग का उद्देश्य स्पष्ट करें।',
    dos: [
      'Exercise your right to access and correct inaccurate digital personal data.',
      'Lodge formal grievance with the Data Fiduciary\'s designated Grievance Officer.',
      'Escalate unresolved privacy violations to the Data Protection Board of India (DPBI).'
    ],
    donts: [
      'Do NOT provide Aadhaar or biometric data to private commercial apps where not mandated by law.',
      'Do NOT accept bundled consent terms that force consent for marketing as a condition of service.',
      'Do NOT share OTPs or authentication tokens with customer support personnel.'
    ],
    dos_hi: [
      'गलत या पुराने डिजिटल डेटा को सुधारने और मिटाने के अधिकार का प्रयोग करें।',
      'डेटा फिड्यूशरी के अधिकृत शिकायत अधिकारी के पास लिखित शिकायत दर्ज करें।',
      'अनसुलझे मामलों की शिकायत भारतीय डेटा संरक्षण बोर्ड (DPBI) को भेजें।'
    ],
    donts_hi: [
      'निजी ऐप्स को कानूनन गैर-अनिवार्य मामलों में आधार या बायोमेट्रिक्स न सौंपें।',
      'सेवा प्राप्त करने के लिए गैर-जरूरी मार्केटिंग सहमति वाले फॉर्म स्वीकार न करें।',
      'किसी भी ग्राहक सेवा प्रतिनिधि के साथ ओटीपी या पासवर्ड साझा न करें।'
    ]
  },

  'posh-workplace-harassment': {
    title_hi: 'कार्यस्थल पर यौन उत्पीड़न से संरक्षण (POSH अधिनियम 2013)',
    summary_hi: 'POSH अधिनियम 2013 के तहत प्रत्येक महिला कर्मचारी को सुरक्षित कार्यस्थल, अनिवार्य आंतरिक शिकायत समिति (ICC) और 90 दिनों की सवैतनिक छुट्टी का वैधानिक अधिकार है।',
    whatToSay: 'I am formally reporting an incident of unwelcome conduct under Section 9 of the POSH Act, 2013. I request the Internal Committee to register my complaint, maintain strict confidentiality under Section 16, and grant interim relief under Section 12.',
    whatToSay_hi: 'मैं POSH अधिनियम 2013 की धारा 9 के तहत औपचारिक शिकायत दर्ज कर रही हूं। मैं आंतरिक शिकायत समिति (ICC) से धारा 16 के तहत पूर्ण गोपनीयता बनाए रखने और धारा 12 के तहत अंतरिम राहत प्रदान करने का अनुरोध करती हूं।',
    dos: [
      'Submit written complaint to the Internal Committee (IC) within 3 months of the incident.',
      'Preserve all digital evidence including emails, chat logs, voice recordings, and CCTV timestamps.',
      'Apply for interim relief: transfer, work-from-home, or up to 90 days paid leave under Section 12.'
    ],
    donts: [
      'Do NOT allow management to resolve sexual harassment through informal HR warnings.',
      'Do NOT publish identity or inquiry proceedings on social media (barred under Section 16).',
      'Do NOT hesitate to approach Local Committee (LC) at District Magistrate office if company lacks an IC.'
    ],
    dos_hi: [
      'घटना के 3 महीने के भीतर आंतरिक समिति (IC) को लिखित शिकायत सौंपें।',
      'ईमेल, चैट संदेश, कॉल रिकॉर्डिंग और सीसीटीवी टाइमस्टैम्प सुरक्षित रखें।',
      'धारा 12 के तहत ट्रांसफर या 90 दिनों तक की सवैतनिक छुट्टी की अंतरिम राहत मांगें।'
    ],
    donts_hi: [
      'प्रबंधन को अनौपचारिक चेतावनी देकर मामला दबाने की अनुमति न दें।',
      'सोशल मीडिया पर जांच या पीड़ित की पहचान उजागर न करें (धारा 16 द्वारा वर्जित)।',
      'कंपनी में समिति न होने पर जिला स्तर की स्थानीय समिति (LC) जाने में संकोच न करें।'
    ]
  },

  'air-passenger-flight-rights': {
    title_hi: 'हवाई यात्री अधिकार: उड़ान देरी, रद्दीकरण एवं सामान क्षति',
    summary_hi: 'डीजीसीए नागरिक उड्डयन आवश्यकताओं (DGCA CAR Series M) के तहत उड़ान में अत्यधिक देरी पर मुफ्त भोजन, 6 घंटे से अधिक देरी पर पूर्ण रिफंड या होटल आवास का अधिकार है।',
    whatToSay: 'Under DGCA Civil Aviation Requirements (CAR Section 3, Series M, Part IV), as my flight is delayed beyond statutory thresholds, the airline is legally obligated to provide complimentary refreshments, hotel accommodation, or an immediate full refund.',
    whatToSay_hi: 'डीजीसीए नागरिक उड्डयन नियमों (CAR Section 3, Series M, Part IV) के तहत, उड़ान में वैधानिक सीमा से अधिक देरी होने पर एयरलाइन मानार्थ भोजन, होटल आवास या तत्काल पूर्ण रिफंड देने के लिए कानूनी रूप से बाध्य है।',
    dos: [
      'Demand written delay endorsement on boarding pass from the duty airline station manager.',
      'Insist on complimentary food and refreshments if flight delay exceeds 2 hours.',
      'Lodge immediate complaint on AirSewa portal (airsewa.gov.in) if compensation is denied.'
    ],
    donts: [
      'Do NOT accept airline travel vouchers if you prefer a direct monetary bank refund.',
      'Do NOT leave the airport without filing a Property Irregularity Report (PIR) for lost or damaged luggage.',
      'Do NOT settle for informal verbal promises from gate agents.'
    ],
    dos_hi: [
      'बोर्डिंग पास पर एयरलाइन स्टेशन मैनेजर से उड़ान देरी की लिखित मोहर लें।',
      '2 घंटे से अधिक देरी होने पर मानार्थ भोजन और पानी की मांग करें।',
      'मुआवजा न मिलने पर एयरसेवा पोर्टल (airsewa.gov.in) पर तुरंत शिकायत दर्ज करें।'
    ],
    donts_hi: [
      'यदि आप बैंक खाते में नकद रिफंड चाहते हैं तो जबरन दिए जा रहे वाउचर स्वीकार न करें।',
      'सामान खोने या टूटने पर बिना पीआईआर (PIR) रिपोर्ट दर्ज कराए हवाई अड्डा न छोड़ें।',
      'गेट कर्मचारियों के केवल मौखिक आश्वासनों पर निर्भर न रहें।'
    ]
  },

  'rera-homebuyer-protection': {
    title_hi: 'घर खरीदार अधिकार: कब्जा देरी एवं बिल्डर धोखाधड़ी (रेरा अधिनियम)',
    summary_hi: 'रेरा अधिनियम 2016 की धारा 18 के तहत फ्लैट पजेशन में देरी होने पर घर खरीदार को एसबीआई मार्जिनल कॉस्ट दर + 2% की दर से मासिक ब्याज या मूलधन सहित पूर्ण रिफंड पाने का अधिकार है।',
    whatToSay: 'Under Section 18 of the Real Estate (Regulation and Development) Act, 2016, the promoter is strictly liable to pay monthly interest at SBI MCLR + 2% for every month of delayed possession, or refund the entire paid amount with statutory interest.',
    whatToSay_hi: 'रेरा अधिनियम 2016 की धारा 18 के तहत, पजेशन में देरी होने पर बिल्डर प्रत्येक महीने के लिए एसबीआई एमसीएलआर + 2% की दर से मासिक ब्याज देने या ब्याज सहित पूरी राशि वापस करने के लिए बाध्य है।',
    dos: [
      'Issue a formal legal notice claiming monthly delay interest under Section 18.',
      'File an online complaint with the State RERA Authority under Section 31.',
      'Verify the builder\'s escrow account and construction milestones on the official RERA portal.'
    ],
    donts: [
      'Do NOT sign unilateral agreement amendments extending completion deadlines without compensation.',
      'Do NOT accept verbal handover promises without an official Occupancy Certificate (OC).',
      'Do NOT pay remaining installments if project construction is completely stalled.'
    ],
    dos_hi: [
      'धारा 18 के तहत मासिक विलंब ब्याज का दावा करते हुए औपचारिक कानूनी नोटिस भेजें।',
      'धारा 31 के तहत राज्य रेरा प्राधिकरण की वेबसाइट पर ऑनलाइन शिकायत दर्ज करें।',
      'रेरा पोर्टल पर प्रोजेक्ट के एस्क्रो खाते और निर्माण प्रगति की पुष्टि करें।'
    ],
    donts_hi: [
      'बिना मुआवजे के कब्जा तिथि बढ़ाने वाले एकतरफा बिल्डर समझौतों पर हस्ताक्षर न करें।',
      'बिना ऑक्यूपेंसी सर्टिफिकेट (OC) के अवैध रूप से चाबी स्वीकार न करें।',
      'यदि निर्माण कार्य पूरी तरह रुका हुआ है तो आगे की किस्तों का भुगतान न करें।'
    ]
  },

  'senior-citizens-maintenance': {
    title_hi: 'वरिष्ठ नागरिक भरण-पोषण एवं संपत्ति उपहार विलेख निरस्तीकरण',
    summary_hi: 'वरिष्ठ नागरिक अधिनियम 2007 की धारा 23 के तहत यदि बच्चे या कानूनी वारिस बुजुर्ग माता-पिता की देखभाल करने में विफल रहते हैं, तो ट्रिब्यूनल उपहार में दी गई संपत्ति का विलेख रद्द कर सकता है।',
    whatToSay: 'Under Section 23 of the Maintenance and Welfare of Parents and Senior Citizens Act, 2007, any gift deed or property transfer executed in favor of children is deemed void if the transferee fails to provide basic amenities and physical care to the senior citizen.',
    whatToSay_hi: 'माता-पिता एवं वरिष्ठ नागरिक भरण-पोषण अधिनियम 2007 की धारा 23 के तहत बच्चों को हस्तांतरित किया गया कोई भी गिफ्ट डीड शून्य माना जा सकता है यदि वे वरिष्ठ नागरिक की बुनियादी जरूरतों और देखभाल की उपेक्षा करते हैं।',
    dos: [
      'File an application before the Sub-Divisional Magistrate (SDM) Maintenance Tribunal.',
      'Dial National Senior Citizen Helpline 14567 (Elderline) for legal aid and social protection.',
      'Claim monthly maintenance allowance up to statutory limits under Section 4.'
    ],
    donts: [
      'Do NOT execute absolute unconditional property transfer deeds without care contingency clauses.',
      'Do NOT vacate your own self-acquired home under pressure from relatives.',
      'Do NOT undergo complex civil court litigation when the summary SDM tribunal provides swift 90-day relief.'
    ],
    dos_hi: [
      'एसडीएम (SDM) वरिष्ठ नागरिक भरण-पोषण ट्रिब्यूनल के समक्ष तत्काल अर्जी दाखिल करें।',
      'राष्ट्रीय वरिष्ठ नागरिक हेल्पलाइन 14567 (एल्डरलाइन) पर कानूनी सुरक्षा के लिए कॉल करें।',
      'धारा 4 के तहत प्रतिमाह भरण-पोषण भत्ते का दावा प्रस्तुत करें।'
    ],
    donts_hi: [
      'बिना देखभाल की शर्त के अपनी संपत्ति का पूर्ण विलेख बच्चों के नाम न करें।',
      'परिजनों के दबाव में आकर अपने स्वयं के घर को खाली न करें।',
      'लंबी दीवानी मुकदमों में उलझने के बजाय एसडीएम ट्रिब्यूनल से 90 दिन में त्वरित न्याय मांगें।'
    ]
  },

  'equal-work-maternity-rights': {
    title_hi: 'समान वेतन एवं 26 सप्ताह सवैतनिक मातृत्व सुरक्षा अधिकार',
    summary_hi: 'मातृत्व लाभ अधिनियम 1961 के तहत महिला कर्मचारियों को 26 सप्ताह की सवैतनिक मातृत्व छुट्टी और गर्भावस्था के आधार पर गैर-भेदभाव एवं सेवा समाप्ति से पूर्ण सुरक्षा का अधिकार है।',
    whatToSay: 'Under Section 5 and Section 12 of the Maternity Benefit Act, 1961, it is strictly unlawful for an employer to dismiss or terminate any woman employee on grounds of pregnancy, or deprive her of 26 weeks paid statutory maternity leave.',
    whatToSay_hi: 'मातृत्व लाभ अधिनियम 1961 की धारा 5 और 12 के तहत किसी भी नियोक्ता के लिए गर्भवती महिला कर्मचारी को नौकरी से निकालना या 26 सप्ताह के सवैतनिक मातृत्व अवकाश से वंचित करना गैर-कानूनी है।',
    dos: [
      'Submit written pregnancy notice to HR along with expected confinement medical certificate.',
      'Claim statutory paid leave of 26 weeks for up to two surviving children.',
      'Report any unlawful termination or wage deduction to the jurisdictional Labour Commissioner.'
    ],
    donts: [
      'Do NOT resign voluntarily under managerial duress or negative performance appraisal during pregnancy.',
      'Do NOT accept arbitrary deduction of annual appraisal ratings or variable pay due to statutory maternity leave.',
      'Do NOT undertake arduous physical work or night shifts in late pregnancy (prohibited under Section 4).'
    ],
    dos_hi: [
      'चिकित्सा प्रमाण पत्र के साथ एचआर (HR) को सवैतनिक मातृत्व अवकाश का लिखित नोटिस दें।',
      'प्रथम दो बच्चों के लिए पूर्ण 26 सप्ताह के सवैतनिक अवकाश का लाभ लें।',
      'अवैध निष्कासन की स्थिति में स्थानीय श्रम आयुक्त (Labour Commissioner) को शिकायत भेजें।'
    ],
    donts_hi: [
      'गर्भावस्था के दौरान कंपनी के दबाव में आकर स्वयं इस्तीफा न दें।',
      'मातृत्व अवकाश के आधार पर वार्षिक रेटिंग या इंसेंटिव में कटौती को स्वीकार न करें।',
      'गर्भावस्था के अंतिम चरणों में कठिन शारीरिक कार्य या रात्रि पाली न करें (धारा 4 द्वारा वर्जित)।'
    ]
  },

  'right-to-information-transparency': {
    title_hi: 'सूचना का अधिकार एवं सार्वजनिक जवाबदेही (RTI अधिनियम 2005)',
    summary_hi: 'RTI अधिनियम 2005 की धारा 6 के तहत प्रत्येक भारतीय नागरिक को किसी भी सरकारी विभाग, सार्वजनिक उपक्रम या प्राधिकरण से 30 दिनों के भीतर आधिकारिक जानकारी व प्रतियां पाने का अधिकार है।',
    whatToSay: 'Under Section 6(1) of the Right to Information Act, 2005, as a citizen of India, I am entitled to receive the requested official documents within 30 days. Under Section 7(1), information concerning life or liberty must be provided within 48 hours.',
    whatToSay_hi: 'सूचना का अधिकार अधिनियम 2005 की धारा 6(1) के तहत एक भारतीय नागरिक के रूप में मुझे 30 दिनों में वांछित जानकारी प्राप्त करने का अधिकार है। धारा 7(1) के तहत जीवन और स्वतंत्रता से संबंधित सूचना 48 घंटों में देना अनिवार्य है।',
    dos: [
      'Address the RTI application to the Central/State Public Information Officer (CPIO/SPIO).',
      'Affix prescribed fee of ₹10 (or attach BPL card copy for full exemption).',
      'File First Appeal under Section 19(1) if information is denied or not furnished within 30 days.'
    ],
    donts: [
      'Do NOT state reasons for asking for the information (explicitly barred under Section 6(2)).',
      'Do NOT ask questions requiring speculative opinions or interrogations; ask for certified records and files.',
      'Do NOT miss the 30-day limitation window for filing First and Second Appeals.'
    ],
    dos_hi: [
      'संबंधित जन सूचना अधिकारी (PIO) को स्पष्ट और बिंदुवार आरटीआई आवेदन भेजें।',
      'निर्धारित 10 रुपये का शुल्क संलग्न करें (बीपीएल कार्डधारकों के लिए पूर्णतः निःशुल्क)।',
      '30 दिनों में सूचना न मिलने पर धारा 19(1) के तहत प्रथम अपीलीय अधिकारी को अपील करें।'
    ],
    donts_hi: [
      'सूचना मांगने का कारण बताने की कोई आवश्यकता नहीं है (धारा 6(2) द्वारा स्पष्ट छूट)।',
      'अधिकारियों से राय या सलाह न मांगें; केवल सरकारी फाइलों व आदेशों की प्रमाणित प्रतियां मांगें।',
      'अपील दायर करने के लिए निर्धारित 30 दिनों की समय-सीमा न चूकें।'
    ]
  },

  'rights-persons-with-disabilities': {
    title_hi: 'दिव्यांगजन समान अवसर एवं सुगम्यता अधिकार (RPwD अधिनियम 2016)',
    summary_hi: 'RPwD अधिनियम 2016 की धारा 3 और 40 के तहत दिव्यांग नागरिकों को सभी सार्वजनिक भवनों, परिवहन, डिजिटल सेवाओं में बाधा रहित सुगम्यता और गैर-भेदभाव का पूर्ण कानूनी अधिकार है।',
    whatToSay: 'Under Section 3 and Section 40 of the Rights of Persons with Disabilities Act, 2016, denial of reasonable accommodation, public accessibility, or discrimination in employment constitutes a punishable statutory offense.',
    whatToSay_hi: 'दिव्यांगजन अधिकार अधिनियम 2016 की धारा 3 और 40 के तहत उचित सुविधा (Reasonable Accommodation) देने से मना करना, सार्वजनिक स्थलों पर बाधा रहित पहुंच न देना या रोजगार में भेदभाव करना दंडनीय अपराध है।',
    dos: [
      'Demand universal accessible infrastructure including ramps, tactile paths, and accessible restrooms.',
      'Report discrimination to the State/Chief Commissioner for Persons with Disabilities under Section 75.',
      'Utilize Unique Disability ID (UDID) card for statutory concessions and reservations.'
    ],
    donts: [
      'Do NOT tolerate denial of entry to public venues, transport, or educational institutions.',
      'Do NOT accept denial of promotion or employment solely on grounds of physical or sensory impairment.',
      'Do NOT allow public establishments to operate without mandatory accessibility compliance.'
    ],
    dos_hi: [
      'सार्वजनिक भवनों और परिवहन में रैंप, लिफ्ट और स्पर्शनीय मार्गों (Tactile Paths) की मांग करें।',
      'भेदभाव होने पर दिव्यांगजन राज्य आयुक्त (State Commissioner) के समक्ष शिकायत दर्ज करें।',
      'सरकारी आरक्षण और सुविधाओं के लिए यूडीआईडी (UDID) कार्ड का उपयोग करें।'
    ],
    donts_hi: [
      'सार्वजनिक स्थलों, बसों, ट्रेनों या स्कूलों में प्रवेश रोके जाने को सहन न करें।',
      'दिव्यांगता के आधार पर पदोन्नति या वेतन वृद्धि रोके जाने को कतई स्वीकार न करें।',
      'सरकारी व निजी संस्थानों को बिना सुगम्यता मानकों के संचालित न होने दें।'
    ]
  },

  'child-protection-safeguards-pocso': {
    title_hi: 'बाल संरक्षण एवं लैंगिक अपराधों से सुरक्षा (POCSO एवं JJ अधिनियम)',
    summary_hi: 'POCSO अधिनियम 2012 और किशोर न्याय अधिनियम 2015 के तहत बच्चों के खिलाफ किसी भी प्रकार के उत्पीड़न पर अनिवार्य रिपोर्टिंग, बाल कल्याण समिति (CWC) सुरक्षा और पहचान की पूर्ण गोपनीयता का अधिकार है।',
    whatToSay: 'Under Section 19 of the POCSO Act, 2012 and Section 75 of the Juvenile Justice Act, reporting child abuse or distress is a mandatory legal obligation. The identity of the child victim must remain strictly confidential under Section 23.',
    whatToSay_hi: 'पॉक्सो अधिनियम 2012 की धारा 19 और किशोर न्याय अधिनियम की धारा 75 के तहत बाल शोषण की सूचना देना अनिवार्य कानूनी दायित्व है। धारा 23 के तहत पीड़ित बच्चे की पहचान पूर्णतः गोपनीय रखना बाध्यकारी है।',
    dos: [
      'Immediately dial Childline 1098 or 112 to report any child in physical or emotional distress.',
      'Ensure the victim child is produced before the local Child Welfare Committee (CWC).',
      'Insist on recording child statements in child-friendly environment without police uniforms.'
    ],
    donts: [
      'Do NOT reveal or publish the child victim\'s name, school, photograph, or address on any platform.',
      'Do NOT subject the child to repetitive cross-examination or hostile questioning.',
      'Do NOT fail to report suspected child abuse (failure to report is punishable under POCSO Section 21).'
    ],
    dos_hi: [
      'संकट में घिरे बच्चे की सुरक्षा के लिए तुरंत चाइल्डलाइन 1098 या 112 पर कॉल करें।',
      'बच्चे को तत्काल स्थानीय बाल कल्याण समिति (CWC) के समक्ष प्रस्तुत कराएं।',
      'बच्चे का बयान सादे कपड़ों में महिला पुलिस अधिकारी द्वारा बाल-सुलभ वातावरण में दर्ज कराएं।'
    ],
    donts_hi: [
      'पीड़ित बच्चे का नाम, फोटो, स्कूल या पता किसी भी स्थिति में सार्वजनिक न करें।',
      'बच्चे से डरावने या अपमानजनक सवाल न पूछें।',
      'बाल उत्पीड़न की जानकारी छिपाएं नहीं (सूचना न देना धारा 21 के तहत स्वयं दंडनीय अपराध है)।'
    ]
  },

  'mental-healthcare-patient-rights': {
    title_hi: 'मानसिक स्वास्थ्य रोगी स्वायत्तता एवं अग्रिम निर्देश अधिकार',
    summary_hi: 'मानसिक स्वास्थ्य सेवा अधिनियम 2017 की धारा 5 के तहत प्रत्येक व्यक्ति को अग्रिम निर्देश (Advance Directive) देने, क्रूर उपचार से सुरक्षा और गोपनीयता का अधिकार है।',
    whatToSay: 'Under Section 5 and Section 20 of the Mental Healthcare Act, 2017, every patient has the right to nominate a representative and issue an Advance Directive. Direct administration of ECT without anesthesia or sterilization is strictly prohibited by law.',
    whatToSay_hi: 'मानसिक स्वास्थ्य देखभाल अधिनियम 2017 की धारा 5 और 20 के तहत रोगी को अग्रिम निर्देश (Advance Directive) देने का अधिकार है। बिना एनेस्थीसिया के ईसीटी (ECT) देना या जबरन बंधक बनाना कानूनन पूरी तरह प्रतिबंधित है।',
    dos: [
      'Execute a legally valid Advance Directive specifying treatment preferences under Section 5.',
      'Nominate a trusted Nominated Representative under Section 14 to make decisions during acute distress.',
      'Report abusive custodial confinement in psychiatric facilities to Mental Health Review Board (MHRB).'
    ],
    donts: [
      'Do NOT permit physical chaining, isolation, or inhuman custodial detention.',
      'Do NOT permit surgical sterilization or ECT without muscle relaxants and anesthesia (strictly illegal).',
      'Do NOT disclose psychiatric records to employers or third parties without explicit consent.'
    ],
    dos_hi: [
      'भविष्य के उपचार संबंधी प्राथमिकताओं को स्पष्ट करते हुए अग्रिम निर्देश (Advance Directive) दर्ज करें।',
      'कठिन समय में कानूनी निर्णय लेने के लिए धारा 14 के तहत अपना अधिकृत प्रतिनिधि नामांकित करें।',
      'मानसिक स्वास्थ्य समीक्षा बोर्ड (MHRB) के पास अवैध हिरासत व प्रताड़ना की शिकायत दर्ज करें।'
    ],
    donts_hi: [
      'रोगी को जंजीरों से बांधने, एकांत कारावास में रखने या अमानवीय व्यवहार की अनुमति न दें।',
      'बिना एनेस्थीसिया के बिजली के झटके (ECT) देने की अनुमति न दें (यह कानूनन अपराध है)।',
      'रोगी की सहमति के बिना उसकी मेडिकल रिपोर्ट नियोक्ता या किसी तीसरे व्यक्ति को न सौंपें।'
    ]
  },

  'street-vendors-livelihood-protection': {
    title_hi: 'स्ट्रीट वेंडर्स आजीविका सुरक्षा एवं वेंडिंग अधिकार',
    summary_hi: 'स्ट्रीट वेंडर्स अधिनियम 2014 की धारा 3 के तहत सर्वेक्षण पूरा होने और वेंडिंग प्रमाण पत्र जारी होने तक किसी भी रेहड़ी-पटरी विक्रेता को मनमाने ढंग से नहीं हटाया जा सकता।',
    whatToSay: 'Under Section 3(3) of the Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014, no street vendor shall be evicted until the mandatory municipal survey is conducted and a Vending Certificate is issued by the Town Vending Committee (TVC).',
    whatToSay_hi: 'स्ट्रीट वेंडर्स (आजीविका संरक्षण) अधिनियम 2014 की धारा 3(3) के अनुसार, जब तक टाउन वेंडिंग कमेटी (TVC) द्वारा सर्वेक्षण पूरा नहीं होता और प्रमाण पत्र नहीं मिलता, तब तक किसी भी विक्रेता को हटाया नहीं जा सकता।',
    dos: [
      'Keep certified copy of Town Vending Committee (TVC) survey slip or Vending Certificate displayed.',
      'Pay prescribed municipal vending fees and retain official payment receipts.',
      'Approach the statutory Grievance Redressal Committee under Section 20 if evicted unlawfully.'
    ],
    donts: [
      'Do NOT allow seizure of vending carts or goods without an official written inventory receipt.',
      'Do NOT submit to extortion or unauthorized collections by municipal staff or police.',
      'Do NOT set up stalls in strictly marked non-vending arterial transit lanes.'
    ],
    dos_hi: [
      'टाउन वेंडिंग कमेटी (TVC) की सर्वेक्षण रसीद या वेंडिंग प्रमाण पत्र अपने पास रखें।',
      'नगर पालिका के आधिकारिक शुल्क का भुगतान कर उसकी रसीद सुरक्षित रखें।',
      'अवैध निष्कासन होने पर धारा 20 के तहत शिकायत निवारण समिति के समक्ष गुहार लगाएं।'
    ],
    donts_hi: [
      'बिना जब्ती रसीद (Inventory List) दिए नगर निगम कर्मचारियों को अपना सामान या ठेला न ले जाने दें।',
      'पुलिस या नगर पालिका कर्मचारियों द्वारा अवैध वसूली का विरोध करें।',
      'घोषित नो-वेंडिंग जोन या व्यस्त चौराहों पर अनधिकृत ठेला न लगाएं।'
    ]
  },

  'right-to-education-rte-act': {
    title_hi: 'निःशुल्क एवं अनिवार्य बाल शिक्षा अधिकार (RTE अधिनियम 2009)',
    summary_hi: 'अनुच्छेद 21A और RTE अधिनियम 2009 की धारा 3 के तहत 6 से 14 वर्ष के प्रत्येक बच्चे को पड़ोस के स्कूल में निःशुल्क प्रारंभिक शिक्षा और निजी स्कूलों में 25% आरक्षण का अधिकार है।',
    whatToSay: 'Under Article 21A of the Constitution and Section 3 of the Right of Children to Free and Compulsory Education (RTE) Act, 2009, my child has a fundamental right to free education. Section 12(1)(c) mandates 25% admission for disadvantaged groups.',
    whatToSay_hi: 'संविधान के अनुच्छेद 21A और आरटीई (RTE) अधिनियम 2009 की धारा 3 के तहत मेरे बच्चे को निःशुल्क शिक्षा का मौलिक अधिकार है। धारा 12(1)(c) के तहत निजी स्कूलों में 25% सीटें वंचित वर्ग के लिए आरक्षित हैं।',
    dos: [
      'Apply under Section 12(1)(c) for 25% free seats in private unaided neighborhood schools.',
      'Ensure birth certificate or self-declaration affidavit is accepted for admission without delay.',
      'Report illegal screening procedures or capitation fee demands to National Commission for Protection of Child Rights (NCPCR).'
    ],
    donts: [
      'Do NOT pay any capitation fee or donation for elementary school admission (prohibited under Section 13).',
      'Do NOT subject children to admission interviews, screening tests, or parental tests.',
      'Do NOT permit physical punishment, corporal punishment, or mental harassment in schools (strictly barred under Section 17).'
    ],
    dos_hi: [
      'धारा 12(1)(c) के तहत निजी स्कूलों में 25% आरक्षित सीटों पर निःशुल्क प्रवेश का आवेदन करें।',
      'जन्म प्रमाण पत्र या स्व-घोषणा पत्र के आधार पर स्कूल में तुरंत दाखिला लें।',
      'डोनेशन मांगने वाले स्कूलों की शिकायत राष्ट्रीय बाल अधिकार संरक्षण आयोग (NCPCR) को करें।'
    ],
    donts_hi: [
      'प्रवेश के लिए कोई भी डोनेशन या कैपिटेशन फीस न दें (धारा 13 द्वारा पूरी तरह वर्जित)।',
      'बच्चे या माता-पिता का कोई भी साक्षात्कार या स्क्रीनिंग टेस्ट न होने दें।',
      'स्कूलों में शारीरिक दंड या मानसिक प्रताड़ना को बर्दाश्त न करें (धारा 17 द्वारा दंडनीय)।'
    ]
  },

  'transgender-persons-protection-rights': {
    title_hi: 'ट्रांसजेंडर व्यक्ति अधिकार एवं आत्म-पहचान संरक्षण (2019 अधिनियम)',
    summary_hi: 'ट्रांसजेंडर व्यक्ति अधिनियम 2019 की धारा 4 के तहत प्रत्येक व्यक्ति को अपनी स्व-अनुभूत लैंगिक पहचान की मान्यता पाने और सार्वजनिक सेवाओं व रोजगार में पूर्ण समानता का अधिकार है।',
    whatToSay: 'Under Section 4 and Section 9 of the Transgender Persons (Protection of Rights) Act, 2019, I have the statutory right to my self-perceived gender identity. Discrimination in employment, healthcare, or housing is a cognizable legal violation.',
    whatToSay_hi: 'ट्रांसजेंडर व्यक्ति (अधिकारों का संरक्षण) अधिनियम 2019 की धारा 4 और 9 के तहत मुझे अपनी स्व-अनुभूत लैंगिक पहचान का वैधानिक अधिकार है। रोजगार, चिकित्सा या आवास में भेदभाव करना कानूनन अपराध है।',
    dos: [
      'Apply online on National Portal for Transgender Persons (transgender.dosje.gov.in) for District Certificate of Identity.',
      'Seek reasonable accommodation and gender-neutral restrooms in workplaces and universities.',
      'File police complaint under Section 18 for any verbal abuse, denial of access, or physical violence.'
    ],
    donts: [
      'Do NOT submit to intrusive medical or physical examinations to prove gender identity.',
      'Do NOT accept denial of housing, tenancy, or hospital admission on grounds of gender diversity.',
      'Do NOT permit forced separation from family or community under unauthorized executive orders.'
    ],
    dos_hi: [
      'राष्ट्रीय पोर्टल पर पहचान प्रमाण पत्र और ट्रांसजेंडर आईडी कार्ड के लिए आवेदन करें।',
      'कार्यस्थलों और कॉलेजों में जेंडर-न्यूट्रल शौचालय और गैर-भेदभावपूर्ण नीतियों की मांग करें।',
      'अपमानजनक भाषा या हिंसा होने पर धारा 18 के तहत पुलिस में प्राथमिकी (FIR) दर्ज कराएं।'
    ],
    donts_hi: [
      'पहचान साबित करने के लिए किसी भी अपमानजनक शारीरिक या मेडिकल जांच को स्वीकार न करें।',
      'किराये पर मकान या अस्पताल में इलाज देने से इनकार को कतई सहन न करें।',
      'परिवार या समुदाय से जबरन अलग किए जाने के प्रशासनिक आदेशों का विरोध करें।'
    ]
  },

  'environmental-right-clean-air-water': {
    title_hi: 'स्वच्छ पर्यावरण, वायु एवं जल का मौलिक अधिकार (NGT अधिनियम एवं अनुच्छेद 21)',
    summary_hi: 'राष्ट्रीय हरित अधिकरण (NGT) अधिनियम 2010 और अनुच्छेद 21 के तहत नागरिकों को प्रदूषण मुक्त वातावरण और प्रदूषणकारी उद्योगों के खिलाफ मुआवजे का कानूनी अधिकार है।',
    whatToSay: 'Under Article 21 of the Constitution and Section 14 of the National Green Tribunal Act, 2010, the Polluter Pays Principle is legally binding. Contaminating drinking water or emitting illegal industrial emissions is a substantial environmental violation.',
    whatToSay_hi: 'संविधान के अनुच्छेद 21 और राष्ट्रीय हरित अधिकरण (NGT) अधिनियम 2010 की धारा 14 के तहत "प्रदूषणकर्ता भुगतान सिद्धांत" बाध्यकारी है। पेयजल दूषित करना या अवैध औद्योगिक उत्सर्जन करना कानून का गंभीर उल्लंघन है।',
    dos: [
      'Report illegal waste burning, untreated industrial discharge, or groundwater contamination to State Pollution Control Board (SPCB).',
      'File Original Application before the National Green Tribunal (NGT) under Section 14 for environmental restoration.',
      'Collect photographic evidence and water/soil test laboratory reports.'
    ],
    donts: [
      'Do NOT dispose of untreated toxic e-waste or industrial effluents into public storm drains.',
      'Do NOT fell heritage trees without permission from the jurisdictional Tree Officer.',
      'Do NOT ignore construction sites violating National Clean Air Programme (NCAP) dust mitigation rules.'
    ],
    dos_hi: [
      'अवैध कचरा जलाने या रासायनिक अपशिष्ट बहाने की शिकायत राज्य प्रदूषण नियंत्रण बोर्ड (SPCB) से करें।',
      'पर्यावरण क्षतिपूर्ति के लिए एनजीटी (NGT) के समक्ष धारा 14 के तहत मूल आवेदन दाखिल करें।',
      'प्रदूषण के फोटो, वीडियो और अधिकृत प्रयोगशाला से पानी/मिट्टी की जांच रिपोर्ट एकत्र करें।'
    ],
    donts_hi: [
      'सार्वजनिक नालों या जलस्रोतों में जहरीला कचरा न फेंकें।',
      'वृक्ष संरक्षण अधिकारी (Tree Officer) की अनुमति के बिना पुराने पेड़ों को न काटें।',
      'धूल नियंत्रण नियमों का उल्लंघन करने वाले निर्माण स्थलों की अनदेखी न करें।'
    ]
  },

  'undertrial-prisoner-bail-rights': {
    title_hi: 'विचाराधीन कैदी जमानत अधिकार एवं निःशुल्क कानूनी सहायता',
    summary_hi: 'BNSS 2023 की धारा 479 और अनुच्छेद 39A के तहत यदि किसी विचाराधीन कैदी ने अधिकतम सजा की आधी (या पहली बार के अपराधी ने एक तिहाई) अवधि काट ली है, तो वह व्यक्तिगत मुचलके पर रिहाई का हकदार है।',
    whatToSay: 'Under Section 479 of the Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) and Article 39A, having served the statutory detention threshold, the undertrial is legally entitled to release on personal bond with free legal aid representation.',
    whatToSay_hi: 'भारतीय नागरिक सुरक्षा संहिता (BNSS 2023) की धारा 479 और अनुच्छेद 39A के अनुसार, निर्धारित अवधि की कैद पूरी करने पर विचाराधीन कैदी व्यक्तिगत मुचलके पर निःशुल्क कानूनी सहायता के साथ जमानत पाने का वैधानिक हकदार है।',
    dos: [
      'Apply to the Jail Under-Trial Review Committee (UTRC) for personal bond release under BNSS §479.',
      'Demand immediate assignment of a free Legal Aid Defense Counsel (LADC) via District Legal Services Authority (DLSA).',
      'Ensure the prisoner is produced virtually or physically at every statutory remand date.'
    ],
    donts: [
      'Do NOT allow undertrials to remain incarcerated merely due to inability to furnish heavy monetary surety.',
      'Do NOT accept prolonged detention beyond statutory charge-sheet filing limits (BNSS Section 187).',
      'Do NOT pay any informal fees or bribes for free legal aid services.'
    ],
    dos_hi: [
      'जेल अंडर-ट्रायल रिव्यू कमेटी (UTRC) के समक्ष धारा 479 के तहत व्यक्तिगत मुचलके पर रिहाई की अर्जी दें।',
      'जिला विधिक सेवा प्राधिकरण (DLSA) से तुरंत निःशुल्क कानूनी सहायता वकील (LADC) की मांग करें।',
      'प्रत्येक रिमांड तिथि पर बंदी की नियमित अदालती पेशी सुनिश्चित कराएं।'
    ],
    donts_hi: [
      'केवल भारी जमानत राशि न जुटा पाने के कारण गरीब विचाराधीन कैदी को जेल में बंद न रहने दें।',
      'चार्जशीट दाखिल करने की वैधानिक समय-सीमा (60/90 दिन) बीतने के बाद जेल में रहना स्वीकार न करें।',
      'निःशुल्क सरकारी कानूनी सहायता के लिए किसी भी व्यक्ति को रिश्वत न दें।'
    ]
  },

  'whistleblower-protection-anti-corruption': {
    title_hi: 'व्हिसलब्लोअर संरक्षण एवं भ्रष्टाचार निरोधक अधिकार',
    summary_hi: 'व्हिसलब्लोअर्स संरक्षण अधिनियम 2014 और लोकपाल अधिनियम के तहत भ्रष्टाचार की गुप्त सूचना देने वाले नागरिक को पहचान की पूर्ण गोपनीयता और प्रतिशोध से सुरक्षा पाने का अधिकार है।',
    whatToSay: 'Under Section 4 of the Whistle Blowers Protection Act, 2014 and the Central Vigilance Commission (CVC) PIDPI guidelines, my identity must be kept strictly anonymous. Any administrative harassment or retaliation is a punishable statutory violation.',
    whatToSay_hi: 'व्हिसलब्लोअर्स संरक्षण अधिनियम 2014 की धारा 4 और केंद्रीय सतर्कता आयोग (CVC) की पीआईडीपीआई नीति के अनुसार मेरी पहचान पूर्णतः गुप्त रखी जानी चाहिए। किसी भी प्रकार का प्रशासनिक उत्पीड़न या प्रतिशोध दंडनीय अपराध है।',
    dos: [
      'Mark the complaint envelope as "Public Interest Disclosure (PIDPI)" addressed to the Central Vigilance Commission (CVC).',
      'Maintain certified copies of all documentary proof regarding the financial irregularity.',
      'Seek immediate police protection and administrative transfer if subjected to physical threats.'
    ],
    donts: [
      'Do NOT disclose your whistleblower identity on social media or public online platforms.',
      'Do NOT transmit confidential leak files over unsecured personal messaging apps.',
      'Do NOT submit frivolous, unverified, or defamatory allegations without verifiable documentation.'
    ],
    dos_hi: [
      'केंद्रीय सतर्कता आयोग (CVC) को "पब्लिक इंटरेस्ट डिस्क्लोजर (PIDPI)" लिखकर सीलबंद शिकायत भेजें।',
      'वित्तीय अनियमितता या भ्रष्टाचार से संबंधित सभी दस्तावेजों की प्रमाणित प्रतियां सुरक्षित रखें।',
      'जान का खतरा होने पर तत्काल पुलिस सुरक्षा और आधिकारिक स्थानांतरण की मांग करें।'
    ],
    donts_hi: [
      'सोशल मीडिया या सार्वजनिक मंचों पर अपनी पहचान उजागर न करें।',
      'असुरक्षित पर्सनल चैट ऐप्स पर गोपनीय सरकारी दस्तावेज न भेजें।',
      'बिना ठोस दस्तावेजी प्रमाण के कोई भी तथ्यहीन या दुर्भावनापूर्ण आरोप न लगाएं।'
    ]
  },

  'land-acquisition-fair-compensation': {
    title_hi: 'भूमि अधिग्रहण में उचित मुआवजा एवं पुनर्वास अधिकार (RFCTLARR 2013)',
    summary_hi: 'भूमि अधिग्रहण अधिनियम 2013 की धारा 26 से 30 के तहत ग्रामीण क्षेत्रों में बाजार मूल्य का 2 से 4 गुना और शहरी क्षेत्रों में 2 गुना मुआवजा तथा 100% सांत्वना राशि (Solatium) का वैधानिक अधिकार है।',
    whatToSay: 'Under Sections 26-30 of the RFCTLARR Act, 2013, the Collector is legally bound to compute compensation at market value multiplied by rural factors plus 100% statutory solatium. Possession cannot be taken without full prior payment.',
    whatToSay_hi: 'भूमि अधिग्रहण अधिनियम (RFCTLARR 2013) की धारा 26-30 के तहत कलेक्टर ग्रामीण क्षेत्रों में बाजार मूल्य का गुणक और 100% अतिरिक्त सांत्वना राशि (Solatium) देने के लिए बाध्य है। पूर्ण भुगतान से पहले कब्जा नहीं लिया जा सकता।',
    dos: [
      'Verify that the Social Impact Assessment (SIA) study was conducted under Section 4.',
      'Demand 100% Solatium (additional bonus compensation) under Section 30.',
      'File an objection before the Land Acquisition, Rehabilitation and Resettlement Authority under Section 64.'
    ],
    donts: [
      'Do NOT surrender physical land possession until 100% awarded compensation is credited to your bank account.',
      'Do NOT sign consent awards without independent legal verification of prevailing market registry rates.',
      'Do NOT allow agricultural multi-crop irrigated land acquisition without compliance with Section 10 restrictions.'
    ],
    dos_hi: [
      'जांच करें कि धारा 4 के तहत सामाजिक प्रभाव आकलन (SIA) अध्ययन हुआ है या नहीं।',
      'धारा 30 के तहत 100% सांत्वना राशि (Solatium) का अनिवार्य भुगतान मांगें।',
      'मुआवजा कम होने पर धारा 64 के तहत पुनर्वास एवं पुनर्व्यवस्थापन प्राधिकरण के समक्ष आपत्ति दर्ज करें।'
    ],
    donts_hi: [
      'जब तक पूरा मुआवजा बैंक खाते में जमा न हो जाए, तब तक जमीन का भौतिक कब्जा न छोड़ें।',
      'सर्किल रेट और बाजार भाव की कानूनी जांच किए बिना सहमति पत्र पर हस्ताक्षर न करें।',
      'बहुफसली सिंचित कृषि भूमि के अधिग्रहण में धारा 10 के कड़े नियमों की अनदेखी न होने दें।'
    ]
  }
};

async function run() {
  const catalogPath = path.resolve(__dirname, '../data/statutoryRightsCatalog.ts');
  console.log('Reading:', catalogPath);
  let content = fs.readFileSync(catalogPath, 'utf8');

  let enrichedCount = 0;
  for (const [rightId, data] of Object.entries(ENRICHMENTS)) {
    const idRegex = new RegExp(`id:\\s*'${rightId}'[\\s\\S]*?verifiedDate:`, 'm');
    const match = content.match(idRegex);
    if (!match) {
      console.warn(`Could not find id: '${rightId}'`);
      continue;
    }

    const block = match[0];
    if (block.includes('whatToSay:')) {
      console.log(`Right '${rightId}' already has whatToSay. Skipping.`);
      continue;
    }

    // Build the fields to inject right before verifiedDate:
    const fieldsToInject = `whatToSay: ${JSON.stringify(data.whatToSay)},
    whatToSay_hi: ${JSON.stringify(data.whatToSay_hi)},
    dos: ${JSON.stringify(data.dos, null, 6)},
    donts: ${JSON.stringify(data.donts, null, 6)},
    dos_hi: ${JSON.stringify(data.dos_hi, null, 6)},
    donts_hi: ${JSON.stringify(data.donts_hi, null, 6)},
    verifiedDate:`;

    const newBlock = block.replace('verifiedDate:', fieldsToInject);
    content = content.replace(block, newBlock);
    enrichedCount++;
    console.log(`Enriched: ${rightId}`);
  }

  fs.writeFileSync(catalogPath, content, 'utf8');
  console.log(`Enrichment complete! Total rights enriched: ${enrichedCount}`);
}

run().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});