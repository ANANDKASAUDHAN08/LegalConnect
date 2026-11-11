export interface FaqSeedItem {
  id: string;
  category: string;
  badge?: string;
  question: string;
  question_hi?: string;
  answer: string;
  answer_hi?: string;
  sortOrder?: number;
}

export const faqsSeedCatalog: FaqSeedItem[] = [
  {
    id: 'faq-free',
    category: 'general',
    badge: 'Free Access',
    question: 'Is LegalConnect 100% free for clients?',
    question_hi: 'क्या लीगलकनेक्ट नागरिकों के लिए पूरी तरह से मुफ्त है?',
    answer: 'Yes, absolutely. Citizens and businesses can search advocate directories, explore Bare Acts, download court templates, and submit consultation inquiries completely free of charge. We never charge commission or platform markup fees.',
    answer_hi: 'हाँ, बिल्कुल। नागरिक और व्यवसाय पूरी तरह से मुफ्त में वकील डायरेक्टरी खोज सकते हैं, बेयर एक्ट्स पढ़ सकते हैं और नोटिस डाउनलोड कर सकते हैं।',
    sortOrder: 1
  },
  {
    id: 'faq-grievance',
    category: 'general',
    badge: 'Platform Governance',
    question: 'How do I report incorrect info or file a platform grievance?',
    question_hi: 'गलत जानकारी की रिपोर्ट या शिकायत कैसे दर्ज करें?',
    answer: 'You can reach our statutory Grievance Officer under the IT Rules 2021 via our Support DPO Desk at <strong>grievance@legalconnect.com</strong>. All complaints are formally acknowledged within 24 hours and resolved within 15 business days.',
    answer_hi: 'आप आईटी नियम 2021 के तहत हमारे शिकायत अधिकारी से grievance@legalconnect.com पर संपर्क कर सकते हैं।',
    sortOrder: 2
  },
  {
    id: 'faq-bar',
    category: 'advocate',
    badge: 'Verified Advocates',
    question: 'How do lawyers get verified on LegalConnect?',
    question_hi: 'वकीलों का सत्यापन (Verification) कैसे किया जाता है?',
    answer: 'Every advocate profile undergoes mandatory manual verification against State Bar Council enrollment registers and Bar Council of India (BCI) License credentials before receiving the green verified badge.',
    answer_hi: 'प्रत्येक वकील का प्रोफाइल बार काउंसिल ऑफ इंडिया (BCI) और राज्य बार काउंसिल के इनरोलमेंट नंबर से सत्यापित किया जाता है।',
    sortOrder: 3
  },
  {
    id: 'faq-inquiry',
    category: 'advocate',
    badge: 'Direct Connect',
    question: 'How do client consultation inquiries reach advocates?',
    question_hi: 'नागरिकों के प्रश्न वकीलों तक कैसे पहुंचते हैं?',
    answer: 'When a user submits an inquiry, it is securely transmitted directly to the advocate’s encrypted dashboard and verified email. No middleman broker holds or delays communication.',
    answer_hi: 'जब कोई नागरिक पूछताछ भेजता है, तो वह सीधे वकील के डैशबोर्ड और ईमेल पर सुरक्षित रूप से पहुंच जाती है।',
    sortOrder: 4
  },
  {
    id: 'faq-commission',
    category: 'advocate',
    badge: 'Zero Commission',
    question: 'Does LegalConnect take a cut of the advocate’s legal fees?',
    question_hi: 'क्या लीगलकनेक्ट वकील की फीस में से कोई कमीशन लेता है?',
    answer: 'No. LegalConnect operates on a strict zero-commission model. 100% of client legal fees go directly to the practicing lawyer. We do not participate in fee splitting.',
    answer_hi: 'नहीं। लीगलकनेक्ट शून्य कमीशन मॉडल पर काम करता है। पूरी फीस सीधे वकील को मिलती है।',
    sortOrder: 5
  },
  {
    id: 'faq-privacy',
    category: 'security',
    badge: 'DPDP Act 2023',
    question: 'What data protection rights do I have under the DPDP Act 2023?',
    question_hi: 'DPDP अधिनियम 2023 के तहत मेरे पास क्या डेटा सुरक्षा अधिकार हैं?',
    answer: 'Under India’s Digital Personal Data Protection (DPDP) Act 2023, you retain full rights to access, correct, erase, or export your personal data dossier at any time through your account settings.',
    answer_hi: 'डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 के तहत आप कभी भी अपना डेटा देखने, सुधारने या मिटाने का अनुरोध कर सकते हैं।',
    sortOrder: 6
  },
  {
    id: 'faq-dossier',
    category: 'security',
    badge: 'Subject Access Request',
    question: 'How can I request or download my personal data dossier?',
    question_hi: 'मैं अपनी व्यक्तिगत डेटा फ़ाइल कैसे डाउनलोड कर सकता हूँ?',
    answer: 'Navigate to <em>Privacy Settings &gt; Data Export</em> in your dashboard. Clicking "Export Personal Dossier" generates a password-protected JSON & PDF archive of your activity history.',
    answer_hi: 'अपने डैशबोर्ड में Privacy Settings > Data Export पर जाकर आप अपनी पूरी डेटा फ़ाइल डाउनलोड कर सकते हैं।',
    sortOrder: 7
  },
  {
    id: 'faq-offline',
    category: 'library',
    badge: 'PWA Offline Cache',
    question: 'Does the Bare Acts law library work offline without internet?',
    question_hi: 'क्या बेयर एक्ट्स लाइब्रेरी बिना इंटरनेट के ऑफलाइन भी काम करती है?',
    answer: 'Yes. LegalConnect is built as a progressive web app (PWA). Once accessed, statutory Bare Act sections are cached locally in your browser storage for offline legal research.',
    answer_hi: 'हाँ, एक बार लोड होने के बाद धाराएं आपके ब्राउज़र में कैश हो जाती हैं जिससे आप ऑफलाइन भी पढ़ सकते हैं।',
    sortOrder: 8
  },
  {
    id: 'faq-bns',
    category: 'library',
    badge: 'Updated 2026 Acts',
    question: 'Are the new criminal codes (BNS, BNSS, BSA) updated in the database?',
    question_hi: 'क्या नए आपराधिक कानून (BNS, BNSS, BSA) डेटाबेस में अपडेट हैं?',
    answer: 'Yes. Bharatiya Nyaya Sanhita (BNS 2023), Bharatiya Nagarik Suraksha Sanhita (BNSS 2023), and Bharatiya Sakshya Adhiniyam (BSA 2023) are fully cross-referenced with legacy IPC, CrPC, and Evidence Act sections.',
    answer_hi: 'हाँ, भारतीय न्याय संहिता, भारतीय नागरिक सुरक्षा संहिता और भारतीय साक्ष्य अधिनियम पूरी तरह से पुराने कानूनों के साथ क्रॉस-रेफरेंस्ड हैं।',
    sortOrder: 9
  }
];