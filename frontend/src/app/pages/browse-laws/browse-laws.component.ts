import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { LegalService, BareActSummary } from '../../services/legal.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-browse-laws',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, FormsModule],
  templateUrl: './browse-laws.component.html',
  styleUrls: ['./browse-laws.component.scss']
})
export class BrowseLawsComponent implements OnInit {
  acts: BareActSummary[] = [];
  searchQuery = '';
  loading = true;
  error = '';

  constructor(private legalService: LegalService) {}

  ngOnInit() {
    this.legalService.getAllActs().subscribe({
      next: res => { this.acts = res.data; this.loading = false; },
      error: () => { this.error = 'Could not load acts from the server.'; this.loading = false; }
    });
  }

  get filteredActs() {
    if (!this.searchQuery.trim()) return this.acts;
    const q = this.searchQuery.toLowerCase();
    return this.acts.filter(a =>
      a.actName.toLowerCase().includes(q) ||
      a.shortName.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    );
  }
}
