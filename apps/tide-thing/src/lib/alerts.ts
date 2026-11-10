// NWS alerts come back as GeoJSON. a warning is red, everything else (watch, advisory, statement) is amber.
export type AlertLevel = 'warning' | 'other';

export type Alert = {
  id: string;
  event: string;
  level: AlertLevel;
  headline: string;
  description: string;
  instruction: string;
  /** ms epoch, null when the alert carries no end */
  ends: number | null;
  area: string;
  floodRelated: boolean;
};

type Feature = {
  id?: string;
  properties?: {
    id?: string;
    event?: string;
    status?: string;
    messageType?: string;
    headline?: string | null;
    description?: string | null;
    instruction?: string | null;
    ends?: string | null;
    expires?: string | null;
    areaDesc?: string | null;
  };
};

export function levelOf(event: string): AlertLevel {
  return /warning$/i.test(event.trim()) ? 'warning' : 'other';
}

export function parseAlerts(json: unknown, now: Date): Alert[] {
  const features = (json as { features?: Feature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const out: Alert[] = [];
  for (const f of features) {
    const p = f.properties;
    if (!p || !p.event) continue;
    if (p.status && p.status !== 'Actual') continue;
    if (p.messageType === 'Cancel') continue;
    const endIso = p.ends ?? p.expires ?? null;
    const ends = endIso ? Date.parse(endIso) : NaN;
    if (Number.isFinite(ends) && ends <= now.getTime()) continue;
    out.push({
      id: p.id ?? f.id ?? `${p.event}-${endIso}`,
      event: p.event,
      level: levelOf(p.event),
      headline: p.headline ?? p.event,
      description: p.description ?? '',
      instruction: p.instruction ?? '',
      ends: Number.isFinite(ends) ? ends : null,
      area: p.areaDesc ?? '',
      floodRelated: /flood|surge|tsunami/i.test(p.event),
    });
  }
  return out.sort(
    (a, b) =>
      Number(b.level === 'warning') - Number(a.level === 'warning') ||
      Number(b.floodRelated) - Number(a.floodRelated) ||
      (a.ends ?? Infinity) - (b.ends ?? Infinity),
  );
}

/** what the phone says aloud for a warning. kept short on purpose. */
export function spokenText(a: Alert, timeText: string | null): string {
  const until = timeText ? ` until ${timeText}` : '';
  return `${a.event}${until}.`;
}
