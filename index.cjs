/*
  로컬 뉴스 프록시 서버
  - 브라우저 CORS 문제 없이 RSS(XML)를 가져와 JSON으로 변환
  - 여러 RSS를 합쳐서 "증권/주식/금융" 중심 뉴스 피드 제공

  실행:
    npm run server
  (Vite dev와 함께: npm run dev)
*/

const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');

const app = express();
app.use(cors());

// Disable ETag to avoid 304 responses (fetch expects JSON body)
app.set('etag', false);


const PORT = process.env.NEWS_PORT ? Number(process.env.NEWS_PORT) : 8787;

// 신뢰할 수 있는 RSS 소스(필요하면 언제든 추가/삭제 가능)
// - 매일경제 RSS 안내 페이지에 공개된 RSS 링크 사용
// - 한국경제 RSS 안내 페이지에 공개된 RSS 링크 사용
// - 연합뉴스경제TV RSS 안내 페이지에 공개된 RSS 링크 사용
const FEEDS = [
  // 국내: 증권/경제
  { group: '국내', topic: '증권', source: '매일경제', url: 'https://www.mk.co.kr/rss/50200011/' },
  { group: '국내', topic: '거시경제', source: '매일경제', url: 'https://www.mk.co.kr/rss/30100041/' },
  { group: '국내', topic: '증권', source: '한국경제', url: 'https://www.hankyung.com/feed/finance' },
  { group: '국내', topic: '거시경제', source: '한국경제', url: 'https://www.hankyung.com/feed/economy' },
  { group: '국내', topic: '증권', source: '연합뉴스경제TV', url: 'https://www.yonhapnewseconomytv.com/rss/allArticle.xml' },

  // 해외: 글로벌 금융/시장
  // Reuters RSS는 지역/네트워크 환경에 따라 실패할 수 있어 폴백으로 취급됩니다.
  { group: '해외', topic: '금융시장', source: 'Reuters', url: 'http://feeds.reuters.com/reuters/businessNews' },
  { group: '해외', topic: '금융시장', source: 'Reuters', url: 'http://feeds.reuters.com/news/usmarkets' },
  { group: '해외', topic: '거시경제', source: 'CNBC', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },

  // 거시경제/정책/리서치
  { group: '거시경제', topic: '거시경제', source: 'FRED Blog', url: 'https://fredblog.stlouisfed.org/feed/' },
  { group: '거시경제', topic: '거시경제', source: 'St. Louis Fed Research', url: 'https://news.research.stlouisfed.org/feed/' },
  { group: '거시경제', topic: '거시경제', source: 'World Bank PSD Blog', url: 'http://feeds.feedburner.com/PSDBlog' },
];


// rss-parser 설정
const parser = new Parser({
  timeout: 8000,
  headers: {
    // 일부 사이트는 UA 없으면 차단하는 경우가 있어 기본 UA를 넣어둠
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
  },
});

// 간단한 메모리 캐시 (3분)
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map();

function safeString(v) {
  return (v ?? '').toString().trim();
}

