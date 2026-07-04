import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef,
  AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { LocationService } from '../../../../services/location.service';

@Component({
  selector: 'app-legal-authorities-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './legal-authorities-hub.component.html',
  styleUrls: ['./legal-authorities-hub.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalAuthoritiesHubComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() nationalAuthorities: any[] = [];
  @Input() slsaResources: any[] = [];
  @Input() allSlsaResources: any[] = []; // All SLSA from DB (for cross-state filter)
  @Output() directions = new EventEmitter<{ lat: number; lng: number }>();

  isDrawerOpen = false;
  selectedStateFilter = '';
  activeTab: 'state' | 'national' = 'state';
  isStateDropdownOpen = false;

  /** Reference to the wrapper div that holds backdrop + panel — teleported to body */
  @ViewChild('drawerRoot', { static: false }) drawerRootRef?: ElementRef<HTMLElement>;
  /** Reference to the state filter custom dropdown container to check clicks */
  @ViewChild('stateDropdown', { static: false }) stateDropdownRef?: ElementRef<HTMLElement>;

  constructor(
    private cdr: ChangeDetectorRef,
    private locationService: LocationService
  ) { }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isStateDropdownOpen && this.stateDropdownRef) {
      const clickedInside = this.stateDropdownRef.nativeElement.contains(event.target as Node);
      if (!clickedInside) {
        this.isStateDropdownOpen = false;
        this.cdr.markForCheck();
      }
    }
  }

  selectState(state: string) {
    this.selectedStateFilter = state;
    this.isStateDropdownOpen = false;
    this.cdr.markForCheck();
  }

  // All unique states from allSlsaResources
  get availableStates(): string[] {
    const states = this.allSlsaResources
      .filter(r => r.isStateAuthority)
      .map(r => r.state as string)
      .filter(Boolean);
    return [...new Set(states)].sort();
  }

  get statesList(): string[] {
    return this.availableStates.filter(st => this.locationService.isState(st));
  }

  get utList(): string[] {
    return this.availableStates.filter(st => this.locationService.isUnionTerritory(st));
  }

  get displayedNalsa(): any[] {
    return this.nationalAuthorities;
  }

  get displayedSlsa(): any[] {
    if (this.selectedStateFilter === 'all') {
      return this.allSlsaResources.filter(r => r.isStateAuthority);
    }

    if (this.selectedStateFilter) {
      return this.allSlsaResources.filter(
        r => r.isStateAuthority && r.state === this.selectedStateFilter
      );
    }
    return this.slsaResources;
  }

  // Auto label for the hub banner
  get userStateName(): string {
    if (this.slsaResources.length > 0) {
      return this.slsaResources[0].state || '';
    }
    return '';
  }

  get hubPhones(): string[] {
    const nalsa = this.nationalAuthorities[0];
    if (!nalsa?.contactNumber) return [];
    if (Array.isArray(nalsa.contactNumber)) {
      return nalsa.contactNumber.slice(0, 2);
    }
    return nalsa.contactNumber.split(/[,\/]/).map((p: string) => p.trim()).filter((p: string) => p.length > 0).slice(0, 2);
  }

  ngAfterViewInit() {
    // Teleport the drawer wrapper to document.body so it escapes any
    // parent overflow-y-auto / transform containing blocks on find-help page.
    if (this.drawerRootRef?.nativeElement) {
      document.body.appendChild(this.drawerRootRef.nativeElement);
    }
  }

  ngOnDestroy() {
    const el = this.drawerRootRef?.nativeElement;
    if (el && el.parentNode === document.body) {
      document.body.removeChild(el);
    }
    document.body.classList.remove('overflow-hidden');
  }

  openDrawer(tab: 'state' | 'national' = 'state') {
    this.activeTab = tab;
    this.selectedStateFilter = '';
    this.isDrawerOpen = true;
    document.body.classList.add('overflow-hidden');
    this.cdr.markForCheck();
  }

  closeDrawer() {
    this.isDrawerOpen = false;
    document.body.classList.remove('overflow-hidden');
    this.cdr.markForCheck();
  }

  setTab(tab: 'state' | 'national') {
    this.activeTab = tab;
    if (tab === 'state') {
      this.selectedStateFilter = '';
    }
  }

  getPhones(resource: any): string[] {
    if (!resource?.contactNumber) return [];
    if (Array.isArray(resource.contactNumber)) {
      return resource.contactNumber;
    }
    return resource.contactNumber
      .split(/[,\/]/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);
  }

  getEmails(resource: any): string[] {
    if (!resource?.email) return [];
    if (Array.isArray(resource.email)) {
      return resource.email;
    }
    return resource.email
      .split(/[,\s]+/)
      .map((e: string) => e.trim())
      .filter((e: string) => e.includes('@'));
  }

  getFaxes(resource: any): string[] {
    if (!resource?.faxNumber) return [];
    if (Array.isArray(resource.faxNumber)) {
      return resource.faxNumber;
    }
    return resource.faxNumber
      .split(/[,\/]/)
      .map((f: string) => f.trim())
      .filter((f: string) => f.length > 0);
  }

  callPhone(num: string) {
    const cleaned = num.replace(/\s+/g, '').replace(/-/g, '');
    window.open(`tel:${cleaned}`, '_self');
  }

  getCleanTelLink(num: string): string {
    if (!num) return '';
    const cleaned = num.replace(/\s+/g, '').replace(/-/g, '');
    return `tel:${cleaned}`;
  }

  openEmail(email: string) {
    if (email) window.open(`mailto:${email}`, '_self');
  }

  openWebsite(url: string) {
    if (url) window.open(url, '_blank');
  }

  openDirections(resource: any) {
    if (resource?.coordinates) {
      this.directions.emit(resource.coordinates);
      this.closeDrawer();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Default to user's detected state when allSlsaResources changes
    if (changes['slsaResources'] && this.slsaResources.length > 0) {
      this.selectedStateFilter = '';
    }
  }

  formatSclscSecretary(text: string): string {
    if (!text) return '';
    let formatted = text;

    // 1. Format Web: www.sclsc.nic.in -> opens in new tab
    formatted = formatted.replace(
      /Web:\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      'Web: <a href="https://$1" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline font-bold no-underline">$1</a>'
    );

    // 2. Format Email: sclsc@nic.in -> opens mail client
    formatted = formatted.replace(
      /Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      'Email: <a href="mailto:$1" class="text-indigo-600 dark:text-indigo-400 hover:underline font-bold no-underline">$1</a>'
    );

    // 3. Format Tel: 23112153, 23772154 -> adds 011 Delhi prefix and makes clickable
    formatted = formatted.replace(
      /Tel:\s*(\d{8})(?:\s*,\s*(\d{8}))?/g,
      (match, p1, p2) => {
        let result = 'Tel: <a href="tel:011' + p1 + '" class="text-emerald-600 dark:text-emerald-400 hover:underline font-bold no-underline">' + p1 + '</a>';
        if (p2) {
          result += ', <a href="tel:011' + p2 + '" class="text-emerald-600 dark:text-emerald-400 hover:underline font-bold no-underline">' + p2 + '</a>';
        }
        return result;
      }
    );

    // 4. Format Fax: 23073970, 23388597
    formatted = formatted.replace(
      /Fax:\s*(\d{8})(?:\s*,\s*(\d{8}))?/g,
      (match, p1, p2) => {
        let result = 'Fax: <a href="tel:011' + p1 + '" class="text-slate-600 dark:text-slate-400 hover:underline font-bold no-underline">' + p1 + '</a>';
        if (p2) {
          result += ', <a href="tel:011' + p2 + '" class="text-slate-600 dark:text-slate-400 hover:underline font-bold no-underline">' + p2 + '</a>';
        }
        return result;
      }
    );

    return formatted;
  }

}