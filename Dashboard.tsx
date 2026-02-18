import { useState, useEffect } from 'react';
import {
  TrendingUp, BarChart3, Target, Award, Activity, ChevronLeft, ChevronRight,
  ImageIcon, X, Plus, Trash2, Edit2, List
} from 'lucide-react';
import { Trade, AppSettings, DashboardSectionId } from '../types';
import {
  formatCurrency, formatNumber, calculatePositions, getMonthlyStats,
  getDaysInMonth, getFirstDayOfMonth
} from '../utils/helpers';
import { NewsFeed } from './NewsFeed';

interface DashboardProps {
  trades: Trade[];
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
  onAddTradeForDate: (date: string) => void;
  calendarTargetDate: string | null;
  onCalendarTargetConsumed: () => void;
  onNavigateToTrades: () => void;
  settings: AppSettings;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function getTradeComputed(trade: Trade) {
  const qty = trade.quantity || 0;
  let buyAmount = 0;
  let sellAmount = 0;

  if (trade.type === 'roundtrip') {
    const bp = trade.buyPrice ?? 0;
    const sp = trade.sellPrice ?? 0;
    buyAmount = bp * qty;
    sellAmount = sp * qty;
  } else if (trade.type === 'buy') {
    buyAmount = (trade.price ?? 0) * qty;
  } else if (trade.type === 'sell') {
    sellAmount = (trade.price ?? 0) * qty;
  }

  const pnl = trade.realizedPnl ?? 0;
  const returnPct = buyAmount > 0 ? (pnl / buyAmount) * 100 : 0;

  return { buyAmount, sellAmount, pnl, returnPct };
}

function getDaySummary(trades: Trade[]) {
  let totalBuy = 0;
  let totalSell = 0;
  let totalPnl = 0;
  const returns: number[] = [];

  for (const t of trades) {
    const c = getTradeComputed(t);
    totalBuy += c.buyAmount;
    totalSell += c.sellAmount;
    totalPnl += c.pnl;
    if (c.buyAmount > 0) returns.push(c.returnPct);
  }

  const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  return { totalBuy, totalSell, totalPnl, avgReturn };
}

export function Dashboard({
  trades,
  onEditTrade,
  onDeleteTrade,
  onAddTradeForDate,
  calendarTargetDate,
  onCalendarTargetConsumed,
  onNavigateToTrades,
  settings,
}: DashboardProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (calendarTargetDate) {
      const d = new Date(calendarTargetDate);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
      setSelectedDate(calendarTargetDate);
      onCalendarTargetConsumed();
      setTimeout(() => {
        document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [calendarTargetDate, onCalendarTargetConsumed]);

  const positions = calculatePositions(trades);
  const monthlyStats = getMonthlyStats(trades);

  // Day-trader metrics (roundtrip-first)
  const rtTrades = trades.filter((t) => t.type === 'roundtrip');
  const sumPnl = (list: Trade[]) => list.reduce((s, t) => s + Number((t as any).realizedPnl || 0), 0);
  const avgReturnPct = (list: Trade[]) => {
    const rets = list
      .map((t) => {
        const invested = Number((t as any).buyPrice || 0) * t.quantity;
        const pnl = Number((t as any).realizedPnl || 0);
        return invested > 0 ? (pnl / invested) * 100 : null;
      })
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (rets.length === 0) return 0;
    return rets.reduce((a, b) => a + b, 0) / rets.length;
  };

  const totalRealizedPnL = sumPnl(rtTrades);
  const totalAvgReturn = avgReturnPct(rtTrades);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrades = rtTrades.filter((t) => t.date === todayStr);
  const todayPnL = sumPnl(todayTrades);
  const todayReturn = avgReturnPct(todayTrades);

  const monthTradesRt = rtTrades.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  const monthReturn = avgReturnPct(monthTradesRt);

  const holdingCount = positions.filter((p) => p.holdingQuantity > 0).length;

  // Calendar
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else setCurrentMonth((prev) => prev - 1);
    setSelectedDate(null);
    setDeleteConfirm(null);
  };
  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else setCurrentMonth((prev) => prev + 1);
    setSelectedDate(null);
    setDeleteConfirm(null);
  };
  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(null);
    setDeleteConfirm(null);
  };

