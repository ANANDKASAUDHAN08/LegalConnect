import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import {
  PracticeArea,
  LawyerPreview,
  ResolvedBareAct,
  LandmarkJudgmentPreview
} from '../../../../services/practice-areas.service';
import { CategoryColorTheme } from '../../specializations.component';
import { StatuteResolverService } from '../../../../services/statute-resolver.service';
import { FreeAidService } from '../../../../services/free-aid.service';

export type DrawerTab = 'overview' | 'acts' | 'cases' | 'lawyers' | 'journey';

export interface IDrawerContext {
  spec: PracticeArea | null;
  theme: CategoryColorTheme;
  isHindi: boolean;
  statuteResolver: StatuteResolverService;
  freeAidService: FreeAidService;

  // Signals
  viewerRole: WritableSignal<'lawyer' | 'client' | 'guest'>;
  jargonMode: WritableSignal<'simple' | 'legal'>;
  isFirstTimerDismissed: WritableSignal<boolean>;
  readMoreDesc: WritableSignal<boolean>;
  showHindiDesc: WritableSignal<boolean>;
  activeFaqIndex: WritableSignal<number | null>;
  showCostBreakdown: WritableSignal<boolean>;
  copiedCitationId: WritableSignal<string | null>;
  expandedHoldings: WritableSignal<Set<string>>;
  selectedAdvocatesForCompare: WritableSignal<LawyerPreview[]>;
  isCompareSheetOpen: WritableSignal<boolean>;
  advocateFilter: WritableSignal<'all' | 'local' | 'free'>;
  advocateSort: WritableSignal<'rating' | 'experience' | 'fee'>;
  advocatePage: WritableSignal<number>;
  serverLawyerPosition: WritableSignal<any>;
  demandIntelligence: WritableSignal<any>;
  activeMatter: WritableSignal<any>;
  checkedDocuments: WritableSignal<Set<string>>;
  showAlertModal: WritableSignal<boolean>;
  alertSubscribed: WritableSignal<boolean>;

  // Computed signals
  confidenceScore: Signal<number>;
  dataCompleteness: Signal<{ actsCount: number; casesCount: number; advocateCount: number; forumsCount: number }>;
  quickGlanceChips: Signal<string[]>;
  displayTagline: Signal<string>;
  displayDescription: Signal<string>;
  displayHindiDescription: Signal<string>;
  lawyerPosition: Signal<any>;
  availableAdvocatesCount: Signal<number>;
  freeConsultLawyers: Signal<LawyerPreview[]>;
  userCityShort: Signal<string>;
  relatedPracticeAreas: Signal<PracticeArea[]>;
  expectedTimelines: Signal<any[]>;
  headings: Signal<{
    scopeHeading: string;
    forumsHeading: string;
    casesHeading: string;
    journeyHeading: string;
    ratioLabel: string;
    lawyersHeading: string;
    checklistHeading: string;
    actsHeading?: string;
  }>;
  lawyersHeadingShort: Signal<string>;
  sortedAdvocates: Signal<LawyerPreview[]>;
  pagedAdvocates: Signal<LawyerPreview[]>;
  hasMoreAdvocates: Signal<boolean>;
  totalAdvocateCount: Signal<number>;
  localAdvocateCount: Signal<number>;
  freeAdvocateCount: Signal<number>;
  languagesList: Signal<string[]>;
  checklistProgress: Signal<{ checked: number; total: number; percent: number }>;

  isLawyer: Signal<boolean>;
  isClient: Signal<boolean>;
  isGuest: Signal<boolean>;

  // Methods
  setTab(tab: DrawerTab): void;
  toggleJargonMode(): void;
  toggleSpeech(text: string, key: string): void;
  isSpeakingItem(key: string): boolean;
  dismissFirstTimerCard(): void;
  onFindAdvocates(): void;
  handleSelectRelated(area: PracticeArea): void;
  getCourtTier(forum: string): { label: string; tier: string; badgeClass: string };
  printChecklist(): void;
  toggleDocumentCheck(doc: string): void;
  getBrowseLawsUrl(): string;
  onBrowseLaws(event: MouseEvent): void;
  openBareAct(act: ResolvedBareAct | string, event: MouseEvent): void;
  getActYear(act: ResolvedBareAct | string): string;
  getActUrl(act: ResolvedBareAct | string): string;
  copySectionRef(act: ResolvedBareAct): void;
  hasNote(key: string): boolean;
  openNoteEditor(key: string, title: string, category: 'statute' | 'case' | 'general'): void;
  shareItem?(text: string): void;
  toggleHolding(caseId: string): void;
  isHoldingExpanded(caseId: string): boolean;
  copyCitation(item: LandmarkJudgmentPreview, format?: 'standard' | 'formal'): void;
  copyToClipboard(text: string, successMsg?: string): void;
  setAdvocateFilter(filter: 'all' | 'local' | 'free'): void;
  setAdvocateSort(sort: 'rating' | 'experience' | 'fee'): void;
  loadMoreAdvocates(): void;
  isAdvocateInUserCity(advocate: LawyerPreview): boolean;
  isStrongMatch(advocate: LawyerPreview): boolean;
  formatLanguagesShort(langs?: string[]): string;
  handleConsult(advocate: LawyerPreview): void;
  toggleAdvocateCompare(advocate: LawyerPreview): void;
  isAdvocateSelectedForCompare(advocate: LawyerPreview): boolean;
  referLawyerViaWhatsApp(advocate: LawyerPreview): void;
  toggleFaq(index: number): void;
  trackByCity(_index: number, item: any): string;
  trackByString(_index: number, item: string): string;
  trackByNumber(_index: number, item: number): number;
  trackByIndex(_index: number): number;
  trackByActName(_index: number, item: any): string;
  trackByCaseId(_index: number, item: any): string;
  trackByAdvocateId(_index: number, item: any): string;
  trackByStepStage(_index: number, item: any): string;
  trackByFaq(_index: number, item: any): string;
  trackByTimeline(_index: number, item: any): string;
  trackByPracticeArea(_index: number, item: PracticeArea): string;
}

export const DRAWER_CONTEXT = new InjectionToken<IDrawerContext>('DRAWER_CONTEXT');