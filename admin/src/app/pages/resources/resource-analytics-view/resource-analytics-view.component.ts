import { Component, Input, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../../core/admin-api.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

@Component({
  selector: 'admin-resource-analytics-view',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './resource-analytics-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceAnalyticsViewComponent implements OnInit {
  analytics: any = null;
  isLoading = true;

  constructor(
    private api: AdminApiService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.fetchAnalytics();
  }

  fetchAnalytics(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.api.getResourceAnalytics().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.analytics = res.data;
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'Court': 'Courts',
      'LegalAid': 'Legal Aid Centers',
      'PoliceStation': 'Police Stations',
      'GovernmentOffice': 'Government Offices',
      'Helpline': 'Emergency Helplines',
      'Notary': 'Public Notaries',
      'LokAdalat': 'Lok Adalats',
      'MediationCenter': 'Mediation Centers',
      'BarAssociation': 'Bar Associations'
    };
    return map[type] || type;
  }
}