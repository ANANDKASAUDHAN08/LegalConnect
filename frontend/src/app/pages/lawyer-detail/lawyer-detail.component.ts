import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { LawyerService, Lawyer, Consultation } from '../../services/lawyer.service';
import { ReviewService, ReviewItem } from '../../services/review.service';
import { DraftService } from '../../services/draft.service';
import { SnackbarService } from '../../services/snackbar.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { BookmarkButtonComponent } from '../../components/bookmark-button/bookmark-button.component';
import { InteractiveLikeComponent } from '../../components/interactive-like/interactive-like.component';
import { ReportTriggerComponent } from '../../components/report-modal/report-trigger/report-trigger.component';
import { InteractionService } from '../../services/interaction.service';
import { UniversalBookmarkService } from '../../services/universal-bookmark.service';

import { VerificationService } from '../../services/verification.service';
import { IconComponent } from '../../components/icon/icon.component';
import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { getWebmailLauncher, WebmailProvider } from '../../core/utils/webmail-helper';

interface ContactForm {
  name: string;
  email: string;
  message: string;
  lawyerId: string;
}

interface ReviewForm {
  rating: number;
  content: string;
  authorName: string;
}

@Component({
  selector: 'app-lawyer-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BookmarkButtonComponent,
    InteractiveLikeComponent,
    ReportTriggerComponent,
    IconComponent,
    TooltipDirective,
    SpinnerComponent
  ],
  templateUrl: './lawyer-detail.component.html',
  styleUrls: ['./lawyer-detail.component.scss']
})
export class LawyerDetailComponent implements OnInit, OnDestroy {
  lawyerId = '';
  lawyer: Lawyer | null = null;
  reviews: ReviewItem[] = [];

  loading = true;
  loadingReviews = false;
  error = '';

  // Animated stats
  animatedExperience = 0;
  animatedCases = 0;
  animatedSuccessRate = 0;

  // Logged in user context
  currentUser: UserProfile | null = null;

  // Consultation Inquiry Modal State
  showInquiryModal = false;
  isSubmittingInquiry = false;
  contactForm: ContactForm = { name: '', email: '', message: '', lawyerId: '' };
  private autoSaveInterval: any;
  private readonly DRAFT_KEY = 'lawyer_detail_contact';

  // Review Form State
  reviewForm: ReviewForm = { rating: 5, content: '', authorName: '' };
  submittingReview = false;

  // Premium features state
  selectedDay = 'Monday';
  selectedSlot: any = null;
  uniqueDays: string[] = [];
  activeFaqIndex: number | null = null;

  // Image preview state
  previewImageUrl: string | null = null;
  previewIsBanner = false;

  // Pillar 5: Email Verification Gating Interlock
  showVerificationInterlockModal = false;
  interlockOtpCode = '';
  isVerifyingInterlockOtp = false;
  isResendingInterlock = false;
  interlockCooldown = 0;
  private interlockCooldownTimer: any = null;

  get interlockWebmail(): WebmailProvider | null {
    return getWebmailLauncher(this.currentUser?.email);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private lawyerService: LawyerService,
    private reviewService: ReviewService,
    private draft: DraftService,
    private snackbar: SnackbarService,
    private auth: AuthService,
    private interactionService: InteractionService,
    private bookmarkService: UniversalBookmarkService,
    private verificationService: VerificationService
  ) { }

