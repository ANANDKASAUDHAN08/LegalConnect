/**
 * Real-time operating hours evaluator for Indian Courts, DLSAs, and Government Offices.
 * Calculates live status according to Indian Standard Time (IST - UTC+5:30) and judicial calendars.
 */

export interface OperatingStatus {
  isOpen: boolean;
  isLunch: boolean;
  label: string;
  colorClass: string;
  dotColorClass: string;
  detailText: string;
}

export function calculateCourtOperatingStatus(customHours?: { open?: number; close?: number }): OperatingStatus {
  // Compute current time in IST (UTC+5:30)
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 3600000;
  const istDate = new Date(utcTime + istOffset);

  const dayOfWeek = istDate.getDay(); // 0 = Sun, 6 = Sat
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  const openTime = (customHours?.open ?? 10) * 60; // 10:00 AM
  const lunchStart = 13 * 60; // 1:00 PM
  const lunchEnd = 14 * 60; // 2:00 PM
  const closeTime = (customHours?.close ?? 17) * 60; // 5:00 PM

  // Check if today is Sunday (Courts Closed)
  if (dayOfWeek === 0) {
    return {
      isOpen: false,
      isLunch: false,
      label: 'Closed Today',
      colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      dotColorClass: 'bg-rose-500',
      detailText: 'Courts closed on Sundays. Reopens Monday at 10:00 AM IST'
    };
  }

  // Check for 2nd and 4th Saturday Judicial Holidays in India
  if (dayOfWeek === 6) {
    const dayOfMonth = istDate.getDate();
    const saturdayRank = Math.ceil(dayOfMonth / 7);
    if (saturdayRank === 2 || saturdayRank === 4) {
      return {
        isOpen: false,
        isLunch: false,
        label: 'Closed (2nd/4th Sat)',
        colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        dotColorClass: 'bg-rose-500',
        detailText: 'Judicial holiday (2nd/4th Saturday). Reopens Monday at 10:00 AM IST'
      };
    }
  }

  // Before Opening Hours (Before 10:00 AM)
  if (timeInMinutes < openTime) {
    const hoursLeft = Math.floor((openTime - timeInMinutes) / 60);
    const minsLeft = (openTime - timeInMinutes) % 60;
    const timeRemainingStr = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`;
    return {
      isOpen: false,
      isLunch: false,
      label: 'Opens at 10:00 AM',
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      dotColorClass: 'bg-amber-500',
      detailText: `Opens in ${timeRemainingStr} (Standard court hours: 10:00 AM - 5:00 PM IST)`
    };
  }

  // Lunch Recess (1:00 PM - 2:00 PM)
  if (timeInMinutes >= lunchStart && timeInMinutes < lunchEnd) {
    const minsToResume = lunchEnd - timeInMinutes;
    return {
      isOpen: true,
      isLunch: true,
      label: 'Lunch Recess',
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      dotColorClass: 'bg-amber-500',
      detailText: `Court in lunch recess. Registry counters resume in ${minsToResume} mins (2:00 PM IST)`
    };
  }

  // Active Court & Registry Hours (10:00 AM - 5:00 PM)
  if (timeInMinutes >= openTime && timeInMinutes < closeTime) {
    const minsToClose = closeTime - timeInMinutes;
    const hoursToClose = Math.floor(minsToClose / 60);
    const remainingMins = minsToClose % 60;
    const closingStr = hoursToClose > 0 ? `${hoursToClose}h ${remainingMins}m` : `${remainingMins}m`;

    return {
      isOpen: true,
      isLunch: false,
      label: 'Open Now',
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      dotColorClass: 'bg-emerald-500',
      detailText: `Open today until 5:00 PM IST (${closingStr} remaining)`
    };
  }

  // After Closing Hours (After 5:00 PM)
  const isFriday = dayOfWeek === 5;
  const reopensText = isFriday ? 'Reopens Monday at 10:00 AM IST' : 'Reopens tomorrow at 10:00 AM IST';
  return {
    isOpen: false,
    isLunch: false,
    label: 'Closed for the Day',
    colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    dotColorClass: 'bg-slate-400',
    detailText: `Courts closed at 5:00 PM IST. ${reopensText}`
  };
}