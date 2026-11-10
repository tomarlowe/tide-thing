import type { ReactNode } from 'react';
import type { Derived } from '../lib/derive';
import { dayKey, HOUR_MS } from '../lib/tide';
import type { RiskLevel } from '../lib/risk';
import type { Snapshot } from '../lib/snapshot';
import { Arrow, Card, CheckIcon, Label, MoonGlyph, Pill, WarnIcon } from './atoms';
import { C, dayText, f1, timeText } from './theme';

export type ScreenProps = { s: Snapshot; d: Derived; now: number; stale: boolean };

const RISK_COLORS: Record<RiskLevel, { bg: string; fg: string }> = {
  calm: { bg: C.card2, fg: C.aqua },
  watch: { bg: C.amber, fg: C.ink },
  minor: { bg: C.amber, fg: C.ink },
  moderate: { bg: C.orange, fg: C.ink },
  major: { bg: C.coral, fg: C.ink },
};

function Empty({ children }: { children: ReactNode }) {
  return (
    <Card style={{ flex: 1, justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 10 }}>
      {children}
    </Card>
  );
}

function NoStation({ s }: { s: Snapshot }) {
  return (
    <Empty>
      <div style={{ fontSize: 34, fontWeight: 800 }}>
        {s.connected ? (s.problem ?? 'Finding the nearest tide station...') : 'Connect your phone'}
      </div>
      <div style={{ fontSize: 22, color: C.mist }}>
        {s.connected ? 'Tide Thing needs your phone for location and data.' : 'Tide Thing gets its data through your phone.'}
      </div>
    </Empty>
  );
}

// ---- 1. tide now ------------------------------------------------------------------------------
export function TideNow({ s, d, now, stale }: ScreenProps) {
  if (!s.station || d.levelNow == null) return <NoStation s={s} />;
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const t0 = dayStart.getTime();
  const W = 432;
  const H = 300;
  const fts = d.curve.map(p => p.ft);
  const lo = Math.min(0, ...fts) - 0.3;
  const hi = Math.max(...fts, d.levelNow) + 1.2;
  const xs = (t: number) => 10 + ((t - t0) / (24 * HOUR_MS)) * (W - 20);
  const ys = (ft: number) => 232 - ((ft - lo) / (hi - lo)) * 200;
  const path = (pts: typeof d.curve) => pts.map((p, i) => `${i ? 'L' : 'M'}${xs(p.t).toFixed(1)} ${ys(p.ft).toFixed(1)}`).join(' ');
  const past = d.curve.filter(p => p.t <= now);
  const future = d.curve.filter(p => p.t >= now);
  const area = d.curve.length ? `${path(d.curve)} L${xs(d.curve[d.curve.length - 1]!.t).toFixed(1)} 232 L${xs(d.curve[0]!.t).toFixed(1)} 232 Z` : '';
  const today = dayKey(now);
  const marks = s.extremes.filter(e => dayKey(e.t) === today);
  const xn = xs(now);
  const yn = ys(d.levelNow);
  const nextTwo = d.next.slice(0, 2);
  const word = (k: 'H' | 'L') => (k === 'H' ? 'High' : 'Low');

  return (
    <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0, opacity: stale ? 0.55 : 1 }}>
      <Card style={{ width: 272, flex: 'none', padding: '14px 20px' }}>
        <Label>{d.levelSource === 'observed' ? 'Water level now' : 'Predicted level now'}</Label>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1 }}>{f1(d.levelNow)}</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.mist }}>ft</div>
        </div>
        {d.trend && (
          <div style={{ marginTop: 6 }}>
            <Pill>
              <Arrow up={d.trend === 'rising'} />
              {d.trend === 'rising' ? 'Rising' : 'Falling'}
            </Pill>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {nextTwo.map(e => (
          <div key={e.t} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.mist }}>Next {word(e.kind).toLowerCase()}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 34, fontWeight: 800 }}>{timeText(e.t)}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: C.mist }}>{f1(e.ft)} ft</div>
            </div>
          </div>
        ))}
      </Card>
      <Card style={{ flex: 1, padding: '12px 14px' }}>
        <Label>Today · {dayText(new Date(now))} · feet above MLLW</Label>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ flex: 1, minHeight: 0, width: '100%' }} role="img"
          aria-label="Tide curve for today with the current time marked">
          <defs>
            <linearGradient id="tfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={C.water} stopOpacity="0.65" />
              <stop offset="1" stopColor={C.water} stopOpacity="0.08" />
            </linearGradient>
          </defs>
          {area && <path d={area} fill="url(#tfill)" />}
          <line x1={xs(t0)} y1="232" x2={xs(t0 + 24 * HOUR_MS)} y2="232" stroke={C.dim} strokeWidth="2" />
          {past.length > 1 && <path d={path(past)} fill="none" stroke="#6FA6CB" strokeWidth="5" strokeLinecap="round" />}
          {future.length > 1 && <path d={path(future)} fill="none" stroke={C.aqua} strokeWidth="5" strokeLinecap="round" />}
          {marks.map(e => {
            const x = xs(e.t);
            const y = ys(e.ft);
            const anchor = x > W - 70 ? 'end' : x < 70 ? 'start' : 'middle';
            const high = e.kind === 'H';
            return (
              <g key={e.t}>
                <circle cx={x} cy={y} r="6" fill={C.foam} />
                <text x={x} y={high ? y - 30 : 258} textAnchor={anchor} fill={C.foam} fontSize="22" fontWeight="800">
                  {f1(e.ft)} ft
                </text>
                <text x={x} y={high ? y - 10 : 278} textAnchor={anchor} fill={C.mist} fontSize="17" fontWeight="600">
                  {timeText(e.t)}
                </text>
              </g>
            );
          })}
          <line x1={xn} y1="34" x2={xn} y2={yn - 10} stroke={C.foam} strokeWidth="2" strokeDasharray="4 5" />
          <rect x={xn - 27} y="4" width="54" height="28" rx="14" fill={C.foam} />
          <text x={xn} y="24" textAnchor="middle" fill={C.bg} fontSize="17" fontWeight="800">Now</text>
          <circle cx={xn} cy={yn} r="9" fill={C.foam} stroke={C.aqua} strokeWidth="4" />
          {[0, 6, 12, 18, 24].map(h => (
            <text key={h} x={xs(t0 + h * HOUR_MS)} y="300" textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
              fill={C.mist} fontSize="15" fontWeight="600">
              {h === 0 || h === 24 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}
            </text>
          ))}
        </svg>
      </Card>
    </div>
  );
}

