export type IconName =
  | 'scale'
  | 'gavel'
  | 'shield'
  | 'award'
  | 'briefcase'
  | 'file-text'
  | 'file'
  | 'folder'
  | 'book-open'
  | 'map-pin'
  | 'building'
  | 'landmark'
  | 'globe'
  | 'phone'
  | 'mail'
  | 'message-square'
  | 'mic'
  | 'mic-off'
  | 'user'
  | 'users'
  | 'user-check'
  | 'badge-check'
  | 'clock'
  | 'calendar'
  | 'history'
  | 'search'
  | 'filter'
  | 'sort'
  | 'sort-asc'
  | 'sort-desc'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'check'
  | 'x'
  | 'alert-circle'
  | 'info'
  | 'help-circle'
  | 'zap'
  | 'star'
  | 'heart'
  | 'eye'
  | 'eye-off'
  | 'sparkles'
  | 'lock'
  | 'unlock'
  | 'key'
  | 'refresh'
  | 'download'
  | 'upload'
  | 'share'
  | 'printer'
  | 'copy'
  | 'trash'
  | 'edit'
  | 'plus'
  | 'minus'
  | 'arrow-right'
  | 'arrow-left'
  | 'external-link'
  | 'navigation'
  | 'video'
  | 'grid'
  | 'list'
  | 'accessibility'
  | 'loader'
  | 'thumbs-up'
  | 'thumbs-down'
  | 'alert-triangle'
  | 'shield-check'
  | 'check-circle'
  | 'trash-2'
  | 'camera'
  | 'rotate-ccw'
  | 'layout'
  | 'arrow-down-a-z'
  | 'monitor'
  | 'compass'
  | 'layers'
  | 'map'
  | 'sun'
  | 'moon'
  | 'crosshair'
  | 'maximize'
  | 'minimize'
  | 'home'
  | 'bookmark'
  | 'bookmark-filled'
  | 'settings'
  | 'command'
  | 'bell'
  | 'lifebuoy'
  | 'menu'
  | 'log-out'
  | 'log-in'
  | 'smartphone'
  | 'volume-2'
  | 'volume-x'
  | 'qr-code'
  | 'shopping-cart'
  | 'file-check'
  | 'logo'
  | 'linkedin'
  | 'twitter'
  | 'x-social'
  | 'brand-x'
  | 'facebook'
  | 'instagram'
  | 'youtube'
  | 'github'
  | 'circle-dollar'
  | 'dollar-sign'
  | 'wallet'
  | 'trending-up'
  | 'checkbox'
  | 'check-square'
  | 'table'
  | 'flag'
  | 'paperclip'
  | 'whatsapp'
  | 'telegram'
  | 'thumbs-up-filled'
  | 'code';

export interface IconDefinition {
  name: string;
  viewBox?: string;
  paths: Array<{
    d?: string;
    type?: 'path' | 'circle' | 'rect' | 'polyline' | 'polygon' | 'line';
    cx?: string | number;
    cy?: string | number;
    r?: string | number;
    x?: string | number;
    y?: string | number;
    width?: string | number;
    height?: string | number;
    rx?: string | number;
    ry?: string | number;
    points?: string;
    x1?: string | number;
    y1?: string | number;
    x2?: string | number;
    y2?: string | number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeLinecap?: 'round' | 'butt' | 'square';
    strokeLinejoin?: 'round' | 'bevel' | 'miter';
  }>;
  rawSvg?: string;
}

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;