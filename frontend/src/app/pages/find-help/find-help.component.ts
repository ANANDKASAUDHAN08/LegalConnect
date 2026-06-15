import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { LegalService } from '../../services/legal.service';
import { BookmarkService } from '../../services/bookmark.service';
import { LocationService } from '../../services/location.service';
import { Subscription } from 'rxjs';
import { SosDrawerComponent } from './components/sos-drawer/sos-drawer.component';
import { HelplineCardComponent } from './components/helpline-card/helpline-card.component';
import { ResourceCardComponent } from './components/resource-card/resource-card.component';
import { LawyerCardComponent } from '../../components/lawyer-card/lawyer-card.component';
import { FreeAidCheckerComponent } from './components/free-aid-checker/free-aid-checker.component';
import { LegalRoadmapComponent } from './components/legal-roadmap/legal-roadmap.component';
import { LocationMapModalComponent } from '../../components/location-map-modal/location-map-modal.component';

declare var google: any;

interface Category {
  id: string;
  name: string;
  icon: string;
  resourceCount: number;
  description: string;
  subcategories: string[];
  breakdown: {
    legalAid: number;
    courts: number;
    govOffices: number;
    helplines: number;
    lawyers: number;
  };
}

@Component({
  selector: 'app-find-help',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SosDrawerComponent,
    HelplineCardComponent,
    ResourceCardComponent,
    LawyerCardComponent,
    FreeAidCheckerComponent,
    LegalRoadmapComponent,
    LocationMapModalComponent
  ],
  templateUrl: './find-help.component.html',
  styleUrls: ['./find-help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FindHelpComponent implements OnInit, OnDestroy, AfterViewInit {
  // Scroll Listener for Dynamic Navbar
  isScrolled = false;
  isLoading = false;
  isMobile = false;
  showMobileFilters = false;

  private onScroll = () => {
    const scrolled = window.scrollY > 20;
    if (scrolled !== this.isScrolled) {
      this.zone.run(() => {
        this.isScrolled = scrolled;
        this.cdr.markForCheck();
      });
    }
  };

  @HostListener('window:resize', [])
  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    const mobile = window.innerWidth < 768;
    if (this.isMobile !== mobile) {
      this.isMobile = mobile;
      this.cdr.markForCheck();
    }
  }

  toggleMobileFilters() {
    this.showMobileFilters = !this.showMobileFilters;
    if (this.showMobileFilters) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    this.cdr.markForCheck();
  }

  // Navigation & Screen states
  isResultsMode = false;
  activeCategory = 'Property Dispute';
  selectedSubcategories: string[] = [];
  activeViewMode: 'split' | 'list' | 'map' = 'split';
  activeTab = 'All';

  // Search Inputs
  locationQuery = 'New Delhi';
  isLocationEstimated = true;
  isAiMode = false;
  showMapModal = false;
  normalSearchQuery = '';
  filteredSuggestions: Array<{ category: string, subcategory?: string, displayName: string }> = [];
  situationQuery = '';
  isRecording = false;
  recognition: any = null;

  // Emergency SOS Drawer State
  showSosDrawer = false;

  // API Data
  roadmap: any = null;
  helplines: any[] = [];
  resources: any[] = [];
  lawyers: any[] = [];
  filteredResources: any[] = [];
  filteredLawyers: any[] = [];
  allResultsCount = 0;

  // Leaflet Map Properties
  private map: any = null;
  private markers: any[] = [];
  private mapCenter: [number, number] = [28.6139, 77.2090]; // Delhi Default
  private userMarker: any = null;
  isSatelliteView = false;
  private tileLayer: any = null;

  // Filters State
  filters = {
    radius: 5,
    resourceTypes: {
      LegalAid: true,
      Court: true,
      GovernmentOffice: true,
      Helpline: true,
      Lawyer: true
    },
    openNow: true,
    languages: {
      English: true,
      Hindi: false,
      Punjabi: false,
      Bengali: false
    },
    verifiedOnly: false
  };

  // Eligibility Check Form State
  eligibilityStep = 0; // 0: Not checked, 1: Checking, 2: Result
  eligibilityAnswers = {
    gender: '',
    income: '',
    category: ''
  };
  isFreeAidEligible = false;

  // Category Configuration
  categories: Category[] = [
    {
      id: 'Property Dispute',
      name: 'Property Dispute',
      icon: 'home',
      resourceCount: 24,
      description: 'Legal issues related to land ownership, tenancy, builder disputes, RERA complaints, and property registration.',
      subcategories: ['Land Ownership', 'Tenancy Dispute', 'Builder Fraud', 'RERA Complaint', 'Property Registration', 'Ancestral Property', 'Encroachment'],
      breakdown: { legalAid: 4, courts: 6, govOffices: 8, helplines: 3, lawyers: 12 }
    },
    {
      id: 'Family Law',
      name: 'Family Law',
      icon: 'users',
      resourceCount: 18,
      description: 'Matters regarding marriage, divorce, child custody, alimony, and inheritance.',
      subcategories: ['Divorce', 'Mutual Divorce', 'Child Custody', 'Alimony / Maintenance', 'Inheritance', 'Wills & Estates'],
      breakdown: { legalAid: 3, courts: 4, govOffices: 2, helplines: 4, lawyers: 10 }
    },
    {
      id: 'Consumer Complaint',
      name: 'Consumer Complaint',
      icon: 'shopping-cart',
      resourceCount: 31,
      description: 'Redressal against defective goods, deficient services, overcharging, and unfair trade practices.',
      subcategories: ['Product Defect', 'Service Deficiency', 'Online Scam', 'Insurance Claim', 'Banking Dispute', 'Medical Negligence'],
      breakdown: { legalAid: 5, courts: 8, govOffices: 6, helplines: 3, lawyers: 15 }
    },
    {
      id: 'Labour Issue',
      name: 'Labour Issue',
      icon: 'briefcase',
      resourceCount: 14,
      description: 'Employee-employer disputes, wage claims, wrongful termination, and workplace harassment.',
      subcategories: ['Unpaid Wages', 'Wrongful Termination', 'PF / Gratuity Dispute', 'Workplace Harassment', 'Contract Breach'],
      breakdown: { legalAid: 2, courts: 3, govOffices: 4, helplines: 2, lawyers: 8 }
    },
    {
      id: 'Criminal Matter',
      name: 'Criminal Matter',
      icon: 'scale',
      resourceCount: 22,
      description: 'Defense representation, bail applications, police harassment, and filing FIRs.',
      subcategories: ['FIR Filing', 'Bail Application', 'Anticipatory Bail', 'Police Harassment', 'Cheque Bounce'],
      breakdown: { legalAid: 4, courts: 5, govOffices: 5, helplines: 3, lawyers: 10 }
    },
    {
      id: 'Business Dispute',
      name: 'Business Dispute',
      icon: 'building',
      resourceCount: 19,
      description: 'Company formation, partnership disputes, commercial contracts, and intellectual property rights.',
      subcategories: ['Contract Violation', 'Partnership Dispute', 'IPR Infringement', 'Taxation Issue', 'Debt Recovery'],
      breakdown: { legalAid: 3, courts: 4, govOffices: 5, helplines: 2, lawyers: 12 }
    },
    {
      id: 'Cyber Crime',
      name: 'Cyber Crime',
      icon: 'shield',
      resourceCount: 12,
      description: 'Reporting phishing scams, online identity theft, hacking, cyberbullying, and financial frauds.',
      subcategories: ['Phishing / Online Scam', 'Hacking', 'Identity Theft', 'Cyber Bullying', 'Financial Fraud'],
      breakdown: { legalAid: 2, courts: 3, govOffices: 3, helplines: 2, lawyers: 6 }
    },
    {
      id: 'Other / Not Sure',
      name: 'Other / Not Sure',
      icon: 'question',
      resourceCount: 0,
      description: 'Describe your situation to our AI Assistant to find relevant resources and categories.',
      subcategories: ['General Consultation', 'Unsure of Category'],
      breakdown: { legalAid: 0, courts: 0, govOffices: 0, helplines: 0, lawyers: 0 }
    }
  ];

  private routeSub!: Subscription;
  private locationSub!: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private legalService: LegalService,
    private bookmarkService: BookmarkService,
    private locationService: LocationService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) { }

  ngOnInit() {
    this.checkMobile();
    this.initVoiceSearch();

    // Sync locationQuery with global LocationService
    this.locationSub = this.locationService.activeLocation$.subscribe(loc => {
      if (loc && loc !== this.locationQuery) {
        this.locationQuery = loc;
        // If already viewing results, re-trigger a search automatically
        if (this.isResultsMode) {
          this.triggerSearch();
        }
        this.cdr.markForCheck();
      }
    });
    this.locationSub.add(
      this.locationService.isEstimated$.subscribe(est => {
        this.isLocationEstimated = est;
        this.cdr.markForCheck();
      })
    );

    // Watch route parameters for category and location
    this.routeSub = this.route.queryParams.subscribe(params => {
      const cat = params['category'];
      const loc = params['location'];

      if (cat && loc) {
        this.activeCategory = cat;
        this.locationQuery = loc;
        this.isResultsMode = true;
        this.fetchData();
      } else {
        this.isResultsMode = false;
        this.clearData();
        setTimeout(() => {
          this.initMainLocationAutocomplete();
        }, 100);
      }
      this.cdr.markForCheck();
    });

    // Register scroll event outside Angular's zone to prevent change detection on every scroll pixel
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngAfterViewInit() {
    if (this.isResultsMode) {
      this.initMap();
    } else {
      this.initMainLocationAutocomplete();
    }
  }

  ngOnDestroy() {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.locationSub) this.locationSub.unsubscribe();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) { }
    }
    if (this.map) {
      try {
        this.clearMapMarkers();
      } catch (e) { }
      this.map = null;
    }
    window.removeEventListener('scroll', this.onScroll);
  }

  // Clear data states
  clearData() {
    this.resources = [];
    this.lawyers = [];
    this.filteredResources = [];
    this.filteredLawyers = [];
    this.helplines = [];
    this.roadmap = null;
    this.allResultsCount = 0;
    if (this.map) {
      this.clearMapMarkers();
      this.map = null;
    }
  }

  // API Call to get help resources
  fetchData() {
    this.clearMapMarkers();
    this.isLoading = true;
    this.cdr.markForCheck();
    this.legalService.getHelpNearMe(this.activeCategory, this.locationService.cleanAddress(this.locationQuery)).subscribe({
      next: (res: any) => {
        // 1.2 second artificial delay to showcase the shimmer skeleton loader interface
        setTimeout(() => {
          try {
            this.isLoading = false;
            if (res && res.success) {
              this.roadmap = res.roadmap;
              this.helplines = res.helplines || [];
              this.resources = res.resources || [];
              this.lawyers = res.lawyers || [];

              // Configure location center based on results or fallback
              if (res.resources && res.resources.length > 0 && res.resources[0].coordinates) {
                const firstCoord = res.resources[0].coordinates;
                this.mapCenter = [firstCoord.lat, firstCoord.lng];
              } else {
                // City center mappings
                const city = this.locationService.cleanAddress(this.locationQuery).toLowerCase();
                if (city.includes('mumbai')) this.mapCenter = [19.0760, 72.8777];
                else if (city.includes('bengaluru') || city.includes('bangalore')) this.mapCenter = [12.9716, 77.5946];
                else this.mapCenter = [28.6139, 77.2090]; // Delhi
              }

              this.applyFilters();
              setTimeout(() => {
                this.initMap();
                this.cdr.markForCheck();
              }, 100);
            }
          } catch (err) {
            console.error('Error during data processing in next callback:', err);
            this.isLoading = false;
          } finally {
            this.cdr.markForCheck();
          }
        }, 1200);
      },
      error: (err) => {
        setTimeout(() => {
          this.isLoading = false;
          console.error('Failed to retrieve nearby help resources', err);
          this.cdr.markForCheck();
        }, 500);
      }
    });
  }

  // Apply filters on clientside to feed results
  applyFilters() {
    try {
      // 1. Filter Resources
      this.filteredResources = (this.resources || []).filter(item => {
        if (!item) return false;
        // Type Filter
        const matchedType =
          (item.type === 'LegalAid' && this.filters.resourceTypes.LegalAid) ||
          (item.type === 'Court' && this.filters.resourceTypes.Court) ||
          (item.type === 'GovernmentOffice' && this.filters.resourceTypes.GovernmentOffice) ||
          (item.type === 'PoliceStation' && this.filters.resourceTypes.GovernmentOffice); // Group police under gov in filters list

        if (!matchedType) return false;

        // Subcategories match if any selected
        if (this.selectedSubcategories.length > 0) {
          const hasSub = (item.subcategories || []).some((s: string) =>
            this.selectedSubcategories.some(sel => sel.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(sel.toLowerCase()))
          );
          if (!hasSub) return false;
        }

        // Open status
        if (this.filters.openNow && !item.isOpenNow) return false;

        // Verification
        if (this.filters.verifiedOnly && !item.isVerified) return false;

        return true;
      });

      // 2. Filter Lawyers
      this.filteredLawyers = (this.lawyers || []).filter(lawyer => {
        if (!lawyer) return false;
        if (!this.filters.resourceTypes.Lawyer) return false;

        // Language check (if any checked)
        const activeLangs = Object.keys(this.filters.languages).filter(k => (this.filters.languages as any)[k]);
        if (activeLangs.length > 0) {
          const speaks = (lawyer.languagesSpoken || []).some((l: string) =>
            activeLangs.some(al => l.toLowerCase().includes(al.toLowerCase()))
          );
          if (!speaks) return false;
        }

        // Verified Only
        if (this.filters.verifiedOnly && !lawyer.isVerified) return false;

        return true;
      });

      // 3. Count
      this.allResultsCount = this.filteredResources.length + this.filteredLawyers.length + (this.filters.resourceTypes.Helpline ? this.helplines.length : 0);

      // Refresh markers on Map
      this.updateMapMarkers();
    } catch (err) {
      console.error('Error executing applyFilters():', err);
    }
  }

  // Selection actions
  selectCategory(catId: string) {
    this.activeCategory = catId;
    this.selectedSubcategories = [];
    if (catId === 'Other / Not Sure') {
      this.isAiMode = true;
    }

    // Smoothly scroll the details card into view
    setTimeout(() => {
      const cardEl = document.getElementById('category-details-card');
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }

  toggleSubcategory(sub: string) {
    const idx = this.selectedSubcategories.indexOf(sub);
    if (idx > -1) {
      this.selectedSubcategories.splice(idx, 1);
    } else {
      this.selectedSubcategories.push(sub);
    }

    if (this.isResultsMode) {
      this.applyFilters();
    }
  }

  // Trigger search and update query params
  triggerSearch() {
    const query = this.locationQuery.trim();
    if (!query) {
      this.locationQuery = 'New Delhi';
      this.executeSearch();
      return;
    }

    // Bypass geocoding if the query is already resolved (contains a comma)
    if (query.includes(',')) {
      this.executeSearch();
      return;
    }

    if ((window as any).google?.maps?.Geocoder) {
      this.isLoading = true;
      this.cdr.markForCheck();
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: query, componentRestrictions: { country: 'IN' } }, (results: any[], status: string) => {
        this.zone.run(() => {
          if (status === 'OK' && results[0]) {
            this.locationQuery = results[0].formatted_address;
            this.locationService.setLocation(this.locationQuery, false);
          }
          this.executeSearch();
        });
      });
    } else {
      this.locationService.setLocation(this.locationQuery, false);
      this.executeSearch();
    }
  }

  private executeSearch() {
    this.isResultsMode = true;
    this.isLoading = true;
    this.cdr.markForCheck();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: this.activeCategory,
        location: this.locationQuery
      },
      queryParamsHandling: 'merge'
    });
  }

  initMainLocationAutocomplete() {
    // Deprecated since we removed the input field from the landing state, keeping as no-op to prevent calls breaking
  }

  goBackToCategories() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: null,
        location: null
      }
    });
  }

  detectLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.zone.run(() => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            this.mapCenter = [lat, lng];
            
            if ((window as any).google?.maps?.Geocoder) {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
                this.zone.run(() => {
                  if (status === 'OK' && results[0]) {
                    this.locationQuery = results[0].formatted_address;
                  } else {
                    this.locationQuery = 'New Delhi';
                  }
                  this.locationService.setLocation(this.locationQuery, false);
                  this.triggerSearch();
                  this.cdr.markForCheck();
                });
              });
            } else {
              this.locationQuery = 'New Delhi';
              this.locationService.setLocation(this.locationQuery, false);
              this.triggerSearch();
              this.cdr.markForCheck();
            }
          });
        },
        (err) => {
          this.zone.run(() => {
            console.warn('Geolocation failed, falling back to manual entry', err);
            this.cdr.markForCheck();
          });
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }

  // Map Modal Interactions
  openMapModal() {
    this.showMapModal = true;
    this.cdr.markForCheck();
  }

  closeMapModal() {
    this.showMapModal = false;
    this.cdr.markForCheck();
  }

  onMapLocationConfirmed(address: string) {
    this.showMapModal = false;
    this.locationService.setLocation(address, false);
    this.cdr.markForCheck();
  }

  // Mode Toggle
  toggleSearchMode() {
    this.isAiMode = !this.isAiMode;
    this.cdr.markForCheck();
  }

  // Normal Mode Quick Search Suggestions logic
  handleNormalSearchInput() {
    const query = this.normalSearchQuery.trim().toLowerCase();
    if (!query) {
      this.filteredSuggestions = [];
      this.cdr.markForCheck();
      return;
    }

    const matches: Array<{ category: string, subcategory?: string, displayName: string }> = [];

    this.categories.forEach(cat => {
      // Check if category name matches
      if (cat.name.toLowerCase().includes(query)) {
        matches.push({
          category: cat.name,
          displayName: cat.name
        });
      }
      
      // Check if subcategories match
      cat.subcategories.forEach(sub => {
        if (sub.toLowerCase().includes(query)) {
          matches.push({
            category: cat.name,
            subcategory: sub,
            displayName: `${sub} (${cat.name})`
          });
        }
      });
    });

    this.filteredSuggestions = matches.slice(0, 5); // Limit to 5 suggestions
    this.cdr.markForCheck();
  }

  selectSuggestion(suggestion: { category: string, subcategory?: string, displayName: string }) {
    this.activeCategory = suggestion.category;
    if (suggestion.subcategory) {
      this.selectedSubcategories = [suggestion.subcategory];
    } else {
      this.selectedSubcategories = [];
    }
    this.normalSearchQuery = suggestion.displayName;
    this.filteredSuggestions = [];
    
    // Automatically trigger search
    this.triggerSearch();
    this.cdr.markForCheck();
  }

  triggerNormalSearch() {
    const query = this.normalSearchQuery.trim().toLowerCase();
    if (!query) return;

    // Try to find the best matching category or subcategory
    let bestMatch: { category: string, subcategory?: string } | null = null;
    
    // First pass: exact or close matches
    for (const cat of this.categories) {
      if (cat.name.toLowerCase() === query) {
        bestMatch = { category: cat.name };
        break;
      }
      for (const sub of cat.subcategories) {
        if (sub.toLowerCase() === query) {
          bestMatch = { category: cat.name, subcategory: sub };
          break;
        }
      }
      if (bestMatch) break;
    }

    // Second pass: partial matches
    if (!bestMatch) {
      for (const cat of this.categories) {
        if (cat.name.toLowerCase().includes(query)) {
          bestMatch = { category: cat.name };
          break;
        }
        for (const sub of cat.subcategories) {
          if (sub.toLowerCase().includes(query)) {
            bestMatch = { category: cat.name, subcategory: sub };
            break;
          }
        }
        if (bestMatch) break;
      }
    }

    if (bestMatch) {
      this.activeCategory = bestMatch.category;
      if (bestMatch.subcategory) {
        this.selectedSubcategories = [bestMatch.subcategory];
      } else {
        this.selectedSubcategories = [];
      }
      this.filteredSuggestions = [];
      this.triggerSearch();
    } else {
      // Fallback: search with active category
      this.triggerSearch();
    }
    this.cdr.markForCheck();
  }

  // AI Description match
  handleAiSearchInput() {
    if (!this.situationQuery.trim()) return;

    const query = this.situationQuery.toLowerCase();

    // Simple matching rules
    if (query.includes('rent') || query.includes('land') || query.includes('tenant') || query.includes('builder') || query.includes('rera') || query.includes('flat') || query.includes('property')) {
      this.activeCategory = 'Property Dispute';
      if (query.includes('tenant') || query.includes('rent')) this.selectedSubcategories = ['Tenancy Dispute'];
      else if (query.includes('builder') || query.includes('fraud')) this.selectedSubcategories = ['Builder Fraud'];
    } else if (query.includes('divorce') || query.includes('wife') || query.includes('husband') || query.includes('custody') || query.includes('maintenance')) {
      this.activeCategory = 'Family Law';
    } else if (query.includes('scam') || query.includes('product') || query.includes('refund') || query.includes('amazon') || query.includes('defect') || query.includes('charge')) {
      this.activeCategory = 'Consumer Complaint';
    } else if (query.includes('salary') || query.includes('fired') || query.includes('job') || query.includes('boss') || query.includes('unpaid') || query.includes('wage')) {
      this.activeCategory = 'Labour Issue';
    } else if (query.includes('police') || query.includes('fir') || query.includes('bail') || query.includes('arrest') || query.includes('threat')) {
      this.activeCategory = 'Criminal Matter';
    } else if (query.includes('hack') || query.includes('phish') || query.includes('facebook') || query.includes('whatsapp') || query.includes('stole') || query.includes('online')) {
      this.activeCategory = 'Cyber Crime';
    }
  }

  // Voice Speech API
  initVoiceSearch() {
    const windowObj = window as any;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'en-IN';
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        this.zone.run(() => {
          this.isRecording = true;
          this.cdr.markForCheck();
        });
      };

      this.recognition.onresult = (event: any) => {
        this.zone.run(() => {
          const text = event.results[0][0].transcript;
          this.situationQuery = text;
          this.handleAiSearchInput();
          this.isRecording = false;
          
          // Automatically trigger search when category/subcategories are parsed from voice search
          if (this.activeCategory) {
            this.triggerSearch();
          }
          this.cdr.markForCheck();
        });
      };

      this.recognition.onerror = (event: any) => {
        this.zone.run(() => {
          console.error('Speech recognition error', event.error);
          this.isRecording = false;
          this.cdr.markForCheck();
        });
      };

      this.recognition.onend = () => {
        this.zone.run(() => {
          this.isRecording = false;
          this.cdr.markForCheck();
        });
      };
    }
  }

  toggleVoiceRecording() {
    if (!this.recognition) {
      alert('Voice speech recognition is not supported in this browser. Try Chrome or Safari.');
      return;
    }

    if (this.isRecording) {
      this.recognition.stop();
    } else {
      this.recognition.start();
    }
  }

  // Legal Aid Eligibility logic
  startEligibilityCheck() {
    this.eligibilityStep = 1;
    this.eligibilityAnswers = { gender: '', income: '', category: '' };
  }

  submitEligibilityStep() {
    const ans = this.eligibilityAnswers;

    // Free legal aid criteria under Section 12 of LSA Act 1987 in India:
    // - Women and Children (always eligible)
    // - SC / ST categories (always eligible)
    // - Industrial workmen (always eligible)
    // - Income less than 3L per annum (or 1.25L in some states like Delhi, but general ceiling is 3L)
    const isWomanOrChild = ans.gender === 'female' || ans.gender === 'other';
    const isScStOrWorkman = ans.category === 'sc' || ans.category === 'st' || ans.category === 'labour';
    const isLowIncome = ans.income === 'under125' || ans.income === 'under300';

    if (isWomanOrChild || isScStOrWorkman || isLowIncome) {
      this.isFreeAidEligible = true;
    } else {
      this.isFreeAidEligible = false;
    }

    this.eligibilityStep = 2;

    // Trigger visual highlight: If eligible, check the Legal Aid box and filter only legal aid centers first
    if (this.isFreeAidEligible) {
      this.filters.resourceTypes.Court = false;
      this.filters.resourceTypes.GovernmentOffice = false;
      this.filters.resourceTypes.Lawyer = false;
      this.filters.resourceTypes.LegalAid = true;
      this.activeTab = 'LegalAid';
      this.applyFilters();
    }
  }

  resetEligibilityCheck() {
    this.eligibilityStep = 0;
    this.filters.resourceTypes.Court = true;
    this.filters.resourceTypes.GovernmentOffice = true;
    this.filters.resourceTypes.Lawyer = true;
    this.filters.resourceTypes.LegalAid = true;
    this.activeTab = 'All';
    this.applyFilters();
  }

  // Dynamic Google Maps Map setup
  private loadGoogleMaps(): Promise<void> {
    if (window.hasOwnProperty('google') && (window as any).google.maps) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const apiKey = (window as any).GOOGLE_MAPS_API_KEY || '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.body.appendChild(script);
    });
  }

  initMap() {
    const mapEl = document.getElementById('google-map-container');
    if (!mapEl) return;

    this.loadGoogleMaps().then(() => {
      const latLng = { lat: this.mapCenter[0], lng: this.mapCenter[1] };
      
      if (this.map) {
        try {
          if (document.getElementById('google-map-container')) {
            this.map.setCenter(latLng);
            this.map.setZoom(this.getZoomLevel());
            this.updateMapMarkers();
            this.cdr.markForCheck();
            return;
          } else {
            this.map = null;
          }
        } catch (e) {
          this.map = null;
        }
      }

      this.map = new google.maps.Map(mapEl, {
        center: latLng,
        zoom: this.getZoomLevel(),
        disableDefaultUI: this.isMobile,
        zoomControl: !this.isMobile,
        mapTypeControl: false,
        scaleControl: true,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false
      });

      this.setMapLayer();
      this.updateMapMarkers();
      this.cdr.markForCheck();
    }).catch(err => {
      console.error('Google Maps script load failed', err);
    });
  }

  setMapLayer() {
    if (this.map && window.hasOwnProperty('google')) {
      if (this.isSatelliteView) {
        this.map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
      } else {
        this.map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
        
        const isDark = document.documentElement.classList.contains('dark');
        
        const lightStyle = [
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ];

        const darkStyle = [
          { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] }
        ];

        this.map.setOptions({ styles: isDark ? darkStyle : lightStyle });
      }
    }
  }

  toggleSatelliteView() {
    this.isSatelliteView = !this.isSatelliteView;
    this.setMapLayer();
  }

  getZoomLevel(): number {
    const r = this.filters.radius;
    if (r <= 2) return 14;
    if (r <= 5) return 13;
    if (r <= 10) return 12;
    return 11;
  }

  clearMapMarkers() {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    if (this.userMarker) {
      this.userMarker.setMap(null);
      this.userMarker = null;
    }
  }

  updateMapMarkers() {
    if (!this.map || !window.hasOwnProperty('google')) return;

    try {
      this.clearMapMarkers();

      // 1. User Position pin
      this.userMarker = new google.maps.Marker({
        position: { lat: this.mapCenter[0], lng: this.mapCenter[1] },
        map: this.map,
        title: 'Your Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      const userPopup = new google.maps.InfoWindow({
        content: '<div class="p-1 font-sans text-slate-800"><b>Your Location</b></div>'
      });
      this.userMarker.addListener('click', () => {
        userPopup.open(this.map, this.userMarker);
      });

      // 2. Add resource pins
      (this.filteredResources || []).forEach(res => {
        if (!res) return;
        let color = '#9333ea'; // Purple
        if (res.type === 'Court') color = '#2563eb'; // Blue
        else if (res.type === 'GovernmentOffice') color = '#ea580c'; // Orange
        else if (res.type === 'PoliceStation') color = '#dc2626'; // Red

        if (res.coordinates && typeof res.coordinates.lat === 'number' && typeof res.coordinates.lng === 'number') {
          const marker = new google.maps.Marker({
            position: { lat: res.coordinates.lat, lng: res.coordinates.lng },
            map: this.map,
            title: res.name || 'Resource',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 1.5
            }
          });

          const popupContent = `
            <div class="p-1 text-slate-800" style="font-family: sans-serif;">
              <b style="font-size: 14px;">${res.name || 'Resource'}</b><br/>
              <span style="font-size: 11px; color:#64748b;">${res.type || ''} &bull; ${res.operatingHours || ''}</span><br/>
              <span style="font-size: 12px; display:inline-block; margin-top:4px;">${res.address || ''}</span>
            </div>
          `;
          const infoWindow = new google.maps.InfoWindow({ content: popupContent });
          marker.addListener('click', () => {
            infoWindow.open(this.map, marker);
          });

          this.markers.push(marker);
        }
      });

      // 3. Add lawyer pins (gold markers offset slightly from center)
      (this.filteredLawyers || []).forEach((lawyer, i) => {
        if (!lawyer) return;
        const offsetLat = (Math.sin(i) * 0.015) + 0.005;
        const offsetLng = (Math.cos(i) * 0.015) - 0.005;
        
        const marker = new google.maps.Marker({
          position: { lat: this.mapCenter[0] + offsetLat, lng: this.mapCenter[1] + offsetLng },
          map: this.map,
          title: lawyer.name || 'Lawyer',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: '#d97706',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 1.5
          }
        });

        const popupContent = `
          <div class="p-1 text-slate-800" style="font-family: sans-serif;">
            <b style="font-size: 14px;">${lawyer.name || 'Lawyer'}</b><br/>
            <span style="font-size: 11px; color:#d97706;">Recommended Lawyer &bull; ⭐ ${lawyer.rating || ''}</span><br/>
            <span style="font-size: 12px; display:inline-block; margin-top:4px;">${(lawyer.specializations && lawyer.specializations[0]) || ''} &bull; Fee: ₹${lawyer.consultationFee || 0}</span>
          </div>
        `;
        const infoWindow = new google.maps.InfoWindow({ content: popupContent });
        marker.addListener('click', () => {
          infoWindow.open(this.map, marker);
        });

        this.markers.push(marker);
      });
    } catch (err) {
      console.error('Error executing updateMapMarkers():', err);
    }
  }

  // tab selections
  selectTab(tab: string) {
    this.activeTab = tab;
    // Update active filter resource check
    if (tab === 'All') {
      this.filters.resourceTypes.LegalAid = true;
      this.filters.resourceTypes.Court = true;
      this.filters.resourceTypes.GovernmentOffice = true;
      this.filters.resourceTypes.Helpline = true;
      this.filters.resourceTypes.Lawyer = true;
    } else {
      // Set all false except selected
      Object.keys(this.filters.resourceTypes).forEach(k => {
        (this.filters.resourceTypes as any)[k] = (k === tab);
      });
    }
    this.applyFilters();
  }

  // Toggle layout views
  setViewMode(mode: 'split' | 'list' | 'map') {
    this.activeViewMode = mode;
    setTimeout(() => {
      if (this.map && window.hasOwnProperty('google')) {
        google.maps.event.trigger(this.map, 'resize');
        this.map.setCenter({ lat: this.mapCenter[0], lng: this.mapCenter[1] });
      }
    }, 100);
  }

  // Helper properties
  get showMap() {
    if (this.isMobile) {
      return this.activeViewMode === 'map';
    }
    return this.activeViewMode === 'split' || this.activeViewMode === 'map';
  }

  get showList() {
    if (this.isMobile) {
      return this.activeViewMode === 'list' || this.activeViewMode === 'split';
    }
    return this.activeViewMode === 'split' || this.activeViewMode === 'list';
  }

  // Direct Directions Call wrapper
  openDirections(lat: number, lng: number) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  }

  // Case Pack Offline Downloader
  downloadCasePack() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const documentChecklistHtml = this.roadmap.documents.map((d: string) => `<li>[ ] ${d}</li>`).join('');
    const actionStepsHtml = this.roadmap.steps.map((s: any, i: number) => `
      <div style="margin-bottom: 15px;">
        <b style="color: #1e3a8a;">Step ${i + 1}: ${s.title}</b>
        <p style="margin: 4px 0 0 0; color: #475569; font-size: 13px;">${s.detail}</p>
      </div>
    `).join('');

    const resourceCardsHtml = this.filteredResources.slice(0, 5).map(res => `
      <div style="border-bottom: 1px solid #e2e8f0; padding: 10px 0;">
        <b style="font-size: 14px;">${res.name} (${res.type})</b>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">${res.address}</p>
        <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Phone: ${res.contactNumber || 'N/A'} | Hours: ${res.operatingHours}</p>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>LegalConnect Case Pack - ${this.activeCategory}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 20px; }
            h1 { margin: 0; color: #1e3a8a; font-size: 24px; }
            h2 { color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; font-size: 16px; margin-top: 30px; }
            .meta { color: #64748b; font-size: 12px; margin-top: 5px; }
            ul { padding-left: 20px; font-size: 13px; }
            li { margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LegalConnect Offline Case Pack</h1>
            <div class="meta">Category: ${this.activeCategory} | Location: ${this.locationQuery} | Generated: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <h2>📋 PERSONALIZED LEGAL ROADMAP</h2>
          ${actionStepsHtml}

          <h2>📁 REQUIRED DOCUMENTS CHECKLIST</h2>
          <ul>${documentChecklistHtml}</ul>

          <h2>🏢 NEARBY SUPPORT CONTACTS</h2>
          ${resourceCardsHtml}

          <h2>💡 LOK ADALAT / ADR ADVISORY</h2>
          <p style="font-size: 13px; color: #475569;">${this.roadmap.lokAdalatGuidance}</p>

          <footer style="margin-top: 50px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center;">
            LegalConnect &copy; 2026. This is an informational case pack. Always consult a legal professional before filing suits.
          </footer>
          <script>
            window.onload = () => {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  // Handle Bookmarks
  toggleBookmark(resourceId: string) {
    // Mock bookmark trigger
    alert('Resource bookmarked successfully for easy tracking in your profile library!');
  }

  goToLawyerDetail(lawyerId: string) {
    this.router.navigate(['/lawyers', lawyerId]);
  }

  toggleLanguage(lang: string) {
    const langs = this.filters.languages as any;
    if (langs.hasOwnProperty(lang)) {
      langs[lang] = !langs[lang];
      this.applyFilters();
    }
  }

  isLanguageActive(lang: string): boolean {
    return !!(this.filters.languages as any)[lang];
  }

  resetFilters() {
    this.filters = {
      radius: 5,
      resourceTypes: {
        LegalAid: true,
        Court: true,
        GovernmentOffice: true,
        Helpline: true,
        Lawyer: true
      },
      openNow: true,
      languages: {
        English: true,
        Hindi: false,
        Punjabi: false,
        Bengali: false
      },
      verifiedOnly: false
    };
    this.activeTab = 'All';
    this.applyFilters();
  }

  get activeFiltersCount(): number {
    let count = 0;
    if (this.filters.radius !== 5) count++;
    if (this.filters.openNow) count++;
    if (this.filters.verifiedOnly) count++;

    // Resource types filter count (count how many are disabled, indicating user filtering)
    const resourceTypes = Object.values(this.filters.resourceTypes);
    const disabledCount = resourceTypes.filter(val => !val).length;
    if (disabledCount > 0) count++;

    // Languages filter count (English is checked by default, others are false)
    const langKeys = Object.keys(this.filters.languages) as Array<keyof typeof this.filters.languages>;
    const customLangs = langKeys.filter(k => k !== 'English' && this.filters.languages[k]);
    if (customLangs.length > 0 || !this.filters.languages.English) count++;

    return count;
  }
}