// ---- 2. moon and tide (range) -----------------------------------------------------------------
export function MoonTide({ s, d, now }: ScreenProps) {
  const ranges = d.moonDays.map(m => m.range ?? 0);
  const maxRange = Math.max(1, ...ranges);
  const m = d.moon;
  const peakText = d.peakDay ? d.peakDay.toLocaleDateString([], { weekday: 'short', day: 'numeric' }) : null;
  return (
    <Card style={{ flex: 1, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <MoonGlyph r={28} lit={m.illumination} waxing={m.waxing} />
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{m.name}</div>
            <div style={{ fontSize: 19, fontWeight: 600, color: C.mist }}>{Math.round(m.illumination * 100)}% lit</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {d.growing != null && (
            <Pill size={20}>
              <Arrow up={d.growing} size={20} />
              {d.growing ? 'Tides growing' : 'Tides shrinking'}
            </Pill>
          )}
          {peakText && s.extremes.length > 0 && (
            <div style={{ fontSize: 19, fontWeight: 700 }}>Biggest around {peakText}</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flex: 1, minHeight: 0, marginTop: 8 }}>
        {d.moonDays.map(day => {
          const dm = new Date(day.date);
          const cyc = ((day.date.getTime() - now) / 86_400_000 + m.ageDays + 29.530588853) % 29.530588853;
          const cycle = cyc / 29.530588853;
          const h = day.range == null ? 6 : Math.max(8, Math.round((day.range / maxRange) * 140));
          const isPeak = d.peakDay != null && dayKey(d.peakDay.getTime()) === day.key;
          const bar = day.today ? C.aqua : isPeak ? C.waterHi : C.water;
          return (
            <div
              key={day.key}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: 18,
                background: day.today ? C.card2 : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '6px 0',
              }}>
              <div style={{ height: 24, fontSize: 18, fontWeight: 800, color: day.today ? C.foam : C.waterHi }}>
                {day.range != null && (day.today || isPeak) ? f1(day.range) : ''}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                <div style={{ width: 28, height: h, background: bar, opacity: day.range == null ? 0.25 : 1, borderRadius: '10px 10px 4px 4px' }} />
              </div>
              <div style={{ marginTop: 8 }}>
                <MoonGlyph r={13} lit={(1 - Math.cos(2 * Math.PI * cycle)) / 2} waxing={cycle < 0.5} />
              </div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, lineHeight: 1.15, textAlign: 'center', color: day.today ? C.foam : C.mist }}>
                {dm.toLocaleDateString([], { weekday: 'narrow' })}
                <br />
                {dm.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: 17, fontWeight: 600, color: C.mist, display: 'flex', justifyContent: 'space-between' }}>
        <span>Bars: daily tide range, feet</span>
        <span>
          Full {d.nextFull.toLocaleDateString([], { month: 'short', day: 'numeric' })} · New{' '}
          {d.nextNew.toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </Card>
  );
}

// ---- 3. flood risk ----------------------------------------------------------------------------
export function FloodRisk({ s, d, stale }: ScreenProps) {
  if (!s.station || d.levelNow == null) return <NoStation s={s} />;
  const lv = s.flood;
  const mhhw = s.datums ? s.datums.mhhw - s.datums.mllw : null;
  const top = Math.max(lv ? lv.major + 1 : (mhhw ?? 6) + 2, d.levelNow + 0.5, (d.peakFt ?? 0) + 0.5);
  const ys = (ft: number) => 300 - (Math.max(0, ft) / top) * 285;
  const colors = RISK_COLORS[d.risk.level];
  const worst = s.alerts[0];
  const rainWord = s.rain ? (s.rain.level === 'none' ? 'No rain' : s.rain.level === 'light' ? 'Light rain' : 'Heavy rain') : null;

  return (
    <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
      <Card style={{ width: 262, flex: 'none', padding: '12px 14px' }}>
        <Label>{lv ? 'Tide vs flood levels' : 'Tide vs usual high'}</Label>
        <svg viewBox="0 0 238 312" style={{ flex: 1, minHeight: 0 }} role="img"
          aria-label="Tide gauge showing the water level against flood levels">
          <defs>
            <clipPath id="staff"><rect x="84" y="11" width="36" height="289" rx="18" /></clipPath>
          </defs>
          <rect x="84" y="11" width="36" height="289" rx="18" fill={C.track} stroke={C.dim} strokeWidth="2" />
          <g clipPath="url(#staff)">
            {d.peakFt != null && d.peakFt > d.levelNow && (
              <rect x="84" y={ys(d.peakFt)} width="36" height={ys(d.levelNow) - ys(d.peakFt)} fill={C.aqua} fillOpacity="0.28" />
            )}
            <rect x="84" y={ys(d.levelNow)} width="36" height={300 - ys(d.levelNow)} fill={C.water} />
          </g>
          {lv
            ? ([['Major', lv.major, C.coral], ['Moderate', lv.moderate, C.orange], ['Minor', lv.minor, C.amber]] as const).map(
                ([name, ft, col]) => (
                  <g key={name}>
                    <line x1="76" y1={ys(ft)} x2="128" y2={ys(ft)} stroke={col} strokeWidth="3" strokeLinecap="round" />
                    <text x="138" y={ys(ft) + 5} fill={col} fontSize="16" fontWeight="800">{name} {f1(ft)}</text>
                  </g>
                ),
              )
            : mhhw != null && (
                <g>
                  <line x1="76" y1={ys(mhhw)} x2="128" y2={ys(mhhw)} stroke={C.mist} strokeWidth="3" strokeLinecap="round" />
                  <text x="138" y={ys(mhhw) + 5} fill={C.mist} fontSize="16" fontWeight="800">Usual high {f1(mhhw)}</text>
                </g>
              )}
          {d.peakFt != null && (
            <g>
              <line x1="70" y1={ys(d.peakFt)} x2="134" y2={ys(d.peakFt)} stroke={C.aqua} strokeWidth="2" strokeDasharray="4 4" />
              <text x="66" y={ys(d.peakFt) + 2} textAnchor="end" fill={C.aqua} fontSize="20" fontWeight="800">{f1(d.peakFt)} ft</text>
              {d.peakAt && <text x="66" y={ys(d.peakFt) + 19} textAnchor="end" fill={C.mist} fontSize="15" fontWeight="600">{timeText(d.peakAt)}</text>}
            </g>
          )}
          <text x="66" y={ys(d.levelNow) + 2} textAnchor="end" fill={C.foam} fontSize="20" fontWeight="800">{f1(d.levelNow)} ft</text>
          <text x="66" y={ys(d.levelNow) + 19} textAnchor="end" fill={C.mist} fontSize="15" fontWeight="600">now</text>
        </svg>
      </Card>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card style={{ flex: 'none', padding: '14px 20px', opacity: stale ? 0.5 : 1, justifyContent: 'center' }}>
          <div>
            <Pill bg={stale ? C.dim : colors.bg} color={stale ? C.foam : colors.fg} size={19}>
              {d.risk.level !== 'calm' && !stale && <WarnIcon color={colors.fg} size={22} />}
              {stale ? 'OUT OF DATE' : d.risk.badge}
            </Pill>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, marginTop: 10 }}>{d.risk.line}</div>
        </Card>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
          <Card style={{ flex: 1, padding: '14px 18px' }}>
            <Label>NWS alert</Label>
            {worst ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15, marginTop: 6 }}>{worst.event}</div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 18, fontWeight: 600, color: C.mist }}>
                  {worst.ends ? `Until ${timeText(worst.ends)}` : 'No end time'}
                  {s.alerts.length > 1 ? ` · +${s.alerts.length - 1} more` : ''}
                </div>
              </>
            ) : (
              <>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckIcon size={34} />
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{s.alertsProblem ? 'Alerts unavailable' : 'No active alerts'}</div>
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.mist, marginTop: 4 }}>
                  {s.alertsProblem ?? 'National Weather Service'}
                </div>
              </>
            )}
          </Card>
          <Card style={{ flex: 1, padding: '14px 18px' }}>
            <Label>Rain next 6 hours</Label>
            {s.rain && rainWord ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, marginTop: 6 }}>{rainWord}</div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 20, fontWeight: 600, color: C.mist }}>{s.rain.inches.toFixed(2)} in expected</div>
              </>
            ) : (
              <>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 22, fontWeight: 700, color: C.mist }}>Rain outlook unavailable</div>
              </>
            )}
          </Card>
        </div>
        <div style={{ flex: 'none', fontSize: 16, fontWeight: 600, color: C.mist }}>
          Flood risk is about the tide gauge and rain outlook, not individual streets.
        </div>
      </div>
    </div>
  );
}

