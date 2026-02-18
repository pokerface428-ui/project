import { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp, Activity } from 'lucide-react';

type Coin = { symbol: string; name: string; tradingview: string };

const COINS: Coin[] = [
  { symbol: 'BTC', name: '비트코인', tradingview: 'UPBIT:BTCKRW' },
  { symbol: 'ETH', name: '이더리움', tradingview: 'UPBIT:ETHKRW' },
  { symbol: 'XRP', name: '리플', tradingview: 'UPBIT:XRPWRW' },
  { symbol: 'SOL', name: '솔라나', tradingview: 'UPBIT:SOLKRW' },
  { symbol: 'DOGE', name: '도지', tradingview: 'UPBIT:DOGEKRW' },
  { symbol: 'ADA', name: '에이다', tradingview: 'UPBIT:ADAKRW' },
  { symbol: 'AVAX', name: '아발란체', tradingview: 'UPBIT:AVAXKRW' },
  { symbol: 'DOT', name: '폴카닷', tradingview: 'UPBIT:DOTKRW' },
];

// ===== UPBIT CHART =====
function UpbitChart() {
  const [selectedCoin, setSelectedCoin] = useState(COINS[0]);
  const chartRef = useRef<HTMLDivElement>(null);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // 다크/라이트 토글을 감지해서 TradingView 위젯을 다시 그릴 수 있게 함
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      setIsDark(el.classList.contains('dark'));
    });
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    // TradingView가 이미 로드된 상태면 script 재삽입 없이도 동작하도록 항상 innerHTML clear
    chartRef.current.innerHTML = '';

    const ensureWidget = () => {
      if (!chartRef.current) return;
      if (typeof (window as any).TradingView === 'undefined') return;

      new (window as any).TradingView.widget({
        container_id: chartRef.current.id,
        symbol: selectedCoin.tradingview,
        interval: '60',
        timezone: 'Asia/Seoul',
        theme: isDark ? 'dark' : 'light',
        style: '1',
        locale: 'kr',
        toolbar_bg: isDark ? '#0b1220' : '#f1f3f6',
        enable_publishing: false,
        allow_symbol_change: true,
        autosize: true,
        hide_side_toolbar: false,
        studies: ['MASimple@tv-basicstudies', 'Volume@tv-basicstudies'],
      });
    };

    // tv.js가 아직 없으면 로드
    const hasTv = Array.from(document.getElementsByTagName('script')).some((s) =>
      (s.src || '').includes('https://s3.tradingview.com/tv.js')
    );

    if (hasTv && typeof (window as any).TradingView !== 'undefined') {
      ensureWidget();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = ensureWidget;

    document.head.appendChild(script);

    return () => {
      try {
        document.head.removeChild(script);
      } catch {
        /* ignore */
      }
    };
  }, [selectedCoin, isDark]);

  return (
    <div className="space-y-4">
      {/* Coin selector */}
      <div className="flex flex-wrap gap-2">
        {COINS.map((coin) => {
          const active = coin.symbol === selectedCoin.symbol;
          return (
            <button
              key={coin.symbol}
              onClick={() => setSelectedCoin(coin)}
              className={[
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors',
                active
                  ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-lg shadow-orange-200'
                  : 'bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-700/60 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-900/50',
              ].join(' ')}
            >
              <TrendingUp className="w-4 h-4" />
              {coin.symbol}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-500" />
            <div>
              <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                {selectedCoin.name} ({selectedCoin.symbol})
              </p>
              <p className="text-[11px] text-gray-400 dark:text-slate-400">TradingView (Upbit)</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div
            ref={chartRef}
            id="tradingview_upbit_chart"
            className="w-full h-[520px] bg-white dark:bg-slate-950"
          />
        </div>
      </div>
    </div>
  );
}

export function Bitcoin() {
  return (
    <div className="space-y-6">
      <UpbitChart />
    </div>
  );
}