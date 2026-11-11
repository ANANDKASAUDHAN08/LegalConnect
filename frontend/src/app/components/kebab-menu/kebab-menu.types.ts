import { IconName } from '../icon/icon.types';

export interface KebabActionItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: IconName | string;
  iconClass?: string;
  iconBgClass?: string;
  badge?: string;
  badgeClass?: string;
  disabled?: boolean;
  danger?: boolean;
  visible?: boolean;
  onClick?: (event: Event) => void;
}

export interface KebabActionGroup {
  title?: string;
  items: KebabActionItem[];
  visible?: boolean;
}

export interface KebabActionEvent {
  item: KebabActionItem;
  event: Event;
}