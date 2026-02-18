import { useEffect, useRef } from 'react';

type Props = {
  symbol: string;
  height: number;
};

/**
 * TradingView Advanced Chart widget.
 * - No API key required
 * - Uses TradingView public embed script
 */
export function TradingViewWidget({ symbol, height }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Clear previous widget
    el.innerHTML = '';

    const isDark = document.documentElement.classList.contains('dark');

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Asia/Seoul',
      theme: isDark ? 'dark' : 'light',
      style: '1',
      locale: 'kr',
      enable_publishing: false,
      allow_symbol_change: true,
      hide_side_toolbar: true,
      withdateranges: true,
      details: false,
      hotlist: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });

    el.appendChild(script);

    return () => {
      if (el) el.innerHTML = '';
    };
  }, [symbol, height]);

  return (
    <div className="w-full h-full">
      <div ref={containerRef} className="tradingview-widget-container w-full h-full" />
    </div>
  );
}
