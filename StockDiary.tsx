import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Edit2, Save, X, ChevronLeft, ChevronRight,
  TrendingUp, BarChart3, Calendar, Hash, Layers,
  ArrowUpDown, Zap, DollarSign, Copy, ChevronDown, ChevronUp
} from 'lucide-react';
import { DailyEntry, DailyStock } from '../types';
import { generateId, formatNumber, getDaysInMonth, getFirstDayOfMonth } from '../utils/helpers';

interface StockDiaryProps {
  entries: DailyEntry[];
  onSave: (entry: DailyEntry) => void;
  onDelete: (id: string) => void;
}

type SubTab = 'stocks' | 'calendar';
type StockTableType = 'surging' | 'volume' | 'combined';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function getDefaultStock(): DailyStock {
  return { id: generateId(), stockName: '', closePrice: 0, changeRate: 0, tradingVolume: 0, reason: '', theme: '' };
}

// Get combined stocks (deduplicated, union of both lists)
function getCombinedStocks(entry: DailyEntry): DailyStock[] {
  const map = new Map<string, DailyStock>();
  for (const s of entry.surgingStocks) {
    if (s.stockName.trim()) map.set(s.stockName.trim(), s);
  }
  for (const s of entry.volumeStocks) {
    if (s.stockName.trim() && !map.has(s.stockName.trim())) map.set(s.stockName.trim(), s);
  }
  return Array.from(map.values());
}

// Group stocks by theme
function groupByTheme(stocks: DailyStock[]): Map<string, DailyStock[]> {
  const map = new Map<string, DailyStock[]>();
  for (const s of stocks) {
    const theme = s.theme.trim();
    if (!theme) continue;
    const existing = map.get(theme) || [];
    // deduplicate by stock name within same theme
    if (!existing.find(e => e.stockName === s.stockName)) {
      existing.push(s);
    }
    map.set(theme, existing);
  }
  return map;
}

// Theme summary
interface ThemeSummary {
  theme: string;
  stocks: DailyStock[];
  totalChangeRate: number;
  totalVolume: number;
  avgChangeRate: number;
  stockCount: number;
}

