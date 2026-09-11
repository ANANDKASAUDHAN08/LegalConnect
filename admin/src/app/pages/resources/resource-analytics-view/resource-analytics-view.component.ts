import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminApiService } from '../../../core/admin-api.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { AdminIconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'admin-resource-analytics-view',
  standalone: true,
  imports: [CommonModule, TooltipDirective, AdminIconComponent],
  templateUrl: './resource-analytics-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceAnalyticsViewComponent implements OnInit, OnDestroy {
  analytics: any = null;
  isLoading = true;
  private destroy$ = new Subject<void>();

  constructor(
    private api: AdminApiService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.fetchAnalytics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchAnalytics(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.api.getResourceAnalytics().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.analytics = res.data;
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
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