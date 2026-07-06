/** Wall-clock time in `timeZone` → UTC Date (iterative fix). */
export function wallTimeToUtc(dateStr, timeHHMM, timeZone) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeHHMM.split(':').map(Number);
  let utc = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(utc));
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    const diff =
      Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    utc += diff;
    if (diff === 0) break;
  }
  return new Date(utc);
}

export function formatTimeInZone(dateStr, timeHHMM, fromZone, toZone) {
  if (!dateStr || !timeHHMM || !toZone) return '—';
  try {
    const utc = wallTimeToUtc(dateStr, timeHHMM, fromZone);
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: toZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(utc);
  } catch {
    return '—';
  }
}

export function zoneShortName(iana) {
  const map = {
    'Asia/Yerevan': 'YRV',
    'Europe/Moscow': 'MSK',
    'Europe/Berlin': 'CET',
    'Europe/London': 'GMT',
    'Europe/Paris': 'CET',
    'America/New_York': 'EST',
  };
  return map[iana] || iana.split('/').pop()?.slice(0, 3).toUpperCase() || iana;
}

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Yerevan', label: 'Yerevan (UTC+4)' },
  { value: 'Europe/Moscow', label: 'Moscow (UTC+3)' },
  { value: 'Europe/Berlin', label: 'Berlin / CET' },
  { value: 'Europe/London', label: 'London / GMT' },
  { value: 'Europe/Paris', label: 'Paris / CET' },
  { value: 'America/New_York', label: 'New York / EST' },
];
