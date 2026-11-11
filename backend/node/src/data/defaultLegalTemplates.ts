export interface SeedTemplateField {
  key: string;
  label: string;
  placeholder: string;
  type: string;
  defaultValue: string;
  helpTip?: string;
}

export interface SeedLegalTemplate {
  templateId: string;
  title: string;
  actRef: string;
  category: 'commercial' | 'family' | 'civil' | 'transport' | 'rights';
  description: string;
  fields: SeedTemplateField[];
  body: string;
  sortOrder: number;
}

export const defaultLegalTemplates: SeedLegalTemplate[] = [
  {
    templateId: 'cheque-bounce-notice',
    title: 'Cheque Bounce Demand Notice',
    actRef: 'NIA Section 138',
    category: 'commercial',
    description: 'Mandatory notice demanding payment within 15 days of bouncing a cheque, required before initiating criminal court action.',
    sortOrder: 1,
    fields: [
      { key: 'advocateName', label: 'Advocate Name', placeholder: 'e.g. Adv. Rajesh Kumar', type: 'text', defaultValue: '', helpTip: 'Write the advocate\'s name serving the notice.' },
      { key: 'advocateAddress', label: 'Advocate Office Address', placeholder: 'e.g. Chamber 412, Tis Hazari Courts, Delhi', type: 'text', defaultValue: '', helpTip: 'Advocate\'s office address for responses.' },
      { key: 'clientName', label: 'Client Name (Payee)', placeholder: 'e.g. Rohan Sharma', type: 'text', defaultValue: '', helpTip: 'Name of the person who was owed the money.' },
      { key: 'clientAddress', label: 'Client Address', placeholder: 'e.g. Sector 15, Dwarka, Delhi', type: 'text', defaultValue: '', helpTip: 'Full residential address of the payee.' },
      { key: 'drawerName', label: 'Drawer Name (Accused)', placeholder: 'e.g. Sunil Verma', type: 'text', defaultValue: '', helpTip: 'Name of the person who signed the bounced cheque.' },
      { key: 'drawerAddress', label: 'Drawer Address', placeholder: 'e.g. Model Town, Jalandhar', type: 'text', defaultValue: '', helpTip: 'Address where the notice will be mailed.' },
      { key: 'chequeNumber', label: 'Cheque Number', placeholder: 'e.g. 450218', type: 'text', defaultValue: '', helpTip: '6-digit number printed on bottom of cheque.' },
      { key: 'chequeDate', label: 'Cheque Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date written on the bounced cheque.' },
      { key: 'bankName', label: 'Drawn Bank Name', placeholder: 'e.g. HDFC Bank Ltd.', type: 'text', defaultValue: '', helpTip: 'The bank account the cheque belonged to.' },
      { key: 'chequeAmount', label: 'Cheque Amount (Rs.)', placeholder: 'e.g. 1,50,000', type: 'text', defaultValue: '', helpTip: 'Total numeric amount written on the cheque.' },
      { key: 'memoDate', label: 'Cheque Return Memo Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date bank issued the Return Memo.' },
      { key: 'noticeDate', label: 'Notice Issuing Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date this notice is being sent.' }
    ],
    body: `FORMAL DEMAND NOTICE
(Under Section 138 of the Negotiable Instruments Act, 1881)

Date: {{noticeDate}}

To,
{{drawerName}}
{{drawerAddress}}

Subject: Notice for Payment under Section 138 of Negotiable Instruments Act, 1881 for Dishonour of Cheque No. {{chequeNumber}} for Rs. {{chequeAmount}}/-

Dear Sir/Madam,

Under instructions and on behalf of my client, {{clientName}}, resident of {{clientAddress}}, I hereby serve you with the following demand notice:

1. That you issued a Cheque No. {{chequeNumber}} dated {{chequeDate}} drawn on {{bankName}} for a sum of Rs. {{chequeAmount}}/- (Rupees {{chequeAmount}} only) towards discharge of your legally enforceable debt and liability to my client.

2. That my client presented the said cheque for payment through their banker, but the same was returned unpaid by your bank with the Cheque Return Memo dated {{memoDate}} stating the reason as "Funds Insufficient" / "Refer to Drawer".

3. That the said cheque was dishonoured due to inadequacy of funds in your account, which is a criminal offense under Section 138 of the Negotiable Instruments Act, 1881.

4. I, therefore, call upon you through this notice to pay the entire cheque amount of Rs. {{chequeAmount}}/- to my client within 15 (fifteen) days from the receipt of this notice.

5. Please note that if you fail to make the said payment within the stipulated 15 days, my client will be constrained to initiate criminal proceedings against you in the court of competent jurisdiction under Section 138 of the Negotiable Instruments Act, 1881, holding you liable for all costs and consequences thereof.

Yours faithfully,


[Signature]

{{advocateName}}
Advocate
{{advocateAddress}}`
  },
  {
    templateId: 'mutual-divorce-deed',
    title: 'Mutual Consent Divorce Deed Template',
    actRef: 'HMA Section 13B',
    category: 'family',
    description: 'Draft agreement outlining settlement terms, alimony, and custody arrangements for joint divorce petitions.',
    sortOrder: 2,
    fields: [
      { key: 'husbandName', label: 'Husband Name', placeholder: 'e.g. Vikram Malhotra', type: 'text', defaultValue: '', helpTip: 'Full legal name of the husband.' },
      { key: 'husbandFatherName', label: 'Husband\'s Father Name', placeholder: 'e.g. Ramesh Malhotra', type: 'text', defaultValue: '', helpTip: 'Husband\'s father\'s full legal name.' },
      { key: 'husbandAddress', label: 'Husband Address', placeholder: 'e.g. Block C, Vasant Kunj, New Delhi', type: 'text', defaultValue: '', helpTip: 'Current address of the husband.' },
      { key: 'wifeName', label: 'Wife Name', placeholder: 'e.g. Shalini Malhotra', type: 'text', defaultValue: '', helpTip: 'Full legal name of the wife.' },
      { key: 'wifeFatherName', label: 'Wife\'s Father Name', placeholder: 'e.g. Suresh Grover', type: 'text', defaultValue: '', helpTip: 'Wife\'s father\'s full legal name.' },
      { key: 'wifeAddress', label: 'Wife Address', placeholder: 'e.g. Sector 2, Panchkula, Haryana', type: 'text', defaultValue: '', helpTip: 'Current address of the wife.' },
      { key: 'marriageDate', label: 'Date of Marriage', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date the wedding took place.' },
      { key: 'separationDate', label: 'Date of Separation', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date since which you have lived separately.' },
      { key: 'alimonyAmount', label: 'Permanent Alimony (Rs.)', placeholder: 'e.g. 10,00,000 / No Alimony', type: 'text', defaultValue: '', helpTip: 'Lump-sum maintenance details agreed upon.' },
      { key: 'childCustodyText', label: 'Child Custody Terms', placeholder: 'e.g. Sole custody of son Aarav to wife, husband has visitation rights.', type: 'text', defaultValue: '', helpTip: 'Details of child custody and visitation rights.' },
      { key: 'currentDate', label: 'Deed Execution Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date this settlement deed is signed.' }
    ],
    body: `MUTUAL CONSENT SETTLEMENT DEED
(Points of Agreement for Joint Divorce under Section 13B of Hindu Marriage Act, 1955)

This Deed of Settlement is made on this the {{currentDate}} by and between:
Sh. {{husbandName}} son of {{husbandFatherName}} residing at {{husbandAddress}} (hereinafter referred to as the First Party)
AND
Smt. {{wifeName}} daughter of {{wifeFatherName}} residing at {{wifeAddress}} (hereinafter referred to as the Second Party).

WHEREAS:
1. The marriage between the Parties was solemnized on {{marriageDate}} according to Hindu Rites and Ceremonies.
2. Due to temperamental differences and incompatibility, the parties could not adjust together and have been living separately since {{separationDate}}. They have not cohabited as husband and wife since then.
3. The parties have mutually agreed to dissolve their marriage by mutual consent under Section 13B of the Hindu Marriage Act, 1955.

NOW THIS DEED WITNESSETH AS UNDER:
1. ALIMONY: The First Party has agreed to pay a lump-sum amount of Rs. {{alimonyAmount}}/- to the Second Party as permanent alimony, maintenance, and distribution of assets. Upon this payment, the Second Party shall have no further claims.
2. CUSTODY: The parties agree to the following terms regarding children:
{{childCustodyText}}
3. FUTURE LITIGATION: Both parties covenant that they shall not file any civil or criminal complaints against each other in the future regarding their marriage, and all pending cases (if any) shall be withdrawn.
4. MUTUAL DISCHARGE: By this agreement, both parties release each other from all marital obligations and agree to live their lives independently without interference.

IN WITNESS WHEREOF the parties have set their signatures below.


_____________________                _____________________
First Party (Husband)                Second Party (Wife)`
  },
  {
    templateId: 'mact-claim-petition',
    title: 'MACT Claim Petition Draft Fields',
    actRef: 'MVA Section 166',
    category: 'transport',
    description: 'Formal statement structure to claim compensation in the Motor Accident Claims Tribunal.',
    sortOrder: 3,
    fields: [
      { key: 'victimName', label: 'Victim Name', placeholder: 'e.g. Amit Sen', type: 'text', defaultValue: '', helpTip: 'Name of the person injured or deceased.' },
      { key: 'victimAge', label: 'Victim Age', placeholder: 'e.g. 34', type: 'text', defaultValue: '', helpTip: 'Age of the victim at the time of accident.' },
      { key: 'victimProfession', label: 'Victim Occupation', placeholder: 'e.g. Senior Software Engineer', type: 'text', defaultValue: '', helpTip: 'Victim\'s profession for salary calculation.' },
      { key: 'victimIncome', label: 'Monthly Income (Rs.)', placeholder: 'e.g. 75,000', type: 'text', defaultValue: '', helpTip: 'Proved monthly earnings of the victim.' },
      { key: 'accidentDate', label: 'Accident Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date the accident took place.' },
      { key: 'accidentTime', label: 'Accident Time', placeholder: 'e.g. 10:30 AM', type: 'text', defaultValue: '', helpTip: 'Approximate time when the accident occurred.' },
      { key: 'accidentPlace', label: 'Exact Accident Location', placeholder: 'e.g. Outer Ring Road, near Safdarjung Hospital, New Delhi', type: 'text', defaultValue: '', helpTip: 'Detailed address of the accident site.' },
      { key: 'policeStation', label: 'Jurisdiction Police Station', placeholder: 'e.g. Safdarjung Enclave Police Station', type: 'text', defaultValue: '', helpTip: 'The police station where the FIR was registered.' },
      { key: 'firNumber', label: 'FIR Number', placeholder: 'e.g. 102/2026', type: 'text', defaultValue: '', helpTip: 'FIR registration number for the accident.' },
      { key: 'vehicleNumber', label: 'Offending Vehicle Number', placeholder: 'e.g. DL-3C-AQ-8821', type: 'text', defaultValue: '', helpTip: 'Registration number of the vehicle that hit the victim.' },
      { key: 'respondentDetails', label: 'Respondent Details (Driver/Owner/Insurer)', placeholder: 'e.g. Sunil Verma (Driver), Baldev Singh (Owner), HDFC ERGO (Insurer)', type: 'textarea', defaultValue: '', helpTip: 'Enter names of the driver, owner, and insurance company of the offending vehicle.' },
      { key: 'injuryDetails', label: 'Details of Injuries / Disability', placeholder: 'e.g. multiple fractures in left leg and severe head trauma', type: 'textarea', defaultValue: '', helpTip: 'List the medical injuries or state if the accident resulted in death.' },
      { key: 'claimAmount', label: 'Total Compensation Claimed (Rs.)', placeholder: 'e.g. 50,00,000', type: 'text', defaultValue: '', helpTip: 'Estimated claim based on medical/income loss.' }
    ],
    body: `BEFORE THE MOTOR ACCIDENT CLAIMS TRIBUNAL
(Under Section 166 of the Motor Vehicles Act, 1988)

In the matter of:
{{victimName}}, Age: {{victimAge}} years, Occupation: {{victimProfession}}, Monthly Income: Rs. {{victimIncome}}/-
(Petitioner)
VERSUS
{{respondentDetails}}
(Respondents)

CLAIM PETITION FOR COMPENSATION

Most Respectfully Showeth:

1. That on {{accidentDate}} at about {{accidentTime}} at {{accidentPlace}}, the petitioner/victim met with a severe road accident caused by the rash and negligent driving of the vehicle bearing registration number {{vehicleNumber}}.

2. That the accident was immediately reported to the police, and FIR No. {{firNumber}} was registered at {{policeStation}} under Sections 279/337/304A of the Indian Penal Code.

3. That due to the accident, the victim sustained severe physical injuries resulting in {{injuryDetails}}, leading to massive medical expenses and complete loss of livelihood.

4. That the victim was earning Rs. {{victimIncome}}/- per month as {{victimProfession}}. Due to the negligence of the offending vehicle driver, the petitioner is entitled to a total compensation of Rs. {{claimAmount}}/- from the respondents jointly and severally.

5. PRAYER: It is therefore respectfully prayed that this Hon'ble Tribunal may be pleased to award compensation of Rs. {{claimAmount}}/- along with interest @ 9% per annum from the date of filing this petition till realization, in the interest of justice.

Petitioner

Through Advocate`
  },
  {
    templateId: 'rti-application',
    title: 'RTI Information Request Application',
    actRef: 'RTI Act Section 6(1)',
    category: 'civil',
    description: 'Standard format to request public documents or records from any government department/public authority.',
    sortOrder: 4,
    fields: [
      { key: 'applicantName', label: 'Applicant Name', placeholder: 'e.g. Mahesh Prasad', type: 'text', defaultValue: '', helpTip: 'Your full name.' },
      { key: 'applicantAddress', label: 'Applicant Address', placeholder: 'e.g. Flat 12B, Pocket 4, Rohini, Delhi', type: 'text', defaultValue: '', helpTip: 'Mailing address where records will be sent.' },
      { key: 'authorityName', label: 'Public Information Officer (PIO)', placeholder: 'e.g. Public Information Officer, MCD Office', type: 'text', defaultValue: '', helpTip: 'Designated PIO for the public department.' },
      { key: 'authorityAddress', label: 'Department Office Address', placeholder: 'e.g. Civic Centre, Minto Road, Delhi', type: 'text', defaultValue: '', helpTip: 'Office address of the department.' },
      { key: 'informationRequired', label: 'Information Required (Detailed Description)', placeholder: 'e.g. Certified copies of the layout approval plan for Building Block D...', type: 'textarea', defaultValue: '', helpTip: 'Be specific and detailed. Avoid asking opinions, ask for records/files.' },
      { key: 'informationPeriod', label: 'Period of Information', placeholder: 'e.g. April 2024 to March 2025', type: 'text', defaultValue: '', helpTip: 'Enter the timeframe/year that this requested data belongs to.' },
      { key: 'paymentReceiptNumber', label: 'RTI Fee Payment Slip/IPO Number', placeholder: 'e.g. 52F 890124', type: 'text', defaultValue: '', helpTip: 'The Rs.10 fee payment postal order or online receipt number.' },
      { key: 'paymentDate', label: 'Payment Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'Date the RTI fee was paid.' },
      { key: 'currentDate', label: 'Application Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date you are signing and filing this application.' }
    ],
    body: `APPLICATION FOR ACQUISITION OF INFORMATION UNDER RTI ACT, 2005
(Under Section 6(1) of the Right to Information Act, 2005)

Date: {{currentDate}}

To,
The Public Information Officer,
{{authorityName}}
{{authorityAddress}}

1. Name of the Applicant: {{applicantName}}
2. Address for Correspondence: {{applicantAddress}}

3. Particulars of Information Required:
I request you to kindly provide the following information/documents under the provisions of the RTI Act, 2005:
{{informationRequired}}

4. Time Period: The information requested relates to the period: {{informationPeriod}}
5. Format of Information: I request certified copies/printouts of the records to be sent to my mailing address.

6. Payment Details:
An application fee of Rs. 10/- has been paid via Postal Order / Demand Draft / Receipt No: {{paymentReceiptNumber}} dated {{paymentDate}}.

7. Citizenship: I hereby declare that I am a citizen of India and am eligible to receive information under the RTI Act.

Applicant Signature:

{{applicantName}}`
  },
  {
    templateId: 'maintenance-petition',
    title: 'Wife/Child Maintenance Petition',
    actRef: 'CrPC Section 125 / BNSS Section 144',
    category: 'family',
    description: 'Petition to seek monthly maintenance allowance from a spouse who neglects or deserts the family.',
    sortOrder: 5,
    fields: [
      { key: 'petitionerName', label: 'Petitioner Name (Wife/Parent)', placeholder: 'e.g. Kavita Sharma', type: 'text', defaultValue: '', helpTip: 'Name of the person claiming maintenance.' },
      { key: 'petitionerAddress', label: 'Petitioner Address', placeholder: 'e.g. Dwarka Sector 1, New Delhi', type: 'text', defaultValue: '', helpTip: 'Current residential address of the petitioner.' },
      { key: 'respondentName', label: 'Respondent Name (Husband/Child)', placeholder: 'e.g. Suresh Sharma', type: 'text', defaultValue: '', helpTip: 'Name of the person who has deserted/neglected you.' },
      { key: 'respondentAddress', label: 'Respondent Address', placeholder: 'e.g. DLF Phase 3, Gurugram, Haryana', type: 'text', defaultValue: '', helpTip: 'Current address of the respondent.' },
      { key: 'marriageDate', label: 'Date of Marriage', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'Date of marriage (if claiming as wife).' },
      { key: 'desertionDate', label: 'Date of Neglect/Desertion', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date since which the respondent stopped maintaining you.' },
      { key: 'monthlyExpense', label: 'Claimed Monthly Maintenance (Rs.)', placeholder: 'e.g. 25,000', type: 'text', defaultValue: '', helpTip: 'Required monthly amount for living expenses.' },
      { key: 'respondentIncome', label: 'Respondent Income (Estimated)', placeholder: 'e.g. Rs. 1,20,000 per month as Manager at TCS', type: 'text', defaultValue: '', helpTip: 'Known income details of the respondent to justify the claim.' }
    ],
    body: `IN THE COURT OF THE METROPOLITAN MAGISTRATE / FAMILY COURT
(Under Section 125 of the Code of Criminal Procedure, 1973 / Section 144 of BNSS)

In the matter of:
{{petitionerName}}
(Petitioner)
VERSUS
{{respondentName}}
(Respondent)

PETITION FOR MONTHLY MAINTENANCE ALLOWANCE

Most Respectfully Showeth:

1. That the Petitioner is the legally wedded wife of the Respondent, their marriage having been solemnized on {{marriageDate}} according to Hindu Rites and Ceremonies.

2. That the Respondent since {{desertionDate}} has deserted the Petitioner and failed/neglected to maintain her. The Petitioner has no independent source of income and is unable to maintain herself.

3. That the Respondent is a man of means, earning {{respondentIncome}} and having additional ancestral assets, but has deliberately refused to support the Petitioner.

4. That the Petitioner requires a minimum of Rs. {{monthlyExpense}}/- per month for food, lodging, medical care, and basic amenities in accordance with the Respondent's social status.

5. PRAYER: It is therefore respectfully prayed that this Hon'ble Court may be pleased to direct the Respondent to pay a monthly maintenance allowance of Rs. {{monthlyExpense}}/- to the Petitioner from the date of filing this application.

Petitioner

Through Advocate`
  },
  {
    templateId: 'section-63-bsa-certificate',
    title: 'Electronic Evidence Declaration (Section 63 BSA)',
    actRef: 'BSA Section 63 (formerly IEA Sec 65B)',
    category: 'civil',
    description: 'Mandatory declaration certificate required to make digital evidence (WhatsApp, emails, photos) admissible in court.',
    sortOrder: 6,
    fields: [
      { key: 'declarantName', label: 'Declarant Name', placeholder: 'e.g. Rahul Verma', type: 'text', defaultValue: '', helpTip: 'The person who owns/operates the device.' },
      { key: 'deviceDescription', label: 'Device Specifications', placeholder: 'e.g. Samsung Galaxy S23 Mobile Phone (Model SM-S911B) running Android 14', type: 'text', defaultValue: '', helpTip: 'Make, model, and OS of the phone/computer.' },
      { key: 'evidenceDescription', label: 'Details of Electronic Records', placeholder: 'e.g. Printout of WhatsApp chat conversations between Rahul and Accused from 10-Jan-2026...', type: 'textarea', defaultValue: '', helpTip: 'List all prints/CDs/drive files you are filing.' },
      { key: 'printerModel', label: 'Output Device / Printer Model', placeholder: 'e.g. HP LaserJet Pro M126nw printer connected to Dell Inspiron Laptop', type: 'text', defaultValue: '', helpTip: 'Equipment used to print or copy the data.' },
      { key: 'declaredCity', label: 'Declaration Place (City)', placeholder: 'e.g. Mumbai', type: 'text', defaultValue: '', helpTip: 'Enter the city where this certificate is being signed.' },
      { key: 'declaredDate', label: 'Declaration Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'The date you are signing this declaration.' }
    ],
    body: `CERTIFICATE UNDER SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM, 2023
(Corresponding to Section 65B of the Indian Evidence Act, 1872)

I, {{declarantName}}, do hereby solemnly affirm and declare as follows:

1. I am the lawful owner and operator of the electronic device namely:
{{deviceDescription}}
which has been under my lawful control throughout the period of creation/receipt of the electronic record.

2. I have produced printouts / copied files of the following electronic records:
{{evidenceDescription}}
which are attached to this certificate for presentation in the court.

3. The output records were printed/generated using:
{{printerModel}}
which was operating properly and in active condition.

4. The information contained in the electronic record reproduces the data fed into the device in the ordinary course of activities. There has been no alteration, manipulation, or unauthorized tempering of the contents, and the systems have remained secure.

5. I certify that the contents of the printout/electronic copy are an authentic and true copy of the electronic record stored in the parent device, which I verify to be correct.

Declared on: {{declaredDate}}
At: {{declaredCity}}

Declarant Signature:

{{declarantName}}`
  },
  {
    templateId: 'general-nda',
    title: 'Non-Disclosure Agreement (NDA)',
    actRef: 'Indian Contract Act Sec 27',
    category: 'commercial',
    description: 'Sleek legal contract protecting proprietary details, commercial ideas, and startup secrets between two parties.',
    sortOrder: 7,
    fields: [
      { key: 'disclosingParty', label: 'Disclosing Party (Owner)', placeholder: 'e.g. TechLabs Solutions Private Limited', type: 'text', defaultValue: '', helpTip: 'Company/person sharing the secrets.' },
      { key: 'receivingParty', label: 'Receiving Party (Receiver)', placeholder: 'e.g. Advait Consultancy Services', type: 'text', defaultValue: '', helpTip: 'Company/person receiving the secrets.' },
      { key: 'effectiveDate', label: 'Effective Agreement Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'Date the NDA rules start applying.' },
      { key: 'governingLaw', label: 'Jurisdiction Governing Law', placeholder: 'e.g. Delhi, India', type: 'text', defaultValue: '', helpTip: 'Which state\'s courts handle conflicts.' }
    ],
    body: `MUTUAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on {{effectiveDate}} ("Effective Date") by and between:
{{disclosingParty}} (hereinafter referred to as the "Disclosing Party")
AND
{{receivingParty}} (hereinafter referred to as the "Receiving Party").

1. PURPOSE: The parties wish to enter into discussions regarding a potential business relationship, during which the Disclosing Party may share confidential commercial, technical, and proprietary secrets.

2. CONFIDENTIAL INFORMATION: Confidential Information includes all information marked confidential or which by its nature should be understood as secret, including source codes, lists, diagrams, and financial formulas.

3. OBLIGATIONS: The Receiving Party agrees:
a) To hold the Confidential Information in strict confidence and take reasonable precautions to protect it.
b) Not to disclose the information to third parties without prior written consent.
c) To use the information solely for the evaluation of the business relationship.

4. EXCLUSIONS: This agreement does not cover information which becomes public through no fault of the Receiving Party, or was already in the receiver's possession prior to disclosure.

5. REMEDIES: The receiving party agrees that breaches of this contract cause irreparable harm, and the disclosing party shall be entitled to seek injunctive relief in addition to damages.

6. GOVERNING LAW: This Agreement shall be governed by and construed in accordance with the laws of {{governingLaw}}.

IN WITNESS WHEREOF the parties have executed this Agreement.


_____________________                _____________________
Disclosing Party                     Receiving Party`
  },
  {
    templateId: 'will-testament',
    title: 'Last Will and Testament',
    actRef: 'Indian Succession Act Sec 63',
    category: 'family',
    description: 'Official declaration for distribution of self-acquired property and asset inheritance.',
    sortOrder: 8,
    fields: [
      { key: 'testatorName', label: 'Testator Name (Your Name)', placeholder: 'e.g. Harish Chandra Sen', type: 'text', defaultValue: '', helpTip: 'Your full name.' },
      { key: 'testatorFatherName', label: 'Testator\'s Father Name', placeholder: 'e.g. Ramesh Chandra Sen', type: 'text', defaultValue: '', helpTip: 'Enter your father\'s full name.' },
      { key: 'testatorAge', label: 'Testator Age (Years)', placeholder: 'e.g. 68', type: 'text', defaultValue: '', helpTip: 'Enter your age in years.' },
      { key: 'testatorAddress', label: 'Testator Residence Address', placeholder: 'e.g. Flat 3A, Block K, Alipore, Kolkata', type: 'text', defaultValue: '', helpTip: 'Your current residential address.' },
      { key: 'spouseName', label: 'Spouse/Nearest Heir Name', placeholder: 'e.g. Meenakshi Sen', type: 'text', defaultValue: '', helpTip: 'Name of husband, wife, or primary beneficiary.' },
      { key: 'childrenNames', label: 'Children / Legal Heirs', placeholder: 'e.g. daughter Debasree Sen and son Amit Sen', type: 'text', defaultValue: '', helpTip: 'List names of children or other secondary heirs.' },
      { key: 'executorName', label: 'Will Executor Name', placeholder: 'e.g. Adv. Sourav Ganguly', type: 'text', defaultValue: '', helpTip: 'A trusted person who will carry out the Will\'s instructions.' },
      { key: 'assetDistribution', label: 'Asset Distribution Details', placeholder: 'e.g. My residential flat in Alipore to my wife Meenakshi...', type: 'textarea', defaultValue: '', helpTip: 'Write clearly who gets what. List bank numbers if possible.' }
    ],
    body: `LAST WILL AND TESTAMENT

I, {{testatorName}}, son/daughter of {{testatorFatherName}}, age {{testatorAge}} years, resident of {{testatorAddress}}, being of sound mind and disposing memory, do hereby make this my Last Will and Testament, revoking all prior Wills.

1. EXECUTOR: I appoint Sh./Smt. {{executorName}} as the sole Executor of this my Will, who shall distribute my assets in accordance with this document.

2. FAMILY DETAILS: My family consists of my spouse {{spouseName}} and {{childrenNames}}.

3. BEQUEST OF PROPERTY: I hereby distribute my self-acquired properties and assets as follows:
{{assetDistribution}}

4. RESIDUARY BEQUEST: Any other assets, savings, or shares owned by me at the time of my death not specifically mentioned above shall go to my spouse {{spouseName}}.

5. ATTESTATION: I declare this to be my true Will, signed in full health and without any force or coercion.

Testator Signature:

{{testatorName}}

Signed by the testator in the presence of us, who in his presence and in the presence of each other have subscribed our names as witnesses:

Witness 1:                           Witness 2:
Signature:                           Signature:
Name:                                Name:
Address:                             Address:`
  },
  {
    templateId: 'tenant-utility-cut-contest',
    title: 'Landlord Utility Cut-Off Cease & Desist Notice',
    actRef: 'Tenancy Act Sec 20 / TPA Sec 108',
    category: 'rights',
    description: 'Urgent statutory cease-and-desist demand served on a landlord who has illegally severed water, electricity, or essential municipal amenities.',
    sortOrder: 9,
    fields: [
      { key: 'tenantName', label: 'Tenant Full Name', placeholder: 'e.g. Ananya Sen', type: 'text', defaultValue: '', helpTip: 'Bona fide tenant residing at the premises.' },
      { key: 'tenantAddress', label: 'Rented Premises Address', placeholder: 'e.g. Flat 4B, Sunrise Enclave, Indiranagar, Bengaluru - 560038', type: 'text', defaultValue: '', helpTip: 'Full address of the tenanted property.' },
      { key: 'landlordName', label: 'Landlord Full Name', placeholder: 'e.g. K. V. Raghavan', type: 'text', defaultValue: '', helpTip: 'Property owner or authorized representative.' },
      { key: 'landlordAddress', label: 'Landlord Postal Address', placeholder: 'e.g. 12, 1st Cross, HAL 2nd Stage, Bengaluru - 560008', type: 'text', defaultValue: '', helpTip: 'Mailing address of the landlord.' },
      { key: 'disconnectionDate', label: 'Date of Disconnection', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'Date essential services were cut.' },
      { key: 'severedUtility', label: 'Severed Utility / Services', placeholder: 'e.g. Electricity Phase & Municipal Drinking Water', type: 'text', defaultValue: 'Electricity and Drinking Water Supply', helpTip: 'Specific utilities disconnected.' },
      { key: 'currentDate', label: 'Notice Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'Date notice is being dispatched.' }
    ],
    body: `URGENT LEGAL CEASE-AND-DESIST NOTICE
UNDER SECTION 20 OF THE TENANCY ACT & SECTION 108 OF THE TRANSFER OF PROPERTY ACT, 1882

Date: {{currentDate}}
Sent via WhatsApp, Registered Speed Post & Electronic Mail

To,
{{landlordName}}
{{landlordAddress}}

FROM:
{{tenantName}}
{{tenantAddress}}

SUBJECT: URGENT OBJECTION AND CEASE-AND-DESIST DEMAND AGAINST ILLEGAL SEVERANCE OF ESSENTIAL MUNICIPAL SERVICES ({{severedUtility}}) AT {{tenantAddress}}

Sir / Madam,

I, {{tenantName}}, bona fide tenant in lawful occupation of the aforementioned tenanted premises, address you as follows:

1. That I am in lawful possession of the premises located at {{tenantAddress}} pursuant to the tenancy relationship between us.

2. That on {{disconnectionDate}}, without any lawful court decree or authority, you have deliberately and maliciously disconnected / caused to be disconnected the {{severedUtility}} to the said tenanted premises in a direct bid to force eviction by coercion.

3. That under Section 20 of the Tenancy Act and established Supreme Court jurisprudence, a landlord is categorically PROHIBITED from cutting off or withholding any essential supplies or municipal amenities enjoyed by the tenant, regardless of any ongoing rental disputes.

4. YOU ARE HEREBY FORMALLY CALLED UPON to restore the {{severedUtility}} to the tenanted premises IMMEDIATELY and no later than TWENTY-FOUR (24) HOURS from the delivery of this notice.

5. Take strict notice that upon failure to restore within 24 hours, I shall immediately file an urgent application before the Rent Authority / Civil Court under Section 20(2) seeking:
   a. Immediate mandatory restoration order;
   b. Imposition of statutory fine and compensation up to Rs. 50,000/- on you;
   c. Police assistance for restoration of electricity/water meters;
   d. Criminal FIR for wrongful restraint under Bharatiya Nyaya Sanhita, 2023.

Govern yourself accordingly.

{{tenantName}}
Lawful Tenant
Contact: ___________________`
  },
  {
    templateId: 'consumer-deficiency-refund',
    title: 'Consumer Refund & Service Deficiency Legal Notice',
    actRef: 'CPA 2019 Sec 2(11) & 38',
    category: 'rights',
    description: 'Formal pre-litigation legal notice demanding 100% refund or replacement for defective goods or deficient services before approaching the Consumer Commission.',
    sortOrder: 10,
    fields: [
      { key: 'consumerName', label: 'Consumer Full Name', placeholder: 'e.g. Vikramaditya Rathore', type: 'text', defaultValue: '', helpTip: 'Your legal name as the purchaser.' },
      { key: 'consumerAddress', label: 'Your Postal Address', placeholder: 'e.g. B-304, Palm Springs, Andheri West, Mumbai - 400053', type: 'text', defaultValue: '', helpTip: 'Mailing address for response.' },
      { key: 'companyName', label: 'Company / Seller Name', placeholder: 'e.g. NexaTech Electronics Pvt Ltd', type: 'text', defaultValue: '', helpTip: 'Merchant or service company name.' },
      { key: 'companyAddress', label: 'Company Office Address', placeholder: 'e.g. Tech Park, Outer Ring Road, Bengaluru', type: 'text', defaultValue: '', helpTip: 'Registered office address.' },
      { key: 'orderNumber', label: 'Order / Invoice Number', placeholder: 'e.g. INV-2026-89104', type: 'text', defaultValue: '', helpTip: 'Bill or order identifier.' },
      { key: 'purchaseDate', label: 'Purchase Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'Date transaction was completed.' },
      { key: 'productName', label: 'Product / Service Purchased', placeholder: 'e.g. 55-inch OLED Smart Television', type: 'text', defaultValue: '', helpTip: 'Exact item description.' },
      { key: 'amountPaid', label: 'Amount Paid (in INR)', placeholder: 'e.g. 74,999', type: 'text', defaultValue: '', helpTip: 'Full amount debited.' },
      { key: 'defectDescription', label: 'Defect / Deficiency Summary', placeholder: 'e.g. Motherboard failed within 48 hours; service technician acknowledged fault but refund refused.', type: 'textarea', defaultValue: '', helpTip: 'Specific issues encountered.' },
      { key: 'currentDate', label: 'Notice Issuing Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'Current date.' }
    ],
    body: `FORMAL PRE-LITIGATION LEGAL NOTICE
UNDER SECTION 2(11) AND SECTION 38 OF THE CONSUMER PROTECTION ACT, 2019

Date: {{currentDate}}
Sent via Registered Email & Speed Post

To,
The Grievance Officer / Managing Director
{{companyName}}
{{companyAddress}}

FROM:
{{consumerName}}
{{consumerAddress}}

SUBJECT: PRE-LITIGATION NOTICE DEMANDING 100% REFUND OF RS. {{amountPaid}}/- FOR DEFICIENT SERVICE AND DEFECTIVE PRODUCT (ORDER/INVOICE NO: {{orderNumber}}) DATED {{purchaseDate}}

Sir / Madam,

Under instructions and on my own behalf as an aggrieved consumer under Section 2(7) of the Consumer Protection Act, 2019, I state as follows:

1. That on {{purchaseDate}}, I purchased {{productName}} against Invoice / Order No. {{orderNumber}} upon paying a sum of Rs. {{amountPaid}}/- to your establishment.

2. That the said product has suffered severe intrinsic defects and deficiency in service:
   {{defectDescription}}

3. That despite multiple written grievances, your support team has neglected and refused to provide an acceptable resolution, which squarely falls within the definition of "Defect" under Section 2(10), "Deficiency in Service" under Section 2(11), and "Unfair Trade Practice" under Section 2(47) of the Consumer Protection Act, 2019.

4. YOU ARE HEREBY CALLED UPON to:
   a. Issue a full refund of Rs. {{amountPaid}}/- to my original payment source; OR
   b. Replace the defective unit with a brand new, sealed certified unit;
   c. Alongside Rs. 15,000/- towards mental harassment and legal expenses;
   WITHIN SEVEN (7) DAYS of the receipt of this notice.

5. TAKE NOTICE that upon your failure to comply within 7 days, a formal consumer complaint will be instituted on the National E-Daakhil Portal before the District Consumer Disputes Redressal Commission under Section 35 of the Act, claiming statutory damages, interest at 18% p.a., and litigation costs.

Yours sincerely,

{{consumerName}}
Aggrieved Consumer`
  },
  {
    templateId: 'police-misconduct-representation',
    title: 'Representation on Police Custody Procedural Violations',
    actRef: 'BNSS Sec 35, 37 & D.K. Basu Directives',
    category: 'rights',
    description: 'Statutory representation addressed to the SP or Judicial Magistrate regarding violation of arrest memo, medical examination, and Section 35(3) notice of appearance rules.',
    sortOrder: 11,
    fields: [
      { key: 'complainantName', label: 'Complainant / Relative Full Name', placeholder: 'e.g. Smt. Sunita Devi (Mother of Detainee)', type: 'text', defaultValue: '', helpTip: 'Your name as the applicant.' },
      { key: 'complainantAddress', label: 'Complainant Postal Address', placeholder: 'e.g. H.No 412, Civil Lines, Kanpur, UP', type: 'text', defaultValue: '', helpTip: 'Your address for official notices.' },
      { key: 'detaineeName', label: 'Detained Person Full Name', placeholder: 'e.g. Rahul Verma', type: 'text', defaultValue: '', helpTip: 'Name of the citizen detained.' },
      { key: 'policeStation', label: 'Police Station & Officer Involved', placeholder: 'e.g. Sub-Inspector Sharma, Kotwali Police Station', type: 'text', defaultValue: '', helpTip: 'Name of the police station.' },
      { key: 'detentionDateTime', label: 'Date & Time of Detention', placeholder: 'e.g. 15th October 2026 at approximately 8:30 PM', type: 'text', defaultValue: '', helpTip: 'Exact time citizen was taken into custody.' },
      { key: 'violationDetails', label: 'Specific Procedural Violations', placeholder: 'e.g. No arrest memo prepared; family not informed; no medical examination conducted within 48 hours.', type: 'textarea', defaultValue: '', helpTip: 'List each protocol violated.' },
      { key: 'currentDate', label: 'Representation Date', placeholder: 'Select Date', type: 'date', defaultValue: '', helpTip: 'Current date.' }
    ],
    body: `FORMAL STATUTORY REPRESENTATION REGARDING PROCEDURAL VIOLATIONS DURING POLICE DETENTION
UNDER SECTION 35, 37, 53 OF BNSS 2023 & D.K. BASU DIRECTIVES (AIR 1997 SC 610)

Date: {{currentDate}}
Sent via Registered Speed Post, Urgent Hand Delivery & Electronic Mail

To,
The Superintendent of Police (SP) / Police Complaints Authority / Judicial Magistrate
District: ___________________
State: ___________________

FROM:
{{complainantName}}
{{complainantAddress}}

SUBJECT: URGENT COMPLAINT AND REPRESENTATION REGARDING UNLAWFUL DETENTION AND ARREST PROCEDURE VIOLATIONS OF {{detaineeName}} BY {{policeStation}}

Respected Authority,

I, {{complainantName}}, address this statutory representation regarding the high-handed, unconstitutional detention of {{detaineeName}}:

1. That on {{detentionDateTime}}, personnel attached to {{policeStation}} intercepted and detained {{detaineeName}}.

2. That the following mandatory statutory guidelines established under Bharatiya Nagarik Suraksha Sanhita, 2023 and the landmark Supreme Court directives in D.K. Basu vs. State of West Bengal have been flagrantly violated:
   {{violationDetails}}

3. Specifically:
   a. Violation of BNSS Section 35(3): Offence punishable under 3 years, yet detention affected without mandatory written Notice of Appearance;
   b. Violation of BNSS Section 37: Failure to prepare a contemporaneous Arrest Memo attested by an independent witness and family member;
   c. Violation of BNSS Section 53: Failure to conduct mandatory medical examination by a registered medical officer;
   d. Right to Legal Representation under BNSS Section 38 violated.

4. PRAYER:
   It is most respectfully prayed that your good office may:
   a. Call for an immediate status report and CCTV footage of {{policeStation}};
   b. Ensure immediate production before the nearest Judicial Magistrate with independent medical examination;
   c. Permit immediate confidential consultation with defense counsel;
   d. Initiate disciplinary inquiry under Section 199 BNS against the delinquent police personnel for intentional non-compliance with the law.

Respectfully submitted,

{{complainantName}}
Enclosed: Copy of Identity Proof, Timestamped Call Records`
  }
];