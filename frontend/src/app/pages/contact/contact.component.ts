import { Component, OnInit, OnDestroy, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SnackbarService } from '../../services/snackbar.service';
import { AuthService } from '../../services/auth.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { InfoApiService } from '../info/services/info-api.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { TicketCardComponent } from '../../components/ticket-card/ticket-card.component';

interface ContactForm {
  fullName: string;
  email: string;
  role: 'client' | 'advocate' | '';
  subject: string;
  message: string;
}

interface FaqItem {
  question: string;
  routerLink: string;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TooltipDirective, ConfirmDialogComponent, TicketCardComponent],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit, OnDestroy {
  now = Date.now();
  private timerInterval: any = null;
  form: ContactForm = {
    fullName: '',
    email: '',
    role: '',
    subject: 'General Inquiry',
    message: ''
  };

  isSubmitting = false;
  successTicketId: string | null = null;
  errorMessage: string | null = null;
  selectedAction: 'ticket' | 'callback' | 'grievance' = 'ticket';
  callbackRequested = false;
  isDropdownOpen = false;
  isRoleDropdownOpen = false;

  @ViewChild('roleDropdownRef') roleDropdownRef?: ElementRef;
  @ViewChild('subjectDropdownRef') subjectDropdownRef?: ElementRef;

  activeMode: 'send' | 'track' = 'send';
  trackQuery = '';

  clearTrackQuery() {
    this.trackQuery = '';
    this.trackError = null;
  }

  isTracking = false;
  trackedTickets: any[] = [];
  trackError: string | null = null;
  withdrawConfirmOpen = false;
  ticketToWithdraw: any = null;

  trackerFilter: 'all' | 'active' | 'withdrawn' = 'all';
  expandedNotesMap: { [ticketId: string]: boolean } = {};
  displayLimit = 5;

  get filteredTickets(): any[] {
    if (!this.trackedTickets) return [];
    if (this.trackerFilter === 'active') {
      return this.trackedTickets.filter(t => !t.status.includes('Withdrawn') && !t.status.includes('Resolved'));
    }
    if (this.trackerFilter === 'withdrawn') {
      return this.trackedTickets.filter(t => t.status.includes('Withdrawn') || t.status.includes('Resolved'));
    }
    return this.trackedTickets;
  }

  get visibleTickets(): any[] {
    return this.filteredTickets.slice(0, this.displayLimit);
  }

  get activeTicketCount(): number {
    return (this.trackedTickets || []).filter(t => !t.status.includes('Withdrawn') && !t.status.includes('Resolved')).length;
  }

  get withdrawnTicketCount(): number {
    return (this.trackedTickets || []).filter(t => t.status.includes('Withdrawn') || t.status.includes('Resolved')).length;
  }

  toggleNotes(ticketId: string) {
    this.expandedNotesMap[ticketId] = !this.expandedNotesMap[ticketId];
  }

  isNotesExpanded(ticketId: string): boolean {
    return !!this.expandedNotesMap[ticketId];
  }

  estimatesList = [
    {
      id: 'property',
      label: 'Property & Real Estate',
      icon: 'building',
      avgTimeline: '3 – 6 Months (District Court / RERA)',
      feeRange: '₹20,000 – ₹60,000',
      documents: ['Sale Deed / Agreement to Sell', 'Encumbrance Certificate', 'Aadhaar / PAN ID Proof'],
      slaDeskResponse: '< 4 Hours (Senior Review)'
    },
    {
      id: 'matrimonial',
      label: 'Family & Matrimonial',
      icon: 'scale',
      avgTimeline: '2 – 6 Months (Family Court / Mediation)',
      feeRange: '₹15,000 – ₹45,000',
      documents: ['Marriage Certificate', 'Address & ID Proof', 'Income / Tax Proof'],
      slaDeskResponse: '< 2 Hours (Private Conciliation)'
    },
    {
      id: 'criminal',
      label: 'Bail & Criminal Defense',
      icon: 'shield',
      avgTimeline: '24 Hours – 7 Days (Sessions Court)',
      feeRange: '₹10,000 – ₹35,000',
      documents: ['FIR Copy / Notice Copy', 'Surety ID Documents', 'Proof of Residence'],
      slaDeskResponse: '< 1 Hour (Urgent Duty Counsel)'
    },
    {
      id: 'consumer',
      label: 'Cheque Bounce & Consumer',
      icon: 'card',
      avgTimeline: '1 – 3 Months (Consumer Commission)',
      feeRange: '₹8,000 – ₹25,000',
      documents: ['Bounced Cheque Copy', 'Bank Return Memo', 'Legal Notice Slip'],
      slaDeskResponse: '< 4 Hours (Drafting Support)'
    }
  ];

  selectedEstimateId = 'property';

  get selectedEstimate() {
    return this.estimatesList.find(e => e.id === this.selectedEstimateId) || this.estimatesList[0];
  }

  get defaultDisplayLimit(): number {
    return (typeof window !== 'undefined' && window.innerWidth < 640) ? 3 : 6;
  }

  get isMobileView(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 640;
  }

  get remainingTicketCount(): number {
    return Math.max(0, this.filteredTickets.length - this.displayLimit);
  }

  isFilterLoading = false;
  private filterTimeout: any = null;

  setFilter(filter: 'all' | 'active' | 'withdrawn') {
    if (this.trackerFilter === filter) return;
    this.trackerFilter = filter;
    this.triggerFilterSkeleton();
  }

  triggerFilterSkeleton() {
    this.isFilterLoading = true;
    if (this.filterTimeout) clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => {
      this.isFilterLoading = false;
    }, 280);
  }

  scrollToNewCard(targetIndex: number) {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      const el = document.getElementById(`ticket-card-${targetIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }

  loadMoreTickets() {
    const prevCount = this.visibleTickets.length;
    const isMobile = this.isMobileView;
    const step = isMobile ? 3 : 6;
    const remaining = this.remainingTicketCount;
    if (remaining <= step * 2) {
      this.displayLimit = this.filteredTickets.length;
    } else {
      this.displayLimit += step;
    }
    this.triggerFilterSkeleton();
    this.scrollToNewCard(prevCount);
  }

  showAllTickets() {
    const prevCount = this.visibleTickets.length;
    this.displayLimit = this.filteredTickets.length;
    this.triggerFilterSkeleton();
    this.scrollToNewCard(prevCount);
  }

  showLessTickets() {
    this.displayLimit = this.defaultDisplayLimit;
    this.triggerFilterSkeleton();
    this.scrollToHistory();
  }

  emailTouched = false;

  get isEmailInvalid(): boolean {
    const val = this.form.email.trim();
    if (!val) {
      return this.emailTouched;
    }
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return !emailPattern.test(val);
  }

  get isFormValid(): boolean {
    const nameValid = this.form.fullName.trim().length >= 2;
    const emailValid = !this.isEmailInvalid && this.form.email.trim().length > 0;
    const roleValid = !!this.form.role;
    const subjectValid = !!this.form.subject;

    if (this.selectedAction === 'callback') {
      return nameValid && emailValid && roleValid && subjectValid;
    }

    const messageValid = this.form.message.trim().length >= 10;
    return nameValid && emailValid && roleValid && subjectValid && messageValid;
  }

  get isTrackQueryValid(): boolean {
    const q = this.trackQuery.trim();
    if (!q) return false;
    if (q.includes('@')) {
      return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(q);
    }
    return q.length >= 4;
  }

  toggleRoleDropdown() {
    this.isRoleDropdownOpen = !this.isRoleDropdownOpen;
    if (this.isRoleDropdownOpen) {
      this.isDropdownOpen = false;
    }
  }

  selectRole(value: 'client' | 'advocate') {
    this.form.role = value;
    this.isRoleDropdownOpen = false;
  }

  get currentRoleLabel(): string {
    if (this.form.role === 'client') return 'Client Seeking Legal Help';
    if (this.form.role === 'advocate') return 'Practicing Advocate';
    return 'Select your role...';
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.isRoleDropdownOpen = false;
    }
  }

  selectSubject(value: string) {
    this.form.subject = value;
    this.isDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Node;
    if (this.roleDropdownRef && !this.roleDropdownRef.nativeElement.contains(target)) {
      this.isRoleDropdownOpen = false;
    }
    if (this.subjectDropdownRef && !this.subjectDropdownRef.nativeElement.contains(target)) {
      this.isDropdownOpen = false;
    }
    if (this.dropdownRef && !this.dropdownRef.nativeElement.contains(target)) {
      this.isDropdownOpen = false;
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 640;
      if (isMobile && this.displayLimit === 6) {
        this.displayLimit = 3;
      } else if (!isMobile && this.displayLimit < 6) {
        this.displayLimit = 6;
      }
    }
  }

  requestTypes = [
    { id: 'ticket' as const, label: 'Support Ticket' },
    { id: 'callback' as const, label: 'Request Callback' },
    { id: 'grievance' as const, label: 'Statutory Grievance' }
  ];

  roles: { value: 'client' | 'advocate'; label: string }[] = [
    { value: 'client', label: 'Client seeking legal help' },
    { value: 'advocate', label: 'Registered Advocate' }
  ];

  subjectsByAction: Record<string, { value: string; label: string }[]> = {
    ticket: [
      { value: 'General Inquiry', label: 'General Inquiry' },
      { value: 'Technical Support', label: 'Technical Support / Bug Report' },
      { value: 'Account Issue', label: 'Account Access / Login Issue' },
      { value: 'Lawyer Verification', label: 'Lawyer Listing Verification' },
      { value: 'Billing', label: 'Billing & Subscription' }
    ],
    callback: [
      { value: 'Demo Request', label: 'Platform Demo / Walkthrough' },
      { value: 'Onboarding Help', label: 'Advocate Onboarding Help' },
      { value: 'Enterprise', label: 'Enterprise / Firm Licensing' }
    ],
    grievance: [
      { value: 'Data Request', label: 'Personal Data Access / Deletion Request' },
      { value: 'Content Removal', label: 'Content Removal / Defamation' },
      { value: 'Privacy Violation', label: 'Privacy / Data Breach Report' },
      { value: 'Abuse Report', label: 'Abuse / Impersonation Report' },
      { value: 'Other Grievance', label: 'Other Statutory Grievance' }
    ]
  };



  faqItems: FaqItem[] = [
    { question: 'How do I verify my Bar Council license on the platform?', routerLink: '/help' },
    { question: 'How do I reset my account password?', routerLink: '/help' },
    { question: 'Where can I download my personal data dossier?', routerLink: '/privacy' },
    { question: 'Does LegalConnect charge advocates any commission?', routerLink: '/help' }
  ];

  get currentSubjects() {
    return this.subjectsByAction[this.selectedAction || 'ticket'] || this.subjectsByAction['ticket'];
  }

  get currentSubjectLabel() {
    const found = this.currentSubjects.find(s => s.value === this.form.subject);
    return found ? found.label : this.form.subject || 'Select subject...';
  }

  constructor(
    private snackbar: SnackbarService,
    private auth: AuthService,
    private infoApi: InfoApiService,
    private titleService: Title,
    private metaService: Meta,
    private elementRef: ElementRef
  ) { }

  @ViewChild('dropdownRef') dropdownRef?: ElementRef;

  ngOnInit() {
    this.titleService.setTitle('Contact Support & Grievance Desk — LegalConnect');
    this.metaService.updateTag({ name: 'description', content: 'Get help from LegalConnect support. Raise tickets, request callbacks, or file statutory grievances under the DPDP Act 2023.' });

    this.auth.currentUser$.subscribe(user => {
      if (user) {
        this.form.fullName = user.fullName;
        this.form.email = user.email;
        if (!this.trackQuery) {
          this.trackQuery = user.email;
        }
        this.autoFetchUserHistory(user.email);
      }
    });

    if (typeof window !== 'undefined') {
      this.displayLimit = window.innerWidth < 640 ? 3 : 6;
      this.timerInterval = setInterval(() => {
        this.now = Date.now();
      }, 1000);
    } else {
      this.displayLimit = 6;
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  selectAction(actionId: 'ticket' | 'callback' | 'grievance') {
    this.selectedAction = actionId;
    this.successTicketId = null;
    this.callbackRequested = false;
    // Reset subject to first option of the new action
    const subjects = this.subjectsByAction[actionId];
    if (subjects && subjects.length > 0) {
      this.form.subject = subjects[0].value;
    }
  }

  switchMode(mode: 'send' | 'track') {
    this.activeMode = mode;
    if (mode === 'track') {
      if (!this.trackQuery && this.form.email) {
        this.trackQuery = this.form.email;
      }
      if (this.trackQuery && this.trackedTickets.length === 0) {
        this.onTrackTicket();
      }
    }
  }

  private saveTicketToHistory(ticketId: string, payload: any) {
    if (typeof window === 'undefined') return;
    try {
      const email = payload.email || this.form.email || 'guest';
      const key = `legalconnect_history_${email.toLowerCase()}`;
      const existing = localStorage.getItem(key);
      const list: any[] = existing ? JSON.parse(existing) : [];

      const newRecord = {
        ticketId,
        name: payload.name,
        email: payload.email,
        subject: payload.subject,
        type: payload.type || 'ticket',
        status: payload.type === 'grievance' ? 'Acknowledged (DPO Desk)' : payload.type === 'callback' ? 'Scheduled' : 'Open',
        timestamp: new Date().toISOString(),
        slaTarget: payload.type === 'grievance' ? '15 Business Days (DPDP Act)' : payload.type === 'callback' ? '2 Hours' : '24 Hours'
      };

      list.unshift(newRecord);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 15)));
    } catch (e) {
      console.warn('Could not save ticket to local history', e);
    }
  }

  private autoFetchUserHistory(email: string) {
    if (!email) return;

    this.infoApi.trackTicket(email).subscribe({
      next: (res) => {
        let serverTickets = (res && res.success && res.tickets) ? res.tickets : [];

        // Combine with localStorage history if present
        if (typeof window !== 'undefined') {
          try {
            const key = `legalconnect_history_${email.toLowerCase()}`;
            const localSaved = localStorage.getItem(key);
            if (localSaved) {
              const localList: any[] = JSON.parse(localSaved);
              localList.forEach(localItem => {
                if (!serverTickets.some((s: any) => s.ticketId === localItem.ticketId)) {
                  serverTickets.push(localItem);
                }
              });
            }
          } catch (e) { }
        }

        if (serverTickets.length > 0) {
          this.trackedTickets = serverTickets;
        }
      }
    });
  }

  onSubmit() {
    const email = this.form.email.trim();
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!this.form.fullName.trim() || !email || !this.form.message.trim()) {
      this.snackbar.show('Please fill in all required fields.', 'warning');
      return;
    }

    if (!emailPattern.test(email)) {
      this.snackbar.show('Please enter a valid email address (e.g. user@domain.com).', 'warning');
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    this.successTicketId = null;

    const payload = {
      name: this.form.fullName,
      email: email,
      role: this.form.role,
      subject: this.form.subject,
      message: this.form.message,
      type: this.selectedAction || 'ticket'
    };

    this.infoApi.submitContactForm(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.successTicketId = res.ticketId;
        this.saveTicketToHistory(res.ticketId, payload);
        this.snackbar.show('Message submitted successfully!', 'success');
        this.form.message = '';
        this.form.role = '';
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Failed to send message. Please try again later.';
        this.snackbar.show(this.errorMessage!, 'error');
      }
    });
  }

  requestCallback() {
    const email = this.form.email.trim();
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!this.form.fullName.trim() || !email) {
      this.snackbar.show('Please provide your name and email for the callback.', 'warning');
      return;
    }

    if (!emailPattern.test(email)) {
      this.snackbar.show('Please enter a valid email address for the callback.', 'warning');
      return;
    }

    this.isSubmitting = true;

    const payload = {
      name: this.form.fullName,
      email: email,
      subject: this.form.subject || 'Callback Request',
      message: `Callback requested. Role: ${this.form.role || 'Not specified'}. Subject: ${this.form.subject}.`,
      type: 'callback'
    };

    this.infoApi.submitContactForm(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.callbackRequested = true;
        this.successTicketId = res.ticketId;
        this.saveTicketToHistory(res.ticketId, payload);
        this.snackbar.show('Callback request submitted! We will call you within 2 hours.', 'success');
      },
      error: () => {
        this.isSubmitting = false;
        this.callbackRequested = true;
        const generatedId = 'LC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        this.successTicketId = generatedId;
        this.saveTicketToHistory(generatedId, payload);
        this.snackbar.show('Callback request logged. We will reach out shortly.', 'success');
      }
    });
  }

  copyGrievanceEmail() {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText('grievance@legalconnect.com').then(() => {
      this.snackbar.show('Grievance officer email copied to clipboard!', 'success');
    }).catch(() => {
      this.snackbar.show('Failed to copy email.', 'error');
    });
  }

  resetForm() {
    this.successTicketId = null;
    this.callbackRequested = false;
    this.form.message = '';
    this.form.role = '';
  }

  onTrackTicket() {
    const query = this.trackQuery.trim();
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!query) {
      this.snackbar.show('Please enter a Ticket ID (e.g. LC-849201) or Email.', 'warning');
      return;
    }

    // Validate email format if tracking by email
    if (query.includes('@') && !emailPattern.test(query)) {
      this.snackbar.show('Please enter a valid email format (e.g. user@domain.com) or Ticket ID.', 'warning');
      return;
    }

    this.isTracking = true;
    this.trackError = null;
    const startTime = Date.now();

    this.infoApi.trackTicket(query).subscribe({
      next: (res) => {
        const elapsed = Date.now() - startTime;
        const delayTime = Math.max(0, 600 - elapsed);

        setTimeout(() => {
          this.isTracking = false;
          let serverTickets = (res && res.success && res.tickets) ? res.tickets : [];

          // Check local storage history for matching email/id
          if (typeof window !== 'undefined') {
            try {
              const queryLower = this.trackQuery.trim().toLowerCase();
              const key = `legalconnect_history_${queryLower}`;
              const localSaved = localStorage.getItem(key);
              if (localSaved) {
                const localList: any[] = JSON.parse(localSaved);
                localList.forEach(localItem => {
                  if (!serverTickets.some((s: any) => s.ticketId === localItem.ticketId)) {
                    serverTickets.push(localItem);
                  }
                });
              }
            } catch (e) { }
          }

          if (serverTickets.length > 0) {
            this.trackedTickets = serverTickets;
          } else {
            this.trackError = res.message || 'No active ticket or inquiry found for this ID/Email.';
          }
        }, delayTime);
      },
      error: (err) => {
        const elapsed = Date.now() - startTime;
        const delayTime = Math.max(0, 600 - elapsed);

        setTimeout(() => {
          this.isTracking = false;
          this.trackError = err.error?.message || 'Failed to fetch ticket status. Please check your query and try again.';
        }, delayTime);
      }
    });
  }

  quickTrack(id: string) {
    this.activeMode = 'track';
    this.trackQuery = id;
    this.onTrackTicket();
  }

  activeFollowUpTicketId: string | null = null;
  followUpText = '';
  isSubmittingFollowUp = false;

  getFollowUpStatus(ticket: any): { allowed: boolean; reason?: string; remainingSecs?: number; cooldownText?: string } {
    const notes: any[] = ticket.notes || [];
    if (notes.length >= 5) {
      return { allowed: false, reason: 'Maximum 5 follow-up notes reached.' };
    }

    if (notes.length > 0) {
      const lastNote = notes[notes.length - 1];
      const lastTime = new Date(lastNote.date || lastNote.timestamp).getTime();
      const elapsedSecs = Math.floor((this.now - lastTime) / 1000);
      const COOLDOWN_SECS = 120; // 2 minutes

      if (elapsedSecs < COOLDOWN_SECS) {
        const remainingSecs = COOLDOWN_SECS - elapsedSecs;
        const mins = Math.floor(remainingSecs / 60);
        const secs = remainingSecs % 60;
        const cooldownText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        return {
          allowed: false,
          reason: `Please wait ${cooldownText} before adding another note.`,
          remainingSecs,
          cooldownText
        };
      }
    }

    return { allowed: true };
  }

  toggleFollowUpInput(ticketId: string) {
    if (this.activeFollowUpTicketId === ticketId) {
      this.activeFollowUpTicketId = null;
    } else {
      this.activeFollowUpTicketId = ticketId;
      this.followUpText = '';
    }
  }

  private syncTicketToLocalHistory(ticket: any) {
    if (typeof window === 'undefined' || !ticket) return;
    try {
      const email = (ticket.email || this.form.email || 'guest').toLowerCase();
      const key = `legalconnect_history_${email}`;
      const existing = localStorage.getItem(key);
      let list: any[] = existing ? JSON.parse(existing) : [];

      const idx = list.findIndex(item => item.ticketId === ticket.ticketId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...ticket };
      } else {
        list.unshift(ticket);
      }

      localStorage.setItem(key, JSON.stringify(list.slice(0, 15)));
    } catch (e) {
      console.warn('Could not sync ticket to local history', e);
    }
  }

  handleFollowUpSubmit(event: { ticket: any; text: string }, cardComp?: any) {
    const { ticket, text } = event;

    this.infoApi.addFollowUpNote(ticket.ticketId, text).subscribe({
      next: (res) => {
        if (cardComp) cardComp.isSubmittingFollowUp = false;
        if (res && res.success) {
          if (!ticket.notes) ticket.notes = [];
          const addedNote = res.note || { text, date: new Date(), sender: 'user' };
          ticket.notes.push(addedNote);
          this.syncTicketToLocalHistory(ticket);
          this.snackbar.show('Follow-up note appended successfully!', 'success');
          if (cardComp) cardComp.resetFollowUp();
        } else {
          this.snackbar.show(res.message || 'Failed to post follow-up note.', 'warning');
        }
      },
      error: (err) => {
        if (cardComp) cardComp.isSubmittingFollowUp = false;
        const msg = err.error?.message || 'Failed to post follow-up note. Please try again.';
        this.snackbar.show(msg, 'error');
      }
    });
  }

  withdrawTicket(ticket: any) {
    if (!ticket || !ticket.ticketId) return;
    this.ticketToWithdraw = ticket;
    this.withdrawConfirmOpen = true;
  }

  cancelWithdrawal() {
    this.withdrawConfirmOpen = false;
    this.ticketToWithdraw = null;
  }

  confirmWithdrawal() {
    const ticket = this.ticketToWithdraw;
    this.withdrawConfirmOpen = false;
    if (!ticket || !ticket.ticketId) return;

    this.infoApi.withdrawTicket(ticket.ticketId).subscribe({
      next: (res) => {
        if (res && res.success) {
          ticket.status = 'Withdrawn by Applicant';
          if (!ticket.notes) ticket.notes = [];
          ticket.notes.push(res.auditNote || {
            text: 'Request withdrawn by applicant.',
            date: new Date(),
            sender: 'system'
          });
          this.syncTicketToLocalHistory(ticket);
          this.snackbar.show(`Request ${ticket.ticketId} has been successfully withdrawn.`, 'info');
        }
        this.ticketToWithdraw = null;
      },
      error: () => {
        this.snackbar.show('Failed to withdraw ticket. Please try again.', 'error');
        this.ticketToWithdraw = null;
      }
    });
  }

  scrollToHistory() {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('history-section');
      if (el) {
        const navbarOffset = window.innerWidth < 640 ? 50 : 60;
        const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - navbarOffset;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth'
        });
      }
    }
  }

  // ═══ 🚀 TRACKBY OPTIMIZATIONS FOR NG-FOR LOOPS ═══
  trackBySubjectValue(index: number, subject: { value: string; label: string }): string {
    return subject.value;
  }

  trackByEstimateId(index: number, estimate: any): string {
    return estimate.id;
  }

  trackByString(index: number, str: string): string {
    return str;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByTicketId(index: number, ticket: any): string {
    return ticket.ticketId;
  }

  trackByNoteTimestamp(index: number, note: any): string {
    return note.date || note.timestamp || index.toString();
  }
}