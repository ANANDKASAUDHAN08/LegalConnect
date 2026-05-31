import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SnackbarService } from '../../../../services/snackbar.service';

@Component({
  selector: 'app-notifications-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications-tab.component.html'
})
export class NotificationsTabComponent implements OnInit {
  prefs = {
    caseUpdates: true,
    newMessages: true,
    reminders: true,
    receipts: true,
    promotional: false
  };

  constructor(private snackbar: SnackbarService) {}

  ngOnInit() {
    const saved = localStorage.getItem('lc_notif_prefs');
    if (saved) {
      try {
        this.prefs = JSON.parse(saved);
      } catch {}
    }
  }

  savePrefs() {
    localStorage.setItem('lc_notif_prefs', JSON.stringify(this.prefs));
    this.snackbar.show('Notification preferences updated!', 'success');
  }
}
