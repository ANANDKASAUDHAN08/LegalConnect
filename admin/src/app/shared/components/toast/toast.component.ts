import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastNotification } from '../../services/toast.service';

@Component({
  selector: 'admin-toasts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss'
})
export class ToastComponent {
  get toasts(): ToastNotification[] {
    return this.toastService['toastsSubject'].value;
  }

  constructor(public toastService: ToastService) {}

  dismiss(id: string): void {
    this.toastService.remove(id);
  }

  handleAction(toast: ToastNotification): void {
    if (toast.onAction) {
      toast.onAction();
    }
    this.dismiss(toast.id);
  }
}