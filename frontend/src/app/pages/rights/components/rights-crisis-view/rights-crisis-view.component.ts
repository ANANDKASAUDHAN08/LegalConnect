import {
  Component,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed,
  input,
  inject,
  DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { StatutoryRight, EmergencyScenario } from '../../../../services/rights.service';
import { ModerationReportService } from '../../../../services/moderation-report.service';
import { RightProposalService } from '../../../../services/right-proposal.service';
import { IconName } from '../../../../components/icon/icon.types';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import {
  getRightTitle,
  getRightSummary,
  getRightWhatToSay,
  getRightDosAndDonts,
  getRightShareUrl,
  getRightShareSubject,
  getRightShareText,
  getRightCitationText,
  getCitationSuccessMessage
} from '../../utils/rights-helpers.util';

// Semantic aliases mapping sub-tagged statutory rights to their parent emergency scenarios
const SCENARIO_TAG_ALIASES: Record<string, string[]> = {
  'police-stop': ['police-stop', 'procedural-safeguards', 'undertrial-bail'],
  'traffic-police': ['traffic-police', 'traffic-challan'],
  'cyber-scam': ['cyber-scam', 'cyber-fraud', 'banking-freeze'],
  'tenant-eviction': ['tenant-eviction', 'landlord-eviction'],
  'medical-emergency': ['medical-emergency', 'medical-refusal'],
  'women-safety': ['women-safety', 'domestic-violence'],
  'consumer-refund': ['consumer-refund', 'ecommerce-refund'],
  'ecommerce-refund': ['ecommerce-refund', 'consumer-refund'],
  'flight-delay': ['flight-delay'],
  'workplace-harassment': ['workplace-harassment']
};

const SCENARIO_KEYWORDS: Record<string, string[]> = {
  'police-stop': ['police', 'arrest', 'custody', 'detention', 'bnss', 'criminal', 'magistrate', 'bail', 'undertrial'],
  'traffic-police': ['traffic', 'challan', 'digilocker', 'vehicle', 'mparivahan', 'breathalyzer', 'towing'],
  'cyber-scam': ['cyber', 'banking', 'scam', 'fraud', 'upi', 'bank', 'p2p', 'freeze', 'deepfake'],
  'tenant-eviction': ['tenant', 'landlord', 'eviction', 'housing', 'tenancy', 'rent', 'deposit'],
  'medical-emergency': ['medical', 'hospital', 'patient', 'health', 'emergency', 'doctor', 'corpse', 'stabilization'],
  'women-safety': ['women', 'domestic', 'pwdva', 'sunset', 'zero fir', 'female'],
  'consumer-refund': ['consumer', 'ecommerce', 'refund', 'defective', 'e-daakhil'],
  'ecommerce-refund': ['ecommerce', 'consumer', 'refund', 'defective', 'dark patterns'],
  'flight-delay': ['flight', 'airline', 'airport', 'dgca', 'aviation', 'passenger'],
  'workplace-harassment': ['workplace', 'harassment', 'posh', 'icc', 'employer']
};

@Component({
  selector: 'app-rights-crisis-view',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective, ShareMenuComponent],
  templateUrl: './rights-crisis-view.component.html',
  styleUrls: ['./rights-crisis-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightsCrisisViewComponent {
  private destroyRef = inject(DestroyRef);
  private reportService = inject(ModerationReportService);
  private proposalService = inject(RightProposalService);

  // Modern Angular 17.3+ Signal Inputs: 100% Reactive & Deterministic
  rights = input.required<StatutoryRight[]>();
  scenarios = input<EmergencyScenario[]>([]);
  currentLanguage = input<'en' | 'hi'>('en');
  isSpeaking = input<boolean>(false);
  speakingRightId = input<string | null>(null);

  @Output() speak = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() stopSpeech = new EventEmitter<void>();
  @Output() flashPass = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() share = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() copyScript = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() copyCitation = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() openDiagnostic = new EventEmitter<string | undefined>();
  @Output() openDetail = new EventEmitter<{ right: StatutoryRight; event: Event }>();

  // Single-Source-of-Truth Scenario Filter within Crisis Mode
  activeScenarioFilter = signal<string>('all');

  // Local state for interactive tactile feedback
  copiedScriptId = signal<string | null>(null);
  copiedCitationId = signal<string | null>(null);
  copiedCyberComplaint = signal<boolean>(false);
  cardLanguageOverrides = signal<Record<string, 'en' | 'hi'>>({});
  expandedDosDonts = signal<Record<string, boolean>>({});

  // Progressive disclosure ("Load More") state: 5 items for mobile, 10 for desktop
  isMobileView = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  get pageSize(): number {
    return this.isMobileView() ? 5 : 10;
  }

  visibleCount = signal<number>(typeof window !== 'undefined' && window.innerWidth < 1024 ? 5 : 10);

  // Scenario list scroll state & visual affordance telemetry
  scenarioScrollProgress = signal<number>(0);
  scenarioCanScrollUp = signal<boolean>(false);
  scenarioCanScrollDown = signal<boolean>(true);

  constructor() {
    // 200% Performance: High-performance matchMedia listener with zero layout thrashing
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      const mql = window.matchMedia('(max-width: 1023px)');
      this.isMobileView.set(mql.matches);
      this.visibleCount.set(mql.matches ? 5 : 10);

      const listener = (e: MediaQueryListEvent) => {
        this.isMobileView.set(e.matches);
        if (this.visibleCount() <= 10) {
          this.visibleCount.set(e.matches ? 5 : 10);
        }
      };

      mql.addEventListener('change', listener);
      this.destroyRef.onDestroy(() => {
        mql.removeEventListener('change', listener);
      });
    }
  }

  matchesScenario(r: StatutoryRight, scenarioTag: string, customKeywords?: string[]): boolean {
    if (!scenarioTag || scenarioTag === 'all') return true;

    const rTag = (r.scenarioTag || '').toLowerCase();
    const aliases = SCENARIO_TAG_ALIASES[scenarioTag] || [scenarioTag];
    if (aliases.includes(rTag)) {
      if (scenarioTag === 'women-safety' && (r.id.includes('senior') || r.id.includes('dog'))) {
        return false;
      }
      return true;
    }

    const keywords = (customKeywords && customKeywords.length > 0)
      ? customKeywords.map(k => k.toLowerCase())
      : (SCENARIO_KEYWORDS[scenarioTag] || []);

    if (keywords.length === 0) {
      return rTag === scenarioTag;
    }

    const id = (r.id || '').toLowerCase();
    const cat = (r.category || '').toLowerCase();
    const corpus = `${rTag} ${id} ${cat}`;

    if (scenarioTag === 'police-stop' && (id.includes('hospital') || rTag.includes('traffic'))) return false;
    if (scenarioTag === 'flight-delay' && id.includes('towing')) return false;
    if ((scenarioTag === 'consumer-refund' || scenarioTag === 'ecommerce-refund') && id.includes('tenant')) return false;
    if (scenarioTag === 'women-safety' && (id.includes('senior') || id.includes('dog'))) return false;

    return keywords.some(kw => corpus.includes(kw));
  }

  // Scenario tabs: dynamically sourced from backend via input() scenarios
  // Prepends the "All Emergencies" meta-tab automatically and deduplicates legacy tags
  scenarioTabs = computed((): EmergencyScenario[] => {
    const allTab: EmergencyScenario = {
      tag: 'all',
      label: 'All Emergencies',
      label_hi: 'सभी आपात स्थितियां',
      icon: 'zap' as IconName,
      color: 'rose',
      description: 'Universal Crisis Defense',
      description_hi: 'सार्वभौमिक संकट सुरक्षा',
      subtext: 'Universal Crisis Defense',
      subtext_hi: 'सार्वभौमिक संकट सुरक्षा',
      badge: 'All Urgent'
    };

    const active = (this.scenarios() || [])
      .filter(s => s.isActive !== false)
      .filter((s, _, arr) => {
        // If both consumer-refund and ecommerce-refund exist, prefer consumer-refund
        if (s.tag === 'ecommerce-refund' && arr.some(other => other.tag === 'consumer-refund')) {
          return false;
        }
        return true;
      });

    return [allTab, ...active];
  });

  // Dynamic live count calculations for each scenario tab using pure Signals dependency
  scenarioCounts = computed(() => {
    const list = this.rights();
    const tabs = this.scenarioTabs();
    const counts: Record<string, number> = {};

    counts['all'] = list.length;

    for (const tab of tabs) {
      if (tab.tag === 'all') continue;
      counts[tab.tag] = list.filter(r => this.matchesScenario(r, tab.tag, tab.filterKeywords)).length;
    }

    return counts;
  });

  // Filtered crisis rights strictly responsive to scenario selection using pure Signals dependency
  filteredCrisisRights = computed(() => {
    const list = this.rights();
    const filter = this.activeScenarioFilter();
    if (filter === 'all') return list;

    const activeTab = this.scenarioTabs().find(t => t.tag === filter);
    return list.filter(r => this.matchesScenario(r, filter, activeTab?.filterKeywords));
  });

  // Displayed subset for progressive disclosure
  displayedCrisisRights = computed(() => {
    const list = this.filteredCrisisRights();
    return list.slice(0, this.visibleCount());
  });

  // Remaining count for the "Show More" button
  remainingCount = computed(() => {
    const total = this.filteredCrisisRights().length;
    return Math.max(0, total - this.visibleCount());
  });

  // Next batch count (5 for mobile, 10 for desktop, or remaining if fewer)
  nextBatchCount = computed(() => {
    return Math.min(this.pageSize, this.remainingCount());
  });

  // Determines if the Cyber Fraud 1930 Golden Hour strip should be prominently displayed
  isCyberScenarioActive = computed(() => {
    const filter = this.activeScenarioFilter();
    return filter === 'cyber-scam' || filter === 'cyber-fraud' || filter === 'banking-freeze';
  });

  setScenarioFilter(id: string): void {
    this.activeScenarioFilter.set(id);
    this.visibleCount.set(this.pageSize);
  }

  onScenarioListScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el) return;
    this.updateScenarioScrollState(el);
  }

  private updateScenarioScrollState(el: HTMLElement): void {
    const maxScroll = el.scrollHeight - el.clientHeight;
    const canUp = el.scrollTop > 6;
    const canDown = maxScroll > 0 && el.scrollTop < maxScroll - 6;
    this.scenarioCanScrollUp.set(canUp);
    this.scenarioCanScrollDown.set(canDown);
    const progress = maxScroll > 0 ? (el.scrollTop / maxScroll) * 100 : 0;
    this.scenarioScrollProgress.set(Math.min(100, Math.max(0, progress)));
  }

  scrollScenarioList(el: HTMLElement, direction: 'up' | 'down'): void {
    if (!el) return;
    const delta = direction === 'up' ? -150 : 150;
    el.scrollBy({ top: delta, behavior: 'smooth' });
    setTimeout(() => this.updateScenarioScrollState(el), 200);
  }

  toggleScenarioListScroll(el: HTMLElement): void {
    if (!el) return;
    if (this.scenarioCanScrollDown()) {
      this.scrollScenarioList(el, 'down');
    } else {
      el.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => this.updateScenarioScrollState(el), 200);
    }
  }

  showMore(): void {
    this.visibleCount.update(c => c + this.pageSize);
  }

  showAll(): void {
    this.visibleCount.set(this.filteredCrisisRights().length);
  }

  onSpeak(right: StatutoryRight, event: Event): void {
    this.speak.emit({ right, event });
  }

  onStealthSilence(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.stopSpeech.emit();
  }

  onFlashPass(right: StatutoryRight, event: Event): void {
    this.flashPass.emit({ right, event });
  }

  onShare(right: StatutoryRight, event: Event): void {
    this.share.emit({ right, event });
  }

  getShareUrl(right: StatutoryRight): string {
    return getRightShareUrl(right?.id);
  }

  getShareSubject(right: StatutoryRight): string {
    const lang = this.getEffectiveLanguage(right.id);
    return getRightShareSubject(right, lang);
  }

  getShareText(right: StatutoryRight): string {
    const lang = this.getEffectiveLanguage(right.id);
    return getRightShareText(right, lang, { includeDirective: true });
  }

  getCitationText(right: StatutoryRight): string {
    return getRightCitationText(right, true);
  }

  getCitationSuccessMessage(right: StatutoryRight): string {
    return getCitationSuccessMessage(right);
  }

  onCopyScript(right: StatutoryRight, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const script = this.getWhatToSay(right);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(script).then(() => {
        this.copiedScriptId.set(right.id);
        setTimeout(() => this.copiedScriptId.set(null), 2200);
      }).catch(() => { });
    }
    this.copyScript.emit({ right, event });
  }

  onCopyCitation(right: StatutoryRight, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const citation = this.getCitation(right);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(citation).then(() => {
        this.copiedCitationId.set(right.id);
        setTimeout(() => this.copiedCitationId.set(null), 2200);
      }).catch(() => { });
    }
    this.copyCitation.emit({ right, event });
  }

  onOpenDiagnostic(crisisId?: string): void {
    this.openDiagnostic.emit(crisisId);
  }

  onOpenDetail(right: StatutoryRight, event: Event): void {
    this.openDetail.emit({ right, event });
  }

  hasReported(rightId: string): boolean {
    return this.reportService.hasReported('StatutoryRight', rightId);
  }

  getReport(rightId: string) {
    return this.reportService.getReport('StatutoryRight', rightId);
  }

  onSuggestCorrection(right: StatutoryRight, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const title = `${this.getTitle(right)} (${right.statutoryBasis?.shortAct || right.statutoryBasis?.actName})`;
    this.reportService.openReport('StatutoryRight', right.id, title);
  }

  onProposeNewRight(): void {
    const scenario = this.activeScenarioFilter();
    const tab = this.scenarioTabs().find(t => t.tag === scenario);
    this.proposalService.openProposal(
      scenario && scenario !== 'all' ? { category: tab ? this.getScenarioLabel(tab) : scenario } : undefined
    );
  }

  toggleCardLanguage(rightId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const current = this.getEffectiveLanguage(rightId);
    const next = current === 'en' ? 'hi' : 'en';
    const existing = { ...this.cardLanguageOverrides() };
    existing[rightId] = next;
    this.cardLanguageOverrides.set(existing);
  }

  getEffectiveLanguage(rightId: string): 'en' | 'hi' {
    return this.cardLanguageOverrides()[rightId] || this.currentLanguage();
  }

  isDosDontsExpanded(rightId: string): boolean {
    const state = this.expandedDosDonts()[rightId];
    if (state !== undefined) {
      return state;
    }
    // Mobile view: collapsed by default to keep cards sleek and compact; Desktop: expanded by default
    return !this.isMobileView();
  }

  toggleDosDonts(rightId: string): void {
    const current = this.isDosDontsExpanded(rightId);
    const existing = { ...this.expandedDosDonts() };
    existing[rightId] = !current;
    this.expandedDosDonts.set(existing);
  }

  getTitle(right: StatutoryRight): string {
    const lang = this.getEffectiveLanguage(right.id);
    return getRightTitle(right, lang);
  }

  getSummary(right: StatutoryRight): string {
    const lang = this.getEffectiveLanguage(right.id);
    return getRightSummary(right, lang);
  }

  getScenarioLabel(tab: EmergencyScenario): string {
    if (this.currentLanguage() === 'hi' && tab.label_hi) return tab.label_hi;
    return tab.label;
  }

  getScenarioSubtext(tab: EmergencyScenario): string {
    if (this.currentLanguage() === 'hi' && tab.subtext_hi) return tab.subtext_hi;
    return tab.subtext || tab.description;
  }

  getCitation(right: StatutoryRight): string {
    const act = right.statutoryBasis.shortAct || right.statutoryBasis.actName;
    const sec = (right.statutoryBasis.sections || []).join(', ');
    const cases = (right.statutoryBasis.landmarkCases || []).length > 0
      ? ` | ${right.statutoryBasis.landmarkCases![0]}`
      : '';
    return `${act} ${sec ? `(§${sec})` : ''}${cases}`;
  }

  getWhatToSay(right: StatutoryRight): string {
    const lang = this.getEffectiveLanguage(right.id);
    return getRightWhatToSay(right, lang);
  }

  getDosAndDonts(right: StatutoryRight): { dos: string[]; donts: string[] } {
    const lang = this.getEffectiveLanguage(right.id);
    return getRightDosAndDonts(right, lang);
  }

  getDiagnosticCrisisId(right: StatutoryRight): string {
    if (right.scenarioTag) {
      return right.scenarioTag;
    }

    const id = (right.id || '').toLowerCase();
    const cat = (right.category || '').toLowerCase();
    const corpus = `${id} ${cat}`;

    for (const scenario of (this.scenarios() || [])) {
      const keywords = (scenario.filterKeywords || []).map(k => k.toLowerCase());
      if (keywords.some(kw => corpus.includes(kw))) {
        return scenario.tag;
      }
    }

    return 'police';
  }

  // ==================== CYBER FRAUD 1930 "GOLDEN HOUR" LOGIC ====================
  copyCyberComplaintDraft(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const nowStr = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const draft = `CYBER FINANCIAL FRAUD IMMEDIATE COMPLAINT (GOLDEN HOUR MANDATE):
- Complainant Name: [Your Name]
- Disputed Transaction Amount: ₹[Enter Disputed Amount]
- Transaction Reference / UTR Number: [Enter 12-Digit UTR/Txn ID]
- Date & Exact Time of Debit: ${nowStr}
- Debited Bank & Account No: [Your Bank Name, Last 4 Digits of A/C]
- Beneficiary Suspect UPI VPA / Account: [Suspect UPI/Account if known]
- Fraud Nature: [Unauthorized UPI Debit / APK Screen-Share / Phishing Link]

Reported under National Cyber Crime Reporting Portal (NCRP) & 24x7 Helpline 1930.
In accordance with RBI Customer Protection Directive (Circular DBR.No.Leg.BC.78/09.07.005/2017-18), zero liability applies on reporting within 72 hours.
Please initiate immediate inter-bank transaction freeze.`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(draft).then(() => {
        this.copiedCyberComplaint.set(true);
        setTimeout(() => this.copiedCyberComplaint.set(false), 2500);
      }).catch(() => { });
    }
  }

  trackByRightId(_index: number, right: StatutoryRight): string {
    return right.id;
  }

  trackByScenarioTab(_index: number, tab: EmergencyScenario): string {
    return tab.tag;
  }

  trackByIndex(index: number): number {
    return index;
  }
}