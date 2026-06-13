export interface LaymanScenario {
  title: string;
  section_number: string;
  flowchart?: string[];
}

export interface LaymanTopic {
  label: string;
  icon: string;
  description: string;
  keywords: string[];
  scenarios?: LaymanScenario[];
}

export const LAYMAN_TOPIC_MAP: Record<string, LaymanTopic[]> = {
  'BNS': [
    {
      label: 'Safety & Physical Harm',
      icon: 'shield',
      description: 'Hurt, assault, murder, threats, and physical safety.',
      keywords: ['murder', 'hurt', 'suicide', 'death', 'kidnap', 'body', 'injury', 'assault', 'violence', 'force', 'threat', 'intimidation'],
      scenarios: [
        {
          title: 'Someone physically hit, injured, or assaulted me',
          section_number: '115',
          flowchart: ['Physical Assault Occurs', 'Visit Hospital for Medical Exam & MLC Report', 'Lodge Police FIR (BNS Sec 115)', 'Police Investigation & Chargesheet', 'Trial & Prosecution']
        },
        {
          title: 'Someone threatened to harm or kill me (Criminal Intimidation)',
          section_number: '351',
          flowchart: ['Threat / Intimidation Incident', 'Gather Evidence (Recordings, SMS, Chats)', 'File Police Complaint (BNS Sec 351)', 'Police Issue Warning / Charge accused', 'Bail Hearing & Restraining Orders']
        },
        {
          title: 'Sovereignty, unity and integrity endangerment',
          section_number: '152',
          flowchart: ['Anti-National Activity Reported', 'Intelligence Gathering', 'FIR under BNS Sec 152', 'Special Court Proceedings', 'Judicial Determination']
        }
      ]
    },
    {
      label: 'Theft & Property Crimes',
      icon: 'home',
      description: 'Theft, robbery, extortion, and property disputes.',
      keywords: ['theft', 'steal', 'rob', 'property', 'trespass', 'extortion', 'loot', 'mischief'],
      scenarios: [
        {
          title: 'Someone stole my property secretly',
          section_number: '303',
          flowchart: ['Theft Discovered', 'Gather CCTV / Proof / Item Details', 'Lodge Theft FIR (BNS Sec 303)', 'Police Investigation & Search', 'Recovery or Final Untraced Report']
        }
      ]
    },
    {
      label: 'Women & Child Safety',
      icon: 'user-group',
      description: 'Dowry harassment, domestic cruelty, and modesty assault.',
      keywords: ['woman', 'child', 'dowry', 'rape', 'sexual', 'marriage', 'husband', 'minor', 'kid', 'girl'],
      scenarios: [
        {
          title: 'Dowry harassment or cruelty by husband/relatives',
          section_number: '85',
          flowchart: ['Cruelty / Dowry Demand', 'Consult CAW Cell (Crime Against Women Cell)', 'Counseling & Mediation Attempt', 'Lodge FIR under BNS Sec 85', 'Regular Family Court Trial']
        },
        {
          title: 'Assault or criminal force to modesty of woman',
          section_number: '74',
          flowchart: ['Modesty Assault / Harassment', 'Lodge Immediate Police FIR (BNS Sec 74)', 'Statement to Magistrate (Sec 183 BNSS)', 'Fast-Track Police Chargesheet', 'Dedicated Trial Court']
        }
      ]
    },
    {
      label: 'Frauds, Cheating & Forgery',
      icon: 'file-text',
      description: 'Cheating, white-collar fraud, counterfeiting, and forged papers.',
      keywords: ['cheat', 'counterfeit', 'forge', 'document', 'coin', 'stamp', 'currency', 'fraud', 'deceive'],
      scenarios: [
        {
          title: 'Deceiving someone to deliver property (Cheating)',
          section_number: '316',
          flowchart: ['Deception / Fraud Encountered', 'Compile Transaction / Communication Records', 'Send Legal Notice requesting return of funds', 'Lodge Complaint at local police / Court', 'Civil Recovery Suit / Criminal Trial']
        },
        {
          title: 'Punishment for cheating / corporate fraud',
          section_number: '318',
          flowchart: ['Cheating/Corporate Fraud Discovered', 'Document Financial Trails & Transactions', 'Report to Corporate Registrar / Police Cell', 'Corporate Assets Audit', 'Court Proceedings']
        }
      ]
    },
    {
      label: 'Public Peace & Order',
      icon: 'alert-circle',
      description: 'Unlawful assembly, rioting, and public nuisance.',
      keywords: ['assembly', 'riot', 'public', 'state', 'sovereignty', 'separatist', 'rebellion', 'tranquility'],
      scenarios: [
        {
          title: 'Unlawful assembly or rioting in public areas',
          section_number: '189',
          flowchart: ['Public Disturbance/Assembly occurs', 'Police order dispersal', 'Arrests/detentions of rioters', 'FIR under BNS Sec 189', 'Judicial Prosecution']
        }
      ]
    }
  ],
  'IPC': [
    {
      label: 'Safety & Physical Harm',
      icon: 'shield',
      description: 'Hurt, assault, murder, threats, and physical safety.',
      keywords: ['murder', 'hurt', 'suicide', 'death', 'kidnap', 'body', 'injury', 'assault', 'violence', 'force', 'threat', 'intimidation'],
      scenarios: [
        {
          title: 'Someone physically hit, injured, or assaulted me',
          section_number: '323',
          flowchart: ['Physical Assault Occurs', 'Visit Hospital for Medical Exam & MLC Report', 'Lodge Police FIR (IPC Sec 323)', 'Police Investigation & Chargesheet', 'Trial & Prosecution']
        },
        {
          title: 'Someone threatened to harm or kill me (Criminal Intimidation)',
          section_number: '506',
          flowchart: ['Threat / Intimidation Incident', 'Gather Evidence (Recordings, SMS, Chats)', 'File Police Complaint (IPC Sec 506)', 'Police Issue Warning / Charge accused', 'Bail Hearing & Restraining Orders']
        }
      ]
    },
    {
      label: 'Theft & Property Crimes',
      icon: 'home',
      description: 'Theft, robbery, extortion, and property disputes.',
      keywords: ['theft', 'steal', 'rob', 'property', 'trespass', 'extortion', 'loot', 'mischief'],
      scenarios: [
        {
          title: 'Someone stole my property secretly',
          section_number: '379',
          flowchart: ['Theft Discovered', 'Gather CCTV / Proof / Item Details', 'Lodge Theft FIR (IPC Sec 379)', 'Police Investigation & Search', 'Recovery or Final Untraced Report']
        }
      ]
    },
    {
      label: 'Women & Child Safety',
      icon: 'user-group',
      description: 'Dowry harassment, domestic cruelty, and modesty assault.',
      keywords: ['woman', 'child', 'dowry', 'rape', 'sexual', 'marriage', 'husband', 'minor', 'kid', 'girl'],
      scenarios: [
        {
          title: 'Cruelty by husband or relatives',
          section_number: '498A',
          flowchart: ['Domestic Cruelty / Dowry Demand', 'Consult CAW Cell (Crime Against Women Cell)', 'Counseling & Mediation Attempt', 'Lodge FIR under IPC Sec 498A', 'Regular Family Court Trial']
        },
        {
          title: 'Assault or criminal force to modesty of woman',
          section_number: '354',
          flowchart: ['Modesty Assault / Harassment', 'Lodge Immediate Police FIR (IPC Sec 354)', 'Statement to Magistrate', 'Fast-Track Police Chargesheet', 'Dedicated Trial Court']
        }
      ]
    },
    {
      label: 'Frauds, Cheating & Forgery',
      icon: 'file-text',
      description: 'Cheating, white-collar fraud, counterfeiting, and forged papers.',
      keywords: ['cheat', 'counterfeit', 'forge', 'document', 'coin', 'stamp', 'currency', 'fraud', 'deceive'],
      scenarios: [
        {
          title: 'Deceiving someone to deliver property (Cheating)',
          section_number: '415',
          flowchart: ['Deception / Fraud Encountered', 'Compile Transaction / Communication Records', 'Send Legal Notice requesting return of funds', 'Lodge Complaint at local police / Court', 'Civil Recovery Suit / Criminal Trial']
        },
        {
          title: 'Punishment for cheating / corporate fraud',
          section_number: '420',
          flowchart: ['Cheating/Corporate Fraud Discovered', 'Document Financial Trails & Transactions', 'Report to Corporate Registrar / Police Cell', 'Corporate Assets Audit', 'Court Proceedings']
        }
      ]
    }
  ],
  'CONSTITUTION': [
    {
      label: 'Fundamental Rights',
      icon: 'scale',
      description: 'Equality, liberty, speech, religion, and educational rights.',
      keywords: ['right', 'equality', 'speech', 'freedom', 'liberty', 'education', 'citizen', 'life', 'discrimination'],
      scenarios: [
        { title: 'Equality before law and equal protection', section_number: '14' },
        { title: 'Freedom of speech, expression, and assembly', section_number: '19' },
        { title: 'Protection of life and personal liberty', section_number: '21' },
        { title: 'Right to free and compulsory education', section_number: '21A' },
        { title: 'Remedies for enforcement of fundamental rights (Writs)', section_number: '32' }
      ]
    },
    {
      label: 'Government & Parliament',
      icon: 'file-text',
      description: 'President, prime minister, parliament powers, and state legislature.',
      keywords: ['parliament', 'governor', 'president', 'legislature', 'union', 'state'],
      scenarios: [
        { title: 'Admission or establishment of new States', section_number: '2' },
        { title: 'Formation/alteration of areas or boundaries of states', section_number: '3' }
      ]
    },
    {
      label: 'Directive Principles',
      icon: 'file-text',
      description: 'Directive policy guidelines for state welfare.',
      keywords: ['directive', 'policy', 'welfare', 'principles', 'uniform civil code'],
      scenarios: [
        { title: 'Equal livelihood and distribution of resources', section_number: '39' },
        { title: 'Uniform Civil Code for all citizens', section_number: '44' }
      ]
    }
  ],
  'RTI': [
    {
      label: 'Filing & Fees',
      icon: 'file-text',
      description: 'How to file a request, application format, and timeline.',
      keywords: ['request', 'fee', 'officer', 'application', 'information', 'thirty days'],
      scenarios: [
        { title: 'Citizen\'s right to secure access to information', section_number: '3' },
        { title: 'How to file an RTI request application', section_number: '6' },
        { title: 'Disposal of request within 30 days', section_number: '7' }
      ]
    },
    {
      label: 'Exemptions & Secrets',
      icon: 'shield',
      description: 'What information the government can refuse to disclose.',
      keywords: ['exempt', 'disclose', 'security', 'third party', 'refuse', 'sovereignty'],
      scenarios: [
        { title: 'Exemptions from disclosing sensitive information', section_number: '8' }
      ]
    },
    {
      label: 'Penalties & Appeals',
      icon: 'scale',
      description: 'Fines on officials and filing appeals to the Commission.',
      keywords: ['penalty', 'fine', 'appeal', 'commission', 'refusal', 'delay'],
      scenarios: [
        { title: 'Fines and penalties on officials for delay/refusal', section_number: '20' }
      ]
    }
  ],
  'ITA': [
    {
      label: 'Cyber Crimes',
      icon: 'globe',
      description: 'Hacking, computer source tampering, and offensive online messages.',
      keywords: ['offence', 'hacking', 'message', 'obscene', 'source code', 'computer', 'network', 'tamper'],
      scenarios: [
        { title: 'Tampering with computer source documents', section_number: '65' },
        { title: 'Hacking or computer related offences', section_number: '66' },
        { title: 'Sending offensive messages through phone/social media', section_number: '66A' },
        { title: 'Publishing obscene material in electronic form', section_number: '67' }
      ]
    },
    {
      label: 'Platform Liability',
      icon: 'shield',
      description: 'Exemptions of liability for network service providers and platforms.',
      keywords: ['intermediary', 'liability', 'exemption', 'third party', 'host'],
      scenarios: [
        { title: 'Exemption from liability of intermediaries (like Google/FB)', section_number: '79' }
      ]
    }
  ],
  'CPA': [
    {
      label: 'Consumer Claims',
      icon: 'shopping-cart',
      description: 'Product defects, service deficiencies, and refund complaints.',
      keywords: ['consumer', 'complaint', 'goods', 'services', 'refund', 'defect', 'deficiency'],
      scenarios: [
        { title: 'Definition of consumer and rights', section_number: '2_consumer' },
        { title: 'Filing complaints for defective goods or services', section_number: '35' }
      ]
    },
    {
      label: 'Dispute Commissions',
      icon: 'scale',
      description: 'District, State, and National commissions and their jurisdictions.',
      keywords: ['district commission', 'state commission', 'national commission', 'jurisdiction', 'appeal', 'crore'],
      scenarios: [
        { title: 'Jurisdiction of District Consumer Commission', section_number: '34' },
        { title: 'Jurisdiction of State Consumer Commission', section_number: '47' }
      ]
    }
  ],
  'ICA': [
    {
      label: 'Contracts & Agreements',
      icon: 'file-text',
      description: 'Proposal, acceptance, free consent, and valid agreements.',
      keywords: ['contract', 'agreement', 'proposal', 'acceptance', 'consent', 'promise', 'void'],
      scenarios: [
        { title: 'Definition of proposal, acceptance, and promise', section_number: '2' },
        { title: 'What agreements constitute valid contracts', section_number: '10' },
        { title: 'Free consent definition (without fraud or coercion)', section_number: '14' }
      ]
    },
    {
      label: 'Breach & Damages',
      icon: 'alert-circle',
      description: 'Compensation for broken contracts and penalty clauses.',
      keywords: ['breach', 'compensation', 'loss', 'damage', 'broken', 'penalty'],
      scenarios: [
        { title: 'Compensation for loss caused by breach of contract', section_number: '73' },
        { title: 'Breach of contract where penalty is stipulated', section_number: '74' }
      ]
    }
  ]
};
