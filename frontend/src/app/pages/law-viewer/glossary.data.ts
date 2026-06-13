export interface GlossaryItem {
  term: string;
  definition: string;
}

export const GLOSSARY_LIST: GlossaryItem[] = [
  { term: 'non-cognizable', definition: 'An offence for which a police officer has no authority to arrest without a warrant.' },
  { term: 'cognizable', definition: 'An offence for which a police officer may arrest the accused without a warrant.' },
  { term: 'non-bailable', definition: 'An offence where bail is not a matter of right; the court decides whether to grant bail.' },
  { term: 'bailable', definition: 'An offence in which the accused is entitled to be released on bail as a matter of right.' },
  { term: 'culpable homicide', definition: 'Causing death by doing an act with the intention of causing death, or causing such bodily injury as is likely to cause death.' },
  { term: 'mens rea', definition: 'A guilty mind or criminal intent; the mental element of a crime.' },
  { term: 'abetment', definition: 'The act of encouraging, instigating, or aiding another person to commit an offence.' },
  { term: 'extortion', definition: 'Obtaining money, property, or services from a person through coercion or threats.' },
  { term: 'trespass', definition: 'Entering onto another person\'s property without permission or authority.' },
  { term: 'commencement', definition: 'The date on which an Act or provision of law comes into force.' },
  { term: 'jurisdiction', definition: 'The official power of a court or authority to make legal decisions and judgments.' },
  { term: 'offence', definition: 'An illegal act or crime that violates public law.' },
  { term: 'evidence', definition: 'Information, documents, or physical objects presented in court to prove or disprove a fact.' },
  { term: 'witness', definition: 'A person who has relevant knowledge about a matter and gives testimony under oath.' },
  { term: 'magistrate', definition: 'A civil officer or judge who administers the law, typically conducting preliminary hearings and trials for minor offences.' },
  { term: 'police officer', definition: 'A member of a law enforcement force responsible for maintaining public order and enforcing laws.' },
  { term: 'accused', definition: 'A person who is officially charged with committing a crime.' },
  { term: 'warrant', definition: 'A written order issued by a judge or magistrate authorizing police to make an arrest, search premises, or take other legal actions.' },
  { term: 'summons', definition: 'An official order to appear before a court, judge, or magistrate.' }
];
