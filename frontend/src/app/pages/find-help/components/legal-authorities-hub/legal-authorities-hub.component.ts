import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef,
  AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { LocationService } from '../../../../services/location.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { OFFICIAL_GOV_PORTALS, OfficialGovPortal } from '../../config/category-data.config';

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

  private snackbar = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);
  private locationService = inject(LocationService);

  isDrawerOpen = false;
  selectedStateFilter = '';
  activeTab: 'state' | 'national' | 'govPortals' = 'state';
  isStateDropdownOpen = false;

  readonly govPortals: OfficialGovPortal[] = OFFICIAL_GOV_PORTALS;

  /** Reference to the wrapper div that holds backdrop + panel — teleported to body */
  @ViewChild('drawerRoot', { static: false }) drawerRootRef?: ElementRef<HTMLElement>;
  /** Reference to the state filter custom dropdown container to check clicks */
  @ViewChild('stateDropdown', { static: false }) stateDropdownRef?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isStateDropdownOpen && this.stateDropdownRef) {
      const clickedInside = this.stateDropdownRef.nativeElement.contains(event.target as Node);
      if (!clickedInside) {
        this.isStateDropdownOpen = false;
        this.cdr.markForCheck();
      }
    }
  }

  selectState(state: string): void {
    this.selectedStateFilter = state;
    this.isStateDropdownOpen = false;
    this.cdr.markForCheck();
  }

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

  get userStateName(): string {
    if (this.slsaResources.length > 0) {
      return this.slsaResources[0].state || '';
    }
    return '';
  }

  get hubPhones(): string[] {
    const nalsa = this.nationalAuthorities[0];
    if (!nalsa?.contactNumber) return ['15100'];
    const phones = String(nalsa.contactNumber).split(',').map(s => s.trim()).filter(Boolean);
    return phones.length > 0 ? phones : ['15100'];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['slsaResources'] || changes['allSlsaResources']) {
      this.cdr.markForCheck();
    }
  }

  ngAfterViewInit(): void {
    if (typeof document !== 'undefined' && this.drawerRootRef?.nativeElement) {
      document.body.appendChild(this.drawerRootRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined' && this.drawerRootRef?.nativeElement) {
      const el = this.drawerRootRef.nativeElement;
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
  }

  openDrawer(tab: 'state' | 'national' | 'govPortals' = 'state'): void {
    this.activeTab = tab;
    this.isDrawerOpen = true;
    this.cdr.markForCheck();
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
    this.cdr.markForCheck();
  }

  setTab(tab: 'state' | 'national' | 'govPortals'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  openDirections(resource: any): void {
    if (resource.coordinates?.lat && resource.coordinates?.lng) {
      this.directions.emit({
        lat: resource.coordinates.lat,
        lng: resource.coordinates.lng
      });
    } else {
      const query = encodeURIComponent(`${resource.name}, ${resource.address || resource.city}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  }

  openPortal(portal: OfficialGovPortal): void {
    this.snackbar.show(`Launching official ${portal.name}...`, 'info');
    window.open(portal.url, '_blank');
  }

  getPhones(res: any): string[] {
    if (!res.contactNumber) return [];
    return String(res.contactNumber).split(',').map(s => s.trim()).filter(Boolean);
  }

  getEmails(res: any): string[] {
    if (!res.email) return [];
    return String(res.email).split(',').map(s => s.trim()).filter(Boolean);
  }

  getFaxes(res: any): string[] {
    if (!res.faxNumber) return [];
    return String(res.faxNumber).split(',').map(s => s.trim()).filter(Boolean);
  }

  getCleanTelLink(phone: string): string {
    const digits = phone.replace(/[^0-9+]/g, '');
    return `tel:${digits}`;
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
      (_match, p1, p2) => {
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
      (_match, p1, p2) => {
        let result = 'Fax: <a href="tel:011' + p1 + '" class="text-slate-600 dark:text-slate-400 hover:underline font-bold no-underline">' + p1 + '</a>';
        if (p2) {
          result += ', <a href="tel:011' + p2 + '" class="text-slate-600 dark:text-slate-400 hover:underline font-bold no-underline">' + p2 + '</a>';
        }
        return result;
      }
    );

    return formatted;
  }

  trackByState(_: number, state: string): string {
    return state;
  }

  trackByAuthorityId(_: number, res: any): string {
    return res._id || res.name;
  }

  trackByString(_: number, val: string): string {
    return val;
  }

  trackByPortalId(_: number, portal: OfficialGovPortal): string {
    return portal.id;
  }
}