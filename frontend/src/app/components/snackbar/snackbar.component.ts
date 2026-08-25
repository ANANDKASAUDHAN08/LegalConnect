import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SnackbarService, SnackbarItem } from '../../services/snackbar.service';

@Component({
  selector: 'app-snackbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './snackbar.component.html',
  styleUrls: ['./snackbar.component.scss']
})
export class SnackbarComponent {
  constructor(public snackbarService: SnackbarService) { }

  trackById(_index: number, item: SnackbarItem): number {
    return item.id;
  }
}