// ---- 4. on the water --------------------------------------------------------------------------
function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub: string }) {
  return (
    <Card style={{ padding: '12px 18px' }}>
      <Label>{label}</Label>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1 }}>{value}</div>
        {unit && <div style={{ fontSize: 24, fontWeight: 700, color: C.mist }}>{unit}</div>}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: C.mist, marginTop: 4 }}>{sub}</div>
    </Card>
  );
}

export function OnTheWater({ s, d }: ScreenProps) {
  if (!s.station) return <NoStation s={s} />;
  const w = s.wind;
  const obs = s.buoy?.obs;
  const wave = obs?.waveFt;
  // hide anything the nearest stations do not report
  const tiles: ReactNode[] = [];
  if (w) {
    tiles.push(
      <Tile key="wind" label="Wind" value={String(Math.round(w.knots))} unit="kt"
        sub={`${w.compass ? `From the ${w.compass}` : 'Direction unknown'}${w.gustKnots != null ? `, gusts ${Math.round(w.gustKnots)}` : ''}`} />,
    );
  }
  if (wave != null && obs) {
    tiles.push(
      <Tile key="waves" label="Waves" value={wave < 1 ? '<1' : String(Math.round(wave))} unit="ft"
        sub={`${obs.periodSec != null ? `Every ${Math.round(obs.periodSec)} sec · ` : ''}${s.buoy!.buoy.miles.toFixed(0)} mi buoy`} />,
    );
  }
  if (s.waterTempF != null) {
    tiles.push(<Tile key="temp" label="Water temp" value={String(Math.round(s.waterTempF))} unit="°F" sub={`At ${s.station.name}`} />);
  }
  const marine = d.marineAlerts[0];
  tiles.push(
    <Tile key="marine" label="Marine alerts" value={marine ? marine.event.replace(/ (Advisory|Warning|Watch|Statement)$/i, '') : 'None'}
      sub={marine ? marine.event.match(/(Advisory|Warning|Watch|Statement)$/i)?.[0] ?? 'Active' : 'No marine advisories'} />,
  );
  const sunLine = d.sun?.sunrise && d.sun.sunset ? `Sunrise ${timeText(d.sun.sunrise.getTime())} · Sunset ${timeText(d.sun.sunset.getTime())}` : null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridAutoRows: 'minmax(0, 1fr)', gap: 12 }}>
        {tiles}
      </div>
      <Card style={{ flex: 'none', padding: '10px 18px', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label>Best fishing times · rule of thumb, not NOAA data</Label>
          {sunLine && <div style={{ fontSize: 16, fontWeight: 600, color: C.sun }}>{sunLine}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {d.fishing.length === 0 && <div style={{ fontSize: 20, fontWeight: 600, color: C.mist }}>No tide data yet</div>}
          {d.fishing.map(wdw => (
            <Pill key={wdw.turn.t} bg={wdw.nearSunEdge ? C.card2 : C.track} color={wdw.nearSunEdge ? C.sun : C.foam} size={20}>
              {timeText(wdw.start)} to {timeText(wdw.end)}
            </Pill>
          ))}
        </div>
      </Card>
    </div>
  );
}
