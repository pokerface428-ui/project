import { useState, useRef, useEffect } from 'react';
import { X, Plus, Save, ImagePlus, Trash2 } from 'lucide-react';
import { Trade } from '../types';
import { generateId, compressImage } from '../utils/helpers';

interface TradeFormProps {
  onSubmit: (trade: Trade) => void;
  editTrade?: Trade | null;
  onCancel: () => void;
  isOpen: boolean;
  initialDate?: string | null;
}

const getDefaultTrade = (date?: string | null): Omit<Trade, 'id'> => ({
  date: date || new Date().toISOString().slice(0, 10),
  stockName: '',
  stockCode: '',
  type: 'buy',
  quantity: 0,
  price: 0,
  memo: '',
  images: [],
});

export function TradeForm({ onSubmit, editTrade, onCancel, isOpen, initialDate }: TradeFormProps) {
  const [form, setForm] = useState<Omit<Trade, 'id'>>(getDefaultTrade());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 폼이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      if (editTrade) {
        setForm({ ...editTrade, images: editTrade.images || [] });
      } else {
        setForm(getDefaultTrade(initialDate));
      }
      setErrors({});
      setPreviewImage(null);
    }
  }, [isOpen, editTrade, initialDate]);

  const handleChange = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (form.images.length + newImages.length >= 5) break;
      try {
        const compressed = await compressImage(files[i], 800, 0.7);
        newImages.push(compressed);
      } catch {
        // skip failed images
      }
    }

    setForm(prev => ({
      ...prev,
      images: [...prev.images, ...newImages],
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.date) newErrors.date = '날짜를 입력해주세요';
    if (!form.stockName.trim()) newErrors.stockName = '종목명을 입력해주세요';
    if (form.quantity <= 0) newErrors.quantity = '수량을 입력해주세요';
    if (form.price <= 0) newErrors.price = '단가를 입력해주세요';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const trade: Trade = {
      ...form,
      id: editTrade?.id || generateId(),
      stockName: form.stockName.trim(),
      stockCode: form.stockCode.trim(),
    };

    onSubmit(trade);
  };

  if (!isOpen) return null;

  const amount = form.quantity * form.price;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {editTrade ? <Save className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
            {editTrade ? '매매 기록 수정' : '새 매매 기록'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 날짜 배지 (initialDate가 있으면 강조) */}
        {initialDate && !editTrade && (
          <div className="mx-6 mt-4 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-2">
            <span className="text-indigo-500 text-lg">📅</span>
            <span className="text-sm text-indigo-700 font-semibold">
              {new Date(initialDate).getFullYear()}년 {new Date(initialDate).getMonth() + 1}월 {new Date(initialDate).getDate()}일 매매 기록 추가
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 매매구분 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">매매구분</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChange('type', 'buy')}
                className={`py-3 rounded-xl font-bold text-sm transition-all ${
                  form.type === 'buy'
                    ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                매수
              </button>
              <button
                type="button"
                onClick={() => handleChange('type', 'sell')}
                className={`py-3 rounded-xl font-bold text-sm transition-all ${
                  form.type === 'sell'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                매도
              </button>
            </div>
          </div>

          {/* 날짜 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">날짜</label>
            <input
              type="date"
              value={form.date}
              onChange={e => handleChange('date', e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border ${
                errors.date ? 'border-red-300 bg-red-50' : 'border-gray-200'
              } focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all`}
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>

          {/* 종목명 & 종목코드 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">종목명 *</label>
              <input
                type="text"
                value={form.stockName}
                onChange={e => handleChange('stockName', e.target.value)}
                placeholder="삼성전자"
                className={`w-full px-4 py-3 rounded-xl border ${
                  errors.stockName ? 'border-red-300 bg-red-50' : 'border-gray-200'
                } focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all`}
              />
              {errors.stockName && <p className="text-xs text-red-500 mt-1">{errors.stockName}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">종목코드</label>
              <input
                type="text"
                value={form.stockCode}
                onChange={e => handleChange('stockCode', e.target.value)}
                placeholder="005930"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
              />
            </div>
          </div>

          {/* 수량 & 단가 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">수량 *</label>
              <input
                type="number"
                value={form.quantity || ''}
                onChange={e => handleChange('quantity', Number(e.target.value))}
                placeholder="0"
                min="0"
                className={`w-full px-4 py-3 rounded-xl border ${
                  errors.quantity ? 'border-red-300 bg-red-50' : 'border-gray-200'
                } focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all`}
              />
              {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">단가 (원) *</label>
              <input
                type="number"
                value={form.price || ''}
                onChange={e => handleChange('price', Number(e.target.value))}
                placeholder="0"
                min="0"
                className={`w-full px-4 py-3 rounded-xl border ${
                  errors.price ? 'border-red-300 bg-red-50' : 'border-gray-200'
                } focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all`}
              />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
            </div>
          </div>

          {/* 금액 요약 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">
                {form.type === 'buy' ? '총 매수 금액' : '총 매도 금액'}
              </span>
              <span className={`font-bold text-lg ${form.type === 'buy' ? 'text-red-600' : 'text-blue-600'}`}>
                {amount.toLocaleString('ko-KR')}원
              </span>
            </div>
          </div>

          {/* 이미지 업로드 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📷 이미지 첨부 <span className="text-gray-400 font-normal">({form.images.length}/5)</span>
            </label>
            <div className="space-y-3">
              {form.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200">
                      <img
                        src={img}
                        alt={`첨부 이미지 ${idx + 1}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setPreviewImage(img)}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {form.images.length < 5 && (
                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all text-sm text-gray-500 hover:text-indigo-600">
                  <ImagePlus className="w-5 h-5" />
                  <span>이미지 추가 (최대 5장)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">메모</label>
            <textarea
              value={form.memo}
              onChange={e => handleChange('memo', e.target.value)}
              placeholder="매매 사유, 전략, 느낀 점 등을 기록하세요..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg ${
              form.type === 'buy'
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-200'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-200'
            }`}
          >
            {editTrade ? '수정 완료' : form.type === 'buy' ? '매수 기록 추가' : '매도 기록 추가'}
          </button>
        </form>
      </div>

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
