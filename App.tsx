import { useState, useEffect } from 'react';
import {
  Plus, LayoutDashboard, List, Briefcase, Download, Moon, Sun,
  BookOpen, Settings as SettingsIcon, BookMarked, Bitcoin,
  Menu, X, ChevronLeft
} from 'lucide-react';
import { Trade, TabType, StudyNote, AppSettings, DailyEntry, BtcTrade } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { exportToCSV } from './utils/helpers';
import { Dashboard } from './components/Dashboard';
import { TradeForm } from './components/TradeForm';
import { TradeList } from './components/TradeList';
import { Portfolio } from './components/Portfolio';
import { StudyNotes } from './components/StudyNotes';
import { Settings } from './components/Settings';
import { StockDiary } from './components/StockDiary';
import { Bitcoin as BitcoinPage } from './components/Bitcoin';

const SAMPLE_TRADES: Trade[] = [
  { id: 'sample1', date: '2024-11-05', stockName: '삼성전자', stockCode: '005930', type: 'buy', quantity: 100, price: 58000, memo: '실적 발표 전 분할 매수', images: [] },
  { id: 'sample2', date: '2024-11-12', stockName: '삼성전자', stockCode: '005930', type: 'buy', quantity: 50, price: 56500, memo: '추가 매수 (단가 낮추기)', images: [] },
  { id: 'sample3', date: '2024-12-03', stockName: '삼성전자', stockCode: '005930', type: 'sell', quantity: 80, price: 61000, memo: '목표가 도달 일부 익절', images: [] },
  { id: 'sample4', date: '2024-11-20', stockName: 'SK하이닉스', stockCode: '000660', type: 'buy', quantity: 30, price: 178000, memo: 'AI 반도체 수요 증가 기대', images: [] },
  { id: 'sample5', date: '2024-12-10', stockName: 'SK하이닉스', stockCode: '000660', type: 'sell', quantity: 30, price: 192000, memo: '단기 목표 달성 전량 매도', images: [] },
  { id: 'sample6', date: '2024-12-15', stockName: 'NAVER', stockCode: '035420', type: 'buy', quantity: 20, price: 215000, memo: '검색 광고 성장 기대', images: [] },
  { id: 'sample7', date: '2025-01-08', stockName: '카카오', stockCode: '035720', type: 'buy', quantity: 50, price: 42000, memo: '저점 매수 기회', images: [] },
  { id: 'sample8', date: '2025-01-15', stockName: '카카오', stockCode: '035720', type: 'sell', quantity: 50, price: 39500, memo: '손절 (-5.9%)', images: [] },
];

const DEFAULT_SETTINGS: AppSettings = {
  appTitle: '주식 매매 일지',
  appSubtitle: '나만의 투자 기록 관리',
  theme: 'dark',
  newsPresets: ['금리', '환율', '반도체', '2차전지', '배당', '공매도', '실적', 'IPO'],
  dashboardSections: [
    { id: 'stats', title: '통계 카드', visible: true, order: 0 },
    { id: 'calendar', title: '캘린더', visible: true, order: 1 },
    { id: 'monthlyChart', title: '월별 손익', visible: true, order: 2 },
    { id: 'recentTrades', title: '최근 매매', visible: true, order: 3 },
    { id: 'news', title: '최신 증권 뉴스', visible: true, order: 4 },
  ],
  tabs: [
    { id: 'dashboard', label: '대시보드', visible: true },
    { id: 'trades', label: '매매 기록', visible: true },
    { id: 'portfolio', label: '포트폴리오', visible: true },
    { id: 'study', label: '분석/공부', visible: true },
    { id: 'diary', label: '주식 일지', visible: true },
    { id: 'bitcoin', label: '비트코인', visible: true },
    { id: 'settings', label: '설정', visible: true },
  ],
};

const TAB_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="w-5 h-5" />,
  trades: <List className="w-5 h-5" />,
  portfolio: <Briefcase className="w-5 h-5" />,
  study: <BookOpen className="w-5 h-5" />,
  diary: <BookMarked className="w-5 h-5" />,
  bitcoin: <Bitcoin className="w-5 h-5" />,
  settings: <SettingsIcon className="w-5 h-5" />,
};

