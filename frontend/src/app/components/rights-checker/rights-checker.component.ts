import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RightsService, StatutoryRight } from '../../services/rights.service';

export interface RightsCheckerCard {
  title: string;
  icon: string;
  summary: string;
  lawRef: string;
  link: string;
  queryParams?: Record<string, any>;
  fragment?: string;
  sourceAuthority?: string;
  reviewStatus?: string;
  lastVerified?: string;
}

@Component({
  selector: 'app-rights-checker',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rights-checker.component.html',
  styleUrls: ['./rights-checker.component.scss']
})
export class RightsCheckerComponent implements OnInit {
  private rightsService = inject(RightsService);
  selectedRightsCard: number | null = null;
  isLoading = true;
  hasError = false;

  // Fully dynamic cards loaded strictly from MongoDB legal knowledge database
  rightsCards: RightsCheckerCard[] = [];

  ngOnInit(): void {
    this.loadCards();
  }

  loadCards(): void {
    this.isLoading = true;
    this.hasError = false;

    // Dynamically load verified statutory rights from backend database
    this.rightsService.fetchRights('All', '', 'popular').subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.populateFromDynamicRights(res.data);
          this.isLoading = false;
        } else {
          this.isLoading = false;
          if (this.rightsCards.length === 0) {
            this.hasError = true;
          }
        }
      },
      error: () => {
        this.isLoading = false;
        if (this.rightsCards.length === 0) {
          this.hasError = true;
        }
      }
    });
  }

  private populateFromDynamicRights(rights: StatutoryRight[]): void {
    const popular = rights.filter(r => r.isPopular);
    const chosen = popular.length >= 4 ? popular.slice(0, 4) : rights.slice(0, 4);

    if (chosen.length > 0) {
      this.rightsCards = chosen.map(r => {
        let iconType = 'police';
        const titleLower = r.title.toLowerCase();
        const catLower = r.category.toLowerCase();

        if (titleLower.includes('tenant') || titleLower.includes('rent') || catLower.includes('property')) {
          iconType = 'tenant';
        } else if (titleLower.includes('consumer') || titleLower.includes('refund') || catLower.includes('consumer')) {
          iconType = 'consumer';
        } else if (titleLower.includes('information') || titleLower.includes('rti') || catLower.includes('governance')) {
          iconType = 'rti';
        } else {
          iconType = 'police';
        }

        const secStr = r.statutoryBasis.sections && r.statutoryBasis.sections.length > 0
          ? ` ${r.statutoryBasis.sections.join(', ')}`
          : '';
        const lawRef = `${r.statutoryBasis.shortAct || r.statutoryBasis.actName}${secStr}`;
        const queryParams: Record<string, string> = r.scenarioTag
          ? { scenario: r.scenarioTag }
          : { q: r.title.split(' ')[0] };

        const card: RightsCheckerCard = {
          title: r.title,
          icon: iconType,
          summary: r.summary,
          lawRef,
          link: '/rights',
          queryParams,
          fragment: r.id,
          sourceAuthority: r.provenance?.sourceAuthority || 'India Code / Legislative Dept',
          reviewStatus: r.provenance?.reviewStatus || 'verified',
          lastVerified: r.verifiedDate
        };
        return card;
      });
    }
  }

  toggleRightsCard(index: number) {
    if (this.selectedRightsCard === index) {
      this.selectedRightsCard = null;
    } else {
      this.selectedRightsCard = index;
    }
  }

  get activeRightsCard() {
    return this.selectedRightsCard !== null ? this.rightsCards[this.selectedRightsCard] : null;
  }
}