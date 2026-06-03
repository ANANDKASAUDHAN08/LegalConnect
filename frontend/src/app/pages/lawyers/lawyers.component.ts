import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { LawyerService, Lawyer } from '../../services/lawyer.service';
import { SnackbarService } from '../../services/snackbar.service';
import { AuthService, UserProfile } from '../../services/auth.service';

@Component({
  selector: 'app-lawyers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './lawyers.component.html',
  styleUrls: ['./lawyers.component.scss']
})
export class LawyersComponent implements OnInit, OnDestroy {
  // Raw and filtered lists
  allLawyers: Lawyer[] = [];
  filteredLawyers: Lawyer[] = [];

  // Meta filters loaded from backend
  cities: string[] = [];
  specializations: string[] = [];

  // Loading states
  loading = true;
  error = '';

  // Filter variables
  searchQuery = '';
  selectedLocation = '';
  selectedPracticeAreas: { [key: string]: boolean } = {};
  selectedAvailability = 'any'; // 'any' | 'today' | 'week'
  minFee = 0;
  maxFee = 5000;

  // Sorting & Layout
  sortBy = 'bestMatch'; // 'bestMatch' | 'experience' | 'feeLow' | 'feeHigh'
  viewMode: 'grid' | 'list' = 'grid';
  showMobileFilters = false;
  showMobileSearch = false;

  // New filters: Experience & Rating
  selectedExperience = 0;
  selectedRating = 0;

  // Pagination
  currentPage = 1;

  // Custom sort dropdown properties
  showSortDropdown = false;
  sortOptions = [
    { value: 'bestMatch', label: 'Best Match' },
    { value: 'experience', label: 'Experience' },
    { value: 'feeLow', label: 'Price: Low to High' },
    { value: 'feeHigh', label: 'Price: High to Low' }
  ];

  // Image preview state
  previewImageUrl: string | null = null;
  private loadingTimeout: any;

  // Scroll states for mobile nav adjustment
  isScrolled = false;
  isMobile = false;

  currentUser: UserProfile | null = null;
  private querySub: any;

  constructor(
    private lawyerService: LawyerService,
    private snackbar: SnackbarService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit() {
    this.checkMobile();
    this.auth.currentUser$.subscribe(user => this.currentUser = user);

    // Load metadata from backend
    this.lawyerService.getMeta().subscribe({
      next: res => {
        this.cities = res.data.cities;
        this.specializations = res.data.specializations;
        // Initialize checkboxes
        this.specializations.forEach(spec => {
          this.selectedPracticeAreas[spec] = false;
        });

        // After meta is loaded, read query params
        this.readQueryParamsAndLoad();
      },
      error: () => {
        this.readQueryParamsAndLoad();
      }
    });
  }

  ngOnDestroy() {
    document.body.classList.remove('overflow-hidden');
    if (this.querySub) {
      this.querySub.unsubscribe();
    }
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
  }

  readQueryParamsAndLoad() {
    this.querySub = this.route.queryParams.subscribe(params => {
      this.searchQuery = params['q'] || '';
      this.selectedLocation = params['city'] || '';

      const specParam = params['specialization'] || '';
      if (specParam) {
        // Reset and check this one
        Object.keys(this.selectedPracticeAreas).forEach(k => this.selectedPracticeAreas[k] = false);
        if (this.selectedPracticeAreas.hasOwnProperty(specParam)) {
          this.selectedPracticeAreas[specParam] = true;
        } else {
          // If it matches case insensitively
          const key = Object.keys(this.selectedPracticeAreas).find(k => k.toLowerCase() === specParam.toLowerCase());
          if (key) this.selectedPracticeAreas[key] = true;
        }
      }

      this.loadLawyers();
    });
  }

  loadLawyers() {
    this.loading = true;
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    this.lawyerService.getLawyers().subscribe({
      next: res => {
        this.loadingTimeout = setTimeout(() => {
          this.allLawyers = res.data;
          this.applyFilters();
          this.loading = false;
        }, 500);
      },
      error: () => {
        this.loadingTimeout = setTimeout(() => {
          this.error = 'Could not load lawyers. Please try again.';
          this.loading = false;
        }, 500);
      }
    });
  }

  applyFilters() {
    let result = [...this.allLawyers];

    // 1. Text Search Query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(lawyer =>
        lawyer.name.toLowerCase().includes(q) ||
        lawyer.bio.toLowerCase().includes(q) ||
        lawyer.specializations.some(s => s.toLowerCase().includes(q))
      );
    }

    // 2. Location Filter
    if (this.selectedLocation.trim()) {
      const loc = this.selectedLocation.toLowerCase().trim();
      result = result.filter(lawyer =>
        lawyer.city.toLowerCase().includes(loc)
      );
    }

    // 3. Practice Areas (Specializations checkboxes)
    const selectedAreas = Object.keys(this.selectedPracticeAreas).filter(k => this.selectedPracticeAreas[k]);
    if (selectedAreas.length > 0) {
      result = result.filter(lawyer =>
        lawyer.specializations.some(spec => selectedAreas.includes(spec))
      );
    }

    // 4. Availability
    if (this.selectedAvailability === 'today') {
      result = result.filter(lawyer => lawyer.isAvailable !== false);
    } else if (this.selectedAvailability === 'week') {
      // Simulate "this week" as available or high rating
      result = result.filter(lawyer => lawyer.isAvailable !== false || lawyer.rating >= 4.7);
    }

    // 5. Price Range (Consultation Fee)
    result = result.filter(lawyer => {
      const fee = lawyer.consultationFee || 0;
      return fee >= this.minFee && fee <= this.maxFee;
    });