export function App() {
  const [trades, setTrades] = useLocalStorage<Trade[]>('stock-journal-trades-v2', SAMPLE_TRADES);
  const [studyNotes, setStudyNotes] = useLocalStorage<StudyNote[]>('stock-journal-study-v1', []);
  const [diaryEntries, setDiaryEntries] = useLocalStorage<DailyEntry[]>('stock-journal-diary-v1', []);
  const [btcTrades, setBtcTrades] = useLocalStorage<BtcTrade[]>('stock-journal-btc-v1', []);
  const [settings, setSettings] = useLocalStorage<AppSettings>('stock-journal-settings-v1', DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [initialFormDate, setInitialFormDate] = useState<string | null>(null);
  const [calendarTargetDate, setCalendarTargetDate] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    let changed = false;
    const next = { ...settings };
    if (!('theme' in settings)) {
      (next as any).theme = DEFAULT_SETTINGS.theme;
      changed = true;
    }
    if (!('newsPresets' in settings) || !Array.isArray((settings as any).newsPresets)) {
      (next as any).newsPresets = DEFAULT_SETTINGS.newsPresets;
      changed = true;
    }
    if (changed) setSettings(next as AppSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDark = settings.theme === 'dark';

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    document.title = `📊 ${settings.appTitle}`;
  }, [settings.appTitle]);

  const handleAddTrade = (trade: Trade) => {
    if (editingTrade) setTrades((prev) => prev.map((t) => (t.id === trade.id ? trade : t)));
    else setTrades((prev) => [...prev, trade]);
    setIsFormOpen(false);
    setEditingTrade(null);
    setInitialFormDate(null);
  };

  const handleDeleteTrade = (id: string) => setTrades((prev) => prev.filter((t) => t.id !== id));

  const handleEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setInitialFormDate(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTrade(null);
    setInitialFormDate(null);
  };

  const handleAddTradeForDate = (date: string) => {
    setEditingTrade(null);
    setInitialFormDate(date);
    setIsFormOpen(true);
  };

  const handleViewInCalendar = (trade: Trade) => {
    setCalendarTargetDate(trade.date);
    setActiveTab('dashboard');
  };

  const handleCalendarTargetConsumed = () => setCalendarTargetDate(null);

  const handleSaveNote = (note: StudyNote) => {
    setStudyNotes((prev) => {
      const exists = prev.find((n) => n.id === note.id);
      if (exists) return prev.map((n) => (n.id === note.id ? note : n));
      return [...prev, note];
    });
  };

  const handleDeleteNote = (id: string) => setStudyNotes((prev) => prev.filter((n) => n.id !== id));

  const handleSaveDiaryEntry = (entry: DailyEntry) => {
    setDiaryEntries((prev) => {
      const exists = prev.find((e) => e.id === entry.id);
      if (exists) return prev.map((e) => (e.id === entry.id ? entry : e));
      return [...prev, entry];
    });
  };

  const handleDeleteDiaryEntry = (id: string) => setDiaryEntries((prev) => prev.filter((e) => e.id !== id));

  const handleSaveBtcTrade = (trade: BtcTrade) => {
    setBtcTrades((prev) => {
      const exists = prev.find((t) => t.id === trade.id);
      if (exists) return prev.map((t) => (t.id === trade.id ? trade : t));
      return [...prev, trade];
    });
  };

  const handleDeleteBtcTrade = (id: string) => setBtcTrades((prev) => prev.filter((t) => t.id !== id));

  const handleSaveSettings = (newSettings: AppSettings) => setSettings(newSettings);
  const handleResetSettings = () => setSettings(DEFAULT_SETTINGS);

  const handleClearAllData = () => {
    setTrades([]);
    setStudyNotes([]);
    setDiaryEntries([]);
    setBtcTrades([]);
    setSettings(DEFAULT_SETTINGS);
  };

  const visibleTabs = settings.tabs.filter((t) => t.visible);

  useEffect(() => {
    const isCurrentTabVisible = settings.tabs.find((t) => t.id === activeTab)?.visible;
    if (!isCurrentTabVisible) setActiveTab('dashboard');
  }, [settings.tabs, activeTab]);

  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 flex text-gray-900 dark:text-slate-100">
      {/* ===== MOBILE OVERLAY ===== */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* ===== LEFT SIDEBAR ===== */}
      <aside
        className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col
        bg-white/95 dark:bg-slate-950/80 backdrop-blur-xl border-r border-gray-200 dark:border-slate-800 shadow-lg lg:shadow-sm
        transition-all duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarOpen ? 'w-64' : 'w-[72px]'}
      `}
      >
        {/* Sidebar Header */}
        <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} p-4 border-b border-gray-100 dark:border-slate-800`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 flex-shrink-0">
                <span className="text-white text-lg">📊</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-gray-800 dark:text-slate-100 truncate leading-tight">{settings.appTitle}</h1>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 truncate">{settings.appSubtitle}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800/60 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex-shrink-0"
            title={sidebarOpen ? '사이드바 접기' : '사이드바 펼치기'}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`} />
          </button>
          {/* Mobile close */}
          <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800/60 text-gray-400 dark:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isSettings = tab.id === 'settings';

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                title={sidebarOpen ? undefined : tab.label}
                className={`
                  w-full flex items-center gap-3 rounded-xl transition-all duration-200
                  ${sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
                  ${isActive
                    ? tab.id === 'bitcoin'
                      ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-lg shadow-orange-200'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200'
                    : isSettings
                    ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }
                `}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-white' : ''}`}>
                  {TAB_ICONS[tab.id] || <SettingsIcon className="w-5 h-5" />}
                </span>
                {sidebarOpen && (
                  <span className={`text-sm font-semibold truncate ${isActive ? 'text-white' : ''}`}>{tab.label}</span>
                )}
                {!sidebarOpen && isActive && <span className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={`p-3 border-t border-gray-100 dark:border-slate-800 ${sidebarOpen ? '' : 'flex flex-col items-center'}`}>
          <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'flex-col gap-2'}`}>
            <button
              onClick={() => setSettings((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/60 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              title="다크 모드"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {sidebarOpen && trades.length > 0 && (
              <button
                onClick={() => exportToCSV(trades)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-100 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            )}
          </div>
          {sidebarOpen && <p className="text-[9px] text-gray-300 dark:text-slate-500 text-center mt-2">💾 로컬 스토리지 저장</p>}
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/60 text-gray-500 dark:text-slate-200">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">📊</span>
                </div>
                <h1 className="text-sm font-bold text-gray-800 dark:text-slate-100">{settings.appTitle}</h1>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingTrade(null);
                setInitialFormDate(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Header */}
        <div className="hidden lg:flex items-center justify-between px-6 lg:px-8 py-4 border-b border-gray-100 dark:border-slate-800 bg-white/40 dark:bg-slate-950/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {TAB_ICONS[activeTab]}
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">
                {settings.tabs.find((t) => t.id === activeTab)?.label || activeTab}
              </h2>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingTrade(null);
              setInitialFormDate(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-bold shadow-lg shadow-indigo-200 transition-all hover:shadow-xl"
          >
            <Plus className="w-4 h-4" />
            새 기록
          </button>
        </div>

        {/* Content */}
        <main className="flex-1 px-4 lg:px-8 py-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              trades={trades}
              onEditTrade={handleEditTrade}
              onDeleteTrade={handleDeleteTrade}
              onAddTradeForDate={handleAddTradeForDate}
              calendarTargetDate={calendarTargetDate}
              onCalendarTargetConsumed={handleCalendarTargetConsumed}
              onNavigateToTrades={() => setActiveTab('trades')}
              settings={settings}
            />
          )}
          {activeTab === 'trades' && (
            <TradeList trades={trades} onDelete={handleDeleteTrade} onEdit={handleEditTrade} onViewInCalendar={handleViewInCalendar} />
          )}
          {activeTab === 'portfolio' && <Portfolio trades={trades} />}
          {activeTab === 'study' && <StudyNotes notes={studyNotes} onSave={handleSaveNote} onDelete={handleDeleteNote} />}
          {activeTab === 'diary' && <StockDiary entries={diaryEntries} onSave={handleSaveDiaryEntry} onDelete={handleDeleteDiaryEntry} />}
          {activeTab === 'bitcoin' && <BitcoinPage trades={btcTrades} onSaveTrade={handleSaveBtcTrade} onDeleteTrade={handleDeleteBtcTrade} />}
          {activeTab === 'settings' && (
            <Settings settings={settings} onSave={handleSaveSettings} onReset={handleResetSettings} onClearAllData={handleClearAllData} />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/80">
          <div className="px-4 lg:px-8 py-3">
            <p className="text-center text-[10px] text-gray-400 dark:text-slate-400">
              📊 {settings.appTitle} — 모든 데이터는 브라우저 로컬 스토리지에 저장됩니다
            </p>
          </div>
        </footer>
      </div>

      {/* Trade Form Modal */}
      <TradeForm isOpen={isFormOpen} onSubmit={handleAddTrade} onCancel={handleCloseForm} editTrade={editingTrade} initialDate={initialFormDate} />
    </div>
  );
}