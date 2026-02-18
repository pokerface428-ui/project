import { useState } from 'react';
import { Trash2, Edit2, Search, Filter, ChevronDown, ChevronUp, MessageSquare, ImageIcon, X, CalendarDays } from 'lucide-react';
import { Trade } from '../types';
import { formatCurrency, formatNumber, formatDate } from '../utils/helpers';

interface TradeListProps {
  trades: Trade[];
  onDelete: (id: string) => void;
  onEdit: (trade: Trade) => void;
  onViewInCalendar: (trade: Trade) => void;
}

type SortField = 'date' | 'stockName' | 'type' | 'amount';
type SortDir = 'asc' | 'desc';

export function TradeList({ trades, onDelete, onEdit, onViewInCalendar }: TradeListProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = trades
    .filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          t.stockName.toLowerCase().includes(s) ||
          t.stockCode.toLowerCase().includes(s) ||
          t.memo.toLowerCase().includes(s)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'date':
          return a.date.localeCompare(b.date) * dir;
        case 'stockName':
          return a.stockName.localeCompare(b.stockName) * dir;
        case 'type':
          return a.type.localeCompare(b.type) * dir;
        case 'amount':
          return (a.price * a.quantity - b.price * b.quantity) * dir;
        default:
          return 0;
      }
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-gray-300" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-indigo-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-indigo-500" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="종목명, 코드, 메모 검색..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {(['all', 'buy', 'sell'] as const).map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                typeFilter === type
                  ? type === 'buy'
                    ? 'bg-red-500 text-white'
                    : type === 'sell'
                    ? 'bg-blue-500 text-white'
                    : 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? '전체' : type === 'buy' ? '매수' : '매도'}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-400">
        총 <span className="font-bold text-gray-600">{filtered.length}</span>건
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400 font-medium">
            {trades.length === 0
              ? '아직 매매 기록이 없습니다. 새 기록을 추가해보세요!'
              : '검색 결과가 없습니다.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    { field: 'date' as SortField, label: '날짜' },
                    { field: 'stockName' as SortField, label: '종목' },
                    { field: 'type' as SortField, label: '구분' },
                    { field: 'amount' as SortField, label: '수량 / 단가' },
                  ].map(col => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.field} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    첨부
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(trade => {
                  const amount = trade.price * trade.quantity;
                  const images = trade.images || [];
                  const isExpanded = expandedId === trade.id;
                  return (
                    <tr key={trade.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 font-mono">{formatDate(trade.date)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{trade.stockName}</p>
                          {trade.stockCode && (
                            <p className="text-xs text-gray-400">{trade.stockCode}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            trade.type === 'buy'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {trade.type === 'buy' ? '매수' : '매도'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {formatNumber(trade.quantity)}주 × {formatNumber(trade.price)}원
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold text-sm ${
                          trade.type === 'buy' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {formatCurrency(amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {images.length > 0 && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors text-xs font-semibold"
                          >
                            <ImageIcon className="w-3 h-3" />
                            {images.length}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {/* 캘린더에서 보기 */}
                          <button
                            onClick={() => onViewInCalendar(trade)}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="캘린더에서 보기"
                          >
                            <CalendarDays className="w-4 h-4" />
                          </button>
                          {trade.memo && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 transition-colors"
                              title="메모 보기"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onEdit(trade)}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {deleteConfirm === trade.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  onDelete(trade.id);
                                  setDeleteConfirm(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600"
                              >
                                확인
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 rounded-lg bg-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-300"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(trade.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Expanded details (memo + images) */}
            {filtered.map(trade => {
              const images = trade.images || [];
              if (expandedId !== trade.id) return null;
              return (
                <div key={`detail-${trade.id}`} className="px-6 py-4 bg-indigo-50/50 border-t border-indigo-100 space-y-3">
                  {trade.memo && (
                    <p className="text-sm text-indigo-700">
                      <span className="font-semibold">📝 메모:</span> {trade.memo}
                    </p>
                  )}
                  {images.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-indigo-600 mb-2">📷 첨부 이미지</p>
                      <div className="flex gap-2 flex-wrap">
                        {images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`${trade.stockName} 이미지 ${idx + 1}`}
                            className="w-24 h-24 object-cover rounded-xl border border-indigo-200 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setPreviewImage(img)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(trade => {
              const amount = trade.price * trade.quantity;
              const images = trade.images || [];
              return (
                <div
                  key={trade.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          trade.type === 'buy'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {trade.type === 'buy' ? '매수' : '매도'}
                      </span>
                      <div>
                        <p className="font-bold text-gray-800">{trade.stockName}</p>
                        {trade.stockCode && (
                          <p className="text-xs text-gray-400">{trade.stockCode}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{formatDate(trade.date)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-400 text-xs">수량</span>
                      <p className="font-semibold">{formatNumber(trade.quantity)}주</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">단가</span>
                      <p className="font-semibold">{formatNumber(trade.price)}원</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 text-xs">금액</span>
                      <p className={`font-bold ${trade.type === 'buy' ? 'text-red-600' : 'text-blue-600'}`}>
                        {formatCurrency(amount)}
                      </p>
                    </div>
                  </div>

                  {trade.memo && (
                    <div className="bg-gray-50 rounded-xl p-3 mb-3">
                      <p className="text-xs text-gray-600">📝 {trade.memo}</p>
                    </div>
                  )}

                  {/* Images */}
                  {images.length > 0 && (
                    <div className="mb-3">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`이미지 ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0 cursor-pointer"
                            onClick={() => setPreviewImage(img)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    {/* 캘린더에서 보기 */}
                    <button
                      onClick={() => onViewInCalendar(trade)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                    >
                      <CalendarDays className="w-3 h-3" />
                      캘린더
                    </button>
                    <button
                      onClick={() => onEdit(trade)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                    >
                      수정
                    </button>
                    {deleteConfirm === trade.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            onDelete(trade.id);
                            setDeleteConfirm(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold"
                        >
                          삭제 확인
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs font-semibold"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(trade.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh]">
            <img
              src={previewImage}
              alt="미리보기"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
