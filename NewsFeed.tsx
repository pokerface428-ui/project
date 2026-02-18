import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Newspaper, RefreshCw, ExternalLink, Clock, AlertCircle, Wifi, WifiOff, Filter, Search } from 'lucide-react';
import { Trade } from '../types';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string; // ISO string
  source: string;
}

interface NewsMeta {
  hours: number;
  limit: number;
  group: string;
  topic: string;
  source: string;
  q: string;
  fetchedFeeds: number;
  failedFeeds: number;
  totalRaw: number;
  totalUnique: number;
}

interface NewsApiResponse {
  items: NewsItem[];
  meta?: NewsMeta;
  cached?: boolean;
  error?: string;
  message?: string;
}

interface SourceInfo {
  group: string;
  topic: string;
  source: string;
  url: string;
}

// 로컬 캐시
const CACHE_KEY = 'stock-news-cache-v2';
const CACHE_TTL = 5 * 60 * 1000; // 5분

function getCachedNews(): { items: NewsItem[]; meta?: NewsMeta; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL) return parsed;
    return null;
  } catch {
    return null;
  }
}

function setCachedNews(items: NewsItem[], meta?: NewsMeta) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ items, meta, timestamp: Date.now() }));
  } catch {
    /* ignore */
  }
}

function timeAgo(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    if (diffDay < 7) return `${diffDay}일 전`;
    return date.toLocaleDateString('ko-KR');
  } catch {
    return '';
  }
}

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

interface NewsFeedProps {
  customTitle?: string;
  trades?: Trade[];
  presetKeywords?: string[];
}

