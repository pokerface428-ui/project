import { useEffect, useMemo, useRef, useState } from 'react';

type MarketItem = {
  key: string;
  label: string;
  symbol: string;
  price: number | null;
  changePercent: number | null;
  ts: number;
};

function formatPrice(label: string, v: number | null) {
  if (v === null || Number.isNaN(v)) return '—';
  // USDKRW는 소수 1자리, 지수는 2자리, 원자재는 2자리
  if (label === 'USDKRW') return v.toFixed(1);
  if (label === 'WTI' || label === 'GOLD') return v.toFixed(2);
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPct(v: number | null) {
  if (v === null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

export function MarketTickerBar() {
  // 기본은 same-origin. 필요 시 .env에 VITE_API_BASE=http://localhost:3001 같은 값 설정
  const API_BASE = useMemo(() => (import.meta as any).env?.VITE_API_BASE || '', []);

  const inFlightRef = useRef(false);
  const failureCountRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const [items, setItems] = useState<MarketItem[]>([]);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ref는 렌더를 트리거하지 않으므로, “폴링 일시정지” UI 표시를 확실히 state로 관리
  const [pollPaused, setPollPaused] = useState(false);

  const ordered = useMemo(() => {
    const order = ['KOSPI', 'KOSDAQ', 'DOW', 'NASDAQ', 'SP500', 'USDKRW', 'GOLD', 'WTI'];
    const map = new Map(items.map(i => [i.key, i]));
    return order.map(k => map.get(k)).filter(Boolean) as MarketItem[];
  }, [items]);

  useEffect(() => {
    let mounted = true;

    const fetchOnce = async () => {
      if (inFlightRef.current) return;
      if (failureCountRef.current >= 6) return;

      inFlightRef.current = true;

      const ac = new AbortController();
      const timeoutId = window.setTimeout(() => ac.abort(), 8000);

      try {
        const r = await fetch(`${API_BASE}/api/market-quotes`, {
          signal: ac.signal,
          headers: { Accept: 'application/json' },
        });

        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const j = await r.json();

        if (!mounted) return;

        setItems(Array.isArray(j.items) ? j.items : []);
        setIsCached(Boolean(j.cached));
        setError(j.error ? String(j.error) : null);

        // 성공하면 실패 카운트 리셋 + 폴링 재개
        failureCountRef.current = 0;
        setPollPaused(false);
      } catch (e: any) {
        failureCountRef.current += 1;

        const msg = String(e?.name === 'AbortError' ? '요청 시간초과' : (e?.message ?? e));
        if (mounted) setError(msg.length > 80 ? msg.slice(0, 80) + '…' : msg);

        // 6회 연속 실패 시 폴링 일시정지 상태로 표시
        if (failureCountRef.current >= 6 && mounted) {
          setPollPaused(true);
        }
      } finally {
        window.clearTimeout(timeoutId);
        inFlightRef.current = false;
      }
    };

    fetchOnce();

    timerRef.current = window.setInterval(() => {
      if (failureCountRef.current >= 6) return;
      fetchOnce();
    }, 20000);

    return () => {
      mounted = false;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [API_BASE]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/80 dark:bg-slate-950/40 backdrop-blur px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {ordered.map(it => {
          const up = (it.changePercent ?? 0) > 0;
          const down = (it.changePercent ?? 0) < 0;

          const tone =
            up ? 'text-red-400' :
            down ? 'text-blue-400' :
            'text-slate-300';

          const pill =
            up ? 'bg-red-500/10 ring-red-500/20' :
            down ? 'bg-blue-500/10 ring-blue-500/20' :
            'bg-slate-500/10 ring-slate-500/20';

          return (
            <div
              key={it.key}
              className="flex items-center gap-3 px-3 py-2 rounded-xl ring-1 shrink-0 min-w-[170px] bg-slate-50 dark:bg-slate-900/40 ring-slate-200 dark:ring-slate-700/60"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-200 tracking-wide truncate">
                  {it.label}
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatPrice(it.label, it.price)}
                  </div>
                  <div className={`text-xs font-bold tabular-nums ${tone}`}>
                    {formatPct(it.changePercent)}
                  </div>
                </div>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ring-1 ${pill}`} />
            </div>
          );
        })}

        {ordered.length === 0 && (
          <div className="text-sm text-slate-500 dark:text-slate-300 px-2 py-2">
            지수 데이터를 불러오는 중…
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>20초마다 업데이트</span>
        <span>
          {isCached ? '캐시 데이터 표시' : '실시간(지연)'}
          {pollPaused ? ' · 서버 연결 불가(폴링 일시정지)' : ''}
          {error ? ` · 오류: ${error}` : ''}
        </span>
      </div>
    </div>
  );
}