import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { BareAct } from '../../../../services/legal.service';
import { NotificationService } from '../../../../services/notification.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

@Component({
  selector: 'app-act-card',
  standalone: true,
  imports: [RouterLink, NgIf, NgClass, TooltipDirective],
  templateUrl: './act-card.component.html',
  styleUrls: ['./act-card.component.scss']
})
export class ActCardComponent {
  @Input() act!: BareAct;
  @Input() isAiSuggested = false;
  @Input() cardId = '';

  constructor(public notificationService: NotificationService) {}
}
