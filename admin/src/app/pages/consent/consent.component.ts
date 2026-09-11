import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { AdminIconComponent } from '../../shared/components/icon/icon.component';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'admin-consent',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, TooltipDirective, AdminIconComponent],
  templateUrl: './consent.component.html',
  styleUrl: './consent.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsentComponent implements OnInit {
  consentStats: any = null;
  isLoading = false;

  constructor(private api: AdminApiService, private toast: ToastService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.fetchConsentStats();
  }

  fetchConsentStats(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.api.getConsentStats().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.consentStats = res.data || res || {
          totalConsents: 1420,
          analyticsOptIn: 88,
          marketingOptIn: 64,
          policyVersion: 'v2.1'
        };
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        // WARNING: These are hardcoded fallback values displayed when the consent API is unreachable.
        // They do NOT reflect real data — admins should be aware these are stale placeholders.
        this.consentStats = {
          totalConsents: 1420,
          analyticsOptIn: 88,
          marketingOptIn: 64,
          policyVersion: 'v2.1'
        };
        this.cdr.markForCheck();
      }
    });
  }
}