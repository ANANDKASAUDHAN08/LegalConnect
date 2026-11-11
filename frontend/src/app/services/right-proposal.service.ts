import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * RightProposalService — Dedicated Citizen Legal Safeguard Crowdsourcing Service
 *
 * Implements SOLID Single Responsibility Principle:
 * Completely isolated from Moderation/ContentReport reporting.
 * Handles:
 * - Citizen submission of new legal protection scenarios
 * - Curated domain category taxonomy fetching
 * - Local storage tracking for citizen proposal reference receipts
 * - Modal state orchestration across Crisis View & Search Zero-Results
 */

export interface ProposalCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  examples: string[];
}

export interface ProposalSubmission {
  scenarioTitle: string;
  category: string;
  statutoryBasis?: string;
  verbalScript?: string;
  emergencyHelpline?: string;
  description: string;
  evidenceUrl?: string;
  contributorType: 'citizen' | 'advocate' | 'law_student' | 'anonymous';
  contributorName?: string;
  contributorEmail?: string;
  clientFingerprint?: string;
}

export interface ProposalResponse {
  success: boolean;
  message: string;
  referenceId: string;
  estimatedReviewTime?: string;
  data?: {
    referenceId: string;
    scenarioTitle: string;
    category: string;
    status: string;
    createdAt: string;
  };
}

export interface StoredProposalRecord {
  referenceId: string;
  scenarioTitle: string;
  category: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  createdAt: number;
}

const LOCAL_STORAGE_KEY = 'lc_citizen_proposals';
const MAX_STORED = 30;

@Injectable({ providedIn: 'root' })
export class RightProposalService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private apiUrl = '/api/info/rights/propose';

  // ── Modal State Signals ──
  isOpen = signal<boolean>(false);
  prefillContext = signal<{ scenarioTitle?: string; category?: string } | null>(null);

  // ── Local Submission Tracking Store ──
  userProposals = signal<StoredProposalRecord[]>([]);

  constructor() {
    this.loadStoredProposals();
  }

  private loadStoredProposals(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        this.userProposals.set(JSON.parse(raw));
      }
    } catch {
      // Storage unavailable
    }
  }

  private saveStoredProposals(record: StoredProposalRecord): void {
    if (typeof window === 'undefined') return;
    try {
      const current = [record, ...this.userProposals().filter(p => p.referenceId !== record.referenceId)].slice(0, MAX_STORED);
      this.userProposals.set(current);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Open the proposal modal with optional prefill context (e.g. search query or scenario category).
   */
  openProposal(context?: { scenarioTitle?: string; category?: string }): void {
    this.prefillContext.set(context || null);
    this.isOpen.set(true);
  }

  /**
   * Close the proposal modal and clear prefill context.
   */
  closeProposal(): void {
    this.isOpen.set(false);
    this.prefillContext.set(null);
  }

  /**
   * Fetch available legal defense categories from backend taxonomy.
   */
  async getCategories(): Promise<ProposalCategory[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ success: boolean; data: ProposalCategory[] }>(`${this.apiUrl}/categories`)
      );
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
    } catch {
      // Graceful fallback if offline or during network drop
    }

    return [
      {
        id: 'Police Encounters',
        name: 'Police Encounters & Criminal Defense',
        icon: 'shield',
        description: 'Custody, summons, traffic stops, unauthorized vehicle search, non-cognizable reports',
        examples: ['Unauthorized Phone Confiscation at Checkpoint', 'Bail on Bailable Warrant by Duty Magistrate']
      },
      {
        id: 'Cyber & Online Fraud',
        name: 'Cyber & Digital Protection',
        icon: 'lock',
        description: 'Digital arrest scams, frozen bank accounts, unauthorized UPI debits, cyber extortion',
        examples: ['Bank Account Unfreezing (1930 Cyber Fraud)', 'Revenge Porn Takedown Protocol under IT Act']
      },
      {
        id: 'Housing & Tenancy',
        name: 'Housing & Tenancy Defense',
        icon: 'home',
        description: 'Forcible eviction, withholding security deposit, illegal electricity disconnection',
        examples: ['Protection Against Lockout Without Court Notice', 'Rent Control Ceiling During Tenancy']
      },
      {
        id: 'Women & Child Safety',
        name: 'Women & Child Safeguards',
        icon: 'heart',
        description: 'Zero FIR, sunset-to-sunrise arrest immunity, workplace harassment (POSH), maintenance',
        examples: ['Female Arrest Protocol after Sunset', 'Emergency POSH Committee Injunction']
      },
      {
        id: 'Consumer & Financial',
        name: 'Consumer & Financial Protection',
        icon: 'credit-card',
        description: 'Loan recovery agent harassment, e-commerce refusal to refund, defective medical goods',
        examples: ['RBI Fair Practices Code Against Recovery Calls', 'Class Action Injunction Before NCDRC']
      },
      {
        id: 'Workplace & Labor',
        name: 'Workplace, Labor & Employment',
        icon: 'briefcase',
        description: 'Wrongful termination, withholding salary, non-issuance of relieving letter/experience certificate',
        examples: ['Wage Recovery Petition Before Labor Commissioner', 'Enforceability of Non-Compete Clauses']
      },
      {
        id: 'Healthcare & Dignity',
        name: 'Healthcare & Patient Rights',
        icon: 'activity',
        description: 'Hospital detaining dead bodies or patients for unpaid bills, denial of emergency care',
        examples: ['Hospital Detention for Pending Bills Prohibited (Charter)', 'Golden Hour Emergency Treatment Mandate']
      }
    ];
  }

  /**
   * Submit new legal protection scenario to the research council.
   */
  async submitProposal(payload: ProposalSubmission): Promise<ProposalResponse> {
    const res = await firstValueFrom(
      this.http.post<ProposalResponse>(this.apiUrl, payload)
    );

    if (res?.success && res.referenceId) {
      this.saveStoredProposals({
        referenceId: res.referenceId,
        scenarioTitle: payload.scenarioTitle,
        category: payload.category,
        status: 'PENDING',
        createdAt: Date.now()
      });
    }

    return res;
  }
}