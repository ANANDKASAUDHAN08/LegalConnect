/**
 * Admin Icon Component — Centralized SVG Icon Library
 *
 * Replaces 100+ duplicated inline SVGs across page templates.
 * Usage: <admin-icon name="close" [size]="14"></admin-icon>
 */
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName =
  | 'close' | 'checkmark' | 'check' | 'download' | 'eye' | 'eye-off'
  | 'edit' | 'trash' | 'refresh' | 'search' | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right'
  | 'plus' | 'spinner' | 'star' | 'star-filled'
  | 'sort-unsorted' | 'sort-asc' | 'sort-desc'
  | 'filter' | 'external-link' | 'copy' | 'more-horizontal'
  | 'arrow-left' | 'arrow-right' | 'calendar' | 'clock'
  | 'shield' | 'alert-triangle' | 'warning' | 'info' | 'check-circle'
  | 'x-circle' | 'user' | 'users' | 'user-check' | 'user-x' | 'user-plus' | 'file-text' | 'settings'
  | 'upload' | 'mail' | 'phone' | 'map-pin' | 'briefcase'
  | 'lock' | 'scale' | 'activity' | 'zap' | 'power'
  | 'layers' | 'layout-dashboard' | 'grid' | 'grid-3x3' | 'list'
  | 'bell' | 'message-square' | 'message-circle' | 'book' | 'bookmark'
  | 'sun' | 'moon' | 'log-out' | 'log-in' | 'key' | 'archive' | 'award'
  | 'send' | 'tag' | 'flag' | 'sliders' | 'columns' | 'printer' | 'paperclip'
  | 'alert-circle' | 'maximize-2' | 'minimize-2' | 'folder' | 'folder-plus'
  | 'database' | 'server' | 'cpu' | 'thumbs-up' | 'thumbs-down' | 'help-circle' | 'life-buoy' | 'bug'
  | 'check-square' | 'square' | 'slash' | 'ban' | 'hash' | 'dot' | 'circle'
  | 'credit-card' | 'zoom-in' | 'zoom-out' | 'rotate-cw' | 'file-minus' | 'building'
  | 'navigation' | 'map' | 'video' | 'compass' | 'bar-chart' | 'trending-up' | 'trending-down'
  | 'alert-octagon' | 'feather' | 'table' | 'sidebar'
  | 'shield-check' | 'image' | 'maximize' | 'monitor' | 'history' | 'save'
  | 'volume-2' | 'dollar-sign' | 'inbox' | 'volume-x' | 'code' | 'repeat'
  | 'globe' | 'clipboard' | 'link' | 'type' | 'languages' | 'align-right' | 'lightbulb'
  | 'chevrons-down' | 'chevrons-up' | 'keyboard' | 'x';

@Component({
  selector: 'admin-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.scss']
})
export class AdminIconComponent {
  @Input() name: IconName = 'info';
  @Input() size: number = 16;
  @Input() strokeWidth: number | string = 2;
  @Input() fill: string = 'none';
  @Input() cssClass: string = '';
}