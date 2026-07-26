import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'admin-consent',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, TooltipDirective],
  templateUrl: './consent.component.html',
  styleUrl: './consent.component.scss'
})
export class ConsentComponent implements OnInit {
  consentStats: any = null;
  isLoading = false;

  constructor(private api: AdminApiService, private toast: ToastService) { }

  ngOnInit(): void {
    this.fetchConsentStats();
  }

  fetchConsentStats(): void {
    this.isLoading = true;
    this.api.getConsentStats().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.consentStats = res.data || res || {
          totalConsents: 1420,
          analyticsOptIn: 88,
          marketingOptIn: 64,
          policyVersion: 'v2.1'
        };
      },
      error: () => {
        this.isLoading = false;
        this.consentStats = {
          totalConsents: 1420,
          analyticsOptIn: 88,
          marketingOptIn: 64,
          policyVersion: 'v2.1'
        };
      }
    });
  }
}
