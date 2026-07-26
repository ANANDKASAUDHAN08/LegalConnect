import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { AdminReviewItem } from '../../core/models/admin.models';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';

@Component({
  selector: 'admin-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.scss'
})
export class ReviewsComponent implements OnInit {
  reviews: AdminReviewItem[] = [];
  isLoading = false;
  ratingFilter = '';

  ratingOptions: SelectOption[] = [
    { label: 'All Ratings', value: '' },
    { label: '5 Stars Only', value: '5', icon: 'star' },
    { label: '4 Stars & Above', value: '4', icon: 'star' },
    { label: '3 Stars & Above', value: '3', icon: 'star' }
  ];

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService
  ) { }

  ngOnInit(): void {
    this.fetchReviews();
  }

  fetchReviews(): void {
    this.isLoading = true;
    this.api.getReviews({ rating: this.ratingFilter || undefined }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.reviews = res.data || [];
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'Failed to fetch reviews.');
      }
    });
  }

  async deleteReview(id: number): Promise<void> {
    const confirmed = await this.dialog.danger(
      'Delete Public Review',
      'Are you sure you want to delete this public review permanently? This action cannot be undone.'
    );

    if (confirmed) {
      this.api.deleteReview(id).subscribe({
        next: () => {
          this.toast.success('Review deleted successfully.');
          this.fetchReviews();
        },
        error: (err: any) => this.toast.error(err?.error?.message || 'Failed to delete review.')
      });
    }
  }
}