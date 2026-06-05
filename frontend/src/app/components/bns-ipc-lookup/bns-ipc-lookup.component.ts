import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface SectionEquivalency {
  ipcSection: string;
  bnsSection: string;
  title: string;
  category: string;
  description: string;
}

@Component({
  selector: 'app-bns-ipc-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bns-ipc-lookup.component.html',
  styleUrls: ['./bns-ipc-lookup.component.scss']
})
export class BnsIpcLookupComponent {
  searchQuery = '';
  searchResults: SectionEquivalency[] = [];
  hasSearched = false;

  // Curated lookup table of critical penal code section transformations (IPC to BNS)
  private lookupDb: SectionEquivalency[] = [
    {
      ipcSection: '302',
      bnsSection: '101',
      title: 'Punishment for Murder',
      category: 'Offences Affecting Life',
      description: 'Replaces Section 302 of the IPC. Outlines the capital punishments (death penalty or life imprisonment) and financial fines associated with murder convictions.'
    },
    {
      ipcSection: '307',
      bnsSection: '109',
      title: 'Attempt to Murder',
      category: 'Offences Affecting Life',
      description: 'Replaces Section 307 of the IPC. Governs acts committed with intent/knowledge that could lead to murder charges if death had occurred.'
    },
    {
      ipcSection: '378',
      bnsSection: '303',
      title: 'Theft',
      category: 'Offences Against Property',
      description: 'Replaces Section 378 of the IPC. Defines theft as moving movable property out of a person\'s possession without consent, dishonesty, and intent.'
    },
    {
      ipcSection: '420',
      bnsSection: '318',
      title: 'Cheating & Dishonestly Inducing Delivery',
      category: 'Offences Against Property',
      description: 'Replaces Section 420 of the IPC. Covers cheating that induces someone to deliver property or make/alter valuable securities.'
    },
    {
      ipcSection: '498A',
      bnsSection: '85',
      title: 'Cruelty to Married Woman',
      category: 'Offences Against Women & Children',
      description: 'Replaces Section 498A of the IPC. Punishes cruelty against a woman by her husband or relatives of her husband with imprisonment up to three years.'
    },
    {
      ipcSection: '304A',
      bnsSection: '106',
      title: 'Causing Death by Negligence',
      category: 'Offences Affecting Life',
      description: 'Replaces Section 304A of the IPC. Strengthens penalties for hit-and-run motor accidents and rash/negligent operations leading to loss of life.'
    },
    {
      ipcSection: '354',
      bnsSection: '74',
      title: 'Outraging Modesty of Woman',
      category: 'Offences Against Women & Children',
      description: 'Replaces Section 354 of the IPC. Punishes assaults or use of criminal force with intent to outrage modesty.'
    },
    {
      ipcSection: '304B',
      bnsSection: '80',
      title: 'Dowry Death',
      category: 'Offences Against Women & Children',
      description: 'Replaces Section 304B of the IPC. Dictates rules on dowry deaths where death occurs under abnormal circumstances within 7 years of marriage.'
    },
    {
      ipcSection: '120B',
      bnsSection: '61(2)',
      title: 'Criminal Conspiracy',
      category: 'General Exceptions & Conspiracy',
      description: 'Replaces Section 120B of the IPC. Governs agreements between individuals to perform illegal acts or execute legal acts by illegal means.'
    },
    {
      ipcSection: '376',
      bnsSection: '64',
      title: 'Punishment for Rape',
      category: 'Offences Against Women & Children',
      description: 'Replaces Section 376 of the IPC. Lays down punishments for rape, aligning with BNS Section 63 (which defines the offence).'
    },
    {
      ipcSection: '323',
      bnsSection: '115',
      title: 'Voluntarily Causing Hurt',
      category: 'Offences Affecting Human Body',
      description: 'Replaces Section 323 of the IPC. Covers minor assaults and voluntarily causing hurt to any person.'
    },
    {
      ipcSection: '506',
      bnsSection: '351',
      title: 'Criminal Intimidation',
      category: 'Offences Affecting Public Peace',
      description: 'Replaces Section 506 of the IPC. Covers threatening a person with injury to their person, reputation, or property.'
    }
  ];

  ngOnInit() {
    // Show a few popular sections initially
    this.searchResults = this.lookupDb.slice(0, 3);
  }

  onSearch() {
    this.hasSearched = true;
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.searchResults = this.lookupDb.slice(0, 3);
      this.hasSearched = false;
      return;
    }

    this.searchResults = this.lookupDb.filter(sec => 
      sec.ipcSection.toLowerCase().includes(query) ||
      sec.bnsSection.toLowerCase().includes(query) ||
      sec.title.toLowerCase().includes(query) ||
      sec.category.toLowerCase().includes(query)
    );
  }

  clearSearch() {
    this.searchQuery = '';
    this.hasSearched = false;
    this.searchResults = this.lookupDb.slice(0, 3);
  }
}
