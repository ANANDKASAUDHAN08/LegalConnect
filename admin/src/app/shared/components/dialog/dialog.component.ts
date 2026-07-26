import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService, ActiveDialog } from '../../services/dialog.service';

@Component({
  selector: 'admin-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss'
})
export class DialogComponent {
  get dialog(): ActiveDialog | null {
    return this.dialogService.activeDialog;
  }

  constructor(public dialogService: DialogService) { }

  confirm(): void {
    this.dialogService.respond(true);
  }

  cancel(): void {
    this.dialogService.respond(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog) {
      this.cancel();
    }
  }

  @HostListener('document:keydown.enter')
  onEnter(): void {
    if (this.dialog) {
      this.confirm();
    }
  }
}