import { IconName } from '../icon/icon.types';

export interface SelectOption<T = any> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: IconName | string;
  iconSvg?: string;
  iconColor?: string;
  badge?: string | number;
  badgeColor?: string;
  count?: number;
  disabled?: boolean;
  group?: string;
  tooltip?: string;
}

export interface SelectGroup<T = any> {
  name: string;
  icon?: IconName | string;
  options: SelectOption<T>[];
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

export type SelectSize = 'sm' | 'md' | 'lg';
export type SelectVariant = 'default' | 'filled' | 'outlined' | 'glass' | 'minimal';
export type SelectDropPosition = 'auto' | 'down' | 'up';
export type SelectMenuAlign = 'auto' | 'left' | 'right';
export type SelectRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full' | (string & {});