  const tradeMap = new Map<string, Trade[]>();
  trades.forEach((trade) => {
    const tradeDate = new Date(trade.date);
    if (tradeDate.getFullYear() === currentYear && tradeDate.getMonth() === currentMonth) {
      const dateStr = trade.date;
      const existing = tradeMap.get(dateStr) || [];
      existing.push(trade);
      tradeMap.set(dateStr, existing);
    }
  });

  const selectedTrades = selectedDate ? tradeMap.get(selectedDate) || [] : [];
  const daySummary = selectedTrades.length ? getDaySummary(selectedTrades) : null;
  const selectedTrade = selectedTrades.find((t) => t.id === selectedTradeId) || (selectedTrades[0] ?? null);

  useEffect(() => {
    if (!selectedDate) {
      setSelectedTradeId(null);
      return;
    }
    if (selectedTrades.length === 0) {
      setSelectedTradeId(null);
      return;
    }
    setSelectedTradeId((prev) =>
      prev && selectedTrades.some((t) => t.id === prev) ? prev : selectedTrades[0].id
    );
  }, [selectedDate, selectedTrades]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const formatDateStr = (day: number) => {
    const m = (currentMonth + 1).toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    return `${currentYear}-${m}-${dd}`;
  };

  const isToday = (day: number) =>
    currentYear === today.getFullYear() && currentMonth === today.getMonth() && day === today.getDate();

  // Get section config from settings
  const getSectionTitle = (id: DashboardSectionId): string => {
    const section = settings.dashboardSections.find((s) => s.id === id);
    return section?.title || id;
  };

  // Ordered sections
  const orderedSections = [...settings.dashboardSections]
    .sort((a, b) => a.order - b.order)
    .filter((s) => s.visible);

  // Render section by ID
  const renderSection = (sectionId: DashboardSectionId) => {
    switch (sectionId) {
      case 'stats':
        return (
          <div key="stats" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard icon={<BarChart3 className="w-5 h-5" />} label="총 매매 횟수" value={`${formatNumber(rtTrades.length)}회`} color="blue" />
            <StatCard icon={<Activity className="w-5 h-5" />} label="누적 실현손익" value={formatCurrency(totalRealizedPnL)} color={totalRealizedPnL >= 0 ? 'green' : 'red'} highlight />
            <StatCard icon={<TrendingUp className="w-5 h-5" />} label="전체 평균 수익률" value={`${totalAvgReturn.toFixed(2)}%`} color={totalAvgReturn >= 0 ? 'green' : 'red'} />
            <StatCard icon={<Target className="w-5 h-5" />} label="이번달 수익률" value={`${monthReturn.toFixed(2)}%`} color={monthReturn >= 0 ? 'green' : 'red'} />
            <StatCard icon={<Award className="w-5 h-5" />} label="오늘 수익률" value={`${todayReturn.toFixed(2)}%`} color={todayReturn >= 0 ? 'green' : 'red'} />
            <StatCard icon={<List className="w-5 h-5" />} label="보유 종목" value={`${holdingCount}개`} color="teal" />
          </div>
        );

      case 'calendar':
        return (
          <div key="calendar" id="calendar-section" className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Calendar */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-950/60 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-slate-800">
                  <button onClick={goToPrevMonth} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/60 text-gray-500 dark:text-slate-300 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">
                      {currentYear}년 {MONTH_NAMES[currentMonth]}
                    </h3>
                    <button onClick={goToToday} className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold mt-1">
                      오늘로 이동
                    </button>
                  </div>
                  <button onClick={goToNextMonth} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/60 text-gray-500 dark:text-slate-300 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-800">
                  {WEEKDAYS.map((day, i) => (
                    <div
                      key={day}
                      className={`py-2 text-center text-xs font-semibold ${
                        i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400 dark:text-slate-400'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {cells.map((day, idx) => {
                    if (day === null)
                      return (
                        <div
                          key={`empty-${idx}`}
                          className="min-h-[70px] sm:min-h-[90px] border-b border-r border-gray-50 dark:border-slate-800"
                        />
                      );
                    const dateStr = formatDateStr(day);
                    const dayTrades = tradeMap.get(dateStr) || [];
                    const hasRoundtrip = dayTrades.some((t) => t.type === 'roundtrip');
                    const hasBuy = dayTrades.some((t) => t.type === 'buy');
                    const hasSell = dayTrades.some((t) => t.type === 'sell');
                    const hasImages = dayTrades.some((t) => (t.images || []).length > 0);
                    const isSelected = selectedDate === dateStr;
                    const isTodayCell = isToday(day);
                    const dayOfWeek = (firstDay + day - 1) % 7;

                    return (
                      <div
                        key={dateStr}
                        onClick={() => {
                          setSelectedDate(isSelected ? null : dateStr);
                          setDeleteConfirm(null);
                        }}
                        className={`min-h-[70px] sm:min-h-[90px] border-b border-r border-gray-50 dark:border-slate-800 p-1 sm:p-2 cursor-pointer transition-all relative ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-500/10 ring-2 ring-inset ring-indigo-300'
                            : dayTrades.length > 0
                            ? 'hover:bg-gray-50 dark:hover:bg-slate-900/50'
                            : 'hover:bg-gray-50/50 dark:hover:bg-slate-900/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs sm:text-sm font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                              isTodayCell
                                ? 'bg-indigo-500 text-white'
                                : dayOfWeek === 0
                                ? 'text-red-400'
                                : dayOfWeek === 6
                                ? 'text-blue-400'
                                : 'text-gray-600 dark:text-slate-200'
                            }`}
                          >
                            {day}
                          </span>
                          {hasImages && <ImageIcon className="w-3 h-3 text-purple-400" />}
                        </div>

                        {dayTrades.length > 0 && (
                          <div className="space-y-0.5">
                            {dayTrades.slice(0, 3).map((trade, tIdx) => (
                              <div
                                key={tIdx}
                                className={`text-[10px] sm:text-xs px-1 py-0.5 rounded truncate font-medium ${
                                  trade.type === 'buy'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                                    : trade.type === 'sell'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                                    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                                }`}
                              >
                                <span className="hidden sm:inline">
                                  {trade.type === 'buy' ? '매수' : trade.type === 'sell' ? '매도' : '완료'}{' '}
                                </span>
                                {trade.stockName}
                              </div>
                            ))}
                            {dayTrades.length > 3 && (
                              <div className="text-[10px] text-gray-400 dark:text-slate-400 font-medium px-1">
                                +{dayTrades.length - 3}건
                              </div>
                            )}
                          </div>
                        )}

                        {dayTrades.length > 0 && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                            {hasRoundtrip && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                            {hasBuy && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                            {hasSell && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-center gap-4 py-3 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-400 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                    완료
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    매수
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    매도
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-indigo-500 text-white text-[8px] flex items-center justify-center font-bold">
                      T
                    </div>
                    오늘
                  </div>
                </div>
              </div>

              {/* Selected Date Detail */}
              <div className="bg-white dark:bg-slate-950/60 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden h-fit">
                <div className="p-5 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">
                      📅{' '}
                      {selectedDate ? (
                        <>
                          {new Date(selectedDate).getMonth() + 1}월 {new Date(selectedDate).getDate()}일
                          <span className="text-sm font-normal text-gray-400 dark:text-slate-400 ml-2">
                            ({WEEKDAYS[new Date(selectedDate).getDay()]})
                          </span>
                        </>
                      ) : (
                        '날짜를 선택하세요'
                      )}
                    </h3>
                    {selectedDate && (
                      <button
                        onClick={() => onAddTradeForDate(selectedDate)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
                        title="이 날짜에 새 기록 추가"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        기록 추가
                      </button>
                    )}
                  </div>
                </div>

                {!selectedDate ? (
                  <div className="p-8 text-center">
                    <div className="text-4xl mb-3">📆</div>
                    <p className="text-gray-400 dark:text-slate-400 text-sm">
                      캘린더에서 날짜를 클릭하면
                      <br />
                      해당일의 매매 기록을 확인할 수 있습니다
                    </p>
                    <p className="text-gray-300 dark:text-slate-500 text-xs mt-2">
                      날짜를 선택 후 기록을 추가할 수도 있습니다
                    </p>
                  </div>
                ) : selectedTrades.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-4xl mb-3">😴</div>
                    <p className="text-gray-400 dark:text-slate-400 text-sm mb-4">이 날의 매매 기록이 없습니다</p>
                    <button
                      onClick={() => onAddTradeForDate(selectedDate)}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      첫 매매 기록 추가하기
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/40">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-700/60 p-3">
                          <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">총 매수금액</p>
                          <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                            {daySummary ? formatCurrency(daySummary.totalBuy) : '₩0'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-700/60 p-3">
                          <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">총 매도금액</p>
                          <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                            {daySummary ? formatCurrency(daySummary.totalSell) : '₩0'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-700/60 p-3">
                          <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">총 실현손익</p>
                          <p
                            className={`text-sm font-extrabold ${
                              daySummary && daySummary.totalPnl >= 0
                                ? 'text-red-600 dark:text-red-300'
                                : 'text-blue-600 dark:text-blue-300'
                            }`}
                          >
                            {daySummary ? formatCurrency(daySummary.totalPnl) : '₩0'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-700/60 p-3">
                          <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">평균 수익률</p>
                          <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                            {daySummary ? `${daySummary.avgReturn.toFixed(2)}%` : '0.00%'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-slate-800">
                      {selectedTrades.map((trade) => {
                        const c = getTradeComputed(trade);
                        const isSelected = selectedTrade?.id === trade.id;
                        return (
                          <button
                            key={trade.id}
                            type="button"
                            onClick={() => setSelectedTradeId(trade.id)}
                            className={`w-full text-left p-4 transition-colors ${
                              isSelected ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-gray-50 dark:hover:bg-slate-900/50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold ${
                                    trade.type === 'buy'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                                      : trade.type === 'sell'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                                  }`}
                                >
                                  {trade.type === 'buy' ? '매수' : trade.type === 'sell' ? '매도' : '완료'}
                                </span>
                                <div>
                                  <p className="font-extrabold text-gray-900 dark:text-slate-100 text-sm">
                                    {trade.stockName}
                                  </p>
                                  {trade.stockCode && <p className="text-xs text-gray-400 dark:text-slate-400">{trade.stockCode}</p>}
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditTrade(trade);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-gray-400 hover:text-indigo-500 transition-colors"
                                  title="수정"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {deleteConfirm === trade.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteTrade(trade.id);
                                        setDeleteConfirm(null);
                                      }}
                                      className="px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold hover:bg-red-600"
                                    >
                                      확인
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirm(null);
                                      }}
                                      className="px-2 py-1 rounded-lg bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-[10px] font-bold hover:bg-gray-300 dark:hover:bg-slate-700"
                                    >
                                      취소
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm(trade.id);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors"
                                    title="삭제"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <div className="rounded-lg bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-700/60 p-2">
                                <p className="text-[10px] text-gray-400 dark:text-slate-400 font-semibold">수량</p>
                                <p className="text-xs font-bold text-gray-900 dark:text-slate-100">{formatNumber(trade.quantity)}주</p>
                              </div>
                              <div className="rounded-lg bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-700/60 p-2">
                                <p className="text-[10px] text-gray-400 dark:text-slate-400 font-semibold">실현손익</p>
                                <p className={`text-xs font-extrabold ${c.pnl >= 0 ? 'text-red-600 dark:text-red-300' : 'text-blue-600 dark:text-blue-300'}`}>
                                  {formatCurrency(c.pnl)}
                                </p>
                              </div>
                              <div className="rounded-lg bg-white dark:bg-slate-950/60 border border-gray-200 dark:border-slate-700/60 p-2">
                                <p className="text-[10px] text-gray-400 dark:text-slate-400 font-semibold">수익률</p>
                                <p className="text-xs font-extrabold text-gray-900 dark:text-slate-100">{c.returnPct.toFixed(2)}%</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {selectedTrade && (
                        <div className="p-4 bg-white dark:bg-slate-950/60">
                          {(() => {
                            const c = getTradeComputed(selectedTrade);
                            const buyP =
                              selectedTrade.type === 'roundtrip'
                                ? selectedTrade.buyPrice ?? 0
                                : selectedTrade.type === 'buy'
                                ? selectedTrade.price ?? 0
                                : 0;
                            const sellP =
                              selectedTrade.type === 'roundtrip'
                                ? selectedTrade.sellPrice ?? 0
                                : selectedTrade.type === 'sell'
                                ? selectedTrade.price ?? 0
                                : 0;
                            const images = selectedTrade.images || [];
                            return (
                              <>
                                <h4 className="text-sm font-extrabold text-gray-900 dark:text-slate-100 mb-3">선택한 거래 상세</h4>

                                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                  <div className="rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700/60 p-3">
                                    <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">매수가</p>
                                    <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                                      {buyP ? `${formatNumber(buyP)}원` : '-'}
                                    </p>
                                  </div>
                                  <div className="rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700/60 p-3">
                                    <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">매도가</p>
                                    <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100">
                                      {sellP ? `${formatNumber(sellP)}원` : '-'}
                                    </p>
                                  </div>
                                  <div className="rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700/60 p-3">
                                    <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">매수금액</p>
                                    <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100">{formatCurrency(c.buyAmount)}</p>
                                  </div>
                                  <div className="rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700/60 p-3">
                                    <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">매도금액</p>
                                    <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100">{formatCurrency(c.sellAmount)}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mb-3">
                                  <div className="rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700/60 p-3">
                                    <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">실현손익</p>
                                    <p className={`text-sm font-extrabold ${c.pnl >= 0 ? 'text-red-600 dark:text-red-300' : 'text-blue-600 dark:text-blue-300'}`}>
                                      {formatCurrency(c.pnl)}
                                    </p>
                                  </div>
                                  <div className="rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700/60 p-3">
                                    <p className="text-[11px] text-gray-400 dark:text-slate-400 font-semibold">수익률</p>
                                    <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100">{c.returnPct.toFixed(2)}%</p>
                                  </div>
                                </div>

                                {selectedTrade.memo && (
                                  <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-slate-700/60 p-3 mb-3">
                                    <p className="text-xs text-gray-700 dark:text-slate-200">📝 {selectedTrade.memo}</p>
                                  </div>
                                )}

                                {images.length > 0 && (
                                  <div className="flex gap-2 overflow-x-auto pb-1">
                                    {images.map((img, imgIdx) => (
                                      <img
                                        key={imgIdx}
                                        src={img}
                                        alt={`이미지 ${imgIdx + 1}`}
                                        className="w-16 h-16 object-cover rounded-xl border border-gray-200 dark:border-slate-700/60 flex-shrink-0 cursor-pointer hover:opacity-80"
                                        onClick={() => setPreviewImage(img)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-slate-900/40">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-slate-300 text-sm">총 {selectedTrades.length}건</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-700 dark:text-slate-100 text-sm">
                            {daySummary ? formatCurrency(daySummary.totalPnl) : '₩0'}
                          </span>
                          <button
                            onClick={() => onAddTradeForDate(selectedDate!)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-500/20 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            추가
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'news':
        return (
          <div key="news" className="space-y-2">
            <div className="text-sm font-extrabold text-gray-800 dark:text-slate-100">{getSectionTitle('news')}</div>
            <NewsFeed />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {orderedSections.map((s) => renderSection(s.id))}
      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh]">
            <img src={previewImage} alt="미리보기" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600 text-white',
    indigo: 'from-indigo-500 to-indigo-600 text-white',
    purple: 'from-purple-500 to-purple-600 text-white',
    green: 'from-green-500 to-green-600 text-white',
    red: 'from-red-500 to-red-600 text-white',
    orange: 'from-orange-500 to-orange-600 text-white',
    teal: 'from-teal-500 to-teal-600 text-white',
  };
  const iconBgMap: Record<string, string> = {
    blue: 'bg-blue-400/30',
    indigo: 'bg-indigo-400/30',
    purple: 'bg-purple-400/30',
    green: 'bg-green-400/30',
    red: 'bg-red-400/30',
    orange: 'bg-orange-400/30',
    teal: 'bg-teal-400/30',
  };

  return (
    <div
      className={[
        'rounded-2xl p-4 bg-gradient-to-br',
        colorMap[color] || colorMap.blue,
        highlight ? 'ring-2 ring-offset-2 ring-offset-gray-50 dark:ring-offset-slate-950 ring-current shadow-lg' : 'shadow-sm',
      ].join(' ')}
    >
      <div className={`inline-flex p-2 rounded-xl ${iconBgMap[color] || iconBgMap.blue} mb-3`}>{icon}</div>
      <p className="text-xs opacity-80 mb-1">{label}</p>
      <p className="text-lg font-bold truncate">{value}</p>
    </div>
  );
}