import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgIf, NgFor, SlicePipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { LegalService } from '../../services/legal.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-civil-family-portal',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, SlicePipe, NgClass, FormsModule, TooltipDirective, ConfirmDialogComponent],
  templateUrl: './civil-family-portal.component.html',
  styleUrls: ['./civil-family-portal.component.scss']
})
export class CivilFamilyPortalComponent implements OnInit, OnDestroy {
  // Modal Dialog variables
  isConfirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' | 'info' = 'warning';
  onConfirmAction: (() => void) | null = null;

  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.onConfirmAction = action;
    this.isConfirmOpen = true;
  }

  onConfirmDialog() {
    this.isConfirmOpen = false;
    if (this.onConfirmAction) {
      this.onConfirmAction();
    }
  }

  onCancelDialog() {
    this.isConfirmOpen = false;
    this.onConfirmAction = null;
  }

  acts: any[] = [];
  loading = true;
  searchQuery = '';
  selectedSpecialization = 'all';
  expandedGuideIndex: number | null = null;

  // Optimized Precomputed properties
  visibleCategories: any[] = [];
  visibleGuides: any[] = [];
  filteredActsByCategory: { [categoryKey: string]: any[] } = {};

  // Precomputed tracking objects for Angular template bindings (Change Detection Optimization)
  currentActiveStep: { [guideIndex: number]: number } = {};
  guideProgressPercent: { [guideIndex: number]: number } = {};
  stepDocsStatus: { [guideIndex: number]: { [stepIndex: number]: string } | undefined } = {};
  activeMobileStep: { [guideIndex: number]: number } = {};
  expandedCategoryMobile: { [key: string]: boolean } = {};

  // Precomputed timelines and calculated dates
  chequeBounceTimelineData: any[] = [];
  divorceTimelineData: any[] = [];
  calculatedSendNoticeBeforeDate = '';
  calculatedWaitResponseDate = '';
  calculatedFileCourtCaseDate = '';
  calculatedEarliestFilingDate = '';
  calculatedCoolingPeriodEndsDate = '';
  calculatedSecondMotionExpiryDate = '';

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Track checked items
  checkedSteps: { [guideIndex: number]: { [stepIndex: number]: boolean } | undefined } = {};
  documentStatus: { [guideIndex: number]: { [docIndex: number]: boolean } | undefined } = {};
  copySuccess: { [guideIndex: number]: boolean } = {};

  // Calculator inputs
  chequeBounceDate = '';
  noticeDeliveryDate = '';
  separationDate = '';
  divorceFilingDate = '';
  chequeAmountInput: number | null = null;
  estimatedCourtFee = '';
  chequePresentationType: 'account' | 'counter' = 'account';
  payeeBranchCity = '';
  drawerBranchCity = '';
  geographicalJurisdictionText = '';
  showPresentationModeDropdown = false;

  // Local lawyer helper inputs
  userLocation = '';
  helpLoading = false;
  localHelpData: any = null;

  // Guide AI Q&A inputs
  guideAiQuery = '';
  guideAiAnswer = '';
  guideAiLoading = false;

  // Voice recognition helper
  isListening = false;

  // Plain-Language definitions for Jargon Buster tooltips
  jargonDefinitions: { [word: string]: string } = {
    'Cheque Return Memo': 'A formal document issued by a bank proving a cheque bounced, stating the reason (e.g., Insufficient Funds).',
    'Demand Notice': 'A mandatory formal warning sent to the cheque drawer demanding the amount within 15 days of notice receipt.',
    'Magistrate Court': 'The local court responsible for filing and trial of cheque bounce crimes under NIA Section 138.',
    'Separately': 'Living separately means not living as husband and wife (can be under the same roof if there is no marital cohabitation).',
    'Settlement': 'A mutually agreed agreement outlining alimony, child custody, and asset distribution prior to filing the divorce.',
    'Cooling Period': 'The statutory 6-month wait time required after filing a mutual divorce petition, intended for potential reconciliation.',
    'Decree': 'The official final court order that officially dissolves the marriage or decides the lawsuit.',
    'FIR': 'First Information Report – the primary document registered by the police cell detailing a road accident.',
    'DAR': 'Detailed Accident Report – a comprehensive investigation report compiled by police and sent to the tribunal.',
    'MACT': 'Motor Accident Claims Tribunal – the specialized district civil court handling road accident compensation cases.',
    'PIO': 'Public Information Officer – the official designated in government departments to receive and reply to RTI applications.',
    'First Appeal': 'A formal appeal submitted to a senior officer if the PIO rejects or fails to reply to an RTI within 30 days.',
    'Interim Maintenance': 'Temporary financial support granted by the court during the trial of the case to meet immediate expenses.',
    'Execution Petition': 'A petition filed in court to enforce a court order (like making the husband pay the ordered maintenance).',
    'Pecuniary Jurisdiction': 'The monetary value limit up to which a specific court has authority to hear and decide cases.',
    'BSA Section 63': 'Bharatiya Sakshya Adhiniyam Section 63 (formerly IEA Sec 65B) – the law requiring a signed certificate for digital records to be admissible.'
  };

  categories = [
    {
      title: 'Family & Matrimonial Law',
      description: 'Laws relating to marriage, divorce, alimony, maintenance, and child custody rights.',
      actShortNames: ['HMA', 'IDA', 'DVA', 'HSA'],
      key: 'family',
      colorClass: 'text-pink-500',
      bgClass: 'bg-pink-500/10 dark:bg-pink-500/5',
      borderClass: 'hover:border-pink-500/40 dark:hover:border-pink-500/30'
    },
    {
      title: 'Commercial & Financial Law',
      description: 'Commercial disputes, recovery of debts, banking contracts, and cheque bounce offenses.',
      actShortNames: ['NIA'],
      key: 'commercial',
      colorClass: 'text-amber-500',
      bgClass: 'bg-amber-500/10 dark:bg-amber-500/5',
      borderClass: 'hover:border-amber-500/40 dark:hover:border-amber-500/30'
    },
    {
      title: 'Civil Procedure & Disputes',
      description: 'Procedural laws governing civil litigation, property disputes, injunctions, and appeals.',
      actShortNames: ['CPC', 'RTI'],
      key: 'civil',
      colorClass: 'text-blue-500',
      bgClass: 'bg-blue-500/10 dark:bg-blue-500/5',
      borderClass: 'hover:border-blue-500/40 dark:hover:border-blue-500/30'
    },
    {
      title: 'Transport & Accident Claims',
      description: 'Road safety rules, motor licensing, and filing compensation claims for accidents.',
      actShortNames: ['MVA'],
      key: 'transport',
      colorClass: 'text-emerald-500',
      bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/5',
      borderClass: 'hover:border-emerald-500/40 dark:hover:border-emerald-500/30'
    }
  ];

  guides: any[] = [
    {
      title: 'Cheque Bounce Resolution (NIA Section 138)',
      category: 'Commercial & Finance',
      summary: 'Procedural steps to recover money and file a case when a cheque is dishonoured for insufficient funds.',
      steps: [
        'Obtain a Cheque Return Memo from the bank specifying the reason for dishonour.',
        'Issue a formal Demand Notice to the drawer within 30 days of receiving the return memo.',
        'Give the drawer 15 days from the receipt of notice to pay the cheque amount.',
        'If payment is not received, file a criminal complaint in the Magistrate Court within 30 days.'
      ],
      actRef: 'NIA',
      sectionRef: '138',
      documents: [
        'Original Bounced Cheque',
        'Original Cheque Return Memo (from bank)',
        'Copy of the Demand Notice served',
        'Speed post receipts & delivery confirmation reports',
        'Bank statements showing non-realization'
      ],
      templateId: 'cheque-bounce-notice',
      noticeTemplate: `FORMAL DEMAND NOTICE
(Under Section 138 of Negotiable Instruments Act, 1881)

Date: [Current Date]

To,
[Drawer Name]
[Drawer Address]

Subject: Notice for dishonour of Cheque No. ______ for Rs. ______

Dear Sir/Madam,

Under instructions from my client, I hereby give you notice that Cheque No. ________ dated ________ drawn on ________ Bank for Rs. ________ in favour of my client has been returned unpaid by your bank with the memo dated ________ stating "Funds Insufficient".

I hereby call upon you to make payment of the said amount of Rs. ________ within 15 days of receipt of this notice, failing which my client will be constrained to initiate criminal proceedings under Section 138 of the NIA.

Yours faithfully,
[Your Name / Advocate]`
    },
    {
      title: 'Applying for Mutual Divorce (HMA Section 13B)',
      category: 'Family & Matrimonial',
      summary: 'Friendly procedural steps for couples seeking mutual consent divorce under Hindu marriage laws.',
      steps: [
        'Ensure both parties have been living Separately for at least one year.',
        'Draft a joint petition outlining terms of Settlement (alimony, custody, assets).',
        'File the First Motion petition in the Family Court.',
        'Wait for the statutory 6-month Cooling Period (can be waived under special circumstances).',
        'Appear for the Second Motion within 18 months of filing to receive the final Decree.'
      ],
      actRef: 'HMA',
      sectionRef: '13B',
      documents: [
        'Marriage Certificate or wedding invitation card',
        'Recent passport size photographs of husband & wife',
        'Joint petition containing settlement deed terms',
        'Evidence proving separate living for at least 1 year',
        'Asset ownership cards and income tax returns (last 3 years)'
      ],
      templateId: 'mutual-divorce-deed',
      noticeTemplate: `MUTUAL CONSENT SETTLEMENT DEED
(Points to include in the Joint Agreement)

1. RECITALS: Marriage date, details of separation since [Date].
2. ALIMONY / MAINTENANCE: Fixed lump-sum settlement amount of Rs. [Amount] paid as full and final settlement.
3. CUSTODY: Mutual agreement on child custody (e.g. Sole custody to [Parent], visitation rights to [Parent]).
4. SHARED ASSETS: Division of family jewelry, motor vehicles, bank locks, and joint properties.
5. NO FUTURE CLAIMS: Agreement not to file any civil or criminal complaints against each other in the future.`
    },
    {
      title: 'Claiming Motor Accident Compensation (MVA Section 166)',
      category: 'Transport & Accidents',
      summary: 'How accident victims or family members can file compensation claims in tribunals.',
      steps: [
        'Ensure an FIR is registered by the police cell mentioning details of the accident.',
        'Obtain a copy of the Detailed Accident Report (DAR) filed by the police.',
        'File a compensation petition in the Motor Accident Claims Tribunal (MACT) in your district.',
        'Present medical records, vehicle insurance details, and income certificates of the victim.'
      ],
      actRef: 'MVA',
      sectionRef: '166',
      documents: [
        'Certified copy of police FIR & DAR report',
        'Original medical bills, discharge summaries, and disability reports (if any)',
        'Proof of age & identity of the victim (Aadhar / Driving License)',
        'Salary slips, job certificate, or income proof of the victim',
        'Registration Certificate (RC) and insurance copy of the vehicle involved'
      ],
      templateId: 'mact-claim-petition',
      noticeTemplate: `PETITION FOR ACCIDENT COMPENSATION
(Key Details required for MACT Petition under Section 166)

1. DETAILS OF ACCIDENT: Date, time, exact spot, and registering Police Station (FIR No. / Year).
2. VICTIM PARTICULARS: Name, Age, Profession, Monthly Income, and degree of permanent disability.
3. OFFENDING VEHICLE: Registration Number, make/model, Driver License number, and Insurance Policy details.
4. CLAIM VALUE: Detailed compensation amount claimed for medical expenses, loss of income, pain & suffering, and conveyances.`
    },
    {
      title: 'Filing a Right to Information (RTI) Application',
      category: 'Civil Procedure & Disputes',
      summary: 'Step-by-step procedure to file an RTI application to obtain documents/records from government departments.',
      steps: [
        'Identify the public department and locate their designated Public Information Officer (PIO).',
        'Draft the RTI application detailing exactly what records or files you require.',
        'Pay the mandatory application fee of Rs. 10 (via postal order or online challan).',
        'Submit the application and wait for the PIO\'s reply (legally required within 30 days).',
        'If reply is not received or unsatisfactory, file a First Appeal within 30 days.'
      ],
      actRef: 'RTI',
      sectionRef: '6(1)',
      documents: [
        'Drafted RTI application sheet',
        'Indian Postal Order (IPO) of Rs. 10 or online payment receipt',
        'Copy of the reply from PIO (if filing First Appeal)'
      ],
      templateId: 'rti-application',
      noticeTemplate: `APPLICATION FOR ACQUISITION OF INFORMATION UNDER RTI ACT, 2005
(Under Section 6(1) of the Right to Information Act, 2005)

Date: [Current Date]

To,
The Public Information Officer,
[Public Authority Name]

1. Name of the Applicant: [Your Name]
2. Correspondence Address: [Your Full Address]
3. Particulars of Information Required:
[Describe records/documents required clearly]
4. Fee Receipt/Postal Order Number: [IPO Number] dated [Payment Date]`
    },
    {
      title: 'Filing for Maintenance (CrPC Section 125)',
      category: 'Family & Matrimonial Law',
      summary: 'Procedure for wives, children, or parents to claim monthly maintenance allowance from a family member who neglects them.',
      steps: [
        'Draft a petition detailing the relationship and reasons for neglect/desertion.',
        'Gather income proofs or assets details of the respondent (e.g. salary slips, IT returns).',
        'File the maintenance petition in the Family Court or Magistrate Court.',
        'Request the court to grant interim maintenance during the pendency of the case.',
        'Obtain the final maintenance order, and file an Execution Petition if respondent fails to pay.'
      ],
      actRef: 'CrPC',
      sectionRef: '125',
      documents: [
        'Marriage certificate or wedding photos (if wife)',
        'Birth certificates (if claiming for children)',
        'Petitioner\'s monthly expenditure statement',
        'Respondent\'s salary slips or asset proof (if available)'
      ],
      templateId: 'maintenance-petition',
      noticeTemplate: `BEFORE THE COURT OF THE FAMILY JUDGE / MAGISTRATE
(Under Section 125 of the Code of Criminal Procedure, 1973)

In the matter of:
[Petitioner Name]
VERSUS
[Respondent Name]

PETITION FOR MONTHLY MAINTENANCE ALLOWANCE

1. Marriage Date: [Marriage Date]
2. Date of Neglect: [Desertion Date]
3. Petitioner\'s Monthly Expenditure: Rs. [Monthly Expense]
4. Respondent\'s Estimated Income: Rs. [Respondent Income]
5. Prayer: Direct Respondent to pay Rs. [Monthly Expense] per month.`
    }
  ];

  // --- Pecuniary Court Fee Calculator ---
  calculateChequeBounceFees() {
    if (!this.chequeAmountInput || this.chequeAmountInput <= 0) {
      this.estimatedCourtFee = '';
      return;
    }
    const amt = this.chequeAmountInput;
    let fee = 0;
    if (amt <= 10000) {
      fee = 200;
    } else if (amt <= 50000) {
      fee = 500;
    } else if (amt <= 100000) {
      fee = 1000;
    } else if (amt <= 500000) {
      fee = 2000 + (amt - 100000) * 0.01;
    } else {
      fee = 6000 + (amt - 500000) * 0.005;
    }
    this.estimatedCourtFee = `Rs. ${Math.round(fee).toLocaleString('en-IN')}`;
  }

  calculateJurisdiction() {
    if (this.chequePresentationType === 'account') {
      if (this.payeeBranchCity && this.payeeBranchCity.trim()) {
        this.geographicalJurisdictionText = `Metropolitan Magistrate Court in ${this.payeeBranchCity.trim()} (under Sec 142(2)(a) NIA – Payee bank branch location).`;
      } else {
        this.geographicalJurisdictionText = '';
      }
    } else {
      if (this.drawerBranchCity && this.drawerBranchCity.trim()) {
        this.geographicalJurisdictionText = `Metropolitan Magistrate Court in ${this.drawerBranchCity.trim()} (under Sec 142(2)(b) NIA – Drawer bank branch location).`;
      } else {
        this.geographicalJurisdictionText = '';
      }
    }
  }

  togglePresentationModeDropdown() {
    this.showPresentationModeDropdown = !this.showPresentationModeDropdown;
  }

  selectPresentationMode(mode: 'account' | 'counter') {
    this.chequePresentationType = mode;
    this.showPresentationModeDropdown = false;
    this.calculateJurisdiction();
  }

  // --- Visual Timeline Milestone Getters ---
  getChequeBounceTimeline() {
    if (!this.chequeBounceDate) return [];
    return [
      { label: 'Cheque Bounced', date: this.addDays(this.chequeBounceDate, 0), icon: 'bounced', status: 'completed' },
      { label: 'Send Notice Before', date: this.addDays(this.chequeBounceDate, 30), icon: 'notice', status: 'warning' },
      { label: 'Payment Window Ends', date: this.addDays(this.chequeBounceDate, 45), icon: 'payment', status: 'info' },
      { label: 'File Case Before', date: this.addDays(this.chequeBounceDate, 75), icon: 'court', status: 'danger' }
    ];
  }

  getDivorceTimeline() {
    if (!this.divorceFilingDate) return [];
    return [
      { label: 'Joint Petition Filed', date: this.addDays(this.divorceFilingDate, 0), icon: 'petition', status: 'completed' },
      { label: 'Cooling Period Ends', date: this.addDays(this.divorceFilingDate, 180), icon: 'cooling', status: 'info' },
      { label: 'Second Motion Expiry', date: this.addDays(this.divorceFilingDate, 540), icon: 'expiry', status: 'danger' }
    ];
  }

  stepDocMappings: { [gIndex: number]: { [sIndex: number]: number[] } } = {
    0: { // Cheque Bounce
      0: [0, 1, 4],
      1: [2],
      2: [3],
      3: [0, 1, 2, 3, 4]
    },
    1: { // Mutual Divorce
      0: [3],
      1: [0, 1, 2, 4],
      2: [2],
      3: [],
      4: [0, 1, 2, 3, 4]
    },
    2: { // Accident Claims
      0: [0],
      1: [0],
      2: [2, 3, 4],
      3: [1]
    }
  };

  constructor(private legalService: LegalService) { }

  ngOnInit() {
    // 1. Assign originalIndex, precompute stepDocs, and digital evidence flags
    this.guides.forEach((guide: any, idx: number) => {
      (guide as any).originalIndex = idx;

      // Precompute step documents mapping
      (guide as any).stepDocs = ((guide.steps as string[]) || []).map((_: string, sIdx: number) => {
        const docIndices = this.stepDocMappings[idx]?.[sIdx] || [];
        return docIndices.map((dIdx: number) => ({ index: dIdx, name: guide.documents[dIdx] }));
      });

      // Precompute digital evidence flags
      const digitalKeywords = ['statement', 'receipt', 'email', 'screenshot', 'WhatsApp', 'record'];
      (guide as any).hasDigitalEvidence = ((guide as any).stepDocs as any[]).map((docs: any[]) =>
        docs.some((d: any) => digitalKeywords.some((k: string) => d.name.toLowerCase().includes(k.toLowerCase())))
      );
    });

    this.precomputeFormattedSteps();
    this.loadProgress();

    // Initialize timelines and dates reactively
    this.onChequeBounceDateChange();
    this.onNoticeDeliveryDateChange();
    this.onSeparationDateChange();
    this.onDivorceFilingDateChange();

    // 2. Subscribe to searchSubject with debounceTime
    this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateVisibleElements();
    });

    this.loading = true;
    this.legalService.getActs().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          const civilActShortNames = ['HMA', 'IDA', 'NIA', 'CPC', 'MVA', 'RTI', 'DVA', 'HSA'];
          this.acts = res.data
            .filter(act => civilActShortNames.includes(act.shortName))
            .map(act => ({
              ...act,
              color: this.generateColor(act.shortName)
            }));
          this.updateVisibleElements();
        }
      },
      error: () => {
        this.loading = false;
        this.updateVisibleElements();
      }
    });
  }

  generateColor(name: string): string {
    if (!name) {
      return 'hsl(0, 0%, 50%)';
    }

    let hash = 0;

    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash |= 0;
    }

    const hue = Math.abs(hash) % 360;

    return `hsl(${hue}, 75%, 50%)`;
  }

  // --- Caching, Precomputing & Filtering ---
  precomputeFormattedSteps() {
    this.guides.forEach((guide: any) => {
      (guide as any).formattedSteps = ((guide.steps as string[]) || []).map((step: string) => this.getFormattedStep(step));
    });
  }

  updateVisibleElements() {
    // 1. Categories
    if (this.selectedSpecialization === 'all') {
      this.visibleCategories = this.categories;
    } else {
      this.visibleCategories = this.categories.filter(cat => cat.key === this.selectedSpecialization);
    }

    // 2. Acts filtered by category and search query
    this.filteredActsByCategory = {};
    this.categories.forEach(cat => {
      let filtered = this.acts.filter(act => cat.actShortNames.includes(act.shortName));
      if (this.searchQuery && this.searchQuery.trim().length > 0) {
        const q = this.searchQuery.toLowerCase().trim();
        filtered = filtered.filter(act =>
          act.shortName.toLowerCase().includes(q) ||
          act.actName.toLowerCase().includes(q) ||
          (act.description && act.description.toLowerCase().includes(q))
        );
      }
      this.filteredActsByCategory[cat.key] = filtered;
    });

    // 3. Guides filtered by specialization and search query
    let list = this.guides;
    if (this.selectedSpecialization !== 'all') {
      const specMap: { [key: string]: string } = {
        family: 'Family',
        commercial: 'Commercial',
        civil: 'Civil',
        transport: 'Transport'
      };
      const categoryPrefix = specMap[this.selectedSpecialization];
      if (categoryPrefix) {
        list = list.filter(g => g.category.startsWith(categoryPrefix));
      }
    }

    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter((g: any) =>
        g.title.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.summary.toLowerCase().includes(q) ||
        (g.steps as string[]).some((step: string) => step.toLowerCase().includes(q))
      );
    }
    this.visibleGuides = list;
  }

  toggleMobileCategory(key: string) {
    this.expandedCategoryMobile[key] = !this.expandedCategoryMobile[key];
  }

  selectSpecialization(spec: string) {
    this.selectedSpecialization = spec;
    this.searchQuery = '';
    this.updateVisibleElements();
  }

  onSearchQueryChange(query: string) {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  // Active step state for each guide index to guide user step-by-step
  activeStepIndex: { [guideIndex: number]: number } = {};

  setStep(guideIndex: number, stepIndex: number) {
    this.activeStepIndex[guideIndex] = stepIndex;
    this.activeMobileStep[guideIndex] = stepIndex; // Sync mobile active step
    this.updatePrecomputedStates(guideIndex);
  }

  // Set step specifically on mobile
  setMobileStep(guideIndex: number, stepIndex: number) {
    this.activeMobileStep[guideIndex] = stepIndex;
    this.activeStepIndex[guideIndex] = stepIndex; // keep both in sync
    this.updatePrecomputedStates(guideIndex);
  }

  getStep(guideIndex: number): number {
    if (this.currentActiveStep[guideIndex] !== undefined) {
      return this.currentActiveStep[guideIndex];
    }
    return 0;
  }

  completeAndNext(guideIndex: number, stepIndex: number, totalSteps: number) {
    if (!this.checkedSteps[guideIndex]) {
      this.checkedSteps[guideIndex] = {};
    }
    this.checkedSteps[guideIndex]![stepIndex] = true;
    this.saveProgress();

    // Advance to next step if there is one
    if (stepIndex < totalSteps - 1) {
      this.setStep(guideIndex, stepIndex + 1);
    } else {
      this.updatePrecomputedStates(guideIndex);
    }
  }

  getStepDocuments(guideIndex: number, stepIndex: number): { index: number, name: string }[] {
    return this.guides[guideIndex]?.stepDocs?.[stepIndex] || [];
  }

  isSpeaking: { [guideIndex: number]: { [stepIndex: number]: boolean } } = {};

  speakStep(guideIndex: number, stepIndex: number, text: string) {
    window.speechSynthesis.cancel();
    if (this.isSpeaking[guideIndex]?.[stepIndex]) {
      this.isSpeaking[guideIndex][stepIndex] = false;
      return;
    }

    // Reset all speaking states
    this.isSpeaking = {};
    if (!this.isSpeaking[guideIndex]) {
      this.isSpeaking[guideIndex] = {};
    }
    this.isSpeaking[guideIndex][stepIndex] = true;

    // Strip Jargon HTML nodes from string
    const cleanText = text.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-IN';
    utterance.onend = () => {
      this.isSpeaking[guideIndex][stepIndex] = false;
    };
    utterance.onerror = () => {
      this.isSpeaking[guideIndex][stepIndex] = false;
    };
    window.speechSynthesis.speak(utterance);
  }

  getStepDocsStatus(guideIndex: number, stepIndex: number): string {
    return this.stepDocsStatus[guideIndex]?.[stepIndex] || '';
  }

  // --- Accordion Logic ---
  toggleGuide(index: number) {
    if (this.expandedGuideIndex === index) {
      this.expandedGuideIndex = null;
    } else {
      this.expandedGuideIndex = index;

      // Initialize/reset stepper state to the first incomplete step
      let active = 0;
      const steps = this.guides[index]?.steps || [];
      let foundIncomplete = false;
      for (let idx = 0; idx < steps.length; idx++) {
        if (!this.checkedSteps[index]?.[idx]) {
          active = idx;
          foundIncomplete = true;
          break;
        }
      }

      if (this.activeStepIndex[index] !== undefined) {
        active = this.activeStepIndex[index];
      }

      this.setStep(index, active);

      // Reset contextual states for the newly opened guide
      this.localHelpData = null;
      this.guideAiAnswer = '';
      this.guideAiQuery = '';
      this.helpLoading = false;
      this.guideAiLoading = false;
    }
  }

  // --- Date Arithmetic helper for deadline calculations ---
  addDays(dateStr: string, days: number): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  onChequeBounceDateChange() {
    this.calculatedSendNoticeBeforeDate = this.chequeBounceDate ? this.addDays(this.chequeBounceDate, 30) : 'Choose bounced date';
    this.updateChequeBounceTimeline();
  }

  onNoticeDeliveryDateChange() {
    this.calculatedWaitResponseDate = this.noticeDeliveryDate ? this.addDays(this.noticeDeliveryDate, 15) : 'Choose delivery date';
    this.calculatedFileCourtCaseDate = this.noticeDeliveryDate ? this.addDays(this.noticeDeliveryDate, 45) : 'Choose delivery date';
  }

  onSeparationDateChange() {
    this.calculatedEarliestFilingDate = this.separationDate ? this.addDays(this.separationDate, 365) : 'Choose separation date';
  }

  onDivorceFilingDateChange() {
    this.calculatedCoolingPeriodEndsDate = this.divorceFilingDate ? this.addDays(this.divorceFilingDate, 180) : 'Choose filing date';
    this.calculatedSecondMotionExpiryDate = this.divorceFilingDate ? this.addDays(this.divorceFilingDate, 540) : 'Choose filing date';
    this.updateDivorceTimeline();
  }

  updateChequeBounceTimeline() {
    if (!this.chequeBounceDate) {
      this.chequeBounceTimelineData = [];
      return;
    }
    this.chequeBounceTimelineData = [
      { label: 'Cheque Bounced', date: this.addDays(this.chequeBounceDate, 0), icon: 'bounced', status: 'completed' },
      { label: 'Send Notice Before', date: this.addDays(this.chequeBounceDate, 30), icon: 'notice', status: 'warning' },
      { label: 'Payment Window Ends', date: this.addDays(this.chequeBounceDate, 45), icon: 'payment', status: 'info' },
      { label: 'File Case Before', date: this.addDays(this.chequeBounceDate, 75), icon: 'court', status: 'danger' }
    ];
  }

  updateDivorceTimeline() {
    if (!this.divorceFilingDate) {
      this.divorceTimelineData = [];
      return;
    }
    this.divorceTimelineData = [
      { label: 'Joint Petition Filed', date: this.addDays(this.divorceFilingDate, 0), icon: 'petition', status: 'completed' },
      { label: 'Cooling Period Ends', date: this.addDays(this.divorceFilingDate, 180), icon: 'cooling', status: 'info' },
      { label: 'Second Motion Expiry', date: this.addDays(this.divorceFilingDate, 540), icon: 'expiry', status: 'danger' }
    ];
  }

  // --- Local lawyer helper call ---
  fetchLocalHelp(category: string) {
    if (!this.userLocation || this.userLocation.trim().length < 3) {
      return;
    }
    this.helpLoading = true;
    this.localHelpData = null;

    let apiCat = 'General';
    if (category.toLowerCase().includes('commercial') || category.toLowerCase().includes('nia')) {
      apiCat = 'Business Dispute';
    } else if (category.toLowerCase().includes('family') || category.toLowerCase().includes('hma')) {
      apiCat = 'Family Law';
    } else if (category.toLowerCase().includes('transport') || category.toLowerCase().includes('mva')) {
      apiCat = 'Consumer Complaint';
    }

    this.legalService.getHelpNearMe(apiCat, this.userLocation.trim()).subscribe({
      next: (res) => {
        this.helpLoading = false;
        if (res.success) {
          this.localHelpData = res;
        }
      },
      error: () => {
        this.helpLoading = false;
      }
    });
  }

  // --- Guide AI Helper call ---
  askGuideAi(topic: string) {
    if (!this.guideAiQuery || this.guideAiQuery.trim().length < 2) return;
    this.guideAiLoading = true;
    this.guideAiAnswer = '';
    const fullQuestion = `Regarding the topic of "${topic}": ${this.guideAiQuery}`;

    this.legalService.askLegalQuestion(fullQuestion).subscribe({
      next: (res) => {
        this.guideAiLoading = false;
        if (res.success) {
          this.guideAiAnswer = res.answer;
        } else {
          this.guideAiAnswer = 'Failed to retrieve an answer from AI. Please try again.';
        }
      },
      error: () => {
        this.guideAiLoading = false;
        this.guideAiAnswer = 'An error occurred connecting to the AI helper service.';
      }
    });
  }

  // --- Voice Search via Web Speech API ---
  startVoiceSearch() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.triggerConfirm(
        'Speech Recognition Unsupported',
        'Voice search is not supported in this browser. Please use a modern browser like Google Chrome or Microsoft Edge.',
        'info',
        () => { }
      );
      return;
    }

    if (this.isListening) {
      this.isListening = false;
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    this.isListening = true;

    recognition.onstart = () => {
      console.log('Voice recognition started...');
    };

    recognition.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      this.searchQuery = resultText;
      this.searchSubject.next(resultText); // fire search query subject
      this.isListening = false;
    };

    recognition.onerror = () => {
      this.isListening = false;
    };

    recognition.onend = () => {
      this.isListening = false;
    };

    recognition.start();
  }

  // --- Precomputing states logic ---
  updatePrecomputedStates(guideIndex: number) {
    const guide = this.guides[guideIndex];
    if (!guide) return;

    // 1. Calculate active step (default to first incomplete step, or override if set)
    let active = 0;
    const steps: string[] = guide.steps || [];
    let foundIncomplete = false;
    for (let idx = 0; idx < steps.length; idx++) {
      if (!this.checkedSteps[guideIndex]?.[idx]) {
        active = idx;
        foundIncomplete = true;
        break;
      }
    }

    if (this.activeStepIndex[guideIndex] !== undefined) {
      active = this.activeStepIndex[guideIndex];
    } else if (!foundIncomplete) {
      active = 0;
    }

    this.currentActiveStep[guideIndex] = active;

    if (this.activeMobileStep[guideIndex] === undefined) {
      this.activeMobileStep[guideIndex] = active;
    }

    // 2. Calculate progress percent
    const totalSteps = steps.length;
    const totalDocs = guide.documents?.length || 0;
    const checkedStepCount = Object.values(this.checkedSteps[guideIndex] || {}).filter(Boolean).length;
    const checkedDocCount = Object.values(this.documentStatus[guideIndex] || {}).filter(Boolean).length;
    const totalItems = totalSteps + totalDocs;
    this.guideProgressPercent[guideIndex] = totalItems === 0 ? 0 : Math.round(((checkedStepCount + checkedDocCount) / totalItems) * 100);

    // 3. Calculate step docs status for each step
    if (!this.stepDocsStatus[guideIndex]) {
      this.stepDocsStatus[guideIndex] = {};
    }
    steps.forEach((_, sIdx) => {
      const docs = (guide as any).stepDocs?.[sIdx] || [];
      if (docs.length === 0) {
        this.stepDocsStatus[guideIndex]![sIdx] = '';
      } else {
        const completed = docs.filter((d: any) => !!this.documentStatus[guideIndex]?.[d.index]).length;
        this.stepDocsStatus[guideIndex]![sIdx] = `${completed}/${docs.length} Docs`;
      }
    });
  }

  // --- Progress Saving & Stepper ---
  loadProgress() {
    const saved = localStorage.getItem('lc_guide_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.checkedSteps = parsed.checkedSteps || {};
        this.documentStatus = parsed.documentStatus || {};
      } catch (e) {
        console.error('Failed to parse guide progress:', e);
      }
    }
    // Initialize precomputed states for all guides
    this.guides.forEach((_, idx) => {
      this.updatePrecomputedStates(idx);
    });
  }

  saveProgress() {
    const data = {
      checkedSteps: this.checkedSteps,
      documentStatus: this.documentStatus
    };
    localStorage.setItem('lc_guide_progress', JSON.stringify(data));
  }

  toggleStep(guideIndex: number, stepIndex: number) {
    if (!this.checkedSteps[guideIndex]) {
      this.checkedSteps[guideIndex] = {};
    }
    this.checkedSteps[guideIndex]![stepIndex] = !this.checkedSteps[guideIndex]![stepIndex];
    this.saveProgress();
    this.updatePrecomputedStates(guideIndex);
  }

  isStepChecked(guideIndex: number, stepIndex: number): boolean {
    return !!(this.checkedSteps[guideIndex] && this.checkedSteps[guideIndex]![stepIndex]);
  }

  toggleDocument(guideIndex: number, docIndex: number) {
    if (!this.documentStatus[guideIndex]) {
      this.documentStatus[guideIndex] = {};
    }
    this.documentStatus[guideIndex]![docIndex] = !this.documentStatus[guideIndex]![docIndex];
    this.saveProgress();
    this.updatePrecomputedStates(guideIndex);
  }

  isDocChecked(guideIndex: number, docIndex: number): boolean {
    return !!(this.documentStatus[guideIndex] && this.documentStatus[guideIndex]![docIndex]);
  }

  getGuideProgressPercent(guideIndex: number, totalSteps: number, totalDocs: number): number {
    if (this.guideProgressPercent[guideIndex] !== undefined) {
      return this.guideProgressPercent[guideIndex];
    }
    return 0;
  }

  resetGuideProgress(guideIndex: number) {
    this.checkedSteps[guideIndex] = {};
    this.documentStatus[guideIndex] = {};
    if (this.activeStepIndex[guideIndex] !== undefined) {
      delete this.activeStepIndex[guideIndex];
    }
    this.activeMobileStep[guideIndex] = 0;
    this.saveProgress();
    this.updatePrecomputedStates(guideIndex);
  }

  // --- Copy templates helper ---
  copyToClipboard(text: string, guideIndex: number) {
    navigator.clipboard.writeText(text).then(() => {
      this.copySuccess[guideIndex] = true;
      setTimeout(() => {
        this.copySuccess[guideIndex] = false;
      }, 2000);
    }).catch(err => {
      console.error('Copy notice template failed: ', err);
    });
  }

  // --- Jargon Buster parser method ---
  getFormattedStep(stepText: string): string {
    let formatted = stepText;
    const words = Object.keys(this.jargonDefinitions);
    for (const word of words) {
      // Find whole word matching case insensitively
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(formatted)) {
        // Re-replace matching exact casing of original word
        formatted = formatted.replace(regex, (match) => {
          return `<span class="glossary-term cursor-help border-b border-dotted border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold relative group inline-block">${match}<span class="glossary-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-950 dark:bg-slate-900 border border-slate-800 text-slate-100 text-[11.5px] font-normal leading-relaxed rounded-xl shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 text-center">${this.jargonDefinitions[word]}</span></span>`;
        });
      }
    }
    return formatted;
  }

  hasDigitalEvidence(guideIndex: number, stepIndex: number): boolean {
    const guide = this.guides[guideIndex];
    if (guide && (guide as any).hasDigitalEvidence) {
      return !!(guide as any).hasDigitalEvidence[stepIndex];
    }
    return false;
  }

  ngOnDestroy() {
    window.speechSynthesis.cancel();
    this.destroy$.next();
    this.destroy$.complete();
  }
}