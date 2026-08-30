import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Bookmark } from '../../../../../services/bookmark.service';
import { IconComponent } from '../../../../../components/icon/icon.component';

@Component({
  selector: 'app-print-dossier',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './print-dossier.component.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrintDossierComponent {
  @Input() activeTab: string = '';
  @Input() printCollectionName: string = 'All';
  @Input() printItemsCount: number = 0;
  @Input() printedBookmarks: Bookmark[] = [];
  @Input() savedLawyersDetails: any[] = [];
  @Input() savedResourcesDetails: any[] = [];
  @Input() savedHelplinesDetails: any[] = [];
  @Input() printDate: Date = new Date();

  trackById(index: number, item: any): string {
    return item._id || index.toString();
  }
}