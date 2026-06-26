import { Component, OnInit, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { DocumentTemplateService, Template, Draft, TemplateField } from '../../services/document-template.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-document-templates',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, DatePipe, FormsModule, RouterLink, TooltipDirective, ConfirmDialogComponent],
  templateUrl: './document-templates.component.html',
  styleUrls: ['./document-templates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentTemplatesComponent implements OnInit {
  searchQuery = '';
  selectedCategory = 'all';
  activeTemplateId = 'cheque-bounce-notice';

  // Tab control on mobile: 'select', 'form' or 'preview'
  activeMobileTab: 'select' | 'form' | 'preview' = 'select';

  // Layout mode on mobile: 'wizard' (tab-based) or 'stacked' (full scroll)
  mobileLayoutMode: 'wizard' | 'stacked' = 'wizard';
  showLayoutMenu = false;

  // Drafts Vault States
  MAX_DRAFTS = 50;
  draftSearchQuery = '';
  draftPage = 1;
  draftPageSize = 5;
  activeDraftId: string | null = null;
  draftsList: Draft[] = [];
  activeSidebarTab: 'templates' | 'drafts' = 'templates';
  showSidebar = true;

  // Cached states for performance / change detection optimization
  compiledTemplateHtml: SafeHtml = '';
  compiledTemplatePlain = '';
  filteredTemplatesList: Template[] = [];
  filteredDraftsList: Draft[] = [];
  paginatedDraftsList: Draft[] = [];

  // Clipboard / Download states
  copySuccess = false;
  downloadSuccess = false;

  // Focus highlighting
  activeFieldKey: string | null = null;

  private compilationSubject = new Subject<void>();

  // Manual Document Text Editing
  isManualEditMode = false;
  customBodyText = '';

  // Custom Template Creator States
  private _showCreateTemplateModal = false;
  get showCreateTemplateModal(): boolean {
    return this._showCreateTemplateModal;
  }
  set showCreateTemplateModal(val: boolean) {
    this._showCreateTemplateModal = val;
    if (val) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    this.cdr.markForCheck();
  }
  activeModalMobileTab: 'editor' | 'variables' = 'editor';
  newTemplateTitle = '';
  newTemplateAct = '';
  newTemplateDesc = '';
  newTemplateCategory = 'commercial';
  newTemplateBody = '';
  parsedPlaceholders: string[] = [];
  customFieldsConfig: { [key: string]: { label: string, type: string, helpTip: string } } = {};

  // Confirmation Dialog States
  showConfirm = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' | 'info' = 'warning';
  confirmAction: (() => void) | null = null;

  // Custom Dropdown Configurations & States
  showCategoryDropdown = false;
  openFieldTypeDropdownKey: string | null = null;
  categories = [
    { value: 'commercial', label: 'Commercial Law' },
    { value: 'family', label: 'Family Law' },
    { value: 'civil', label: 'Civil Law' },
    { value: 'transport', label: 'Transport/MACT' }
  ];
  fieldTypes = [
    { value: 'text', label: 'Short Text' },
    { value: 'textarea', label: 'Paragraph' },
    { value: 'date', label: 'Date Picker' }
  ];

  // Simulated premium loader state
  templateLoading = false;

  // Empty Field Compilation Modes
  emptyFieldsMode: 'placeholder' | 'underline' | 'blank' = 'placeholder';
  highlightEmptyFields = true;

  // Real-time fields binding values
  // Format: { [templateId]: { [fieldKey]: value } }
  formValues: { [templateId: string]: { [fieldKey: string]: string } } = {};

  templates: Template[] = [];
  defaultTemplates: Template[] = [
    {
      id: 'cheque-bounce-notice',
      title: 'Cheque Bounce Demand Notice',
      actRef: 'NIA Section 138',
      category: 'commercial',
      description: 'Mandatory notice demanding payment within 15 days of bouncing a cheque, required before initiating criminal court action.',
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
      id: 'mutual-divorce-deed',
      title: 'Mutual Consent Divorce Deed Template',
      actRef: 'HMA Section 13B',
      category: 'family',
      description: 'Draft agreement outlining settlement terms, alimony, and custody arrangements for joint divorce petitions.',
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
      id: 'mact-claim-petition',
      title: 'MACT Claim Petition Draft Fields',
      actRef: 'MVA Section 166',
      category: 'transport',
      description: 'Formal statement structure to claim compensation in the Motor Accident Claims Tribunal.',
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
      id: 'rti-application',
      title: 'RTI Information Request Application',
      actRef: 'RTI Act Section 6(1)',
      category: 'civil',
      description: 'Standard format to request public documents or records from any government department/public authority.',
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
      id: 'maintenance-petition',
      title: 'Wife/Child Maintenance Petition',
      actRef: 'CrPC Section 125 / BNSS Section 144',
      category: 'family',
      description: 'Petition to seek monthly maintenance allowance from a spouse who neglects or deserts the family.',
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
      id: 'section-63-bsa-certificate',
      title: 'Electronic Evidence Declaration (Section 63 BSA)',
      actRef: 'BSA Section 63 (formerly IEA Sec 65B)',
      category: 'civil',
      description: 'Mandatory declaration certificate required to make digital evidence (WhatsApp, emails, photos) admissible in court.',
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
      id: 'general-nda',
      title: 'Non-Disclosure Agreement (NDA)',
      actRef: 'Indian Contract Act Sec 27',
      category: 'commercial',
      description: 'Sleek legal contract protecting proprietary details, commercial ideas, and startup secrets between two parties.',
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
      id: 'will-testament',
      title: 'Last Will and Testament',
      actRef: 'Indian Succession Act Sec 63',
      category: 'family',
      description: 'Official declaration for distribution of self-acquired property and asset inheritance.',
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
    }
  ];

  get activeTemplate(): Template {
    return this.templates.find(t => t.id === this.activeTemplateId) || this.templates[0];
  }

  constructor(
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private templateService: DocumentTemplateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Setup debounced preview compilation (80ms)
    this.compilationSubject.pipe(
      debounceTime(80)
    ).subscribe(() => {
      this.updateCompiledTemplate();
    });

    // Load mobile layout preference from local storage
    const savedLayoutMode = localStorage.getItem('lc_mobile_layout_mode');
    if (savedLayoutMode === 'wizard' || savedLayoutMode === 'stacked') {
      this.mobileLayoutMode = savedLayoutMode;
    }

    // Initialize templates with static list
    this.templates = [...this.defaultTemplates];

    // Subscribe to custom templates from the service
    this.templateService.customTemplates$.subscribe(customList => {
      this.templates = [...this.defaultTemplates, ...customList];

      // Initialize form values for all templates
      this.templates.forEach(t => {
        if (!this.formValues[t.id]) {
          this.formValues[t.id] = {};
        }
        t.fields.forEach(f => {
          if (this.formValues[t.id][f.key] === undefined) {
            if (f.type === 'date' && !f.defaultValue) {
              if (f.key === 'noticeDate' || f.key === 'currentDate' || f.key === 'declaredDate') {
                this.formValues[t.id][f.key] = this.getTodayDateString();
              } else {
                this.formValues[t.id][f.key] = '';
              }
            } else {
              this.formValues[t.id][f.key] = f.defaultValue;
            }
          }
        });
      });

      this.updateFiltersAndPagination();
      this.cdr.markForCheck();
    });

    // Subscribe to drafts list from service
    this.templateService.drafts$.subscribe(drafts => {
      this.draftsList = drafts;
      this.updateFiltersAndPagination();
      this.cdr.markForCheck();
    });

    // Listen to route query parameters to check if we should auto-open a specific template
    this.route.queryParams.subscribe(params => {
      const openId = params['open'];
      if (openId && this.templates.some(t => t.id === openId)) {
        this.selectTemplate(openId, true);
        this.activeMobileTab = 'form';
        this.cdr.markForCheck();
      } else {
        this.templateLoading = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.templateLoading = false;
          this.updateCompiledTemplate();
          this.cdr.markForCheck();
        }, 400);
      }
    });
  }

  getTodayDateString(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  setMobileLayoutMode(mode: 'wizard' | 'stacked') {
    this.mobileLayoutMode = mode;
    localStorage.setItem('lc_mobile_layout_mode', mode);
  }

  scrollToMobileSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Caches/Updates search filters and pagination
  updateFiltersAndPagination() {
    // 1. Filter templates
    let tList = this.templates;
    if (this.selectedCategory !== 'all') {
      tList = tList.filter(t => t.category === this.selectedCategory);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      tList = tList.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.actRef.toLowerCase().includes(q)
      );
    }
    this.filteredTemplatesList = tList;

    // 2. Filter drafts
    let dList = this.draftsList;
    if (this.draftSearchQuery.trim()) {
      const q = this.draftSearchQuery.toLowerCase().trim();
      dList = dList.filter(d => d.title.toLowerCase().includes(q));
    }
    this.filteredDraftsList = dList;

    // 3. Paginate drafts
    const start = (this.draftPage - 1) * this.draftPageSize;
    this.paginatedDraftsList = this.filteredDraftsList.slice(start, start + this.draftPageSize);

    // 4. Update preview compilation
    this.updateCompiledTemplate();
  }

  // Pre-compiles and caches filled templates to avoid execution inside change detection cycles
  updateCompiledTemplate() {
    this.compiledTemplatePlain = this.getFilledTemplate(this.activeTemplateId, 'print');

    let htmlContent = '';
    if (this.isManualEditMode && this.customBodyText) {
      htmlContent = this.customBodyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    } else {
      htmlContent = this.getFilledTemplate(this.activeTemplateId, 'preview');
    }
    this.compiledTemplateHtml = this.sanitizer.bypassSecurityTrustHtml(htmlContent);
    this.cdr.markForCheck();
  }

  setEmptyFieldsMode(mode: 'placeholder' | 'underline' | 'blank') {
    this.emptyFieldsMode = mode;
    this.updateCompiledTemplate();
  }

  onHighlightEmptyToggle() {
    this.updateCompiledTemplate();
  }

  toggleSidebar() {
    this.showSidebar = !this.showSidebar;
    this.cdr.markForCheck();
  }

  private findNameValueInValues(templateId: string, values: { [key: string]: string }): string {
    const keysToCheck = [
      'clientName', 'victimName', 'applicantName', 'husbandName', 'testatorName', 'declarantName', 'disclosingParty'
    ];
    for (const key of keysToCheck) {
      if (values[key] && values[key].trim()) {
        return values[key].trim();
      }
    }
    return '';
  }

  saveDraft(customTitle?: string) {
    const templateId = this.activeTemplateId;
    const values = this.formValues[templateId] || {};
    const customBody = this.isManualEditMode ? this.customBodyText : undefined;

    if (this.activeDraftId) {
      const draft = this.draftsList.find(d => d.id === this.activeDraftId);
      if (draft) {
        draft.values = { ...values };
        draft.customBody = customBody;
        if (customTitle && customTitle.trim()) {
          draft.title = customTitle.trim();
        } else {
          const nameVal = this.findNameValueInValues(templateId, values);
          if (nameVal && (draft.title.startsWith('Draft:') || draft.title.includes('Autosaved') || draft.title.includes('Draft #'))) {
            const template = this.templates.find(t => t.id === templateId);
            draft.title = `${template?.title || templateId} - ${nameVal}`;
          }
        }
        this.templateService.saveDraft(draft);
        return;
      }
    }

    if (this.draftsList.length >= this.MAX_DRAFTS) {
      this.openConfirm(
        'Draft Limit Reached',
        `Draft limit reached (${this.MAX_DRAFTS}/${this.MAX_DRAFTS}). Please delete some old drafts to save new ones.`,
        'warning',
        () => { }
      );
      return;
    }

    const template = this.templates.find(t => t.id === templateId);
    const nameVal = this.findNameValueInValues(templateId, values);
    let title = customTitle || '';
    if (!title.trim()) {
      title = nameVal ? `${template?.title || templateId} - ${nameVal}` : `Draft: ${template?.title || templateId} #${this.draftsList.length + 1}`;
    }

    const newDraft: Draft = {
      id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      templateId: templateId,
      title: title.trim(),
      updatedAt: new Date().toISOString(),
      values: { ...values },
      customBody: customBody
    };

    this.activeDraftId = newDraft.id;
    this.activeSidebarTab = 'drafts';
    this.templateService.saveDraft(newDraft);
  }

  onFieldChange() {
    const templateId = this.activeTemplateId;
    const values = this.formValues[templateId] || {};

    if (!this.activeDraftId) {
      if (this.draftsList.length < this.MAX_DRAFTS) {
        const template = this.templates.find(t => t.id === templateId);
        const nameVal = this.findNameValueInValues(templateId, values);
        const title = nameVal ? `${template?.title || templateId} - ${nameVal}` : `Draft: ${template?.title || templateId} (Autosaved)`;

        const newDraft: Draft = {
          id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          templateId: templateId,
          title: title,
          updatedAt: new Date().toISOString(),
          values: { ...values },
          customBody: this.isManualEditMode ? this.customBodyText : undefined
        };
        this.activeDraftId = newDraft.id;
        this.templateService.saveDraft(newDraft);
      }
    } else {
      this.saveDraft();
    }
    this.compilationSubject.next();
  }

  onCustomBodyChange() {
    if (this.isManualEditMode) {
      this.saveDraft();
      this.compilationSubject.next();
    }
  }

  toggleManualEditMode(enable: boolean) {
    if (enable) {
      this.customBodyText = this.getFilledTemplate(this.activeTemplateId, 'plain');
      this.isManualEditMode = true;
      this.saveDraft();
      this.updateCompiledTemplate();
      this.cdr.markForCheck();
    } else {
      this.openConfirm(
        'Switch to Sync Mode',
        'Are you sure you want to switch back to Form Sync Mode? Any manual modifications you made directly to the document text will be lost.',
        'warning',
        () => {
          this.isManualEditMode = false;
          this.customBodyText = '';
          this.saveDraft();
          this.updateCompiledTemplate();
          this.cdr.markForCheck();
        }
      );
    }
  }

  loadDraft(draftId: string) {
    const draft = this.draftsList.find(d => d.id === draftId);
    if (draft) {
      this.activeDraftId = draft.id;
      this.activeTemplateId = draft.templateId;

      if (!this.formValues[draft.templateId]) {
        this.formValues[draft.templateId] = {};
      }

      const template = this.templates.find(t => t.id === draft.templateId);
      if (template) {
        template.fields.forEach(f => {
          this.formValues[draft.templateId][f.key] = draft.values[f.key] !== undefined ? draft.values[f.key] : f.defaultValue;
        });
      }

      this.selectTemplate(draft.templateId, false);

      if (draft.customBody) {
        this.isManualEditMode = true;
        this.customBodyText = draft.customBody;
      } else {
        this.isManualEditMode = false;
        this.customBodyText = '';
      }

      this.activeMobileTab = 'form';
      this.updateCompiledTemplate();
    }
  }

  selectTemplate(id: string, resetValues = true) {
    this.templateLoading = true;
    this.activeTemplateId = id;
    this.copySuccess = false;
    this.downloadSuccess = false;
    this.activeMobileTab = 'form';

    if (!this.formValues[id]) {
      this.formValues[id] = {};
    }

    if (resetValues) {
      this.activeDraftId = null;
      this.isManualEditMode = false;
      this.customBodyText = '';
      const temp = this.templates.find(t => t.id === id);
      if (temp) {
        temp.fields.forEach(f => {
          if (this.formValues[id]) {
            if (f.type === 'date' && !f.defaultValue) {
              if (f.key === 'noticeDate' || f.key === 'currentDate' || f.key === 'declaredDate') {
                this.formValues[id][f.key] = this.getTodayDateString();
              } else {
                this.formValues[id][f.key] = '';
              }
            } else {
              this.formValues[id][f.key] = f.defaultValue;
            }
          }
        });
      }
    }

    setTimeout(() => {
      this.templateLoading = false;
      this.updateCompiledTemplate();
      this.cdr.markForCheck();
    }, 400);
  }

  createNewDraft(templateId: string) {
    this.selectTemplate(templateId, true);
  }

  // --- Custom Templates Creator Helper Functions ---
  parsePlaceholders() {
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const found: string[] = [];
    let match;
    while ((match = regex.exec(this.newTemplateBody)) !== null) {
      const key = match[1];
      if (!found.includes(key)) {
        found.push(key);
      }
    }
    this.parsedPlaceholders = found;

    const newConfig: { [key: string]: { label: string, type: string, helpTip: string } } = {};
    found.forEach(key => {
      if (this.customFieldsConfig[key]) {
        newConfig[key] = this.customFieldsConfig[key];
      } else {
        const friendlyLabel = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
        newConfig[key] = {
          label: friendlyLabel,
          type: 'text',
          helpTip: ''
        };
      }
    });
    this.customFieldsConfig = newConfig;
  }

  saveCustomTemplate() {
    if (!this.newTemplateTitle.trim() || !this.newTemplateBody.trim()) {
      this.openConfirm(
        'Missing Information',
        'Please enter a title and template body.',
        'warning',
        () => { }
      );
      return;
    }

    const id = `custom-${this.newTemplateTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const fields: TemplateField[] = this.parsedPlaceholders.map(key => {
      const config = this.customFieldsConfig[key];
      return {
        key: key,
        label: config.label || key,
        placeholder: `Enter ${config.label || key}`,
        type: config.type || 'text',
        defaultValue: '',
        helpTip: config.helpTip || undefined
      };
    });

    const newTemplate: Template = {
      id: id,
      title: this.newTemplateTitle.trim(),
      actRef: this.newTemplateAct.trim() || 'Custom Template',
      category: this.newTemplateCategory,
      description: this.newTemplateDesc.trim() || 'User defined custom template.',
      fields: fields,
      body: this.newTemplateBody,
      isCustom: true
    };

    this.templateService.saveCustomTemplate(newTemplate);

    this.newTemplateTitle = '';
    this.newTemplateAct = '';
    this.newTemplateDesc = '';
    this.newTemplateCategory = 'commercial';
    this.newTemplateBody = '';
    this.parsedPlaceholders = [];
    this.customFieldsConfig = {};
    this.showCreateTemplateModal = false;

    this.selectTemplate(id, true);
  }

  deleteCustomTemplate(id: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.openConfirm(
      'Delete Custom Template',
      'Are you sure you want to delete this custom template? All saved drafts for this template will remain but the template structure will be removed.',
      'danger',
      () => {
        this.templateService.deleteCustomTemplate(id);
        if (this.activeTemplateId === id) {
          this.selectTemplate(this.templates[0].id, true);
        }
      }
    );
  }

  toggleCategoryDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.showCategoryDropdown = !this.showCategoryDropdown;
    this.openFieldTypeDropdownKey = null;
  }

  selectCategory(val: string) {
    this.newTemplateCategory = val;
    this.showCategoryDropdown = false;
  }

  getCategoryLabel(val: string) {
    return this.categories.find(c => c.value === val)?.label || val;
  }

  toggleFieldTypeDropdown(key: string, event: MouseEvent) {
    event.stopPropagation();
    this.openFieldTypeDropdownKey = this.openFieldTypeDropdownKey === key ? null : key;
    this.showCategoryDropdown = false;
  }

  selectFieldType(key: string, type: string) {
    if (this.customFieldsConfig[key]) {
      this.customFieldsConfig[key].type = type;
    }
    this.openFieldTypeDropdownKey = null;
  }

  getFieldTypeLabel(key: string) {
    const val = this.customFieldsConfig[key]?.type;
    return this.fieldTypes.find(t => t.value === val)?.label || 'Short Text';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    this.showCategoryDropdown = false;
    this.openFieldTypeDropdownKey = null;
    this.showLayoutMenu = false;
  }

  openConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.confirmAction = action;
    this.showConfirm = true;
    this.cdr.markForCheck();
  }

  handleConfirm() {
    if (this.confirmAction) {
      this.confirmAction();
    }
    this.showConfirm = false;
    this.confirmAction = null;
    this.cdr.markForCheck();
  }

  handleCancel() {
    this.showConfirm = false;
    this.confirmAction = null;
    this.cdr.markForCheck();
  }

  deleteDraft(draftId: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    this.openConfirm(
      'Delete Draft',
      'Are you sure you want to delete this draft?',
      'danger',
      () => {
        this.templateService.deleteDraft(draftId);
        if (this.activeDraftId === draftId) {
          this.activeDraftId = null;
        }
      }
    );
  }

  clearAllDrafts() {
    this.openConfirm(
      'Wipe All Drafts',
      'Are you sure you want to delete ALL saved drafts? This action cannot be undone.',
      'danger',
      () => {
        this.templateService.clearAllDrafts();
        this.activeDraftId = null;
      }
    );
  }

  get totalDraftPages(): number {
    return Math.ceil(this.filteredDraftsList.length / this.draftPageSize) || 1;
  }

  nextDraftPage() {
    if (this.draftPage < this.totalDraftPages) {
      this.draftPage++;
      this.updateFiltersAndPagination();
    }
  }

  prevDraftPage() {
    if (this.draftPage > 1) {
      this.draftPage--;
      this.updateFiltersAndPagination();
    }
  }

  escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Compiler & Preview Formatting ---
  getFilledTemplate(templateId: string, mode: 'preview' | 'print' | 'plain'): string {
    if (this.isManualEditMode && this.customBodyText) {
      return this.customBodyText;
    }

    const template = this.templates.find(t => t.id === templateId);
    if (!template) return '';

    let text = template.body;
    const values = this.formValues[templateId] || {};

    template.fields.forEach(f => {
      const val = values[f.key];
      const regex = new RegExp(`{{\\s*${f.key}\\s*}}`, 'g');

      let replacement = '';
      if (val && val.trim()) {
        let finalVal = val;
        if (f.type === 'date') {
          try {
            const dateObj = new Date(val);
            if (!isNaN(dateObj.getTime())) {
              finalVal = dateObj.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              });
            }
          } catch (e) {
            // Keep raw val
          }
        }

        // Escape HTML for preview and print views to prevent XSS script injection
        if (mode === 'preview' || mode === 'print') {
          finalVal = this.escapeHtml(finalVal);
        }

        replacement = finalVal;

        if (mode === 'preview') {
          const isFocused = this.activeFieldKey === f.key;
          const focusClass = isFocused ? 'field-highlight-active ring-2 ring-indigo-500 bg-indigo-500/10' : '';
          replacement = `<span class="filled-field-span px-1 rounded cursor-pointer border border-transparent hover:border-indigo-500/30 transition-all ${focusClass}" data-field-key="${f.key}" title="Double-click to edit field">${replacement}</span>`;
        }
      } else {
        if (mode === 'preview' && this.highlightEmptyFields) {
          const isFocused = this.activeFieldKey === f.key;
          const focusClass = isFocused ? 'field-highlight-active-empty ring-4 ring-indigo-500/30 border-indigo-500 bg-indigo-500/20 text-indigo-700 scale-105' : 'bg-amber-105 dark:bg-amber-900/40 text-amber-800 dark:text-amber-250 border-amber-300 dark:border-amber-800';
          replacement = `<span class="placeholder-badge border rounded px-1.5 py-0.5 font-sans font-bold cursor-pointer transition-all hover:bg-amber-200 dark:hover:bg-amber-900/60 inline-flex items-center gap-1 select-all ${focusClass}" data-field-key="${f.key}" title="Double-click to fill field">[${f.label}]</span>`;
        } else {
          if (this.emptyFieldsMode === 'placeholder') {
            replacement = `[${f.label}]`;
          } else if (this.emptyFieldsMode === 'underline') {
            replacement = '________________________';
          } else {
            replacement = '      ';
          }
        }
      }
      text = text.replace(regex, replacement);
    });

    return text;
  }

  // --- Clipboard, Download, Print Utilities ---
  copyToClipboard() {
    navigator.clipboard.writeText(this.compiledTemplatePlain).then(() => {
      this.copySuccess = true;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.copySuccess = false;
        this.cdr.markForCheck();
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  downloadTxtFile() {
    const blob = new Blob([this.compiledTemplatePlain], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.activeTemplateId}_draft.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.downloadSuccess = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.downloadSuccess = false;
      this.cdr.markForCheck();
    }, 2000);
  }

  triggerPrint() {
    window.print();
  }

  onPreviewClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const badge = target.closest('[data-field-key]');
    if (badge) {
      const fieldKey = badge.getAttribute('data-field-key');
      if (fieldKey) {
        const inputEl = document.getElementById(`input-${fieldKey}`);
        if (inputEl) {
          inputEl.focus();
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

          inputEl.classList.add('ring-4', 'ring-amber-500/30', 'border-amber-500');
          setTimeout(() => {
            inputEl.classList.remove('ring-4', 'ring-amber-500/30', 'border-amber-500');
          }, 1500);
        }
      }
    }
  }
}