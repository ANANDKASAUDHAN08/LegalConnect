import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

export interface TriageResult {
  category: string;
  urgency: 'immediate' | 'golden_hour' | 'standard' | 'past';
  goal: 'free_aid' | 'police' | 'legal_notice' | 'private_advocate';
  summary: string;
}

@Component({
  selector: 'app-triage-wizard-modal',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './triage-wizard-modal.component.html',
  styleUrls: ['./triage-wizard-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TriageWizardModalComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() triageCompleted = new EventEmitter<TriageResult>();

  currentStep = 1;

  // Selections
  selectedCategory = 'Property Dispute';
  selectedUrgency: 'immediate' | 'golden_hour' | 'standard' | 'past' = 'standard';
  selectedGoal: 'free_aid' | 'police' | 'legal_notice' | 'private_advocate' = 'free_aid';

  categoryOptions = [
    {
      id: 'Cyber Crime',
      title: 'Online Fraud & Cyber Scam',
      desc: 'Unauthorized bank debit, UPI fraud, phishing, identity theft, account hacking',
      iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      badge: 'Golden Hour Rule'
    },
    {
      id: 'Property Dispute',
      title: 'Rent, Land & Property Conflict',
      desc: 'Illegal eviction, rent default, land encroachment, builder possession delay',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badge: 'Civil & Tenancy'
    },
    {
      id: 'Family Law',
      title: 'Domestic, Matrimonial & Custody',
      desc: 'Domestic violence (PWDVA), mutual divorce, child custody, maintenance petition',
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      badge: 'Family Welfare'
    },
    {
      id: 'Criminal Matter',
      title: 'Police FIR & Criminal Defense',
      desc: 'FIR registration refusal, unlawful arrest, bail application, assault complaint',
      iconBg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      badge: 'Art 22 Protection'
    },
    {
      id: 'Consumer Complaint',
      title: 'Consumer Dispute & Refund',
      desc: 'Defective goods, refused warranty, airline cancellation, e-Daakhil filing',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badge: 'e-Daakhil'
    },
    {
      id: 'Labour Issue',
      title: 'Unpaid Wages & Job Termination',
      desc: 'Withheld salary, sudden termination without notice, workplace dispute',
      iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
      badge: 'Labour Court'
    },
    {
      id: 'Business Dispute',
      title: 'Commercial & Cheque Bounce',
      desc: 'Sec 138 dishonoured cheque, MSME Samadhaan delayed payment, contract breach',
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      badge: 'Sec 138 NI Act'
    }
  ];

  urgencyOptions = [
    {
      id: 'immediate' as const,
      title: 'Happening Right Now / Active Danger',
      desc: 'Immediate physical safety risk, active confrontation, or custody emergency',
      badge: 'Emergency SOS',
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      iconClass: 'text-rose-600 dark:text-rose-400'
    },
    {
      id: 'golden_hour' as const,
      title: 'Within the Last 2 Hours (Golden Hour)',
      desc: 'Crucial window for I4C 1930 bank lien freeze on siphoned financial assets',
      badge: 'Golden Hour Priority',
      badgeClass: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      iconClass: 'text-cyan-600 dark:text-cyan-400'
    },
    {
      id: 'standard' as const,
      title: 'Within the Past 30 Days',
      desc: 'Active dispute, recent notice delivery, or standard statutory notice window',
      badge: 'High Statutory Urgency',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
      iconClass: 'text-amber-600 dark:text-amber-400'
    },
    {
      id: 'past' as const,
      title: 'Several Months Ago / Pre-existing Matter',
      desc: 'Long-standing civil or commercial dispute seeking strategic legal counsel',
      badge: 'Standard Advisory',
      badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
      iconClass: 'text-slate-600 dark:text-slate-400'
    }
  ];

  goalOptions = [
    {
      id: 'free_aid' as const,
      title: 'Free Legal Aid Counsel (Section 12 NALSA)',
      desc: 'Government-appointed pro bono advocate provided at State expense via District Legal Services Authority (DLSA)',
      badge: '100% Free Counsel',
      badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      iconClass: 'text-purple-600 dark:text-purple-400'
    },
    {
      id: 'legal_notice' as const,
      title: 'Draft a Pre-Litigation Legal Notice',
      desc: 'Send a formal statutory demand notice (e.g. Sec 138 Cheque Bounce, Eviction, Consumer Refund) before filing in court',
      badge: 'Statutory Notice',
      badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      iconClass: 'text-indigo-600 dark:text-indigo-400'
    },
    {
      id: 'police' as const,
      title: 'Immediate Police & Protection Intervention',
      desc: 'Connect directly with the nearest Police Station, Women Protection Officer, or Cyber Crime Reporting desk',
      badge: 'Law Enforcement',
      badgeClass: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
      iconClass: 'text-red-600 dark:text-red-400'
    },
    {
      id: 'private_advocate' as const,
      title: 'Consult Verified Private Advocate',
      desc: 'Schedule a private consultation with a Bar Council verified advocate specialized in this domain in your district',
      badge: 'Private Counsel',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
      iconClass: 'text-amber-600 dark:text-amber-400'
    }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && typeof document !== 'undefined') {
      if (this.isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  selectCategory(catId: string): void {
    this.selectedCategory = catId;
    this.currentStep = 2;
  }

  selectUrgency(urgency: 'immediate' | 'golden_hour' | 'standard' | 'past'): void {
    this.selectedUrgency = urgency;
    this.currentStep = 3;
  }

  selectGoal(goal: 'free_aid' | 'police' | 'legal_notice' | 'private_advocate'): void {
    this.selectedGoal = goal;
    this.completeTriage();
  }

  completeTriage(): void {
    const summary = `Triage Diagnostic: Category [${this.selectedCategory}], Urgency [${this.selectedUrgency}], Relief Goal [${this.selectedGoal}]`;
    this.triageCompleted.emit({
      category: this.selectedCategory,
      urgency: this.selectedUrgency,
      goal: this.selectedGoal,
      summary
    });
    this.closeModal();
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  closeModal(): void {
    this.currentStep = 1;
    this.close.emit();
  }

  trackByOptionId(_: number, opt: any): string {
    return opt.id;
  }

  trackByUrgencyId(_: number, urg: any): string {
    return urg.id;
  }

  trackByGoalId(_: number, goal: any): string {
    return goal.id;
  }
}