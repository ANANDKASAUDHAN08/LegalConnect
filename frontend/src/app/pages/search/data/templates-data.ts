import { Template } from '../../../services/document-template.service';

export interface SearchTemplate extends Template {
  jurisdiction?: string;
  highlightedTitle?: string;
  highlightedDescription?: string;
}

export const DEFAULT_SEARCH_TEMPLATES: SearchTemplate[] = [
  {
    id: 'cheque-bounce-notice',
    title: 'Section 138 Cheque Bounce Demand Notice Template',
    actRef: 'Section 138, Negotiable Instruments Act',
    category: 'commercial',
    description: 'Standard legal demand notice sent to a drawer of a bounced cheque, demanding payment within 15 days of notice receipt.',
    fields: [],
    body: '',
    jurisdiction: 'Central'
  },
  {
    id: 'mutual-divorce-deed',
    title: 'Mutual Consent Divorce Deed Template',
    actRef: 'Section 13B, Hindu Marriage Act, 1955',
    category: 'family',
    description: 'Pre-drafted deed to detail separation terms, alimony, child custody, and mutual agreement between spouses before filing in court.',
    fields: [],
    body: '',
    jurisdiction: 'Central'
  },
  {
    id: 'mact-claim-petition',
    title: 'MACT Claim Petition Draft Form',
    actRef: 'Section 166, Motor Vehicles Act, 1988',
    category: 'transport',
    description: 'Formal claim petition statement structure to demand compensation in the Motor Accident Claims Tribunal (MACT).',
    fields: [],
    body: '',
    jurisdiction: 'Central'
  },
  {
    id: 'rti-application',
    title: 'RTI Information Request Application',
    actRef: 'Section 6(1), Right to Information Act, 2005',
    category: 'civil',
    description: 'Standard application layout to request certified copies of public records and documents from government departments.',
    fields: [],
    body: '',
    jurisdiction: 'Central'
  },
  {
    id: 'maintenance-petition',
    title: 'Wife/Child Maintenance Petition Draft',
    actRef: 'Section 125, CrPC / Section 144, BNSS',
    category: 'family',
    description: 'Legal petition layout to seek monthly support allowance from a spouse who neglects or deserts the family.',
    fields: [],
    body: '',
    jurisdiction: 'Central'
  },
  {
    id: 'section-63-bsa-certificate',
    title: 'Electronic Evidence Declaration (BSA Section 63)',
    actRef: 'Section 63, Bharatiya Sakshya Adhiniyam, 2023',
    category: 'civil',
    description: 'Mandatory declaration certificate required to make digital files, WhatsApp chats, and emails admissible in legal court.',
    fields: [],
    body: '',
    jurisdiction: 'Central'
  },
  {
    id: 'general-nda',
    title: 'Non-Disclosure Agreement (NDA)',
    actRef: 'Section 27, Indian Contract Act, 1872',
    category: 'commercial',
    description: 'Standard mutual legal contract protecting proprietary details, startup ideas, and commercial secrets between parties.',
    fields: [],
    body: '',
    jurisdiction: 'Central'
  },
  {
    id: 'will-testament',
    title: 'Last Will and Testament Template',
    actRef: 'Section 63, Indian Succession Act, 1925',
    category: 'family',
    description: 'Official self-declared legal statement for asset inheritance and distribution of self-acquired property.',
    fields: [],
    body: '',
    jurisdiction: 'Central'
  }
];