    // 6. Experience Filter
    if (this.selectedExperience > 0) {
      result = result.filter(lawyer => lawyer.experience >= this.selectedExperience);
    }

    // 7. Minimum Rating Filter
    if (this.selectedRating > 0) {
      result = result.filter(lawyer => lawyer.rating >= this.selectedRating);
    }

    // 8. Sorting
    if (this.sortBy === 'bestMatch') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (this.sortBy === 'experience') {
      result.sort((a, b) => b.experience - a.experience);
    } else if (this.sortBy === 'feeLow') {
      result.sort((a, b) => (a.consultationFee || 0) - (b.consultationFee || 0));
    } else if (this.sortBy === 'feeHigh') {
      result.sort((a, b) => (b.consultationFee || 0) - (a.consultationFee || 0));
    }

    this.filteredLawyers = result;
    this.currentPage = 1;
  }

  get itemsPerPage(): number {
    return this.isMobile ? 8 : 10;
  }

  get paginatedLawyers(): Lawyer[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredLawyers.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredLawyers.length / this.itemsPerPage);
  }

  get pageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Chip helpers
  getActiveChips(): string[] {
    const chips: string[] = [];
    if (this.selectedLocation) {
      chips.push(`Location: ${this.selectedLocation}`);
    }
    if (this.selectedAvailability !== 'any') {
      chips.push(this.selectedAvailability === 'today' ? 'Available Today' : 'Available This Week');
    }
    Object.keys(this.selectedPracticeAreas).forEach(key => {
      if (this.selectedPracticeAreas[key]) {
        chips.push(key);
      }
    });
    if (this.minFee > 0 || this.maxFee < 5000) {
      chips.push(`Fee: ₹${this.minFee} - ₹${this.maxFee}`);
    }
    if (this.selectedExperience > 0) {
      chips.push(`Exp: ${this.selectedExperience}+ Yrs`);
    }
    if (this.selectedRating > 0) {
      chips.push(`Rating: ${this.selectedRating}+ ★`);
    }
    return chips;
  }

  removeChip(chip: string) {
    if (chip.startsWith('Location: ')) {
      this.selectedLocation = '';
    } else if (chip === 'Available Today' || chip === 'Available This Week') {
      this.selectedAvailability = 'any';
    } else if (chip.startsWith('Fee: ')) {
      this.minFee = 0;
      this.maxFee = 5000;
    } else if (chip.startsWith('Exp: ')) {
      this.selectedExperience = 0;
    } else if (chip.startsWith('Rating: ')) {
      this.selectedRating = 0;
    } else {
      if (this.selectedPracticeAreas.hasOwnProperty(chip)) {
        this.selectedPracticeAreas[chip] = false;
      }
    }
    this.applyFilters();
  }

  clearAllFilters() {
    this.searchQuery = '';
    this.selectedLocation = '';
    this.selectedAvailability = 'any';
    this.minFee = 0;
    this.maxFee = 5000;
    this.selectedExperience = 0;
    this.selectedRating = 0;
    Object.keys(this.selectedPracticeAreas).forEach(k => this.selectedPracticeAreas[k] = false);
    this.applyFilters();
  }

  getInitials(name: string): string {
    return name.replace('Adv. ', '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  useMyLocation() {
    if (navigator.geolocation) {
      this.snackbar.show('Locating your position...', 'info');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Simulate detecting closest city in seed data (defaults to Delhi)
          this.selectedLocation = 'Delhi';
          this.applyFilters();
          this.snackbar.show('Location set to Delhi (detected nearest center)', 'success');
        },
        () => {
          this.selectedLocation = 'Delhi';
          this.applyFilters();
          this.snackbar.show('Could not access location. Defaulted to Delhi.', 'info');
        }
      );
    } else {
      this.snackbar.show('Geolocation not supported by this browser.', 'warning');
    }
  }

  getSelectedPracticeAreasCount(): number {
    return Object.values(this.selectedPracticeAreas).filter(Boolean).length;
  }

  toggleMobileFilters() {
    this.showMobileFilters = !this.showMobileFilters;
    if (this.showMobileFilters) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }

  toggleSortDropdown(event: Event) {
    event.stopPropagation();
    this.showSortDropdown = !this.showSortDropdown;
  }

  selectSort(val: string, event: Event) {
    event.stopPropagation();
    this.sortBy = val;
    this.showSortDropdown = false;
    this.applyFilters();
  }

  getSortLabel(val: string): string {
    const opt = this.sortOptions.find(o => o.value === val);
    return opt ? opt.label : 'Best Match';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick() {
    this.showSortDropdown = false;
  }

  // Card interaction handlers
  goToDetail(id: string) {
    this.router.navigate(['/lawyers', id]);
  }

  openImagePreview(url: string, event: Event) {
    event.stopPropagation();
    this.previewImageUrl = url;
  }

  closeImagePreview() {
    this.previewImageUrl = null;
  }

  goToSpecialization(specName: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/specializations'], { queryParams: { name: specName } });
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 20;
  }

  openMobileSearch() {
    this.showMobileSearch = true;
    setTimeout(() => {
      const searchInput = document.getElementById('mobileSearchInput');
      if (searchInput) {
        searchInput.focus();
      }
    }, 50);
  }

  closeMobileSearch() {
    this.showMobileSearch = false;
  }

  @HostListener('window:resize', [])
  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    const oldIsMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;
    if (oldIsMobile !== this.isMobile) {
      this.currentPage = 1;
    }
  }
}