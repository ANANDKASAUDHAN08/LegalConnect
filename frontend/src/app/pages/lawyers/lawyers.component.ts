import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LawyerService, Lawyer } from '../../services/lawyer.service';
import { DraftService } from '../../services/draft.service';
import { SnackbarService } from '../../services/snackbar.service';
import { AuthService, UserProfile } from '../../services/auth.service';

interface ContactForm {
  name: string;
  email: string;
  message: string;
  lawyerId: string;
}

@Component({
  selector: 'app-lawyers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lawyers.component.html',
  styleUrls: ['./lawyers.component.scss']
})
export class LawyersComponent implements OnInit, OnDestroy {
  lawyers: Lawyer[] = [];
  cities: string[] = [];
  specializations: string[] = [];
  loading = true;
  error = '';
  searchQuery = '';
  selectedCity = '';
  selectedSpecialization = '';
  private searchDebounce: any;

  // Contact form state
  selectedLawyer: Lawyer | null = null;
  contactForm: ContactForm = { name: '', email: '', message: '', lawyerId: '' };
  private autoSaveInterval: any;
  private readonly DRAFT_KEY = 'lawyer_contact';

  currentUser: UserProfile | null = null;

  constructor(
    private lawyerService: LawyerService,
    private draft: DraftService,
    private snackbar: SnackbarService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(user => this.currentUser = user);
    
    this.lawyerService.getMeta().subscribe({
      next: res => {
        this.cities = res.data.cities;
        this.specializations = res.data.specializations;
      }
    });
    this.loadLawyers();
  }

  ngOnDestroy() {
    clearInterval(this.autoSaveInterval);
    clearTimeout(this.searchDebounce);
  }

  loadLawyers() {
    this.loading = true;
    this.lawyerService.getLawyers({
      city: this.selectedCity || undefined,
      specialization: this.selectedSpecialization || undefined,
      q: this.searchQuery || undefined
    }).subscribe({
      next: res => { this.lawyers = res.data; this.loading = false; },
      error: () => { this.error = 'Could not load lawyers. Please try again.'; this.loading = false; }
    });
  }

  applyFilters() {
    this.loadLawyers();
  }

  onSearch() {
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.loadLawyers(), 350);
  }

  getInitials(name: string): string {
    return name.replace('Adv. ', '').split(' ').map(n => n[0]).slice(0, 2).join('');
  }

  // --- Contact Form with SessionStorage Draft ---

  openContact(lawyer: Lawyer) {
    this.selectedLawyer = lawyer;

    // Restore a previously saved draft if it exists for this lawyer
    const saved = this.draft.load<ContactForm>(this.DRAFT_KEY);
    if (saved && saved.lawyerId === lawyer._id) {
      this.contactForm = saved;
      this.snackbar.show('Draft restored!', 'info');
    } else {
      this.contactForm = {
        name: this.currentUser?.fullName || '',
        email: this.currentUser?.email || '',
        message: '',
        lawyerId: lawyer._id
      };
    }

    // Auto-save draft every 2 seconds
    this.autoSaveInterval = setInterval(() => {
      this.draft.save(this.DRAFT_KEY, this.contactForm);
    }, 2000);
  }

  closeContact() {
    clearInterval(this.autoSaveInterval);
    this.selectedLawyer = null;
  }

  submitContact() {
    if (!this.contactForm.name || !this.contactForm.email || !this.contactForm.message) {
      this.snackbar.show('Please fill in all fields.', 'warning');
      return;
    }

    this.lawyerService.sendInquiry({
      clientName: this.contactForm.name,
      clientEmail: this.contactForm.email,
      lawyerEmail: this.selectedLawyer?.email || '',
      message: this.contactForm.message
    }).subscribe({
      next: () => {
        this.draft.clear(this.DRAFT_KEY);
        clearInterval(this.autoSaveInterval);
        this.snackbar.show(`Message sent to ${this.selectedLawyer?.name}!`, 'success');
        this.selectedLawyer = null;
      },
      error: (err) => {
        this.snackbar.show(err.error?.message || err.error || 'Failed to send inquiry. Please try again.', 'error');
      }
    });
  }
}

