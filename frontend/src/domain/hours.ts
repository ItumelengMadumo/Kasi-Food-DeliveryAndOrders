// ─────────────────────────────────────────────────
// Vendor trading-hours helpers.
//
// Shape: WorkingHours maps each weekday to either "HH:MM-HH:MM" or "closed".
// A missing/undefined day is treated as closed.
// ─────────────────────────────────────────────────
import type { WorkingHours } from '../types';

export const WEEKDAYS: (keyof WorkingHours)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const WEEKDAY_LABELS: Record<keyof WorkingHours, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

function parseRange(value?: string): { open: string; close: string } | null {
  if (!value || value === 'closed') return null;
  const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(value.trim());
  if (!match) return null;
  return { open: match[1], close: match[2] };
}

export interface OpenStatus {
  isOpen: boolean;
  label: string;
}

/** Determines whether a vendor is open right now, given its working hours. */
export function getOpenStatus(workingHours?: WorkingHours | null, now = new Date()): OpenStatus {
  if (!workingHours) {
    return { isOpen: true, label: 'Hours not set' };
  }
  const day = WEEKDAYS[now.getDay()];
  const range = parseRange(workingHours[day]);
  if (!range) {
    return { isOpen: false, label: 'Closed today' };
  }
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = range.open.split(':').map(Number);
  const [closeH, closeM] = range.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (minutesNow < openMinutes) {
    return { isOpen: false, label: `Opens ${range.open}` };
  }
  if (minutesNow >= closeMinutes) {
    return { isOpen: false, label: `Opens ${range.open} tomorrow` };
  }
  return { isOpen: true, label: `Open until ${range.close}` };
}