export function NewsFeed({ customTitle, trades, presetKeywords: presetKeywordsProp }: NewsFeedProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [meta, setMeta] = useState<NewsMeta | null>(null);
  const [sources, setSources] = useState<SourceInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // 필터
  const [hours, setHours] = useState<number>(72); // 기본: 72시간 (3일)
  const [limit, setLimit] = useState<number>(20);
  const [group, setGroup] = useState<string>('전체');
  const [topic, setTopic] = useState<string>('전체');
  const [source, setSource] = useState<string>('전체');
  const [q, setQ] = useState<string>('');
  const [qDraft, setQDraft] = useState<string>('');

  // === 키워드 프리셋 ===
  const presetKeywords = useMemo(() => {
    const fallback = ['금리', '환율', '반도체', '2차전지', '배당', '공매도', '실적', 'IPO'];
    const arr = (presetKeywordsProp && presetKeywordsProp.length ? presetKeywordsProp : fallback)
      .map(s => (s || '').trim())
      .filter(Boolean);
    return arr.length ? arr : fallback;
  }, [presetKeywordsProp]);

  // 거래 기록 기반: 최근 종목명 프리셋
  const tradedStockKeywords = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    const sorted = [...trades].sort((a, b) => (a.date < b.date ? 1 : -1));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of sorted) {
      const name = (t.stockName || '').trim();
      if (!name) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(name);
      if (out.length >= 8) break;
    }
    return out;
  }, [trades]);

  // 자동 종목 검색: 키워드가 비어있을 때만 1회 적용
  const autoAppliedRef = useRef(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSources = useCallback(async () => {
    try {
      const data = await fetchJson<{ sources: SourceInfo[] }>('/api/news/sources', 6000);
      setSources(data.sources || []);
    } catch {
      // sources를 못 불러와도 뉴스는 뜰 수 있으므로 무시
    }
  }, []);

  const fetchNews = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      else if (!lastUpdated) setLoading(true);

      try {
        const params = new URLSearchParams({
          hours: String(hours),
          limit: String(limit),
          group,
          topic,
          source,
        });
        if (q.trim()) params.set('q', q.trim());

        const data = await fetchJson<NewsApiResponse>(`/api/news?${params.toString()}`);

        if (Array.isArray(data.items) && data.items.length > 0) {
          setNews(data.items);
          setMeta(data.meta || null);
          setLastUpdated(new Date());
          setError(data.cached ? '실시간 연결이 불안정하여 캐시된 결과를 표시 중입니다.' : null);
          setRetryCount(0);
          setCachedNews(data.items, data.meta);
        } else {
          // 빈 결과: 캐시가 있으면 보여주고, 없으면 안내
          const cached = getCachedNews();
          if (cached?.items?.length) {
            setNews(cached.items);
            setMeta(cached.meta || null);
            setLastUpdated(new Date(cached.timestamp));
            setError('현재 조건에서 가져온 뉴스가 없어 캐시된 결과를 표시 중입니다.');
          } else {
            setNews([]);
            setMeta(data.meta || null);
            setError('조건에 맞는 뉴스가 없습니다. (시간/카테고리를 늘려보세요)');
          }
        }
      } catch {
        const cached = getCachedNews();
        if (cached?.items?.length) {
          setNews(cached.items);
          setMeta(cached.meta || null);
          setLastUpdated(new Date(cached.timestamp));
          setError('실시간 연결 실패 — 캐시된 결과를 표시 중입니다.');
        } else {
          setRetryCount((prev) => prev + 1);
          setError('뉴스를 불러올 수 없습니다. (로컬 뉴스 서버가 실행 중인지 확인해주세요)');
        }
      }

      setLoading(false);
      setIsRefreshing(false);
    },
    [hours, limit, group, topic, source, q, lastUpdated]
  );

  const applyKeyword = useCallback(
    (keyword: string, opts?: { setDomestic?: boolean }) => {
      const kw = (keyword || '').trim();
      if (!kw) return;
      setQ(kw);
      setQDraft(kw);

      // 종목 검색은 대부분 국내 종목일 가능성이 높아서 선택적으로 국내로 좁혀줌
      if (opts?.setDomestic) {
        setGroup('국내');
        setTopic('전체');
        setSource('전체');
      }

      // 상태 업데이트 이후 즉시 검색 실행
      setTimeout(() => fetchNews(true), 0);
    },
    [fetchNews]
  );

  // Initial fetch & interval
  useEffect(() => {
    // 캐시 먼저 표시
    const cached = getCachedNews();
    if (cached?.items?.length) {
      setNews(cached.items);
      setMeta(cached.meta || null);
      setLastUpdated(new Date(cached.timestamp));
      setLoading(false);
    }

    loadSources();
    fetchNews();

    // 2분 간격 자동 갱신 (RSS는 1분 갱신이 의미 없을 때가 많아 2분)
    intervalRef.current = setInterval(() => {
      fetchNews();
    }, 120000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 거래 기록 기반 자동 키워드 적용(초기 1회)
  useEffect(() => {
    if (autoAppliedRef.current) return;
    if (q.trim()) return;
    if (tradedStockKeywords.length === 0) return;

    autoAppliedRef.current = true;
    applyKeyword(tradedStockKeywords[0], { setDomestic: true });
  }, [applyKeyword, q, tradedStockKeywords]);

  // 실패 시 30초 후 자동 재시도 (최대 3회)
  useEffect(() => {
    if (retryCount > 0 && retryCount <= 3) {
      const timeout = setTimeout(() => fetchNews(), 30000);
      return () => clearTimeout(timeout);
    }
  }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => fetchNews(true);

  const groups = Array.from(new Set(['전체', ...sources.map((s) => s.group)]));
  const topics = Array.from(
    new Set(['전체', ...sources.filter((s) => group === '전체' || s.group === group).map((s) => s.topic)])
  );
  const sourcesList = Array.from(
    new Set(['전체', ...sources
      .filter((s) => (group === '전체' || s.group === group) && (topic === '전체' || s.topic === topic))
      .map((s) => s.source)])
  );

  const timeOptions: Array<{ label: string; value: number }> = [
    { label: '3시간', value: 3 },
    { label: '12시간', value: 12 },
    { label: '24시간', value: 24 },
    { label: '3일', value: 72 },
    { label: '7일', value: 168 },
    { label: '14일', value: 336 },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-xl">
              <Newspaper className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">📰 {customTitle || '주식/증권/금융 뉴스'}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {lastUpdated ? (
                  <span className="flex items-center gap-1 text-[10px] text-green-500">
                    <Wifi className="w-3 h-3" />
                    {lastUpdated.toLocaleTimeString('ko-KR')} 업데이트
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <WifiOff className="w-3 h-3" />
                    연결 중...
                  </span>
                )}
                <span className="text-[10px] text-orange-300">• 최근 {hours}시간</span>
                <span className="text-[10px] text-gray-300">• 2분마다 자동 갱신</span>
                {meta && (
                  <span className="text-[10px] text-gray-400">
                    • 소스 {meta.fetchedFeeds}개 성공 / {meta.failedFeeds}개 실패
                  </span>
                )}
                {retryCount > 0 && retryCount <= 3 && (
                  <span className="text-[10px] text-orange-400">• 재시도 {retryCount}/3</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              isRefreshing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100 active:scale-95'
            }`}
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '갱신 중...' : '새로고침'}
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="text-xs bg-transparent outline-none text-gray-700"
            >
              {timeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-gray-300">|</span>
            <select
              value={group}
              onChange={(e) => { setGroup(e.target.value); setTopic('전체'); setSource('전체'); }}
              className="text-xs bg-transparent outline-none text-gray-700"
              title="카테고리/언론사"
            >
              {groups.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-gray-300">|</span>
            <select
              value={topic}
              onChange={(e) => { setTopic(e.target.value); setSource('전체'); }}
              className="text-xs bg-transparent outline-none text-gray-700"
              title="세부 주제"
            >
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-gray-300">|</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="text-xs bg-transparent outline-none text-gray-700"
              title="언론사"
            >
              {sourcesList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <span className="text-[11px] text-gray-300">|</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="text-xs bg-transparent outline-none text-gray-700"
              title="표시 개수"
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n}개
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setQ(qDraft);
                  fetchNews(true);
                }
              }}
              placeholder="키워드 (Enter)"
              className="text-xs bg-transparent outline-none text-gray-700 w-40"
            />
            {q && (
              <button
                onClick={() => {
                  setQ('');
                  setQDraft('');
                  fetchNews(true);
                }}
                className="text-[11px] font-bold text-gray-400 hover:text-gray-600"
                title="검색 초기화"
              >
                초기화
              </button>
            )}
          </div>

          {/* 키워드 프리셋 */}
          <div className="flex flex-wrap items-center gap-1.5 px-2 py-2 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-[11px] font-bold text-gray-500 px-1">프리셋</span>
            {presetKeywords.map((kw) => (
              <button
                key={kw}
                onClick={() => applyKeyword(kw)}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white border border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 active:scale-95 transition-all"
                title={`키워드 검색: ${kw}`}
              >
                {kw}
              </button>
            ))}
          </div>

          {/* 거래 종목 프리셋 */}
          {tradedStockKeywords.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-2 py-2 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[11px] font-bold text-gray-500 px-1">최근 종목</span>
              <button
                onClick={() => applyKeyword(tradedStockKeywords[0], { setDomestic: true })}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 active:scale-95 transition-all"
                title="최근 거래 종목으로 자동 검색"
              >
                자동
              </button>
              {tradedStockKeywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => applyKeyword(kw, { setDomestic: true })}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white border border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 active:scale-95 transition-all"
                  title={`종목 뉴스: ${kw}`}
                >
                  {kw}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => fetchNews(true)}
            className="px-3 py-2 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold hover:bg-orange-100 transition-all"
            title="필터 적용"
          >
            적용
          </button>
        </div>
      </div>

      {/* Warning banner */}
      {error && news.length > 0 && (
        <div className="px-5 py-2 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
          <span className="text-[11px] text-yellow-600">{error}</span>
        </div>
      )}

      {/* Content */}
      <div className="divide-y divide-gray-50">
        {loading && news.length === 0 ? (
          <div className="p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-full" />
                  <div className="h-3 bg-gray-100 rounded-lg w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error && news.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-orange-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-1">{error}</p>
            {retryCount > 0 && retryCount <= 3 && (
              <p className="text-orange-400 text-xs mb-3">30초 후 자동 재시도합니다... ({retryCount}/3)</p>
            )}
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 text-orange-600 text-sm font-bold hover:bg-orange-100 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              지금 다시 시도
            </button>
            <p className="text-[11px] text-gray-400 mt-3">
              팁) <b className="font-semibold">npm run dev</b>로 실행하면 뉴스 서버도 같이 켜집니다.
            </p>
          </div>
        ) : !loading && news.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-semibold mb-1">조건에 맞는 뉴스가 없습니다</p>
            <p className="text-gray-400 text-xs mb-3">
              시간 범위를 늘리거나(예: 7일), 카테고리를 <b className="font-semibold">전체</b>로 바꿔보세요.
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 text-orange-600 text-sm font-bold hover:bg-orange-100 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
          </div>
        ) : (
          news.map((item, idx) => (
            <a
              key={`${item.link}-${idx}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 hover:bg-orange-50/50 transition-colors group"
            >
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  idx < 3
                    ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-800 group-hover:text-orange-600 transition-colors line-clamp-2 leading-snug mb-1.5">
                  {item.title}
                </h4>
                <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                  {item.source && (
                    <span className="font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {item.source}
                    </span>
                  )}
                  {item.pubDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(item.pubDate)}
                    </span>
                  )}
                </div>
              </div>

              <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-orange-400 flex-shrink-0 mt-0.5 transition-colors" />
            </a>
          ))
        )}
      </div>

      {/* Footer */}
      {news.length > 0 && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              최근 {hours}시간 • 최신순 • 2분 자동 갱신 {error ? '(캐시/폴백)' : ''}
            </p>
            <div className="flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                    error ? 'bg-yellow-400' : 'bg-green-400'
                  } opacity-75`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    error ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                ></span>
              </span>
              <span className={`text-[10px] font-semibold ${error ? 'text-yellow-500' : 'text-green-500'}`}>
                {error ? 'FALLBACK' : 'LIVE'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
