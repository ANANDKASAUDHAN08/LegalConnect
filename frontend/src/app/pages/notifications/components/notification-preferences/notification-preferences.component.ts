import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
  OnDestroy,
  OnInit,
  HostListener,
  inject,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../components/icon/icon.component';
import { IconName } from '../../../../components/icon/icon.types';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TimePickerComponent } from '../../../../components/time-picker/time-picker.component';
import { ConfirmDialogComponent } from '../../../../components/confirm-dialog/confirm-dialog.component';
import { formatTime12, isCurrentTimeInWindow } from '../../../../utils/time.util';
import {
  NotificationPreferences,
  ChannelDeliveryConfig,
  SoundProfile
} from '../../../../services/notification.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface CategoryConfig {
  key: keyof NotificationPreferences;
  label: string;
  desc: string;
  clientLabel?: string;
  clientDesc?: string;
  applicableRoles: Array<'Lawyer' | 'Client' | 'Corporate' | 'All'>;
  icon: IconName;
  badgeClass: string;
  iconColor: string;
  tag: string;
  frequency: string;
  triggers: string[];
  channelAdvice: string;
}

export interface DiffItem {
  category: string;
  detail: string;
  icon: IconName;
  isPositive: boolean;
  channelKey?: 'inApp' | 'email' | 'push' | 'whatsapp' | 'quietHours' | 'sound' | 'haptic';
}

export const PREFERENCES_CATEGORIES: CategoryConfig[] = [
  {
    key: 'legal',
    label: 'Bare Act Amendments & Gazette Notices',
    desc: 'Statute revisions, Parliamentary bills & central gazette notifications',
    clientLabel: 'Legal Rights & Statutory Bare Acts',
    clientDesc: 'Updates on consumer protection, cyber safety & basic rights',
    applicableRoles: ['Lawyer', 'Corporate', 'All', 'Client'],
    icon: 'scale',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    iconColor: '#6366f1',
    tag: 'Statutory',
    frequency: '1\u20132 alerts/week',
    triggers: [
      'Parliamentary gazettes published and officially notified',
      'Central bare acts & legislative amendments revised',
      'High Court statutory circulars & jurisdictional rules'
    ],
    channelAdvice: 'Email recommended for reading full gazette PDFs; Push for immediate headlines.'
  },
  {
    key: 'case',
    label: 'Court Dockets & Hearing Cause Lists',
    desc: 'Court hearings, courtroom listings & client consultation milestones',
    clientLabel: 'Court Hearing Dates & Case Status',
    clientDesc: 'Real-time alerts for your active court hearing dates and docket progress',
    applicableRoles: ['Lawyer', 'Client', 'Corporate', 'All'],
    icon: 'calendar',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    iconColor: '#3b82f6',
    tag: 'Hearings',
    frequency: 'Real-time on court listing',
    triggers: [
      'Daily bench cause lists & daily court rosters published',
      'Item call-overs, pass-overs & urgent hearing listings',
      'Hearing date adjournments & next listing schedules',
      'Docket document submissions & certified order uploads'
    ],
    channelAdvice: 'Push & WhatsApp highly recommended to prevent missed courtroom call-outs.'
  },
  {
    key: 'lawyer',
    label: 'Direct Messages & Client Consultations',
    desc: 'Confidential client legal inquiries, consultation chats & case files',
    clientLabel: 'Advocate Direct Chat & Advice Notes',
    clientDesc: 'Confidential direct messages and case advice from your verified advocate',
    applicableRoles: ['Lawyer', 'Client', 'Corporate', 'All'],
    icon: 'message-square',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    iconColor: '#a855f7',
    tag: 'Messages',
    frequency: 'Immediate on message',
    triggers: [
      'Direct client consultation requests & retainer proposals',
      'Advocate case notes & private client instructions',
      'Virtual hearing & secure video consultation links',
      'Document review feedback & contract markup notes'
    ],
    channelAdvice: 'In-App + WhatsApp ensures instant receipt for urgent legal counsel chats.'
  },
  {
    key: 'security',
    label: 'Security & Device Login Audits',
    desc: 'New IP logins, 2FA credentials & account security audit alerts',
    applicableRoles: ['Lawyer', 'Client', 'Corporate', 'All'],
    icon: 'shield',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    iconColor: '#f43f5e',
    tag: 'Security',
    frequency: 'Critical events only',
    triggers: [
      'Logins from unrecognized devices or foreign IPs',
      'Two-Factor Authentication (2FA) credentials altered',
      'Account password resets & security key updates'
    ],
    channelAdvice: 'Email + WhatsApp enabled by default for multi-factor account safety.'
  },
  {
    key: 'verification',
    label: 'Bar Council Credential Approvals',
    desc: 'State Bar Council verification, COP checks & advocate badge updates',
    applicableRoles: ['Lawyer'],
    icon: 'badge-check',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconColor: '#10b981',
    tag: 'BCI Audit',
    frequency: 'Milestone-based',
    triggers: [
      'State Bar Council enrollment verification approvals',
      'Certificate of Practice (COP) validations & periodic audits',
      'Verified advocate badge renewals & seniority status updates'
    ],
    channelAdvice: 'In-App & Email alert you as soon as credentials are reviewed by administrators.'
  },
  {
    key: 'review',
    label: 'Client Reviews & Practice Ratings',
    desc: 'Verified client reviews, ratings approval & feedback notifications',
    applicableRoles: ['Lawyer'],
    icon: 'star',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    iconColor: '#f59e0b',
    tag: 'Reviews',
    frequency: 'Weekly digest',
    triggers: [
      'New ratings submitted by verified litigants following consultation',
      'Litigant feedback testimonials approved for public profile',
      'Monthly practice satisfaction score summary'
    ],
    channelAdvice: 'In-App feed displays reviews without interrupting active court schedules.'
  },
  {
    key: 'profile',
    label: 'Identity Verification & e-KYC Audits',
    desc: 'Aadhaar/PAN compliance, KYC validation & court filing identity verification',
    clientLabel: 'Account Identity & e-KYC Verification',
    clientDesc: 'Validation status of your identity and documents for court submissions',
    applicableRoles: ['Client', 'Corporate'],
    icon: 'user',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    iconColor: '#14b8a6',
    tag: 'e-KYC',
    frequency: 'Milestone-based',
    triggers: [
      'Identity document validation results & e-KYC approvals',
      'Aadhaar / PAN compliance checks for legal representation',
      'Court e-filing litigant identity authorization updates'
    ],
    channelAdvice: 'Email provides audit trail for court documentation verification.'
  },
  {
    key: 'system',
    label: 'Platform Engine Releases & Uptime',
    desc: 'Platform feature updates, database sync & legal intelligence upgrades',
    applicableRoles: ['Lawyer', 'Client', 'Corporate', 'All'],
    icon: 'zap',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    iconColor: '#0ea5e9',
    tag: 'Platform',
    frequency: 'Bi-weekly updates',
    triggers: [
      'Scheduled legal database sync & court API connector updates',
      'Platform feature rollouts & legal research tool upgrades',
      'Security maintenance windows & infrastructure reliability'
    ],
    channelAdvice: 'In-App alerts inform of legal database updates without email inbox clutter.'
  }
];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  system: { inApp: true, email: true, push: false, whatsapp: false },
  legal: { inApp: true, email: true, push: true, whatsapp: true },
  case: { inApp: true, email: true, push: true, whatsapp: true },
  lawyer: { inApp: true, email: true, push: true, whatsapp: true },
  review: { inApp: true, email: false, push: false, whatsapp: false },
  profile: { inApp: true, email: true, push: false, whatsapp: false },
  security: { inApp: true, email: true, push: true, whatsapp: true },
  verification: { inApp: true, email: true, push: true, whatsapp: false },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '07:30',
    allowUrgent: true
  },
  soundProfile: 'gavel',
  soundVolume: 80,
  hapticFeedback: true,
  targetRole: 'All'
};

