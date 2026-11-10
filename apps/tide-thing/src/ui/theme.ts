// the blue-water palette. warnings use the same hues as the alert strip so colour always means the same thing.
export const C = {
  bg: '#061B30',
  card: '#0C2E4E',
  card2: '#123F66',
  track: '#082640',
  water: '#2B8FD6',
  waterHi: '#7CC8F5',
  aqua: '#4FD1E0',
  foam: '#EAF7FB',
  mist: '#9EC3D9',
  dim: '#3F6D93',
  amber: '#FFC15A',
  orange: '#FF9A52',
  coral: '#FF7A66',
  warnRed: '#E5484D',
  moon: '#E9EEF2',
  moonDark: '#173A55',
  sun: '#FFD98A',
  ink: '#04121F',
} as const;

export function timeText(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function dayText(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export const f1 = (v: number) => v.toFixed(1);
