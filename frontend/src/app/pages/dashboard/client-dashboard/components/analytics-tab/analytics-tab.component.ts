import { Component, OnInit, Input, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LawyerService, ClientInsightsData, ClientSpendMilestone, CasePipelineStep, DocumentReadiness, CounselSlaMetrics } from '../../../../../services/lawyer.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { FormsModule } from '@angular/forms';
import { DataExportService } from '../../../../../services/data-export.service';
import { AuthService, UserProfile } from '../../../../../services/auth.service';

@Component({
  selector: 'app-analytics-tab',
  standalone: true,
  imports: [CommonModule, TooltipDirective, FormsModule],
  templateUrl: './analytics-tab.component.html',
  styleUrls: ['./analytics-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsTabComponent implements OnInit {
  @Input() isPrivacyMode: boolean = false;
  currentUser: UserProfile | null = null;

  insights = signal<ClientInsightsData | null>(null);
  isLoading = signal<boolean>(true);
  isLocalPrivacy = signal<boolean>(false);
  showBudgetInput = signal<boolean>(false);
  budgetInputValue = signal<number | null>(null);
  isSavingBudget = signal<boolean>(false);

  // Computed Values
  totalSpend = computed(() => this.insights()?.totalSpend ?? 0);
  budgetCap = computed(() => this.insights()?.budgetCap ?? 0);
  inEscrow = computed(() => this.insights()?.inEscrow ?? 0);
  remainingBudget = computed(() => this.insights()?.remainingBudget ?? 0);
  spendMilestones = computed<ClientSpendMilestone[]>(() => this.insights()?.spendMilestones || []);
  casePipeline = computed<CasePipelineStep[]>(() => this.insights()?.casePipeline || []);
  documentReadiness = computed<DocumentReadiness>(() => this.insights()?.documentReadiness || {
    totalRequired: 0,
    verifiedCount: 0,
    pendingCount: 0,
    readinessPercentage: 0,
    statusLabel: 'No Documents',
    missingDocuments: []
  });
  counselSla = computed<CounselSlaMetrics>(() => this.insights()?.counselSla || {
    advocateName: 'No Advocate Contacted',
    avgResponseTime: 'N/A',
    responseGrade: 'No Active Matter',
    daysEngaged: 0,
    activeMattersCount: 0
  });

  isBudgetUserSet = computed<boolean>(() => this.insights()?.isBudgetUserSet ?? false);

  spendPercentage = computed(() => {
    const total = this.totalSpend();
    const cap = this.budgetCap();
    return cap > 0 ? Math.min(100, Math.round((total / cap) * 100)) : 0;
  });

  escrowPercentage = computed(() => {
    const esc = this.inEscrow();
    const cap = this.budgetCap();
    return cap > 0 ? Math.min(100, Math.round((esc / cap) * 100)) : 0;
  });

  isBudgetNearingCap = computed<boolean>(() => {
    const budget = this.budgetCap();
    if (!this.isBudgetUserSet() || budget <= 0) return false;
    const allocated = this.totalSpend() + this.inEscrow();
    return (allocated / budget) >= 0.90;
  });

  budgetUtilizationPct = computed<number>(() => {
    const budget = this.budgetCap();
    if (!this.isBudgetUserSet() || budget <= 0) return 0;
    const allocated = this.totalSpend() + this.inEscrow();
    return Math.min(100, Math.round((allocated / budget) * 100));
  });

  constructor(
    private lawyerService: LawyerService,
    private snackbar: SnackbarService,
    private dataExportService: DataExportService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.authService.currentUser$.subscribe(u => this.currentUser = u);
    this.loadInsights();
  }

  loadInsights() {
    this.isLoading.set(true);

    const cached = this.lawyerService.getCachedClientInsights();
    if (cached) {
      this.insights.set(cached);
    }

    const minTimer = new Promise(resolve => setTimeout(resolve, 300));

    this.lawyerService.getClientInsights().subscribe({
      next: (data) => {
        minTimer.then(() => {
          this.insights.set(data);
          this.isLoading.set(false);
        });
      },
      error: () => {
        minTimer.then(() => {
          if (!this.insights()) {
            this.insights.set(this.generateDefaultClientInsights());
          }
          this.isLoading.set(false);
        });
      }
    });
  }

  togglePrivacy() {
    this.isLocalPrivacy.update(v => !v);
    this.snackbar.show(
      this.isLocalPrivacy() ? 'Privacy Mode Enabled (Amounts Hidden)' : 'Privacy Mode Disabled',
      'info'
    );
  }

  formatAmount(val: number): string {
    if (this.isPrivacyMode || this.isLocalPrivacy()) return '₹ ••••••';
    return '₹' + Number(val).toLocaleString('en-IN');
  }

  printSummary() {
    const success = this.dataExportService.printClientInsightsDossier(
      this.currentUser,
      this.insights(),
      () => {
        this.snackbar.show('Popups were blocked by your browser. Printing triggered in background.', 'info');
      }
    );
    if (success) {
      this.snackbar.show('Generating Client Spend & Case Transparency Dossier...', 'info');
    }
  }

  exportMilestonesToCsv() {
    const milestones = this.spendMilestones();
    const escapeCell = (val: any): string => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows: (string | number)[][] = [
      ['Milestone Deliverable', 'Date', 'Amount (INR)', 'Payment Status'],
      ...milestones.map(m => [m.title, m.date, m.amount, m.status]),
      [''],
      ['Total Settled Spend', '', this.totalSpend(), 'Settled'],
      ['Funds in Escrow', '', this.inEscrow(), 'In Escrow'],
      ['Configured Budget Ceiling', '', this.isBudgetUserSet() ? this.budgetCap() : 'Not Set', 'Budget']
    ];

    const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `legalconnect_client_spend_milestones_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.snackbar.show('Exported Milestone Invoices to CSV.', 'success');
  }

  openBudgetInput() {
    this.budgetInputValue.set(this.budgetCap() > 0 ? this.budgetCap() : null);
    this.showBudgetInput.set(true);
  }

  saveBudget() {
    const val = this.budgetInputValue();
    if (val !== null && val < 0) {
      this.snackbar.show('Budget cannot be negative.', 'error');
      return;
    }
    this.isSavingBudget.set(true);
    this.lawyerService.setLegalBudget(val).subscribe({
      next: () => {
        this.showBudgetInput.set(false);
        this.isSavingBudget.set(false);
        this.snackbar.show('Legal budget updated.', 'success');
        this.loadInsights();
      },
      error: () => {
        this.isSavingBudget.set(false);
        this.snackbar.show('Failed to update budget.', 'error');
      }
    });
  }

  cancelBudgetInput() {
    this.showBudgetInput.set(false);
  }

  private generateDefaultClientInsights(): ClientInsightsData {
    return {
      totalSpend: 0,
      budgetCap: 0,
      isBudgetUserSet: false,
      inEscrow: 0,
      remainingBudget: 0,
      spendDeltaPct: 0,
      spendMilestones: [],
      casePipeline: [],
      documentReadiness: {
        totalRequired: 0,
        verifiedCount: 0,
        pendingCount: 0,
        readinessPercentage: 0,
        statusLabel: 'Not Started',
        missingDocuments: []
      },
      counselSla: {
        advocateName: 'No Advocate Contacted',
        avgResponseTime: 'N/A',
        responseGrade: 'No Active Matter',
        daysEngaged: 0,
        activeMattersCount: 0
      }
    };
  }

  trackByMilestone(index: number, item: ClientSpendMilestone): string {
    return item.title + item.date;
  }

  trackByStep(index: number, item: CasePipelineStep): number {
    return item.step;
  }
}