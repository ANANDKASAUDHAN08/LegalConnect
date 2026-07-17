import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemAnnouncementService } from '../../services/system-announcement.service';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'app-version-reload-pill',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './version-reload-pill.component.html',
  styleUrls: ['./version-reload-pill.component.scss']
})
export class VersionReloadPillComponent {
  announcementService = inject(SystemAnnouncementService);

  reloadApp() {
    window.location.reload();
  }
}