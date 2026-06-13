import { Component } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LegalService } from '../../services/legal.service';

@Component({
  selector: 'app-law-mapper',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, RouterLink, FormsModule],
  templateUrl: './law-mapper.component.html',
  styleUrls: ['./law-mapper.component.scss']
})
export class LawMapperComponent {
  selectedAct = 'IPC';
  sectionNumber = '';
  loading = false;
  error = '';
  result: any = null;

  popularSections = [
    { act: 'IPC', num: '302', label: 'IPC 302: Murder' },
    { act: 'IPC', num: '420', label: 'IPC 420: Cheating' },
    { act: 'IPC', num: '376', label: 'IPC 376: Rape' },
    { act: 'IPC', num: '120B', label: 'IPC 120B: Conspiracy' },
    { act: 'CrPC', num: '154', label: 'CrPC 154: FIR' },
    { act: 'CrPC', num: '125', label: 'CrPC 125: Maintenance' },
    { act: 'IEA', num: '32', label: 'IEA 32: Dying Declaration' },
    { act: 'IEA', num: '45', label: 'IEA 45: Expert Opinion' }
  ];

  constructor(private legalService: LegalService) {}

  selectPopular(act: string, num: string) {
    this.selectedAct = act;
    this.sectionNumber = num;
    this.getMapping();
  }

  getMapping() {
    if (!this.sectionNumber.trim()) {
      this.error = 'Please enter a section number.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.result = null;

    this.legalService.getTransitionMapping(this.selectedAct, this.sectionNumber).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.result = res;
        } else {
          this.error = 'Failed to load mapping details.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Section not found or mapping not available.';
      }
    });
  }
}
