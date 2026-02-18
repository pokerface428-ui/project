import { Trade, StockPosition } from '../types';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ko-KR').format(num);
}

export function formatCurrency(num: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(num);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function calculatePositions(trades: Trade[]): StockPosition[] {
  const posMap = new Map<string, StockPosition>();

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  for (const trade of sorted) {
    const key = trade.stockCode || trade.stockName;
    let pos = posMap.get(key);
    if (!pos) {
      pos = {
        stockName: trade.stockName,
        stockCode: trade.stockCode,
        buyQuantity: 0,
        sellQuantity: 0,
        holdingQuantity: 0,
        avgBuyPrice: 0,
        totalBuyCost: 0,
        totalSellRevenue: 0,
        realizedPnL: 0,
      };
      posMap.set(key, pos);
    }

    if (trade.type === 'buy') {
      const cost = trade.price * trade.quantity;
      pos.totalBuyCost += cost;
      pos.buyQuantity += trade.quantity;
      pos.avgBuyPrice = pos.buyQuantity > 0 ? pos.totalBuyCost / pos.buyQuantity : 0;
    } else {
      const revenue = trade.price * trade.quantity;
      pos.totalSellRevenue += revenue;
      pos.sellQuantity += trade.quantity;
      const costBasis = pos.avgBuyPrice * trade.quantity;
      pos.realizedPnL += revenue - costBasis;
    }

    pos.holdingQuantity = pos.buyQuantity - pos.sellQuantity;
  }

  return Array.from(posMap.values());
}

export function getMonthlyStats(trades: Trade[]): { month: string; buyAmount: number; sellAmount: number; pnl: number; count: number }[] {
  const monthMap = new Map<string, { buyAmount: number; sellAmount: number; pnl: number; count: number }>();

  const positions = new Map<string, number>();

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  const avgPrices = new Map<string, { totalCost: number; totalQty: number }>();
  for (const trade of sorted) {
    const key = trade.stockCode || trade.stockName;
    if (trade.type === 'buy') {
      const existing = avgPrices.get(key) || { totalCost: 0, totalQty: 0 };
      existing.totalCost += trade.price * trade.quantity;
      existing.totalQty += trade.quantity;
      avgPrices.set(key, existing);
      positions.set(key, existing.totalCost / existing.totalQty);
    }
  }

  for (const trade of sorted) {
    const month = trade.date.slice(0, 7);
    const existing = monthMap.get(month) || { buyAmount: 0, sellAmount: 0, pnl: 0, count: 0 };
    const amount = trade.price * trade.quantity;

    if (trade.type === 'buy') {
      existing.buyAmount += amount;
    } else {
      existing.sellAmount += amount;
      const key = trade.stockCode || trade.stockName;
      const avgPrice = positions.get(key) || trade.price;
      existing.pnl += (trade.price - avgPrice) * trade.quantity;
    }
    existing.count++;
    monthMap.set(month, existing);
  }

  return Array.from(monthMap.entries())
    .map(([month, stats]) => ({ month, ...stats }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
}

export function exportToCSV(trades: Trade[]): void {
  const headers = ['날짜', '종목명', '종목코드', '매매구분', '수량', '단가', '금액', '메모'];
  const rows = trades.map(t => [
    t.date,
    t.stockName,
    t.stockCode,
    t.type === 'buy' ? '매수' : '매도',
    t.quantity.toString(),
    t.price.toString(),
    (t.price * t.quantity).toString(),
    t.memo,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `매매일지_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getTradesForDate(trades: Trade[], dateStr: string): Trade[] {
  return trades.filter(t => t.date === dateStr);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function compressImage(file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