function parseDate(v) {
  const s = safeString(v);
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function normalizeItem(item, fallbackSource) {
  const title = safeString(item.title);
  const link = safeString(item.link || item.guid);

  // rss-parser는 isoDate(권장), pubDate를 제공합니다.
  const dt = parseDate(item.isoDate) || parseDate(item.pubDate);

  // rss에 source 태그가 있으면 그것도 활용
  const source = safeString(item?.source?.title || item?.creator || fallbackSource);

  return {
    title,
    link,
    pubDate: dt ? dt.toISOString() : '',
    source,
  };
}

async function fetchFeed(feed) {
  // rss-parser의 parseURL을 쓰면 내부적으로 요청을 처리합니다.
  // 사이트에 따라 실패하면 예외를 던집니다.
  const parsed = await parser.parseURL(feed.url);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return items
    .map((it) => normalizeItem(it, feed.source))
    .filter((it) => it.title && it.link);
}

function filterAndSort(items, { hours, limit, q }) {
  const now = Date.now();
  const since = now - hours * 60 * 60 * 1000;
  const query = safeString(q).toLowerCase();

  const filtered = items.filter((it) => {
    if (!it.pubDate) return false;
    const t = new Date(it.pubDate).getTime();
    if (!Number.isFinite(t)) return false;
    if (t < since || t > now + 60 * 1000) return false; // 미래값 약간 보정

    if (query) {
      const hay = `${it.title} ${it.source}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  return filtered.slice(0, limit);
}

app.get('/api/news/sources', (_req, res) => {
  res.json({
    sources: FEEDS.map((f) => ({ group: f.group, topic: f.topic, source: f.source, url: f.url })),
    groups: Array.from(new Set(FEEDS.map((f) => f.group))),
    topics: Array.from(new Set(FEEDS.map((f) => f.topic))),
    sourcesOnly: Array.from(new Set(FEEDS.map((f) => f.source))),
  });
});

app.get('/api/news', async (req, res) => {
  const hours = Math.max(1, Math.min(24 * 14, Number(req.query.hours ?? 72) || 72)); // 1~336시간(14일)
  const limit = Math.max(5, Math.min(100, Number(req.query.limit ?? 30) || 30));
  const group = safeString(req.query.group ?? req.query.category ?? '전체');
  const topic = safeString(req.query.topic ?? '전체');
  const source = safeString(req.query.source ?? '전체');
  const q = safeString(req.query.q ?? '');

  const cacheKey = JSON.stringify({ hours, limit, group, topic, source, q });
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return res.json({ ...cached.data, cached: true });
  }

  let feedsToUse = FEEDS;
  if (group !== '전체') feedsToUse = feedsToUse.filter((f) => f.group === group);
  if (topic !== '전체') feedsToUse = feedsToUse.filter((f) => f.topic === topic);
  if (source !== '전체') feedsToUse = feedsToUse.filter((f) => f.source === source);

  try {
    const results = await Promise.allSettled(feedsToUse.map(fetchFeed));

    let items = [];
    let fetchedFeeds = 0;
    let failedFeeds = 0;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        fetchedFeeds += 1;
        items.push(...r.value);
      } else {
        failedFeeds += 1;
      }
    }

    // 중복 제거: link 우선, 없으면 title
    const seen = new Set();
    const unique = [];
    for (const it of items) {
      const key = it.link || it.title;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(it);
    }

    const finalItems = filterAndSort(unique, { hours, limit, q });

    const data = {
      items: finalItems,
      meta: {
        hours,
        limit,
        group,
        topic,
        source,
        q,
        fetchedFeeds,
        failedFeeds,
        totalRaw: items.length,
        totalUnique: unique.length,
      },
    };

    cache.set(cacheKey, { ts: Date.now(), data });
    res.json({ ...data, cached: false });
  } catch (e) {
    res.status(500).json({
      error: 'failed_to_fetch',
      message: '뉴스 소스를 불러오지 못했습니다.',
    });
  }
});


// ===== Market Quotes (Ticker) =====
// Unofficial Yahoo Finance quote endpoint. If it fails, we return the last cached value.
const marketCache = new Map();

const MARKET_SYMBOLS = [
  { key: 'KOSPI', label: 'KOSPI', symbol: '^KS11' },
  { key: 'KOSDAQ', label: 'KOSDAQ', symbol: '^KQ11' },
  { key: 'DOW', label: 'DOW', symbol: '^DJI' },
  { key: 'NASDAQ', label: 'NASDAQ', symbol: '^IXIC' },
  { key: 'SP500', label: 'S&P500', symbol: '^GSPC' },
  { key: 'USDKRW', label: 'USDKRW', symbol: 'USDKRW=X' },
  { key: 'GOLD', label: 'GOLD', symbol: 'GC=F' },
  { key: 'WTI', label: 'WTI', symbol: 'CL=F' },
];

app.get('/api/market-quotes', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');

  try {
    const symbols = MARKET_SYMBOLS.map(s => s.symbol).join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json,text/plain,*/*',
      },
      signal: controller.signal,
    });

    clearTimeout(t);

    if (!r.ok) throw new Error(`upstream_status_${r.status}`);

    const json = await r.json();
    const result = json?.quoteResponse?.result;
    if (!Array.isArray(result)) throw new Error('upstream_invalid');

    const bySymbol = new Map(result.map(q => [q.symbol, q]));

    const items = MARKET_SYMBOLS.map(s => {
      const q = bySymbol.get(s.symbol) || {};
      const price = q.regularMarketPrice;
      const chgPct = q.regularMarketChangePercent;
      const prev = marketCache.get(s.key);

      const item = {
        key: s.key,
        label: s.label,
        symbol: s.symbol,
        price: typeof price === 'number' ? price : (prev ? prev.price : null),
        changePercent: typeof chgPct === 'number' ? chgPct : (prev ? prev.changePercent : null),
        ts: Date.now(),
      };

      marketCache.set(s.key, item);
      return item;
    });

    res.json({ items, cached: false });
  } catch (e) {
    const items = MARKET_SYMBOLS.map(s => {
      const prev = marketCache.get(s.key);
      return prev ?? {
        key: s.key,
        label: s.label,
        symbol: s.symbol,
        price: null,
        changePercent: null,
        ts: Date.now(),
      };
    });

    res.json({
      items,
      cached: true,
      error: String(e && e.message ? e.message : e),
    });
  }
});


app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[news-proxy] listening on http://localhost:${PORT}`);
});
