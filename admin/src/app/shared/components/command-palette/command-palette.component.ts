import { Component, HostListener, signal, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

export interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions' | 'Directory';
  title: string;
  description: string;
  icon: string;
  action: () => void;
}

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  isOpen = signal(false);

  toggle(): void {
    this.isOpen.set(!this.isOpen());
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}

@Component({
  selector: 'admin-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss'
})
export class CommandPaletteComponent {
  query = '';
  selectedIndex = 0;

  commands: CommandItem[] = [
    {
      id: 'cmd-dash',
      category: 'Navigation',
      title: 'Go to Dashboard',
      description: 'Overview analytics, system counters & registration graphs',
      icon: 'grid',
      action: () => this.router.navigate(['/dashboard'])
    },
    {
      id: 'cmd-users',
      category: 'Directory',
      title: 'User Management',
      description: 'Manage citizens, legal seekers & client accounts',
      icon: 'users',
      action: () => this.router.navigate(['/users'])
    },
    {
      id: 'cmd-lawyers',
      category: 'Directory',
      title: 'Lawyer Verification Queue',
      description: 'Verify advocate bar license credentials & profiles',
      icon: 'check-circle',
      action: () => this.router.navigate(['/lawyers'])
    },
    {
      id: 'cmd-support',
      category: 'Actions',
      title: 'Support Desk & Grievances',
      description: 'Manage tickets, DPO escalations & resolution notes',
      icon: 'life-buoy',
      action: () => this.router.navigate(['/support'])
    },
    {
      id: 'cmd-security',
      category: 'Actions',
      title: 'Security & Active Sessions',
      description: 'Audit logs, IT Act export compliance & 2FA enforcement',
      icon: 'shield',
      action: () => this.router.navigate(['/security'])
    },
    {
      id: 'cmd-notifications',
      category: 'Navigation',
      title: 'Notifications & Telemetry Hub',
      description: 'Real-time alert stream, severity matrix & broadcast dispatcher',
      icon: 'bell',
      action: () => this.router.navigate(['/notifications'])
    },
    {
      id: 'cmd-acts',
      category: 'Navigation',
      title: 'Statutory Bare Acts',
      description: 'Browse BNS, BNSS, BSA legal statutory content catalog',
      icon: 'book',
      action: () => this.router.navigate(['/legal-content'])
    }
  ];

  filteredItems: CommandItem[] = [...this.commands];

  constructor(public palette: CommandPaletteService, private router: Router) { }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.toggle();
      this.query = '';
      this.filteredItems = [...this.commands];
      this.selectedIndex = 0;
    } else if (event.key === 'Escape' && this.palette.isOpen()) {
      this.palette.close();
    }
  }

  onSearch(): void {
    const q = this.query.toLowerCase().trim();
    if (!q) {
      this.filteredItems = [...this.commands];
    } else {
      this.filteredItems = this.commands.filter(
        c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
      );
    }
    this.selectedIndex = 0;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.filteredItems[this.selectedIndex]) {
        this.execute(this.filteredItems[this.selectedIndex]);
      }
    }
  }

  execute(item: CommandItem): void {
    item.action();
    this.palette.close();
  }
}