/**
 * Notification Preferences Modal & Bottom Sheet
 * 
 * Enterprise preferences workstation for LegalConnect. Manages role-adaptive channel matrix
 * (In-App, Email, Push, WhatsApp), quiet hours / Do-Not-Disturb schedules with emergency hearing bypass,
 * procedural courtroom audio chime synthesis, and WhatsApp Business API gateway routing.
 * 
 * Implemented with OnPush change detection, Angular 18 Signal inputs and computed derivations.
 */
@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective, TimePickerComponent, ConfirmDialogComponent],
  templateUrl: './notification-preferences.component.html',
  styleUrls: ['./notification-preferences.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationPreferencesComponent implements OnInit, OnDestroy {
  private snackbar = inject(SnackbarService);
  private http = inject(HttpClient);

  isOpen = input.required<boolean>();
  preferences = input.required<NotificationPreferences>();
  effectiveRole = input.required<'Lawyer' | 'Client'>();
  userPhone = input<string | undefined>();
  userEmail = input<string | undefined>();
  isSaving = input<boolean>(false);
  isLoading = input<boolean>(false);

  close = output<void>();
  save = output<NotificationPreferences>();
  requestPush = output<void>();
  sendTestAlert = output<void>();

  preferencesSection = signal<'categories' | 'quiet-hours' | 'sound' | 'whatsapp'>('categories');
  prefSearchDisplay = signal<string>('');
  prefSearchQuery = signal<string>('');
  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;
  tempPreferences = signal<NotificationPreferences>(structuredClone(DEFAULT_NOTIFICATION_PREFERENCES));
  preferencesCategories = PREFERENCES_CATEGORIES;

  readonly formatTime12 = formatTime12;
  activeTimePickerField = signal<'startTime' | 'endTime' | null>(null);

  // Global Confirm Dialog State
  isConfirmOpen = signal<boolean>(false);
  confirmTitle = signal<string>('');
  confirmMessage = signal<string>('');
  confirmType = signal<'danger' | 'warning' | 'info'>('warning');
  private onConfirmAction: (() => void) | null = null;

  private audioCtx: AudioContext | null = null;
  private touchStartY = 0;
  private touchCurrentY = 0;
  private isDraggingSheet = false;
  private previousActiveElement: HTMLElement | null = null;

  isDiffReviewOpen = signal<boolean>(true);
  lastSavedTimestamp = signal<string | null>(null);
  testingChannel = signal<'email' | 'whatsapp' | null>(null);
  expandedCategory = signal<string | null>(null);
  isSavedCelebration = signal<boolean>(false);

  filteredPreferenceCategories = computed(() => {
    const role = this.effectiveRole();
    const q = this.prefSearchQuery().toLowerCase().trim();

    let list = this.preferencesCategories.filter(cat =>
      cat.applicableRoles.includes(role) || cat.applicableRoles.includes('All')
    );

    if (q) {
      list = list.filter(cat => {
        const label = (role === 'Client' && cat.clientLabel ? cat.clientLabel : cat.label).toLowerCase();
        const desc = (role === 'Client' && cat.clientDesc ? cat.clientDesc : cat.desc).toLowerCase();
        return label.includes(q) || desc.includes(q) || cat.tag.toLowerCase().includes(q);
      });
    }

    return list;
  });

  getRoleDefaultConfig(role: 'Lawyer' | 'Client'): NotificationPreferences {
    if (role === 'Lawyer') {
      return {
        legal: { inApp: true, email: true, push: true, whatsapp: true },
        case: { inApp: true, email: true, push: true, whatsapp: true },
        lawyer: { inApp: true, email: true, push: true, whatsapp: true },
        security: { inApp: true, email: true, push: true, whatsapp: true },
        verification: { inApp: true, email: true, push: true, whatsapp: false },
        review: { inApp: true, email: false, push: false, whatsapp: false },
        profile: { inApp: true, email: true, push: false, whatsapp: false },
        system: { inApp: true, email: false, push: false, whatsapp: false },
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '07:30',
          allowUrgent: true
        },
        soundProfile: 'gavel',
        hapticFeedback: true,
        targetRole: 'Lawyer'
      };
    } else {
      return {
        case: { inApp: true, email: true, push: true, whatsapp: true },
        lawyer: { inApp: true, email: true, push: true, whatsapp: true },
        security: { inApp: true, email: true, push: true, whatsapp: true },
        profile: { inApp: true, email: true, push: false, whatsapp: false },
        legal: { inApp: true, email: false, push: false, whatsapp: false },
        review: { inApp: false, email: false, push: false, whatsapp: false },
        verification: { inApp: false, email: false, push: false, whatsapp: false },
        system: { inApp: true, email: false, push: false, whatsapp: false },
        quietHours: {
          enabled: true,
          startTime: '21:30',
          endTime: '08:00',
          allowUrgent: true
        },
        soundProfile: 'crystal',
        hapticFeedback: true,
        targetRole: 'Client'
      };
    }
  }

  isRoleDefaultApplied = computed<boolean>(() => {
    const current = this.tempPreferences() as any;
    const defaults = this.getRoleDefaultConfig(this.effectiveRole()) as any;
    const cats = this.filteredPreferenceCategories();

    for (const cat of cats) {
      const c = current[cat.key];
      const d = defaults[cat.key];
      if (!c || !d) return false;
      if (c.inApp !== d.inApp || c.email !== d.email || c.push !== d.push || c.whatsapp !== d.whatsapp) {
        return false;
      }
    }
    return true;
  });

  activePreset = computed<'all' | 'essential' | 'quiet' | 'default' | 'role-default' | 'custom'>(() => {
    if (this.isRoleDefaultApplied()) return 'role-default';
    const prefs = this.tempPreferences() as any;
    const cats = this.filteredPreferenceCategories();

    let allOn = true;
    let allQuiet = true;
    for (const cat of cats) {
      const c = prefs[cat.key] as ChannelDeliveryConfig | undefined;
      if (!c || !c.inApp || !c.email || !c.push || !c.whatsapp) allOn = false;
      if (!c || !c.inApp || c.email || c.push || c.whatsapp) allQuiet = false;
    }
    if (allOn) return 'all';
    if (allQuiet) return 'quiet';

    let isDefault = true;
    const def = DEFAULT_NOTIFICATION_PREFERENCES as any;
    for (const cat of cats) {
      const c = prefs[cat.key] as ChannelDeliveryConfig | undefined;
      const d = def[cat.key] as ChannelDeliveryConfig | undefined;
      if (!c || !d || c.inApp !== d.inApp || c.email !== d.email || c.push !== d.push || (c.whatsapp !== d.whatsapp)) {
        isDefault = false;
        break;
      }
    }
    if (isDefault) return 'default';

    return 'custom';
  });

  isQuietHoursActiveNow = computed<boolean>(() => {
    const qh = this.tempPreferences().quietHours;
    if (!qh || !qh.enabled) return false;
    return isCurrentTimeInWindow(qh.startTime || '22:00', qh.endTime || '07:30');
  });

  isDirty = computed(() =>
    JSON.stringify(this.tempPreferences()) !== JSON.stringify(this.preferences())
  );

  /**
   * Enterprise Diff Summary:
   * Inspects every category channel flag, Quiet Hours schedule, audio profile, and haptics,
   * returning an actionable list of pending modifications before saving.
   */
  diffSummary = computed(() => {
    const cur = this.tempPreferences() as any;
    const base = this.preferences() as any;
    const items: Array<DiffItem> = [];

    if (!cur || !base) return { totalCount: 0, items: [] };

    // Categories channel differences
    for (const cat of this.preferencesCategories) {
      const curCat = cur[cat.key] || {};
      const baseCat = base[cat.key] || {};
      const catLabel = this.effectiveRole() === 'Client' && cat.clientLabel ? cat.clientLabel : cat.label;

      const channels: Array<{ key: 'inApp' | 'email' | 'push' | 'whatsapp'; label: string; icon: IconName }> = [
        { key: 'inApp', label: 'In-App', icon: 'monitor' },
        { key: 'email', label: 'Email', icon: 'mail' },
        { key: 'push', label: 'Push', icon: 'smartphone' },
        { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' }
      ];

      for (const ch of channels) {
        if (Boolean(curCat[ch.key]) !== Boolean(baseCat[ch.key])) {
          const enabled = Boolean(curCat[ch.key]);
          items.push({
            category: catLabel,
            detail: `${ch.label} ${enabled ? 'Enabled' : 'Disabled'}`,
            icon: ch.icon,
            isPositive: enabled,
            channelKey: ch.key
          });
        }
      }
    }

    // Quiet Hours differences
    const curQh = cur.quietHours || {};
    const baseQh = base.quietHours || {};
    if (Boolean(curQh.enabled) !== Boolean(baseQh.enabled)) {
      items.push({
        category: 'Quiet Hours (DND)',
        detail: curQh.enabled ? 'Enabled' : 'Disabled',
        icon: 'moon',
        isPositive: Boolean(curQh.enabled),
        channelKey: 'quietHours'
      });
    }
    if (curQh.enabled && (curQh.startTime !== baseQh.startTime || curQh.endTime !== baseQh.endTime)) {
      items.push({
        category: 'Quiet Hours Schedule',
        detail: `${this.formatTime12(curQh.startTime || '22:00')} \u2013 ${this.formatTime12(curQh.endTime || '07:30')}`,
        icon: 'clock',
        isPositive: true,
        channelKey: 'quietHours'
      });
    }
    if (Boolean(curQh.allowUrgent) !== Boolean(baseQh.allowUrgent)) {
      items.push({
        category: 'Urgent Hearing Bypass',
        detail: curQh.allowUrgent ? 'Allowed' : 'Muted',
        icon: 'alert-circle',
        isPositive: Boolean(curQh.allowUrgent),
        channelKey: 'quietHours'
      });
    }

    // Sound Profile differences
    if (cur.soundProfile !== base.soundProfile) {
      items.push({
        category: 'Judicial Audio Chime',
        detail: `${(cur.soundProfile || 'gavel').toUpperCase()}`,
        icon: 'volume-2',
        isPositive: cur.soundProfile !== 'silent',
        channelKey: 'sound'
      });
    }

    // Volume level differences
    if (cur.soundVolume !== base.soundVolume && cur.soundVolume !== undefined) {
      items.push({
        category: 'Audio Chime Volume',
        detail: `${cur.soundVolume}%`,
        icon: cur.soundVolume === 0 ? 'volume-x' : 'volume-2',
        isPositive: cur.soundVolume > 0,
        channelKey: 'sound'
      });
    }

    // Haptics
    if (Boolean(cur.hapticFeedback) !== Boolean(base.hapticFeedback)) {
      items.push({
        category: 'Haptic Feedback',
        detail: cur.hapticFeedback ? 'Enabled' : 'Disabled',
        icon: 'smartphone',
        isPositive: Boolean(cur.hapticFeedback),
        channelKey: 'haptic'
      });
    }

    return { totalCount: items.length, items };
  });

  getDiffItemIconClass(item: DiffItem): string {
    if (!item.isPositive) return 'text-rose-500 dark:text-rose-400';
    switch (item.channelKey) {
      case 'inApp': return 'text-blue-500 dark:text-blue-400';
      case 'email': return 'text-purple-500 dark:text-purple-400';
      case 'push': return 'text-teal-500 dark:text-teal-400';
      case 'whatsapp': return 'text-[#25D366]';
      case 'quietHours': return 'text-indigo-500 dark:text-indigo-400';
      case 'sound': return 'text-amber-500 dark:text-amber-400';
      case 'haptic': return 'text-teal-500 dark:text-teal-400';
      default: return 'text-emerald-500 dark:text-emerald-400';
    }
  }

  getDiffItemDetailClass(item: DiffItem): string {
    if (!item.isPositive) return 'text-rose-600 dark:text-rose-400';
    switch (item.channelKey) {
      case 'inApp': return 'text-blue-600 dark:text-blue-400';
      case 'email': return 'text-purple-600 dark:text-purple-400';
      case 'push': return 'text-teal-600 dark:text-teal-400';
      case 'whatsapp': return 'text-[#16a34a] dark:text-[#25D366]';
      case 'quietHours': return 'text-indigo-600 dark:text-indigo-400';
      case 'sound': return 'text-amber-600 dark:text-amber-400';
      case 'haptic': return 'text-teal-600 dark:text-teal-400';
      default: return 'text-emerald-600 dark:text-emerald-400';
    }
  }

  getDiffItemContainerClass(item: DiffItem): string {
    if (!item.isPositive) {
      return 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200/80 dark:border-rose-900/50';
    }
    switch (item.channelKey) {
      case 'inApp':
        return 'bg-blue-50/60 dark:bg-blue-950/25 border-blue-200/70 dark:border-blue-900/40';
      case 'email':
        return 'bg-purple-50/60 dark:bg-purple-950/25 border-purple-200/70 dark:border-purple-900/40';
      case 'push':
        return 'bg-teal-50/60 dark:bg-teal-950/25 border-teal-200/70 dark:border-teal-900/40';
      case 'whatsapp':
        return 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200/70 dark:border-emerald-900/40';
      case 'quietHours':
        return 'bg-indigo-50/60 dark:bg-indigo-950/25 border-indigo-200/70 dark:border-indigo-900/40';
      case 'sound':
        return 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-200/70 dark:border-amber-800/40';
      case 'haptic':
        return 'bg-teal-50/60 dark:bg-teal-950/25 border-teal-200/70 dark:border-teal-900/40';
      default:
        return 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800';
    }
  }

  lastSavedDisplay = computed(() => {
    const ts = this.lastSavedTimestamp();
    if (!ts) return 'All changes saved';
    try {
      const date = new Date(ts);
      const isToday = new Date().toDateString() === date.toDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? `Saved today at ${timeStr}` : `Saved on ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return 'All changes saved';
    }
  });

  lastSavedDisplayShort = computed(() => {
    const ts = this.lastSavedTimestamp();
    if (!ts) return 'All saved';
    try {
      const date = new Date(ts);
      const isToday = new Date().toDateString() === date.toDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? `Saved ${timeStr}` : `Saved ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    } catch {
      return 'All saved';
    }
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        untracked(() => {
          this.previousActiveElement = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
          this.resetToInitialPreferences();
          setTimeout(() => {
            const firstInteractive = document.querySelector('.preferences-dialog-panel button:not([disabled])') as HTMLElement | null;
            firstInteractive?.focus();
          }, 80);
        });
      }
    });
  }

  ngOnInit() {
    this.resetToInitialPreferences();
    this.searchSub = this.searchSubject.pipe(
      debounceTime(200),
      distinctUntilChanged()
    ).subscribe(val => this.prefSearchQuery.set(val));
  }

  ngOnDestroy() {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => { });
      this.audioCtx = null;
    }
  }

  resetToInitialPreferences() {
    this.tempPreferences.set(structuredClone(this.preferences()));
    this.prefSearchDisplay.set('');
    this.prefSearchQuery.set('');
    this.isDiffReviewOpen.set(false);
    try {
      const saved = localStorage.getItem('lc_preferences_last_saved');
      if (saved) {
        this.lastSavedTimestamp.set(saved);
      }
    } catch { }
  }

  toggleDiffReview() {
    this.isDiffReviewOpen.update(v => !v);
  }

  discardAllChanges() {
    this.triggerConfirm(
      'Discard All Pending Modifications?',
      'Are you sure you want to revert all pending channel and rule modifications back to your saved preferences?',
      'warning',
      () => {
        this.resetToInitialPreferences();
        this.snackbar.show('Pending configuration changes discarded.', 'info');
      }
    );
  }

  onClose() {
    if (this.isDirty()) {
      this.triggerConfirm(
        'Discard Unsaved Preferences?',
        'You have unsaved changes to your notification preferences. Discarding will revert all modified channels and schedules.',
        'warning',
        () => {
          this.isDiffReviewOpen.set(false);
          this.close.emit();
          this.previousActiveElement?.focus();
        }
      );
      return;
    }
    this.isDiffReviewOpen.set(false);
    this.close.emit();
    this.previousActiveElement?.focus();
  }

  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle.set(title);
    this.confirmMessage.set(message);
    this.confirmType.set(type);
    this.onConfirmAction = action;
    this.isConfirmOpen.set(true);
  }

  onConfirmDialog() {
    this.isConfirmOpen.set(false);
    if (this.onConfirmAction) {
      this.onConfirmAction();
      this.onConfirmAction = null;
    }
  }

  onCancelDialog() {
    this.isConfirmOpen.set(false);
    this.onConfirmAction = null;
  }

  onPrefSearchInput(value: string) {
    this.prefSearchDisplay.set(value);
    this.searchSubject.next(value);
  }

  clearPrefSearch() {
    this.prefSearchDisplay.set('');
    this.prefSearchQuery.set('');
    this.searchSubject.next('');
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    if (this.activeTimePickerField()) {
      this.closeTimePicker();
      return;
    }
    if (this.isDiffReviewOpen()) {
      this.isDiffReviewOpen.set(false);
      return;
    }
    if (this.isOpen()) {
      this.onClose();
    }
  }

  /**
   * Enterprise Focus Trap (WCAG 2.1 AA Compliant):
   * Restricts Tab navigation exclusively inside the preferences modal panel while open.
   */
  @HostListener('document:keydown.tab', ['$event'])
  handleTabFocusTrap(event: KeyboardEvent) {
    if (!this.isOpen()) return;

    const modalEl = document.querySelector('.preferences-dialog-panel') as HTMLElement | null;
    if (!modalEl) return;

    const focusableSelectors = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(modalEl.querySelectorAll<HTMLElement>(focusableSelectors))
      .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled'));

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  // ==================== MOBILE GESTURE (BOUND EXCLUSIVELY TO GRAB HANDLE) ====================

  onHandleTouchStart(event: TouchEvent) {
    if (event.touches.length > 0) {
      this.touchStartY = event.touches[0].clientY;
      this.touchCurrentY = this.touchStartY;
      this.isDraggingSheet = true;
    }
  }

  onHandleTouchMove(event: TouchEvent) {
    if (!this.isDraggingSheet || event.touches.length === 0) return;
    this.touchCurrentY = event.touches[0].clientY;
  }

  onHandleTouchEnd() {
    if (!this.isDraggingSheet) return;
    const deltaY = this.touchCurrentY - this.touchStartY;
    this.isDraggingSheet = false;
    if (deltaY > 60) {
      this.onClose();
    }
  }

  // ==================== MASTER CHANNELS & PRESETS ====================

  getChannelActiveCount(channel: 'inApp' | 'email' | 'push' | 'whatsapp'): number {
    const prefs = this.tempPreferences() as any;
    const cats = this.filteredPreferenceCategories();
    let count = 0;
    for (const cat of cats) {
      if (prefs[cat.key] && prefs[cat.key][channel]) {
        count++;
      }
    }
    return count;
  }

  isMasterChannelActive(channel: 'inApp' | 'email' | 'push' | 'whatsapp'): boolean {
    const cats = this.filteredPreferenceCategories();
    if (cats.length === 0) return false;
    return this.getChannelActiveCount(channel) === cats.length;
  }

  isChannelAnyActive(channel: 'inApp' | 'email' | 'push' | 'whatsapp'): boolean {
    return this.getChannelActiveCount(channel) > 0;
  }

  setAllCategoriesForChannel(channel: 'inApp' | 'email' | 'push' | 'whatsapp', enable: boolean) {
    const current = this.tempPreferences() as any;
    const updated = { ...current };
    const roleCats = this.preferencesCategories.filter(cat =>
      cat.applicableRoles.includes(this.effectiveRole()) || cat.applicableRoles.includes('All')
    );
    for (const cat of roleCats) {
      updated[cat.key] = {
        ...(updated[cat.key] || {}),
        [channel]: enable
      };
    }
    this.tempPreferences.set(updated);

    if (channel === 'push' && enable) {
      this.requestPush.emit();
    }
    this.isDiffReviewOpen.set(true);
  }

  toggleMasterChannel(channel: 'inApp' | 'email' | 'push' | 'whatsapp') {
    const shouldEnable = !this.isMasterChannelActive(channel);
    const current = this.tempPreferences() as any;
    const updated = { ...current };
    // Master channel toggle applies to all role-applicable categories to prevent search-masking bugs
    const roleCats = this.preferencesCategories.filter(cat =>
      cat.applicableRoles.includes(this.effectiveRole()) || cat.applicableRoles.includes('All')
    );
    for (const cat of roleCats) {
      updated[cat.key] = {
        ...(updated[cat.key] || {}),
        [channel]: shouldEnable
      };
    }
    this.tempPreferences.set(updated);

    if (channel === 'push' && shouldEnable) {
      this.requestPush.emit();
    }
    this.isDiffReviewOpen.set(true);
  }

  getPref(category: string, channel: 'inApp' | 'email' | 'push' | 'whatsapp'): boolean {
    const prefs = this.tempPreferences() as any;
    return prefs && prefs[category] ? !!prefs[category][channel] : false;
  }

  togglePref(category: keyof NotificationPreferences, channel: 'inApp' | 'email' | 'push' | 'whatsapp') {
    const current = this.tempPreferences();
    const catObj = (current[category] as any) || {};
    const willEnable = !catObj[channel];
    const updated = {
      ...current,
      [category]: {
        ...catObj,
        [channel]: willEnable
      }
    };
    this.tempPreferences.set(updated);
    this.isDiffReviewOpen.set(true);

    if (channel === 'push' && willEnable) {
      this.requestPush.emit();
    }
  }

  applyPreset(preset: 'all' | 'essential' | 'quiet' | 'default' | 'role-default') {
    const role = this.effectiveRole();
    if (preset === 'role-default') {
      this.applyRoleDefaults(role);
      return;
    }

    if (preset === 'default') {
      this.tempPreferences.set(structuredClone(DEFAULT_NOTIFICATION_PREFERENCES));
      this.snackbar.show('Preferences reset to platform defaults.', 'info');
      return;
    }

    if (preset === 'all') {
      const current = this.tempPreferences() as any;
      const updated = { ...current };
      for (const cat of this.preferencesCategories) {
        updated[cat.key] = { inApp: true, email: true, push: true, whatsapp: true };
      }
      this.tempPreferences.set(updated);
      this.requestPush.emit();
      this.snackbar.show('All delivery channels enabled (In-App, Email, Push, WhatsApp).', 'info');
      return;
    }

    if (preset === 'quiet') {
      const current = this.tempPreferences() as any;
      const updated = { ...current };
      for (const cat of this.preferencesCategories) {
        updated[cat.key] = { inApp: true, email: false, push: false, whatsapp: false };
      }
      updated.quietHours = {
        ...(updated.quietHours || { startTime: '22:00', endTime: '07:30', allowUrgent: true }),
        enabled: true
      };
      this.tempPreferences.set(updated);
      this.snackbar.show('Quiet mode enabled: External channels muted & Quiet Hours enabled.', 'info');
      return;
    }

    if (preset === 'essential') {
      if (role === 'Lawyer') {
        this.tempPreferences.set({
          ...this.tempPreferences(),
          legal: { inApp: true, email: true, push: true, whatsapp: true },
          case: { inApp: true, email: true, push: true, whatsapp: true },
          lawyer: { inApp: true, email: true, push: true, whatsapp: true },
          security: { inApp: true, email: true, push: true, whatsapp: true },
          verification: { inApp: true, email: true, push: false, whatsapp: false },
          review: { inApp: true, email: false, push: false, whatsapp: false },
          profile: { inApp: true, email: true, push: false, whatsapp: false },
          system: { inApp: true, email: false, push: false, whatsapp: false }
        });
      } else {
        this.tempPreferences.set({
          ...this.tempPreferences(),
          case: { inApp: true, email: true, push: true, whatsapp: true },
          lawyer: { inApp: true, email: true, push: true, whatsapp: true },
          security: { inApp: true, email: true, push: true, whatsapp: true },
          profile: { inApp: true, email: true, push: false, whatsapp: false },
          legal: { inApp: true, email: false, push: false, whatsapp: false },
          review: { inApp: false, email: false, push: false, whatsapp: false },
          verification: { inApp: false, email: false, push: false, whatsapp: false },
          system: { inApp: true, email: false, push: false, whatsapp: false }
        });
      }
      this.requestPush.emit();
      this.snackbar.show(`Essential alerts activated for ${role === 'Lawyer' ? 'Advocate' : 'Client'}.`, 'info');
    }
  }

  applyRoleDefaults(role: 'Lawyer' | 'Client' = this.effectiveRole()) {
    const defaults = this.getRoleDefaultConfig(role);
    this.tempPreferences.set({
      ...this.tempPreferences(),
      ...defaults
    });
    if (role === 'Lawyer') {
      this.snackbar.show('Advocate Workstation intelligent defaults applied.', 'success');
    } else {
      this.snackbar.show('Client / Litigant intelligent defaults applied.', 'success');
    }
  }

  // ==================== QUIET HOURS (DND) ====================

  openTimePicker(field: 'startTime' | 'endTime') {
    this.activeTimePickerField.set(field);
  }

  closeTimePicker() {
    this.activeTimePickerField.set(null);
  }

  onTimePickerApply(time24: string) {
    const field = this.activeTimePickerField();
    if (!field) return;
    this.updateQuietHoursTime(field, time24);
    this.closeTimePicker();
    const formatted = formatTime12(time24);
    this.snackbar.show(`${field === 'startTime' ? 'Rest start' : 'Rest end'} time set to ${formatted}`, 'info');
  }

  toggleQuietHours(enabled?: boolean) {
    const current = this.tempPreferences();
    const qh = current.quietHours || { enabled: false, startTime: '22:00', endTime: '07:30', allowUrgent: true };
    const updated = enabled !== undefined ? enabled : !qh.enabled;
    this.tempPreferences.set({
      ...current,
      quietHours: {
        ...qh,
        enabled: updated
      }
    });
  }

  updateQuietHoursTime(field: 'startTime' | 'endTime', value: string) {
    const current = this.tempPreferences();
    const qh = current.quietHours || { enabled: false, startTime: '22:00', endTime: '07:30', allowUrgent: true };
    this.tempPreferences.set({
      ...current,
      quietHours: {
        ...qh,
        [field]: value
      }
    });
  }

  toggleQuietHoursUrgent(allow: boolean) {
    const current = this.tempPreferences();
    const qh = current.quietHours || { enabled: false, startTime: '22:00', endTime: '07:30', allowUrgent: true };
    this.tempPreferences.set({
      ...current,
      quietHours: {
        ...qh,
        allowUrgent: allow
      }
    });
  }

  setQuietHoursPreset(startTime: string, endTime: string) {
    const current = this.tempPreferences();
    const qh = current.quietHours || { enabled: true, startTime: '22:00', endTime: '07:30', allowUrgent: true };
    this.tempPreferences.set({
      ...current,
      quietHours: {
        ...qh,
        enabled: true,
        startTime,
        endTime
      }
    });
    this.snackbar.show(`Quiet hours set to ${this.formatTime12(startTime)} – ${this.formatTime12(endTime)}`, 'info');
  }

  isQuietHoursPresetActive(startTime: string, endTime: string): boolean {
    const qh = this.tempPreferences().quietHours;
    if (!qh || !qh.enabled) return false;
    return qh.startTime === startTime && qh.endTime === endTime;
  }

  // ==================== SINGLETON WEB AUDIO API SYNTHESIZER ====================

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  setSoundProfile(sound: SoundProfile) {
    const current = this.tempPreferences();
    this.tempPreferences.set({
      ...current,
      soundProfile: sound
    });
    this.isDiffReviewOpen.set(true);
    this.playSound(sound);
  }

  setSoundVolume(volume: number, playPreview = true) {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    const current = this.tempPreferences();
    this.tempPreferences.set({
      ...current,
      soundVolume: clamped
    });
    this.isDiffReviewOpen.set(true);
    if (playPreview && clamped > 0) {
      this.playSound();
    }
  }

  toggleHaptic(enabled?: boolean) {
    const current = this.tempPreferences();
    const val = enabled !== undefined ? enabled : !current.hapticFeedback;
    this.tempPreferences.set({
      ...current,
      hapticFeedback: val
    });
    this.isDiffReviewOpen.set(true);
    if (val && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  }

  playSound(sound: SoundProfile = this.tempPreferences().soundProfile || 'gavel') {
    if (sound === 'silent') return;
    const vol = this.tempPreferences().soundVolume !== undefined ? this.tempPreferences().soundVolume! : 80;
    if (vol <= 0) return;
    const volScale = Math.max(0.01, Math.min(1, vol / 100));

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      if (sound === 'gavel') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
        gain.gain.setValueAtTime(0.8 * volScale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);

        setTimeout(() => {
          try {
            if (!this.audioCtx) return;
            const c = this.audioCtx;
            const osc2 = c.createOscillator();
            const gain2 = c.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(95, c.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.12);
            gain2.gain.setValueAtTime(0.4 * volScale, c.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
            osc2.connect(gain2);
            gain2.connect(c.destination);
            osc2.start(c.currentTime);
            osc2.stop(c.currentTime + 0.16);
          } catch { }
        }, 110);
      } else if (sound === 'crystal') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        gain.gain.setValueAtTime(0.4 * volScale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (sound === 'bell') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.frequency.setValueAtTime(1046.5, now);
        osc2.frequency.setValueAtTime(1567.98, now);
        gain.gain.setValueAtTime(0.35 * volScale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.65);
        osc2.stop(now + 0.65);
      } else if (sound === 'pulse') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        gain.gain.setValueAtTime(0.5 * volScale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }

      if (this.tempPreferences().hapticFeedback && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
    } catch (err) {
      console.warn('Audio synthesis error:', err);
    }
  }

  // ==================== WHATSAPP & ACTIONS ====================

  getDisplayPhone(): string {
    return this.userPhone() || 'Not configured in profile';
  }

  getDisplayEmail(): string {
    return this.userEmail() || 'Not configured in profile';
  }

  getEmailChannelStatusTooltip(): string {
    const total = this.filteredPreferenceCategories().length;
    const count = this.getChannelActiveCount('email');
    if (this.isMasterChannelActive('email')) {
      return `All ${total} legal notification categories are actively routed to Email.`;
    }
    if (count > 0) {
      return `${count} of ${total} categories actively deliver via Email. Click the toggle switch to enable all or silence.`;
    }
    return `Email alerts are currently muted across all ${total} notification categories.`;
  }

  getWhatsAppChannelStatusTooltip(): string {
    const total = this.filteredPreferenceCategories().length;
    const count = this.getChannelActiveCount('whatsapp');
    if (this.isMasterChannelActive('whatsapp')) {
      return `All ${total} legal notification categories are actively routed to WhatsApp.`;
    }
    if (count > 0) {
      return `${count} of ${total} categories actively deliver via WhatsApp. Click the toggle switch to enable all or silence.`;
    }
    return `WhatsApp alerts are currently muted across all ${total} notification categories.`;
  }

  getEmailWhatsAppTabTooltip(): string {
    const emailCount = this.getChannelActiveCount('email');
    const waCount = this.getChannelActiveCount('whatsapp');
    const total = this.filteredPreferenceCategories().length;
    return `Direct Gateways: Email (${emailCount}/${total} active) & WhatsApp (${waCount}/${total} active)`;
  }

  sendWhatsAppTestSimulation() {
    this.testChannel('whatsapp');
  }

  sendEmailTest() {
    this.testChannel('email');
  }

  /**
   * Dispatches authentic live test alerts (WhatsApp or Email) through the backend service pipeline.
   */
  testChannel(channel: 'email' | 'whatsapp') {
    this.testingChannel.set(channel);
    this.http.post<any>('/api/notification-delivery/test-channel', { channel }).subscribe({
      next: (res) => {
        this.testingChannel.set(null);
        if (res.channel === 'whatsapp' && res.directUrl && res.isSimulated) {
          this.snackbar.show(
            `WhatsApp simulation generated for ${res.target}. Click to open web chat.`,
            'info',
            6000,
            'Open WhatsApp',
            () => window.open(res.directUrl, '_blank')
          );
        } else {
          this.snackbar.show(res.message || `Test ${channel} alert dispatched successfully!`, 'success');
        }
      },
      error: (err) => {
        this.testingChannel.set(null);
        const msg = err.error?.message || `Failed to dispatch test ${channel} alert.`;
        this.snackbar.show(msg, 'warning', 4500);
      }
    });
  }

  toggleCategoryExpand(key: string) {
    this.expandedCategory.update(cur => cur === key ? null : key);
  }

  /**
   * WCAG 2.1 AA Keyboard Accessibility Handler for Channel Chips:
   * Supports Enter/Space toggling and ArrowLeft/ArrowRight roving focus among sibling chips.
   */
  onChipKeydown(event: KeyboardEvent, categoryKey: keyof NotificationPreferences, channel: 'inApp' | 'email' | 'push' | 'whatsapp') {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.togglePref(categoryKey, channel);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const target = event.target as HTMLElement;
      const parent = target.parentElement;
      if (parent) {
        const chips = Array.from(parent.querySelectorAll<HTMLElement>('.pref-channel-chip'));
        const currentIndex = chips.indexOf(target);
        if (currentIndex !== -1) {
          event.preventDefault();
          const nextIndex = event.key === 'ArrowRight'
            ? (currentIndex + 1) % chips.length
            : (currentIndex - 1 + chips.length) % chips.length;
          chips[nextIndex]?.focus();
        }
      }
    }
  }

  onSave() {
    if (!this.isDirty()) {
      this.snackbar.show('No changes detected \u2014 preferences are already up to date.', 'info');
      this.close.emit();
      return;
    }
    this.isSavedCelebration.set(true);
    setTimeout(() => {
      this.save.emit(this.tempPreferences());
      setTimeout(() => this.isSavedCelebration.set(false), 900);
    }, 350);
  }

  trackCategoryKey(_index: number, cat: CategoryConfig): string {
    return cat.key;
  }

  trackTriggerItem(_index: number, item: string): string {
    return item;
  }
}