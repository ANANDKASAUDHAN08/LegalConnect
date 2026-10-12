/**
 * Time Utilities for LegalConnect
 * 
 * Provides robust 12-hour AM/PM and 24-hour HH:mm parsing, conversion,
 * validation, and formatting for court hearings, quiet hours, and schedule pickers.
 */

export interface TimeParts12 {
  hour12: number;
  minute: string;
  period: 'AM' | 'PM';
}

export interface TimeOption {
  label: string;
  value: string; // 24-hour format "HH:mm"
}

export const STANDARD_HOURS_12: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const STANDARD_MINUTES: readonly string[] = ['00', '15', '30', '45'];

export const EXTENDED_MINUTES: readonly string[] = [
  '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'
];

export const COMMON_START_TIMES: readonly TimeOption[] = [
  { label: '09:00 PM', value: '21:00' },
  { label: '09:30 PM', value: '21:30' },
  { label: '10:00 PM', value: '22:00' },
  { label: '10:30 PM', value: '22:30' },
  { label: '11:00 PM', value: '23:00' },
  { label: '11:30 PM', value: '23:30' },
  { label: '12:00 AM', value: '00:00' }
];

export const COMMON_END_TIMES: readonly TimeOption[] = [
  { label: '06:00 AM', value: '06:00' },
  { label: '06:30 AM', value: '06:30' },
  { label: '07:00 AM', value: '07:00' },
  { label: '07:30 AM', value: '07:30' },
  { label: '08:00 AM', value: '08:00' },
  { label: '08:30 AM', value: '08:30' },
  { label: '09:00 AM', value: '09:00' }
];

/**
 * Formats a 24-hour "HH:mm" string into a 12-hour "hh:mm AM/PM" string.
 * e.g., "22:00" -> "10:00 PM", "07:30" -> "07:30 AM"
 */
export function formatTime12(time24?: string): string {
  if (!time24) return '10:00 PM';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return time24;
  const minute = (parts[1] || '00').padStart(2, '0');
  const period: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
  return `${hourStr}:${minute} ${period}`;
}

/**
 * Parses a 24-hour "HH:mm" string into 12-hour components.
 */
export function parseTime24(time24?: string): TimeParts12 {
  if (!time24) return { hour12: 10, minute: '00', period: 'PM' };
  const parts = time24.split(':');
  let hour = parseInt(parts[0], 10);
  if (isNaN(hour)) hour = 10;
  const minute = (parts[1] || '00').padStart(2, '0');
  const period: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return { hour12: hour, minute, period };
}

/**
 * Converts 12-hour components back into a 24-hour "HH:mm" string.
 */
export function formatTime24(hour12: number | string, minute: number | string, period: 'AM' | 'PM'): string {
  let h = Number(hour12) % 12;
  if (period === 'PM') h += 12;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  const mStr = String(minute || '00').padStart(2, '0');
  return `${hStr}:${mStr}`;
}

/**
 * Returns true if a given current time is within a specified start and end window.
 * Handles overnight schedules (e.g., 22:00 to 07:30) correctly.
 */
export function isCurrentTimeInWindow(startTime24: string, endTime24: string, now: Date = new Date()): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = (startTime24 || '22:00').split(':').map(Number);
  const [endH, endM] = (endTime24 || '07:30').split(':').map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  if (startMinutes > endMinutes) {
    // Overnight window (e.g. 10 PM to 7:30 AM)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}