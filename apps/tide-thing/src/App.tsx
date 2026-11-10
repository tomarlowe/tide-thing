import { BridgethingClient, type ConnectionState } from '@bridgething/client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { daemonUrl } from './daemon';
import { phoneFetcher, phoneStore, TideData } from './lib/data';
import { derive } from './lib/derive';
import { ageText, freshness } from './lib/stale';
import { EMPTY, type Snapshot } from './lib/snapshot';
import { SpeakerIcon, WarnIcon } from './ui/atoms';
import { FloodRisk, MoonTide, OnTheWater, TideNow } from './ui/screens';
import { C, timeText } from './ui/theme';

const TITLES = ['Tide now', 'Moon & tide', 'Flood risk', 'On the water'];

function useTideData(client: BridgethingClient) {
  const data = useMemo(
    () =>
      new TideData({
        fetcher: phoneFetcher(client),
        kv: phoneStore(client),
        locate: async () => {
          const r = await client.geo.getOnce({ accuracy: 'coarse', maxAgeS: 600 }, { timeoutMs: 20_000 });
          return r.ok ? { lat: r.response.position.lat, lon: r.response.position.lon } : null;
        },
        speak: (id, text) => {
          void client.audio.tts({ id: `${id}-${Date.now()}`, text, voice: null }).catch(() => {});
        },
        now: () => Date.now(),
        timeText,
      }),
    [client],
  );
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  useEffect(() => {
    const off = data.subscribe(setSnap);
    const sync = () => {
      const open = client.connectionState === 'open';
      data.setConnected(open);
      if (open) void data.refreshAll();
    };
    const offConn = client.on(event => {
      if (event.type === 'open' || event.type === 'close') sync();
    });
    void data.start().then(sync);
    return () => {
      off();
      offConn();
      data.stop();
    };
  }, [client, data]);
  return { data, snap };
}

export default function App() {
  const client = useMemo(() => new BridgethingClient({ url: daemonUrl() }), []);
  const [, setConn] = useState<ConnectionState>(client.connectionState);
  const { data, snap } = useTideData(client);
  const [screen, setScreen] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    const off = client.on(() => setConn(client.connectionState));
    return () => {
      clearInterval(t);
      off();
    };
  }, [client]);

  // physical controls: presets 1 to 4 pick a screen, the wheel steps through them, a wheel click toggles voice
  const speakRef = useRef(snap.speak);
  speakRef.current = snap.speak;
  useEffect(() => {
    let acc = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') setScreen(Number(e.key) - 1);
      if (e.key === 'Enter') data.setSpeak(!speakRef.current);
    };
    const onWheel = (e: WheelEvent) => {
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(acc) >= 60) {
        setScreen(s => (s + (acc > 0 ? 1 : TITLES.length - 1)) % TITLES.length);
        acc = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, [data]);

  const d = useMemo(() => derive(snap, now, timeText), [snap, now]);

  const stamp =
    screen === 3
      ? snap.metAt
      : screen === 2
        ? snap.extremesAt != null && snap.alertsAt != null
          ? Math.min(snap.extremesAt, snap.alertsAt)
          : (snap.extremesAt ?? snap.alertsAt)
        : snap.extremesAt;
  const fresh = freshness(stamp, now);
  const stale = snap.station != null && fresh === 'stale';
  const props = { s: snap, d, now, stale };
  const body: ReactNode = [
    <TideNow key="a" {...props} />,
    <MoonTide key="b" {...props} />,
    <FloodRisk key="c" {...props} />,
    <OnTheWater key="d" {...props} />,
  ][screen];

  const alert = snap.alerts[0];
  const isWarning = alert?.level === 'warning';
  const stripBg = isWarning ? C.warnRed : C.amber;
  const stripFg = isWarning ? '#FFFFFF' : C.ink;

  return (
    <div style={{ width: 800, height: 480, display: 'flex', flexDirection: 'column', padding: '10px 16px 8px', gap: 8, background: C.bg }}>
      <div style={{ height: 44, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>{TITLES[screen]}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {snap.station && (
            <div style={{ fontSize: 19, fontWeight: 600, color: C.mist, maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {snap.station.name} · {Math.round(snap.station.miles)} mi
            </div>
          )}
          <SpeakerIcon on={snap.speak} />
          <div style={{ display: 'flex', gap: 2 }}>
            {TITLES.map((t, i) => (
              <button key={t} onClick={() => setScreen(i)} aria-label={t}
                style={{ width: 34, height: 34, background: 'none', border: 'none', display: 'grid', placeItems: 'center', padding: 0 }}>
                <span style={{ width: i === screen ? 22 : 12, height: 12, borderRadius: 6, background: i === screen ? C.aqua : C.dim, transition: 'width 0.15s' }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {alert && (
        <div
          role="alert"
          style={{
            flex: 'none',
            height: 44,
            borderRadius: 14,
            background: stripBg,
            color: stripFg,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 16px',
            fontSize: 25,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}>
          <WarnIcon color={stripFg} size={26} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {alert.event}
            {alert.ends ? ` until ${timeText(alert.ends)}` : ''}
          </span>
          {snap.alerts.length > 1 && <span style={{ marginLeft: 'auto', flex: 'none' }}>+{snap.alerts.length - 1}</span>}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>{body}</div>

      <div style={{ height: 24, flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 17, fontWeight: 600 }}>
        <span style={{ color: C.mist }}>Not for navigation or safety</span>
        <span style={{ color: fresh === 'fresh' ? C.mist : fresh === 'aging' ? C.amber : C.coral }}>
          {ageText(stamp, now)} · NOAA, NWS
        </span>
      </div>
    </div>
  );
}
