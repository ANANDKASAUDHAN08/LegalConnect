import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'admin-legal-content',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SkeletonComponent, TooltipDirective],
  templateUrl: './legal-content.component.html',
  styleUrl: './legal-content.component.scss'
})
export class LegalContentComponent implements OnInit {
  acts: any[] = [];
  isLoading = false;

  constructor(private api: AdminApiService, private toast: ToastService, private router: Router) { }

  ngOnInit(): void {
    this.fetchActs();
  }

  fetchActs(): void {
    this.isLoading = true;
    this.api.getActs().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.acts = res.data || [];
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error('Failed to load Bare Acts directory.');
      }
    });
  }

  openActDetail(shortName: string, inNewTab = true): void {
    if (inNewTab) {
      window.open(`/legal-content/${shortName}`, '_blank');
    } else {
      this.router.navigate(['/legal-content', shortName]);
    }
  }
}
