import type { CSSProperties, ReactNode } from 'react';
import { C } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: 22,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        ...style,
      }}>
      {children}
    </div>
  );
}

export function Label({ children, color = C.mist }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color }}>
      {children}
    </div>
  );
}

export function Pill({
  children,
  bg = C.card2,
  color = C.aqua,
  size = 22,
}: {
  children: ReactNode;
  bg?: string;
  color?: string;
  size?: number;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: bg,
        color,
        fontSize: size,
        fontWeight: 800,
        padding: '4px 14px',
        borderRadius: 999,
        letterSpacing: 0.4,
      }}>
      {children}
    </div>
  );
}

export function Arrow({ up, color = C.aqua, size = 22 }: { up: boolean; color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={up ? 'M12 20V5M5 12l7-7 7 7' : 'M12 4v15M5 12l7 7 7-7'}
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WarnIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 2 21h20L12 3Z" fill={color} />
      <path d="M12 10v5" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="18" r="1.4" fill={C.ink} />
    </svg>
  );
}

export function CheckIcon({ color = C.aqua, size = 36 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2" />
      <path d="m7.5 12.5 3 3 6-6.5" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SpeakerIcon({ on, size = 24 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4Z" fill={on ? C.aqua : C.dim} />
      {on ? (
        <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" stroke={C.aqua} strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <path d="m16 9 5 6m0-6-5 6" stroke={C.dim} strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** lit part of the moon. waxing moons are lit on the right as seen from the northern hemisphere. */
export function MoonGlyph({ r, lit, waxing }: { r: number; lit: number; waxing: boolean }) {
  const s = 2 * r + 4;
  const c = s / 2;
  let body: ReactNode;
  if (lit > 0.98) body = <circle cx={c} cy={c} r={r} fill={C.moon} />;
  else if (lit < 0.02) body = null;
  else {
    const rx = Math.abs(1 - 2 * lit) * r;
    const sweep = lit < 0.5 ? 0 : 1;
    const d = `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx.toFixed(2)} ${r} 0 0 ${sweep} ${c} ${c - r} Z`;
    body = waxing ? (
      <path d={d} fill={C.moon} />
    ) : (
      <g transform={`translate(${2 * c} 0) scale(-1 1)`}>
        <path d={d} fill={C.moon} />
      </g>
    );
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill={C.moonDark} />
      {body}
    </svg>
  );
}