  ngOnInit() {
    this.auth.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && !this.reviewForm.authorName) {
        this.reviewForm.authorName = user.fullName;
      }
    });

    this.route.params.subscribe(params => {
      this.lawyerId = params['id'];
      if (this.lawyerId) {
        this.loadLawyerData();
      }
    });
  }

  ngOnDestroy() {
    clearInterval(this.autoSaveInterval);
    if (this.interlockCooldownTimer) {
      clearInterval(this.interlockCooldownTimer);
      this.interlockCooldownTimer = null;
    }
    document.body.classList.remove('overflow-hidden');
  }

  loadLawyerData() {
    this.loading = true;
    this.error = '';
    this.lawyerService.getLawyerById(this.lawyerId).subscribe({
      next: (res) => {
        this.lawyer = res.data;
        this.loading = false;
        if (this.lawyer) {
          // Server-Side Enrichment Pre-Seeding: 0ms Frame 0 Display
          const inter = (this.lawyer as any).interaction;
          if (inter) {
            this.interactionService.seedState('Lawyer', this.lawyer._id, {
              count: inter.count || 0,
              liked: Boolean(inter.liked),
              type: inter.liked ? 'Like' : null
            });
            if (inter.saved) {
              this.bookmarkService.seedBookmark('Lawyer', this.lawyer._id, true);
            }
          }

          this.initializeTimeSlots();
          this.loadReviews();
          this.animateStats();
          this.lawyerService.trackProfileView(this.lawyer.email).subscribe({
            error: () => { /* ignore tracking errors silently */ }
          });
        }
      },
      error: (err) => {
        this.error = 'Could not find the attorney profile. It may have been removed or deactivated.';
        this.loading = false;
      }
    });
  }

  loadReviews() {
    if (!this.lawyer) return;
    this.loadingReviews = true;
    this.reviewService.getReviews(this.lawyer.name).subscribe({
      next: (res: any) => {
        const data = res?.data || res?.items || res || [];
        this.reviews = Array.isArray(data) ? data : [];
        this.loadingReviews = false;
      },
      error: () => {
        this.reviews = [];
        this.loadingReviews = false;
      }
    });
  }

  getInitials(name: string): string {
    return name.replace('Adv. ', '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  // --- Pillar 5: Email Verification Gating Interlock Handlers ---
  closeVerificationInterlock() {
    this.showVerificationInterlockModal = false;
    this.interlockOtpCode = '';
    if (!this.previewImageUrl && !this.showInquiryModal) {
      document.body.classList.remove('overflow-hidden');
    }
  }

  onInterlockOtpInput(val: string) {
    const numeric = val.replace(/\D/g, '').slice(0, 6);
    this.interlockOtpCode = numeric;
    if (numeric.length === 6 && this.currentUser?.email) {
      this.verifyInterlockOtp();
    }
  }

  verifyInterlockOtp() {
    const code = this.interlockOtpCode.trim();
    const email = this.currentUser?.email?.trim();
    if (!email || code.length !== 6 || this.isVerifyingInterlockOtp) return;

    this.isVerifyingInterlockOtp = true;
    this.verificationService.verifyEmail(code, email).subscribe({
      next: () => {
        this.isVerifyingInterlockOtp = false;
        this.auth.updateCurrentUser({ isEmailVerified: true });
        this.snackbar.show('Email confirmed successfully! Proceeding with your consultation request.', 'success');
        this.closeVerificationInterlock();
        // Automatically unlock and launch consultation modal seamlessly
        this.openInquiry();
      },
      error: (err) => {
        this.isVerifyingInterlockOtp = false;
        const msg = err?.error?.message || err?.message || 'Invalid or expired 6-digit code. Please request a new code.';
        this.snackbar.show(msg, 'error');
      }
    });
  }

  resendInterlockVerification() {
    const email = this.currentUser?.email?.trim();
    if (!email || this.isResendingInterlock || this.interlockCooldown > 0) return;

    this.isResendingInterlock = true;
    this.verificationService.resendEmailVerification(email).subscribe({
      next: () => {
        this.isResendingInterlock = false;
        this.snackbar.show(`A fresh verification code was sent to ${email}.`, 'success');
        this.startInterlockCooldown(60);
      },
      error: (err) => {
        this.isResendingInterlock = false;
        this.snackbar.show(err?.error?.message || 'Failed to resend code. Please try again.', 'error');
        this.startInterlockCooldown(15);
      }
    });
  }

  openInterlockWebmail() {
    const webmail = this.interlockWebmail;
    if (webmail) {
      window.open(webmail.url, '_blank', 'noopener,noreferrer');
    }
  }

  private startInterlockCooldown(seconds: number) {
    if (this.interlockCooldownTimer) {
      clearInterval(this.interlockCooldownTimer);
    }
    this.interlockCooldown = seconds;
    this.interlockCooldownTimer = setInterval(() => {
      this.interlockCooldown--;
      if (this.interlockCooldown <= 0) {
        this.interlockCooldown = 0;
        clearInterval(this.interlockCooldownTimer);
        this.interlockCooldownTimer = null;
      }
    }, 1000);
  }

  // --- Consultation Dialog & SessionStorage Draft ---
  openInquiry() {
    if (!this.currentUser) {
      this.snackbar.show('Please log in to submit a consultation request.', 'warning');
      return;
    }

    // Pillar 5: High-Trust Gating Interlock
    if (this.currentUser.isEmailVerified === false) {
      this.showVerificationInterlockModal = true;
      document.body.classList.add('overflow-hidden');
      return;
    }

    if (!this.lawyer) return;

    this.showInquiryModal = true;
    document.body.classList.add('overflow-hidden');

    let prependMsg = '';
    if (this.selectedSlot) {
      prependMsg = `[Booking Request: ${this.selectedDay} at ${this.selectedSlot.time}]\n\n`;
    }

    // Restore session draft
    const saved = this.draft.load<ContactForm>(this.DRAFT_KEY);
    if (saved && saved.lawyerId === this.lawyer._id) {
      this.contactForm = saved;
      if (prependMsg && !this.contactForm.message.startsWith('[Booking Request:')) {
        this.contactForm.message = prependMsg + this.contactForm.message;
      }
      this.snackbar.show('Draft restored!', 'info');
    } else {
      this.contactForm = {
        name: this.currentUser?.fullName || '',
        email: this.currentUser?.email || '',
        message: prependMsg,
        lawyerId: this.lawyer._id
      };
    }

    // Auto save
    this.autoSaveInterval = setInterval(() => {
      this.draft.save(this.DRAFT_KEY, this.contactForm);
    }, 2000);
  }

  closeInquiry() {
    clearInterval(this.autoSaveInterval);
    this.showInquiryModal = false;
    if (!this.previewImageUrl && !this.showVerificationInterlockModal) {
      document.body.classList.remove('overflow-hidden');
    }
  }

  submitInquiry() {
    if (this.currentUser?.isEmailVerified === false) {
      this.closeInquiry();
      this.showVerificationInterlockModal = true;
      document.body.classList.add('overflow-hidden');
      return;
    }

    if (!this.contactForm.name || !this.contactForm.email || !this.contactForm.message) {
      this.snackbar.show('Please complete all form fields.', 'warning');
      return;
    }
    if (!this.lawyer) return;

    this.isSubmittingInquiry = true;
    this.lawyerService.sendInquiry({
      clientName: this.contactForm.name,
      clientEmail: this.contactForm.email,
      lawyerEmail: this.lawyer.email,
      message: this.contactForm.message
    }).subscribe({
      next: () => {
        this.isSubmittingInquiry = false;
        this.draft.clear(this.DRAFT_KEY);
        this.selectedSlot = null;
        this.closeInquiry();
        this.snackbar.show('Your consultation request has been sent successfully!', 'success');
      },
      error: (err) => {
        this.isSubmittingInquiry = false;
        if (err?.error?.code === 'EMAIL_NOT_VERIFIED' || err?.error?.requiresEmailVerification) {
          this.closeInquiry();
          this.showVerificationInterlockModal = true;
          document.body.classList.add('overflow-hidden');
          this.snackbar.show(err.error?.message || 'Email verification is required before booking a consultation.', 'warning');
        } else {
          this.snackbar.show(err?.error?.message || 'Failed to submit request. Please try again.', 'error');
        }
      }
    });
  }

  // --- Reviews Interaction ---
  setRating(stars: number) {
    this.reviewForm.rating = stars;
  }

  submitReview() {
    if (!this.lawyer) return;
    if (!this.reviewForm.content.trim()) {
      this.snackbar.show('Please write a comment for your review.', 'warning');
      return;
    }

    this.submittingReview = true;
    this.reviewService.submitReview({
      rating: this.reviewForm.rating,
      content: this.reviewForm.content,
      targetName: this.lawyer.name,
      authorName: this.currentUser ? this.currentUser.fullName : (this.reviewForm.authorName || 'Guest Client')
    }).subscribe({
      next: (newReview) => {
        this.reviews.unshift(newReview);
        this.snackbar.show('Thank you! Your review has been published.', 'success');

        // Dynamic re-calculation of rating locally
        if (this.lawyer) {
          const totalRating = this.reviews.reduce((acc, r) => acc + r.rating, 0);
          this.lawyer.rating = totalRating / this.reviews.length;
        }

        // Reset form
        this.reviewForm.content = '';
        if (!this.currentUser) this.reviewForm.authorName = '';
        this.submittingReview = false;
      },
      error: (err) => {
        this.snackbar.show(err.error?.message || err.error || 'Failed to submit review. Please try again.', 'error');
        this.submittingReview = false;
      }
    });
  }

  // --- Animation & Click Navigation Helpers ---
  animateStats() {
    if (!this.lawyer) return;

    const expTarget = this.lawyer.experience || 0;
    const casesTarget = this.lawyer.casesCompleted || 150;
    const successTarget = this.lawyer.successRate || 95;

    this.animatedExperience = 0;
    this.animatedCases = 0;
    this.animatedSuccessRate = 0;

    const duration = 1200; // 1.2 seconds animation length
    const stepTime = 25; // 25ms steps
    const steps = duration / stepTime;

    const expStep = expTarget / steps;
    const casesStep = casesTarget / steps;
    const successStep = successTarget / steps;

    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        this.animatedExperience = expTarget;
        this.animatedCases = casesTarget;
        this.animatedSuccessRate = successTarget;
        clearInterval(interval);
      } else {
        this.animatedExperience = Math.round(expStep * currentStep);
        this.animatedCases = Math.round(casesStep * currentStep);
        this.animatedSuccessRate = Math.round(successStep * currentStep);
      }
    }, stepTime);
  }

  goToSpecialization(specName: string) {
    this.router.navigate(['/specializations'], { queryParams: { name: specName } });
  }

  // --- Premium features helper methods ---
  initializeTimeSlots() {
    if (!this.lawyer) return;

    // If lawyer has no available slots, populate standard weekly defaults
    if (!this.lawyer.availableTimeSlots || this.lawyer.availableTimeSlots.length === 0) {
      this.lawyer.availableTimeSlots = [
        { day: 'Monday', time: '10:00 AM', isBooked: false },
        { day: 'Monday', time: '2:30 PM', isBooked: false },
        { day: 'Tuesday', time: '11:00 AM', isBooked: false },
        { day: 'Wednesday', time: '1:30 PM', isBooked: false },
        { day: 'Wednesday', time: '4:00 PM', isBooked: false },
        { day: 'Thursday', time: '10:00 AM', isBooked: false },
        { day: 'Friday', time: '3:00 PM', isBooked: false }
      ];
    }

    // Extract unique sorted days
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const daysSet = new Set(this.lawyer.availableTimeSlots.map(s => s.day));
    this.uniqueDays = dayOrder.filter(d => daysSet.has(d));
    if (this.uniqueDays.length > 0) {
      this.selectedDay = this.uniqueDays[0];
    }
  }

  getSlotsForSelectedDay(): any[] {
    if (!this.lawyer || !this.lawyer.availableTimeSlots) return [];
    return this.lawyer.availableTimeSlots.filter(s => s.day === this.selectedDay);
  }

  selectSlot(slot: any) {
    if (this.selectedSlot === slot) {
      this.selectedSlot = null;
    } else {
      this.selectedSlot = slot;
    }
  }

  toggleFaq(index: number) {
    this.activeFaqIndex = this.activeFaqIndex === index ? null : index;
  }

  openImagePreview(url: string | undefined, event: MouseEvent, isBanner = false) {
    if (!url) return;
    event.stopPropagation();
    this.previewImageUrl = url;
    this.previewIsBanner = isBanner;
    document.body.classList.add('overflow-hidden');
  }

  closeImagePreview() {
    this.previewImageUrl = null;
    if (!this.showInquiryModal) {
      document.body.classList.remove('overflow-hidden');
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    const isAnyModalOpen = this.showInquiryModal || this.showVerificationInterlockModal || !!this.previewImageUrl;
    if (!isAnyModalOpen) return;

    if (event.key === 'Escape') {
      if (this.previewImageUrl) {
        this.closeImagePreview();
      } else if (this.showVerificationInterlockModal) {
        this.closeVerificationInterlock();
      } else if (this.showInquiryModal) {
        this.closeInquiry();
      }
      return;
    }

    if (event.key === 'Tab') {
      const activeModal = document.querySelector('.fixed.inset-0.z-50, .fixed.inset-0.z-\\[100\\]') as HTMLElement | null;
      if (!activeModal) return;

      const focusable = activeModal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && (document.activeElement === first || !activeModal.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !activeModal.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}
