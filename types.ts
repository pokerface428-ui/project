export interface Trade {
  id: string;
  date: string;
  stockName: string;
  stockCode: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  memo: string;
  images: string[];
}

export interface StockPosition {
  stockName: string;
  stockCode: string;
  buyQuantity: number;
  sellQuantity: number;
  holdingQuantity: number;
  avgBuyPrice: number;
  totalBuyCost: number;
  totalSellRevenue: number;
  realizedPnL: number;
}

export interface StudyFile {
  name: string;
  size: number;
  type: string;
  data: string;
}

export interface StudyNote {
  id: string;
  title: string;
  category: 'analysis' | 'study';
  stockName: string;
  stockCode: string;
  content: string;
  images: string[];
  videos: string[];
  files: StudyFile[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// === 주식 일지 ===
export interface DailyStock {
  id: string;
  stockName: string;
  closePrice: number;
  changeRate: number; // 등락률 %
  tradingVolume: number; // 거래대금 (억원)
  reason: string; // 상승 이유
  theme: string; // 테마
}

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  surgingStocks: DailyStock[]; // 급등주 상위 20
  volumeStocks: DailyStock[]; // 거래대금 상위 20
  memo: string;
}

// === 비트코인 매매 일지 ===
export interface BtcTrade {
  id: string;
  date: string;
  coin: string; // BTC, ETH, XRP 등
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  memo: string;
}

export type TabType = 'dashboard' | 'trades' | 'portfolio' | 'study' | 'diary' | 'bitcoin' | 'settings';

export type DashboardSectionId = 'stats' | 'calendar' | 'monthlyChart' | 'recentTrades' | 'news';

export interface DashboardSection {
  id: DashboardSectionId;
  title: string;
  visible: boolean;
  order: number;
}

export interface TabConfig {
  id: TabType;
  label: string;
  visible: boolean;
}

export interface AppSettings {
  appTitle: string;
  appSubtitle: string;
  dashboardSections: DashboardSection[];
  tabs: TabConfig[];
  /** UI theme preference */
  theme: 'light' | 'dark';
  /** News keyword preset buttons shown in News tab */
  newsPresets: string[];
}
