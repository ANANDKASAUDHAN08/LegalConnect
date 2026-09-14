import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminApiService } from '../../../core/admin-api.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { AdminIconComponent } from '../../../shared/components/icon/icon.component';

export interface DrillDownFilterEvent {
  filterType: 'type' | 'state' | 'facility' | 'status';
  value: string;
}

@Component({
  selector: 'admin-resource-analytics-view',
  standalone: true,
  imports: [CommonModule, TooltipDirective, AdminIconComponent],
  templateUrl: './resource-analytics-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceAnalyticsViewComponent implements OnInit, OnDestroy {
  @Output() drillDown = new EventEmitter<DrillDownFilterEvent>();

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

  drillDownType(type: string): void {
    this.drillDown.emit({ filterType: 'type', value: type });
  }

  drillDownState(state: string): void {
    this.drillDown.emit({ filterType: 'state', value: state });
  }

  drillDownFacility(facilityKey: string): void {
    this.drillDown.emit({ filterType: 'facility', value: facilityKey });
  }

  drillDownStatus(status: string): void {
    this.drillDown.emit({ filterType: 'status', value: status });
  }

  exportReport(): void {
    if (!this.analytics) return;
    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalResources: this.analytics.totalResources,
        approvedCount: this.analytics.approvedCount,
        pendingCount: this.analytics.pendingCount,
        staleAuditsCount: this.analytics.staleCount,
        citizenViews: this.analytics.totalViews,
        satisfactionRate: `${this.analytics.satisfactionRate}%`,
        upvotes: this.analytics.totalUpvotes,
        downvotes: this.analytics.totalDownvotes
      },
      infrastructureCoverage: this.analytics.facilities,
      typeBreakdown: this.analytics.typeBreakdown || this.analytics.typeDistribution,
      stateDistribution: this.analytics.stateDistribution || this.analytics.topStates,
      topViewedInstitutions: this.analytics.topViewed,
      auditAttentionRequired: this.analytics.topStale
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `legalconnect-registry-telemetry-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
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