function getThemeSummaries(stocks: DailyStock[], minCount = 1): ThemeSummary[] {
  const grouped = groupByTheme(stocks);
  const summaries: ThemeSummary[] = [];
  grouped.forEach((stks, theme) => {
    if (stks.length < minCount) return;
    const totalChangeRate = stks.reduce((s, st) => s + st.changeRate, 0);
    const totalVolume = stks.reduce((s, st) => s + st.tradingVolume, 0);
    summaries.push({
      theme,
      stocks: stks,
      totalChangeRate,
      totalVolume,
      avgChangeRate: stks.length > 0 ? totalChangeRate / stks.length : 0,
      stockCount: stks.length,
    });
  });
  return summaries.sort((a, b) => b.totalChangeRate - a.totalChangeRate);
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function computeScores(themes: ThemeSummary[]) {
  if (themes.length === 0) return new Map<string, number>();
  const counts = themes.map(t => t.stockCount);
  const vols = themes.map(t => t.totalVolume);
  const moves = themes.map(t => Math.abs(t.avgChangeRate));
  const maxC = Math.max(...counts), minC = Math.min(...counts);
  const maxV = Math.max(...vols), minV = Math.min(...vols);
  const maxM = Math.max(...moves), minM = Math.min(...moves);
  const scoreMap = new Map<string, number>();
  themes.forEach(t => {
    const nC = maxC === minC ? 0.5 : (t.stockCount - minC) / (maxC - minC);
    const nV = maxV === minV ? 0.5 : (t.totalVolume - minV) / (maxV - minV);
    const nM = maxM === minM ? 0.5 : (Math.abs(t.avgChangeRate) - minM) / (maxM - minM);
    const score = clamp01(0.45 * nC + 0.35 * nV + 0.20 * nM);
    scoreMap.set(t.theme, score);
  });
  return scoreMap;
}

function scoreToClasses(score: number) {
  // Make importance colors visible in both light and dark mode
  if (score >= 0.75) return {
    pill: 'bg-fuchsia-600/15 text-fuchsia-700 dark:text-fuchsia-200 ring-1 ring-fuchsia-500/40',
    card: 'bg-fuchsia-50 border-fuchsia-300 dark:bg-fuchsia-950/40 dark:border-fuchsia-500/30',
  };
  if (score >= 0.50) return {
    pill: 'bg-indigo-600/15 text-indigo-700 dark:text-indigo-200 ring-1 ring-indigo-500/35',
    card: 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/35 dark:border-indigo-500/25',
  };
  if (score >= 0.25) return {
    pill: 'bg-slate-600/15 text-slate-700 dark:text-slate-200 ring-1 ring-slate-500/25',
    card: 'bg-slate-50 border-slate-200 dark:bg-slate-950/30 dark:border-slate-500/20',
  };
  return {
    pill: 'bg-slate-600/10 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/15',
    card: 'bg-white border-gray-100 dark:bg-slate-950/20 dark:border-slate-500/15',
  };
}

function formatVolume(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`;
  if (v >= 1) return `${formatNumber(Math.round(v))}억`;
  return `${(v * 100).toFixed(0)}백만`;
}

export function StockDiary({ entries, onSave, onDelete }: StockDiaryProps) {
  const today = new Date();
  const [subTab, setSubTab] = useState<SubTab>('stocks');
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().slice(0, 10));
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DailyEntry | null>(null);
  const [stockTableType, setStockTableType] = useState<StockTableType>('surging');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Calendar states
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedThemeDate, setSelectedThemeDate] = useState<string | null>(null);
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);

  // Form states
  const [formSurging, setFormSurging] = useState<DailyStock[]>([]);
  const [formVolume, setFormVolume] = useState<DailyStock[]>([]);
  const [formMemo, setFormMemo] = useState('');
  const [formDate, setFormDate] = useState(selectedDate);

  // Find entry for selected date
  const currentEntry = entries.find(e => e.date === selectedDate);

  // ===== EDIT/CREATE =====
  const handleNew = () => {
    setEditingEntry(null);
    setFormDate(selectedDate);
    setFormSurging(Array.from({ length: 3 }, () => getDefaultStock()));
    setFormVolume(Array.from({ length: 3 }, () => getDefaultStock()));
    setFormMemo('');
    setIsEditing(true);
  };

  const handleEdit = () => {
    if (!currentEntry) return;
    setEditingEntry(currentEntry);
    setFormDate(currentEntry.date);
    setFormSurging(currentEntry.surgingStocks.length > 0 ? [...currentEntry.surgingStocks] : [getDefaultStock()]);
    setFormVolume(currentEntry.volumeStocks.length > 0 ? [...currentEntry.volumeStocks] : [getDefaultStock()]);
    setFormMemo(currentEntry.memo);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingEntry(null);
  };

  // Stock row changes
  const updateStock = (
    _list: DailyStock[],
    setList: React.Dispatch<React.SetStateAction<DailyStock[]>>,
    idx: number,
    field: keyof DailyStock,
    value: string | number
  ) => {
    setList(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addStockRow = (setList: React.Dispatch<React.SetStateAction<DailyStock[]>>) => {
    setList(prev => [...prev, getDefaultStock()]);
  };

  const removeStockRow = (setList: React.Dispatch<React.SetStateAction<DailyStock[]>>, idx: number) => {
    setList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    const validSurging = formSurging.filter(s => s.stockName.trim());
    const validVolume = formVolume.filter(s => s.stockName.trim());

    const entry: DailyEntry = {
      id: editingEntry?.id || generateId(),
      date: formDate,
      surgingStocks: validSurging,
      volumeStocks: validVolume,
      memo: formMemo,
    };
    onSave(entry);
    setSelectedDate(formDate);
    setIsEditing(false);
    setEditingEntry(null);
  };

  const handleDelete = () => {
    if (!currentEntry) return;
    onDelete(currentEntry.id);
    setDeleteConfirm(null);
  };

  // Copy surging to volume or vice versa
  const handleCopyToOther = (from: 'surging' | 'volume') => {
    if (from === 'surging') {
      setFormVolume([...formSurging.map(s => ({ ...s, id: generateId() }))]);
    } else {
      setFormSurging([...formVolume.map(s => ({ ...s, id: generateId() }))]);
    }
  };

  // ===== STOCK TABLE RENDER =====
  const renderStockTable = (stocks: DailyStock[], _title: string, _icon: React.ReactNode, color: string) => {
    if (stocks.length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm">데이터가 없습니다</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`${color} border-b border-gray-200`}>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-600 w-8">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-600">종목명</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-600">종가</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-600">등락률</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-600">거래대금</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-600">상승이유</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-600">테마</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stocks.map((stock, idx) => (
              <tr key={stock.id || idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                    idx < 3 ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white' :
                    idx < 10 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {idx + 1}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-bold text-gray-800">{stock.stockName}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-700">
                  {stock.closePrice > 0 ? `${formatNumber(stock.closePrice)}원` : '-'}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`font-bold ${stock.changeRate > 0 ? 'text-red-600' : stock.changeRate < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                    {stock.changeRate > 0 ? '+' : ''}{stock.changeRate.toFixed(2)}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-600">
                  {stock.tradingVolume > 0 ? formatVolume(stock.tradingVolume) : '-'}
                </td>
                <td className="px-3 py-2.5 text-gray-600 max-w-[150px]">
                  <span className="line-clamp-1 text-xs">{stock.reason || '-'}</span>
                </td>
                <td className="px-3 py-2.5">
                  {stock.theme ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-semibold">
                      <Hash className="w-3 h-3" />{stock.theme}
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ===== FORM: Stock input rows =====
  const renderStockForm = (
    stocks: DailyStock[],
    setStocks: React.Dispatch<React.SetStateAction<DailyStock[]>>,
    label: string,
    icon: React.ReactNode,
    color: string,
    otherLabel: string,
    copyFrom: 'surging' | 'volume'
  ) => (
    <div className={`rounded-2xl border ${color} overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-3 ${color.replace('border-', 'bg-').replace('-200', '-50')}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-bold text-gray-800">{label}</h4>
          <span className="text-xs text-gray-400">({stocks.length}/20)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopyToOther(copyFrom === 'surging' ? 'surging' : 'volume')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/80 text-gray-500 text-[10px] font-semibold hover:bg-white hover:text-indigo-600 transition-colors border border-gray-200"
            title={`${otherLabel}에 복사`}
          >
            <Copy className="w-3 h-3" />{otherLabel}에 복사
          </button>
          {stocks.length < 20 && (
            <button
              type="button"
              onClick={() => addStockRow(setStocks)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-indigo-600 text-xs font-bold hover:bg-indigo-50 transition-colors border border-indigo-200"
            >
              <Plus className="w-3 h-3" />추가
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 w-8">#</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 min-w-[100px]">종목명 *</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 min-w-[80px]">종가</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 min-w-[70px]">등락률(%)</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 min-w-[80px]">거래대금(억)</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 min-w-[120px]">상승이유</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 min-w-[80px]">테마</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stocks.map((stock, idx) => (
              <tr key={stock.id} className="hover:bg-gray-50/50">
                <td className="px-2 py-1.5 text-xs text-gray-400 font-bold">{idx + 1}</td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={stock.stockName}
                    onChange={e => updateStock(stocks, setStocks, idx, 'stockName', e.target.value)}
                    placeholder="종목명"
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    value={stock.closePrice || ''}
                    onChange={e => updateStock(stocks, setStocks, idx, 'closePrice', Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="0.01"
                    value={stock.changeRate || ''}
                    onChange={e => updateStock(stocks, setStocks, idx, 'changeRate', Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    step="0.1"
                    value={stock.tradingVolume || ''}
                    onChange={e => updateStock(stocks, setStocks, idx, 'tradingVolume', Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={stock.reason}
                    onChange={e => updateStock(stocks, setStocks, idx, 'reason', e.target.value)}
                    placeholder="상승 이유"
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={stock.theme}
                    onChange={e => updateStock(stocks, setStocks, idx, 'theme', e.target.value)}
                    placeholder="테마"
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeStockRow(setStocks, idx)}
                    className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ===== 일일 캘린더: theme grouped view =====
  const renderDailyCalendar = () => {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const fmtDate = (day: number) => {
      const m = (calMonth + 1).toString().padStart(2, '0');
      const dd = day.toString().padStart(2, '0');
      return `${calYear}-${m}-${dd}`;
    };

    const isToday = (day: number) => calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate();

    // Entry map
    const entryMap = new Map<string, DailyEntry>();
    entries.forEach(e => {
      const d = new Date(e.date);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        entryMap.set(e.date, e);
      }
    });

    // Selected date themes
    const selEntry = selectedThemeDate ? entries.find(e => e.date === selectedThemeDate) : null;
    const selCombined = selEntry ? getCombinedStocks(selEntry) : [];
    const selThemes = getThemeSummaries(selCombined, 3);

    const monthThemeList = Array.from(themeCalData.monthlyThemes.entries()).map(([theme, data]) => ({ theme, ...data }));
    const monthScores = (() => {
      if (monthThemeList.length === 0) return new Map<string, number>();
      const counts = monthThemeList.map(t => t.count);
      const vols = monthThemeList.map(t => t.totalVolume);
      const moves = monthThemeList.map(t => Math.abs(t.totalChange));
      const maxC = Math.max(...counts), minC = Math.min(...counts);
      const maxV = Math.max(...vols), minV = Math.min(...vols);
      const maxM = Math.max(...moves), minM = Math.min(...moves);
      const m = new Map<string, number>();
      monthThemeList.forEach(t => {
        const nC = maxC === minC ? 0.5 : (t.count - minC) / (maxC - minC);
        const nV = maxV === minV ? 0.5 : (t.totalVolume - minV) / (maxV - minV);
        const nM = maxM === minM ? 0.5 : (Math.abs(t.totalChange) - minM) / (maxM - minM);
        const score = clamp01(0.45 * nC + 0.35 * nV + 0.20 * nM);
        m.set(t.theme, score);
      });
      return m;
    })();

    return (
      <div className="space-y-6">
        {/* Monthly theme summary */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Hash className="w-5 h-5 text-purple-500" />
            {calYear}년 {MONTH_NAMES[calMonth]} 테마 종합
          </h3>
          {themeCalData.monthlyThemes.size === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
              이 달의 테마 데이터가 없습니다
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {monthThemeList
                .sort((a, b) => {
                  if (b.count !== a.count) return b.count - a.count;
                  if (b.totalVolume !== a.totalVolume) return b.totalVolume - a.totalVolume;
                  return Math.abs(b.totalChange) - Math.abs(a.totalChange);
                })
                .map(t => (
                  <div key={t.theme} className={`rounded-xl border p-3 transition-all hover:shadow-md ${scoreToClasses(monthScores.get(t.theme) ?? 0).card}  border-gray-100 dark:border-slate-700/60`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Hash className="w-3.5 h-3.5 text-purple-500" />
                      <span className="font-bold text-gray-800 dark:text-slate-100 text-sm truncate">{t.theme}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400 dark:text-slate-300 text-[10px]">총 등락률</p>
                        <p className={`font-bold ${t.totalChange >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {t.totalChange >= 0 ? '+' : ''}{t.totalChange.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-slate-300 text-[10px]">총 거래대금</p>
                        <p className="font-bold text-gray-700 dark:text-slate-200">{formatVolume(t.totalVolume)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 dark:text-slate-300">
                      <Calendar className="w-3 h-3" />{t.dates.length}일 등장 · {t.count}종목
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-950/40 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/60 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); setSelectedThemeDate(null); }}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><ChevronLeft className="w-5 h-5" /></button>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800">{calYear}년 {MONTH_NAMES[calMonth]}</h3>
              <p className="text-xs text-gray-400 mt-0.5">테마별 종목 현황</p>
            </div>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); setSelectedThemeDate(null); }}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><ChevronRight className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEKDAYS.map((day, i) => (
              <div key={day} className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} className="min-h-[280px] border-b border-r border-gray-50" />;
              const dateStr = fmtDate(day);
              const entry = entryMap.get(dateStr);
              const combined = entry ? getCombinedStocks(entry) : [];
              const themes = getThemeSummaries(combined, 3);
              const dayScores = computeScores(themes);
              const isSel = selectedThemeDate === dateStr;
              const isTodayCell = isToday(day);
              const dayOfWeek = (firstDay + day - 1) % 7;

              return (
                <div
                  key={dateStr}
                  onClick={() => { setSelectedThemeDate(isSel ? null : dateStr); setExpandedTheme(null); }}
                  className={`min-h-[280px] border-b border-r border-gray-50 p-2 cursor-pointer transition-all ${
                    isSel ? 'bg-purple-50 ring-2 ring-inset ring-purple-300' :
                    entry ? 'hover:bg-purple-50/50' : 'hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center ${
                      isTodayCell ? 'bg-indigo-500 text-white' :
                      dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-600'
                    }`}>{day}</span>
                    {entry && <span className="text-[9px] text-gray-400 font-semibold">{combined.length}종목</span>}
                  </div>
                                    <div className="space-y-0.5">
                    {themes.map((t, ti) => (
                      <div key={ti} className={`flex items-center justify-between gap-1 text-[10px] px-1 py-0.5 rounded ${scoreToClasses(dayScores.get(t.theme) ?? 0).pill}`}>
                        <span className="font-semibold truncate flex-1">#{t.theme}</span>
                        <span className="text-[10px] text-gray-600 flex-shrink-0">({t.stockCount})</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="bg-white dark:bg-slate-950/40 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/60 overflow-hidden h-fit max-h-[700px] overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              {selectedThemeDate ? (
                <>{new Date(selectedThemeDate + 'T00:00:00').getMonth() + 1}월 {new Date(selectedThemeDate + 'T00:00:00').getDate()}일 테마 분석</>
              ) : '날짜를 선택하세요'}
            </h3>
            {selectedThemeDate && <p className="text-[11px] text-gray-400 mt-1">3종목 이상 테마 표시</p>}
          </div>

          {!selectedThemeDate ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-sm text-gray-400">캘린더에서 날짜를 클릭하세요</p>
            </div>
          ) : selThemes.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2">😴</div>
              <p className="text-sm text-gray-400">
                {selEntry ? '동일 테마가 없습니다' : '이 날짜의 데이터가 없습니다'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* 총 요약 */}
              <div className="p-3 bg-purple-50">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-gray-500">총 등락률 합계</p>
                    <p className={`text-sm font-bold ${selThemes.reduce((s, t) => s + t.totalChangeRate, 0) >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {selThemes.reduce((s, t) => s + t.totalChangeRate, 0) >= 0 ? '+' : ''}
                      {selThemes.reduce((s, t) => s + t.totalChangeRate, 0).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">총 거래대금</p>
                    <p className="text-sm font-bold text-gray-800">
                      {formatVolume(selThemes.reduce((s, t) => s + t.totalVolume, 0))}
                    </p>
                  </div>
                </div>
              </div>

              {selThemes.map(theme => {
                const isOpen = expandedTheme === theme.theme;
                return (
                  <div key={theme.theme}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedTheme(isOpen ? null : theme.theme); }}
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                          #{theme.theme}
                        </span>
                        <span className="text-xs text-gray-400">{theme.stockCount}종목</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold ${theme.totalChangeRate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {theme.totalChangeRate >= 0 ? '+' : ''}{theme.totalChangeRate.toFixed(2)}%
                        </span>
                        <span className="text-xs text-gray-500 font-semibold">{formatVolume(theme.totalVolume)}</span>
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="px-2 py-1.5 text-left text-gray-500 font-semibold">종목</th>
                              <th className="px-2 py-1.5 text-right text-gray-500 font-semibold">등락률</th>
                              <th className="px-2 py-1.5 text-right text-gray-500 font-semibold">거래대금</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {theme.stocks.map((s, si) => (
                              <tr key={si} className="hover:bg-gray-50">
                                <td className="px-2 py-1.5 font-semibold text-gray-800">{s.stockName}</td>
                                <td className={`px-2 py-1.5 text-right font-bold ${s.changeRate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                  {s.changeRate >= 0 ? '+' : ''}{s.changeRate.toFixed(2)}%
                                </td>
                                <td className="px-2 py-1.5 text-right text-gray-600">{formatVolume(s.tradingVolume)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-200 font-bold">
                              <td className="px-2 py-1.5 text-gray-600">합계</td>
                              <td className={`px-2 py-1.5 text-right ${theme.totalChangeRate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                {theme.totalChangeRate >= 0 ? '+' : ''}{theme.totalChangeRate.toFixed(2)}%
                              </td>
                              <td className="px-2 py-1.5 text-right text-gray-700">{formatVolume(theme.totalVolume)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    );
  };

  // ===== 키워드(테마) 캘린더 =====
  // Gather all themes across all entries for the selected month
  const themeCalData = useMemo(() => {
    const monthEntries = entries.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === calYear && d.getMonth() === calMonth;
    });

    // All unique themes in this month
    const allThemes = new Set<string>();
    const dateThemeMap = new Map<string, ThemeSummary[]>();

    monthEntries.forEach(entry => {
      const combined = getCombinedStocks(entry);
      const themes = getThemeSummaries(combined, 3);
              const dayScores = computeScores(themes);
      dateThemeMap.set(entry.date, themes);
      themes.forEach(t => allThemes.add(t.theme));
    });

    // Monthly theme aggregation
    const monthlyThemes = new Map<string, { totalChange: number; totalVolume: number; count: number; dates: string[] }>();
    dateThemeMap.forEach((themes, date) => {
      themes.forEach(t => {
        const existing = monthlyThemes.get(t.theme) || { totalChange: 0, totalVolume: 0, count: 0, dates: [] };
        existing.totalChange += t.totalChangeRate;
        existing.totalVolume += t.totalVolume;
        existing.count += t.stockCount;
        existing.dates.push(date);
        monthlyThemes.set(t.theme, existing);
      });
    });

    return { dateThemeMap, allThemes, monthlyThemes };
  }, [entries, calYear, calMonth]);

  

  // ===== EDIT MODE =====
  if (isEditing) {
    return (
      <div className="space-y-4">
        <button onClick={handleCancel} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-semibold">
          ← 돌아가기
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            {editingEntry ? <Edit2 className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
            {editingEntry ? '일지 수정' : '새 일지 작성'}
          </h2>

          {/* Date */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">📅 날짜</label>
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className="px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-lg font-semibold"
            />
          </div>

          {/* Surging stocks */}
          <div className="mb-6">
            {renderStockForm(
              formSurging, setFormSurging,
              '🚀 급등주 상위 20',
              <Zap className="w-4 h-4 text-orange-500" />,
              'border-orange-200',
              '거래대금',
              'surging'
            )}
          </div>

          {/* Volume stocks */}
          <div className="mb-6">
            {renderStockForm(
              formVolume, setFormVolume,
              '💰 거래대금 상위 20',
              <DollarSign className="w-4 h-4 text-green-500" />,
              'border-green-200',
              '급등주',
              'volume'
            )}
          </div>

          {/* Memo */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">📝 메모</label>
            <textarea
              value={formMemo}
              onChange={e => setFormMemo(e.target.value)}
              placeholder="오늘의 시장 분석, 특이사항 등..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              className="flex-1 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />{editingEntry ? '수정 완료' : '일지 저장'}
            </button>
            <button onClick={handleCancel} className="px-6 py-4 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== VIEW MODE =====
  const combinedStocks = currentEntry ? getCombinedStocks(currentEntry) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">📔 주식 일지</h2>
          <p className="text-sm text-gray-400 mt-1">일별 급등주, 거래대금, 테마를 기록하고 분석하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {currentEntry ? (
            <div className="flex gap-1">
              <button onClick={handleEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-bold hover:bg-indigo-100">
                <Edit2 className="w-4 h-4" />수정
              </button>
              {deleteConfirm === currentEntry.id ? (
                <div className="flex gap-1">
                  <button onClick={handleDelete} className="px-3 py-2 rounded-xl bg-red-500 text-white text-xs font-bold">삭제</button>
                  <button onClick={() => setDeleteConfirm(null)} className="px-3 py-2 rounded-xl bg-gray-200 text-gray-600 text-xs font-bold">취소</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(currentEntry.id)} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg hover:shadow-xl">
              <Plus className="w-4 h-4" />새 일지
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 bg-white/60 p-1 rounded-xl border border-gray-100">
        {[
          { id: 'stocks' as SubTab, label: '급등주 & 거래대금', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'calendar' as SubTab, label: '테마 캘린더', icon: <Calendar className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-1 justify-center ${
              subTab === tab.id
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ===== SUB TAB: 급등주 & 거래대금 ===== */}
      {subTab === 'stocks' && (
        <div className="space-y-4">
          {!currentEntry ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-5xl mb-4">📔</div>
              <p className="text-gray-500 font-semibold mb-2">{selectedDate} 의 일지가 없습니다</p>
              <p className="text-gray-400 text-sm mb-6">새 일지를 작성하여 급등주와 거래대금 상위 종목을 기록하세요</p>
              <button onClick={handleNew} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl">
                <Plus className="w-5 h-5" />일지 작성하기
              </button>
            </div>
          ) : (
            <>
              {/* Date header + memo */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">
                        {new Date(selectedDate + 'T00:00:00').getFullYear()}년 {new Date(selectedDate + 'T00:00:00').getMonth() + 1}월 {new Date(selectedDate + 'T00:00:00').getDate()}일
                      </h3>
                      <p className="text-xs text-gray-400">
                        급등주 {currentEntry.surgingStocks.length}종목 · 거래대금 {currentEntry.volumeStocks.length}종목 · 취합 {combinedStocks.length}종목
                      </p>
                    </div>
                  </div>
                </div>
                {currentEntry.memo && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">📝 {currentEntry.memo}</p>
                  </div>
                )}
              </div>

              {/* Table type selector */}
              <div className="flex gap-1 bg-white p-1 rounded-xl border border-gray-100">
                {[
                  { id: 'surging' as StockTableType, label: '🚀 급등주 TOP 20', count: currentEntry.surgingStocks.length },
                  { id: 'volume' as StockTableType, label: '💰 거래대금 TOP 20', count: currentEntry.volumeStocks.length },
                  { id: 'combined' as StockTableType, label: '📊 전체 취합', count: combinedStocks.length },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setStockTableType(t.id)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all flex-1 ${
                      stockTableType === t.id
                        ? t.id === 'surging' ? 'bg-orange-500 text-white shadow' :
                          t.id === 'volume' ? 'bg-green-500 text-white shadow' :
                          'bg-indigo-500 text-white shadow'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t.label} <span className="opacity-70">({t.count})</span>
                  </button>
                ))}
              </div>

              {/* Stock table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {stockTableType === 'surging' && renderStockTable(
                  currentEntry.surgingStocks,
                  '급등주 상위 20',
                  <TrendingUp className="w-4 h-4 text-orange-500" />,
                  'bg-orange-50/50'
                )}
                {stockTableType === 'volume' && renderStockTable(
                  currentEntry.volumeStocks,
                  '거래대금 상위 20',
                  <ArrowUpDown className="w-4 h-4 text-green-500" />,
                  'bg-green-50/50'
                )}
                {stockTableType === 'combined' && renderStockTable(
                  combinedStocks,
                  '전체 취합 (중복 제거)',
                  <BarChart3 className="w-4 h-4 text-indigo-500" />,
                  'bg-indigo-50/50'
                )}
              </div>

              {/* Theme summary for the day */}
              {combinedStocks.length > 0 && (() => {
                const themes = getThemeSummaries(combinedStocks, 1);
                if (themes.length === 0) return null;
                return (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-500" />
                        당일 테마 요약
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600">테마</th>
                            <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-600">종목수</th>
                            <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-600">총 등락률</th>
                            <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-600">평균 등락률</th>
                            <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-600">총 거래대금</th>
                            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600">종목</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {themes.map(t => (
                            <tr key={t.theme} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                                  <Hash className="w-3 h-3" />{t.theme}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center font-bold text-gray-700">{t.stockCount}</td>
                              <td className={`px-4 py-2.5 text-right font-bold ${t.totalChangeRate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                {t.totalChangeRate >= 0 ? '+' : ''}{t.totalChangeRate.toFixed(2)}%
                              </td>
                              <td className={`px-4 py-2.5 text-right font-semibold ${t.avgChangeRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {t.avgChangeRate >= 0 ? '+' : ''}{t.avgChangeRate.toFixed(2)}%
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-600">{formatVolume(t.totalVolume)}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {t.stocks.map((s, si) => (
                                    <span key={si} className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{s.stockName}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* Entry list */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                작성된 일지 목록
                <span className="text-xs font-normal text-gray-400">({entries.length}건)</span>
              </h3>
            </div>
            {entries.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">아직 작성된 일지가 없습니다</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
                {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map(entry => {
                  const combined = getCombinedStocks(entry);
                  const themes = getThemeSummaries(combined, 3);
              const dayScores = computeScores(themes);
                  const isSelected = entry.date === selectedDate;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedDate(entry.date)}
                      className={`flex items-center justify-between p-3 cursor-pointer transition-all ${
                        isSelected ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-800">{new Date(entry.date + 'T00:00:00').getDate()}</p>
                          <p className="text-[10px] text-gray-400">{new Date(entry.date + 'T00:00:00').getMonth() + 1}월</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">
                            급등주 {entry.surgingStocks.length} · 거래대금 {entry.volumeStocks.length} · 취합 {combined.length}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {themes.slice(0, 4).map((t, ti) => (
                              <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold">
                                #{t.theme}
                              </span>
                            ))}
                            {themes.length > 4 && <span className="text-[9px] text-gray-400">+{themes.length - 4}</span>}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SUB TAB: 테마 캘린더 ===== */}
      {subTab === 'calendar' && renderDailyCalendar()}

      {/* ===== SUB TAB: (삭제됨) ===== */}
      
    </div>
  );
}
