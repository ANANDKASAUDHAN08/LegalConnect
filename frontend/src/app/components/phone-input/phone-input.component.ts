import {
  Component, forwardRef, Input, Output, EventEmitter, OnDestroy, signal, computed,
  ChangeDetectionStrategy, ElementRef, ViewChild, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { COUNTRIES, CountryData } from '../../constants/countries.constant';
import { IconComponent } from '../icon/icon.component';

import { TooltipDirective } from '../../directives/tooltip.directive';

/**
 * Shared Phone Input with Country Code Dropdown
 *
 * Accepts/emits the full phone string (e.g. "+91 9876543210")
 * but internally manages country code + phone body separately.
 *
 * Usage:
 *   <app-phone-input formControlName="phone" label="Phone Number"></app-phone-input>
 */
@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true
    }
  ],
  templateUrl: './phone-input.component.html'
})
export class PhoneInputComponent implements ControlValueAccessor, OnDestroy {
  @Input() label = 'Phone Number';
  @Input() inputId = 'phone-input';
  @Input() errorId = '';
  @Input() isVerified: boolean | null = null;
  @Input() showVerifyAction = false;
  @Input() accent: 'blue' | 'amber' = 'amber';

  @Output() verify = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  // ─── State ───────────────────────────────────────────────────
  readonly countries = COUNTRIES;
  selectedCountry = signal<CountryData>(this.countries.find(c => c.short === 'IN') || this.countries[0]);
  phoneBody = signal('');
  showDropdown = signal(false);
  searchText = signal('');
  disabled = signal(false);

  private onChange: (value: string) => void = () => { };
  private onTouched: () => void = () => { };

  // ─── Computed ────────────────────────────────────────────────
  filteredCountries = computed(() => {
    const search = this.searchText().toLowerCase().trim();
    if (!search) return this.countries;
    const searchNoPlus = search.replace(/^\+/, '');
    const matches = this.countries.filter(c => {
      const name = c.name.toLowerCase();
      const short = c.short.toLowerCase();
      const code = c.code.toLowerCase();
      const codeNoPlus = code.replace(/^\+/, '');
      return (
        name.includes(search) ||
        short.includes(search) ||
        code.includes(search) ||
        codeNoPlus.includes(searchNoPlus)
      );
    });

    return matches.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aShort = a.short.toLowerCase();
      const bShort = b.short.toLowerCase();
      const aCode = a.code.replace(/^\+/, '');
      const bCode = b.code.replace(/^\+/, '');

      const aExactShort = aShort === search ? 1 : 0;
      const bExactShort = bShort === search ? 1 : 0;
      if (aExactShort !== bExactShort) return bExactShort - aExactShort;

      const aStartsName = aName.startsWith(search) ? 1 : 0;
      const bStartsName = bName.startsWith(search) ? 1 : 0;
      if (aStartsName !== bStartsName) return bStartsName - aStartsName;

      const aStartsCode = aCode.startsWith(searchNoPlus) ? 1 : 0;
      const bStartsCode = bCode.startsWith(searchNoPlus) ? 1 : 0;
      if (aStartsCode !== bStartsCode) return bStartsCode - aStartsCode;

      return aName.localeCompare(bName);
    });
  });

  // ─── ControlValueAccessor ────────────────────────────────────
  writeValue(value: string | null): void {
    if (!value) {
      this.selectedCountry.set(this.countries.find(c => c.short === 'IN') || this.countries[0]);
      this.phoneBody.set('');
      return;
    }

    // Parse the full phone string to extract country code + body
    const sortedCountries = [...this.countries].sort((a, b) => b.code.length - a.code.length);
    const cleanValue = value.replace(/\s+/g, '');
    for (const c of sortedCountries) {
      if (cleanValue.startsWith(c.code)) {
        this.selectedCountry.set(c);
        this.phoneBody.set(cleanValue.substring(c.code.length));
        return;
      }
    }

    // Fallback: India + raw digits
    this.selectedCountry.set(this.countries.find(c => c.short === 'IN') || this.countries[0]);
    this.phoneBody.set(value.replace(/\D/g, ''));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // ─── Actions ─────────────────────────────────────────────────
  toggleDropdown(): void {
    if (this.disabled()) return;
    const isOpen = !this.showDropdown();
    this.showDropdown.set(isOpen);
    if (isOpen) {
      this.searchText.set('');
      setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
    }
  }

  selectCountry(country: CountryData): void {
    this.selectedCountry.set(country);
    this.showDropdown.set(false);
    this.searchText.set('');
    this.emitValue();
  }

  closeDropdown(): void {
    this.showDropdown.set(false);
    this.searchText.set('');
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Strip non-digits
    const digits = input.value.replace(/\D/g, '');
    this.phoneBody.set(digits);
    input.value = digits;
    this.emitValue();
  }

  onPhoneKeypress(event: KeyboardEvent): void {
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onBlur(): void {
    this.onTouched();
  }

  onVerifyClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.verify.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Close dropdown when clicking outside (handled by backdrop in template)
  }

  private emitValue(): void {
    const body = this.phoneBody();
    if (!body) {
      this.onChange('');
    } else {
      this.onChange(`${this.selectedCountry().code} ${body}`.trim());
    }
  }

  // ─── TrackBy ─────────────────────────────────────────────────
  trackByCountryCode(_index: number, country: CountryData): string {
    return country.short;
  }

  ngOnDestroy(): void {
    this.showDropdown.set(false);
  }
}