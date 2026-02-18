import { useState } from 'react';
import {
  Settings as SettingsIcon, ChevronUp, ChevronDown, Eye, EyeOff,
  Edit2, Save, RotateCcw, LayoutDashboard, Palette, Type,
  GripVertical, Check, AlertTriangle, Trash2
} from 'lucide-react';
import { AppSettings, DashboardSectionId } from '../types';

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onReset: () => void;
  onClearAllData: () => void;
}

const SECTION_ICONS: Record<DashboardSectionId, string> = {
  stats: '📊',
  calendar: '📅',
  monthlyChart: '📈',
  recentTrades: '🕐',
  news: '📰',
};

const SECTION_DESCRIPTIONS: Record<DashboardSectionId, string> = {
  stats: '총 매매횟수, 매수/매도 금액, 실현 손익, 승률, 보유 종목 등 핵심 통계',
  calendar: '이달 요약 카드 + 월별 캘린더 + 날짜별 상세보기',
  monthlyChart: '월별 수익/손실 바 차트',
  recentTrades: '최근 5건의 매매 기록',
  news: '실시간 증권 뉴스 (1분 자동 갱신)',
};

const TAB_ICONS: Record<string, string> = {
  dashboard: '📊',
  trades: '📋',
  portfolio: '💼',
  study: '📚',
  diary: '📔',
  bitcoin: '₿',
  settings: '⚙️',
};

export function Settings({ settings, onSave, onReset, onClearAllData }: SettingsProps) {
  const [draft, setDraft] = useState<AppSettings>(JSON.parse(JSON.stringify(settings)));
  const [editingTitle, setEditingTitle] = useState<DashboardSectionId | null>(null);
  const [editingTabLabel, setEditingTabLabel] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [newPreset, setNewPreset] = useState('');

  const markChanged = () => setHasChanges(true);

  const DEFAULT_NEWS_PRESETS = ['금리', '환율', '반도체', '2차전지', '배당', '공매도', '실적', 'IPO'];

  // === App Title / Subtitle ===
  const handleAppTitleChange = (value: string) => {
    setDraft(prev => ({ ...prev, appTitle: value }));
    markChanged();
  };

  const handleAppSubtitleChange = (value: string) => {
    setDraft(prev => ({ ...prev, appSubtitle: value }));
    markChanged();
  };

  // === Theme ===
  const handleThemeChange = (theme: 'light' | 'dark') => {
    setDraft(prev => ({ ...prev, theme }));
    markChanged();
  };

  // === News presets ===
  const normalizePresets = (arr: string[]) => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of arr) {
      const v = (raw || '').trim();
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  };

  const handleUpdatePreset = (idx: number, value: string) => {
    setDraft(prev => {
      const next = [...(prev.newsPresets || [])];
      next[idx] = value;
      return { ...prev, newsPresets: next };
    });
    markChanged();
  };

  const handleRemovePreset = (idx: number) => {
    setDraft(prev => {
      const next = [...(prev.newsPresets || [])];
      next.splice(idx, 1);
      return { ...prev, newsPresets: next };
    });
    markChanged();
  };

  const handleAddPreset = (value: string) => {
    const v = (value || '').trim();
    if (!v) return;
    setDraft(prev => {
      const next = normalizePresets([...(prev.newsPresets || []), v]);
      return { ...prev, newsPresets: next };
    });
    markChanged();
  };

  const handleResetPresets = () => {
    setDraft(prev => ({ ...prev, newsPresets: [...DEFAULT_NEWS_PRESETS] }));
    markChanged();
  };

  // === Dashboard Sections ===
  const sortedSections = [...draft.dashboardSections].sort((a, b) => a.order - b.order);

  const handleSectionToggle = (id: DashboardSectionId) => {
    setDraft(prev => ({
      ...prev,
      dashboardSections: prev.dashboardSections.map(s =>
        s.id === id ? { ...s, visible: !s.visible } : s
      ),
    }));
    markChanged();
  };

  const handleSectionTitleChange = (id: DashboardSectionId, title: string) => {
    setDraft(prev => ({
      ...prev,
      dashboardSections: prev.dashboardSections.map(s =>
        s.id === id ? { ...s, title } : s
      ),
    }));
    markChanged();
  };

  const handleMoveSection = (id: DashboardSectionId, direction: 'up' | 'down') => {
    const sorted = [...draft.dashboardSections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= sorted.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const temp = sorted[idx].order;
    sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
    sorted[swapIdx] = { ...sorted[swapIdx], order: temp };

    setDraft(prev => ({ ...prev, dashboardSections: sorted }));
    markChanged();
  };

  // === Tab configs ===
  const handleTabLabelChange = (id: string, label: string) => {
    setDraft(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => (t.id === id ? { ...t, label } : t)),
    }));
    markChanged();
  };

  const handleTabToggle = (id: string) => {
    // 대시보드와 설정은 비활성화 불가
    if (id === 'dashboard' || id === 'settings') return;
    setDraft(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => (t.id === id ? { ...t, visible: !t.visible } : t)),
    }));
    markChanged();
  };

  // === Save / Reset ===
  const handleSave = () => {
    onSave(draft);
    setHasChanges(false);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  const handleReset = () => {
    onReset();
    setShowResetConfirm(false);
    setHasChanges(false);
  };

  const handleClearAll = () => {
    onClearAllData();
    setShowClearConfirm(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl shadow-lg">
            <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">설정</h2>
            <p className="text-sm text-gray-400">대시보드 구성, 탭 이름, 앱 설정을 커스터마이즈하세요</p>
          </div>
        </div>
        {/* Save button (fixed) */}
        <div className="flex items-center gap-2">
          {savedMessage && (
            <span className="flex items-center gap-1 text-sm text-green-600 font-semibold animate-pulse">
              <Check className="w-4 h-4" /> 저장 완료!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              hasChanges
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200 hover:shadow-xl'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            변경사항 저장
          </button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">저장하지 않은 변경사항이 있습니다.</p>
        </div>
      )}

      {/* ========== 1. 앱 기본 설정 ========== */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Palette className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-bold text-gray-800">앱 기본 설정</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">앱 제목</label>
            <input
              type="text"
              value={draft.appTitle}
              onChange={e => handleAppTitleChange(e.target.value)}
              placeholder="주식 매매 일지"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-lg font-semibold"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">앱 부제목</label>
            <input
              type="text"
              value={draft.appSubtitle}
              onChange={e => handleAppSubtitleChange(e.target.value)}
              placeholder="나만의 투자 기록 관리"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
            />
          </div>
          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">미리보기</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">📊</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 leading-tight">{draft.appTitle || '제목 없음'}</h1>
                <p className="text-xs text-gray-400">{draft.appSubtitle || '부제목 없음'}</p>
              </div>
            </div>
          </div>

          {/* Theme */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-800">다크모드</p>
                <p className="text-xs text-gray-400 mt-1">앱 전체 테마를 라이트/다크로 전환합니다</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    draft.theme === 'light'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  라이트
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    draft.theme === 'dark'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  다크
                </button>
              </div>
            </div>
          </div>

          {/* News preset keywords */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold text-gray-800">뉴스 키워드 프리셋</p>
                <p className="text-xs text-gray-400 mt-1">뉴스 화면의 프리셋 버튼을 직접 편집/추가/삭제할 수 있어요</p>
              </div>
              <button
                onClick={handleResetPresets}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold"
                title="기본 프리셋으로 복원"
              >
                <RotateCcw className="w-4 h-4" />
                기본값
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                value={newPreset}
                onChange={(e) => setNewPreset(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddPreset(newPreset);
                    setNewPreset('');
                  }
                }}
                placeholder="예) 금리, 환율, 반도체... (Enter로 추가)"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm"
              />
              <button
                onClick={() => {
                  handleAddPreset(newPreset);
                  setNewPreset('');
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-sm hover:shadow"
              >
                추가
              </button>
            </div>

            <div className="space-y-2">
              {(draft.newsPresets || []).length === 0 ? (
                <p className="text-xs text-gray-400">프리셋이 없습니다. 위에서 추가해보세요.</p>
              ) : (
                (draft.newsPresets || []).map((kw, idx) => (
                  <div key={`${kw}-${idx}`} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-6 text-center">{idx + 1}</span>
                    <input
                      value={kw}
                      onChange={(e) => handleUpdatePreset(idx, e.target.value)}
                      onBlur={() => {
                        // normalize on blur
                        setDraft(prev => ({ ...prev, newsPresets: normalizePresets(prev.newsPresets || []) }));
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-semibold"
                    />
                    <button
                      onClick={() => handleRemovePreset(idx)}
                      className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(draft.newsPresets || []).slice(0, 12).map((kw, i) => (
                <span key={`${kw}-${i}`} className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-600">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== 2. 탭 설정 ========== */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-bold text-gray-800">탭 설정</h3>
          <span className="text-xs text-gray-400 ml-2">이름 변경 및 표시/숨김</span>
        </div>
        <div className="divide-y divide-gray-50">
          {draft.tabs.map(tab => {
            const isProtected = tab.id === 'dashboard' || tab.id === 'settings';
            const isEditingLabel = editingTabLabel === tab.id;

            return (
              <div key={tab.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                {/* Icon */}
                <span className="text-lg flex-shrink-0">{TAB_ICONS[tab.id] || '📌'}</span>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  {isEditingLabel ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tab.label}
                        onChange={e => handleTabLabelChange(tab.id, e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-semibold w-40"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') setEditingTabLabel(null);
                        }}
                      />
                      <button
                        onClick={() => setEditingTabLabel(null)}
                        className="p-1 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm ${tab.visible ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                        {tab.label}
                      </span>
                      <button
                        onClick={() => setEditingTabLabel(tab.id)}
                        className="p-1 rounded-lg hover:bg-indigo-50 text-gray-300 hover:text-indigo-500 transition-colors"
                        title="이름 변경"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {isProtected && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">필수</span>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">ID: {tab.id}</p>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleTabToggle(tab.id)}
                  disabled={isProtected}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isProtected
                      ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                      : tab.visible
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  {tab.visible ? (
                    <><Eye className="w-3.5 h-3.5" /> 표시</>
                  ) : (
                    <><EyeOff className="w-3.5 h-3.5" /> 숨김</>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Tab preview */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">탭 미리보기</p>
          <div className="flex gap-1 overflow-x-auto">
            {draft.tabs.filter(t => t.visible).map(tab => (
              <div
                key={tab.id}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 whitespace-nowrap"
              >
                <span>{TAB_ICONS[tab.id] || '📌'}</span>
                {tab.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 3. 대시보드 섹션 설정 ========== */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Type className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-bold text-gray-800">대시보드 섹션 설정</h3>
          <span className="text-xs text-gray-400 ml-2">순서 변경, 표시/숨김, 제목 수정</span>
        </div>

        <div className="divide-y divide-gray-50">
          {sortedSections.map((section, idx) => {
            const isEditingThisTitle = editingTitle === section.id;

            return (
              <div
                key={section.id}
                className={`flex items-center gap-3 p-4 transition-all ${
                  section.visible ? 'hover:bg-gray-50' : 'bg-gray-50/50 opacity-60'
                }`}
              >
                {/* Drag handle (visual) + Order */}
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <span className="text-[10px] text-gray-400 font-bold">{idx + 1}</span>
                </div>

                {/* Icon */}
                <span className="text-lg flex-shrink-0">{SECTION_ICONS[section.id]}</span>

                {/* Title + description */}
                <div className="flex-1 min-w-0">
                  {isEditingThisTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={section.title}
                        onChange={e => handleSectionTitleChange(section.id, e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-semibold flex-1"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') setEditingTitle(null);
                        }}
                      />
                      <button
                        onClick={() => setEditingTitle(null)}
                        className="p-1 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${section.visible ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                        {section.title}
                      </span>
                      <button
                        onClick={() => setEditingTitle(section.id)}
                        className="p-1 rounded-lg hover:bg-indigo-50 text-gray-300 hover:text-indigo-500 transition-colors"
                        title="제목 수정"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                    {SECTION_DESCRIPTIONS[section.id]}
                  </p>
                </div>

                {/* Move buttons */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => handleMoveSection(section.id, 'up')}
                    disabled={idx === 0}
                    className={`p-1 rounded-md transition-colors ${
                      idx === 0
                        ? 'text-gray-200 cursor-not-allowed'
                        : 'text-gray-400 hover:bg-indigo-100 hover:text-indigo-600'
                    }`}
                    title="위로"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMoveSection(section.id, 'down')}
                    disabled={idx === sortedSections.length - 1}
                    className={`p-1 rounded-md transition-colors ${
                      idx === sortedSections.length - 1
                        ? 'text-gray-200 cursor-not-allowed'
                        : 'text-gray-400 hover:bg-indigo-100 hover:text-indigo-600'
                    }`}
                    title="아래로"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Visibility toggle */}
                <button
                  onClick={() => handleSectionToggle(section.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
                    section.visible
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  {section.visible ? (
                    <><Eye className="w-3.5 h-3.5" /> 표시</>
                  ) : (
                    <><EyeOff className="w-3.5 h-3.5" /> 숨김</>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Dashboard preview */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">대시보드 레이아웃 미리보기</p>
          <div className="space-y-2">
            {sortedSections
              .filter(s => s.visible)
              .map((section, idx) => (
                <div
                  key={section.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200"
                >
                  <span className="text-xs font-bold text-indigo-500 bg-indigo-50 w-5 h-5 rounded flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm flex-shrink-0">{SECTION_ICONS[section.id]}</span>
                  <span className="text-sm font-semibold text-gray-700">{section.title}</span>
                </div>
              ))}
            {sortedSections.filter(s => s.visible).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">표시할 섹션이 없습니다</p>
            )}
          </div>
        </div>
      </section>

      {/* ========== 4. 데이터 관리 ========== */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-bold text-gray-800">데이터 관리</h3>
        </div>
        <div className="p-5 space-y-4">
          {/* Reset settings */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div>
              <p className="font-semibold text-amber-800 text-sm">설정 초기화</p>
              <p className="text-xs text-amber-600 mt-0.5">모든 설정을 기본값으로 되돌립니다 (데이터는 유지됨)</p>
            </div>
            {showResetConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600"
                >
                  확인
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-300"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-bold hover:bg-amber-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                초기화
              </button>
            )}
          </div>

          {/* Clear all data */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-200">
            <div>
              <p className="font-semibold text-red-800 text-sm">모든 데이터 삭제</p>
              <p className="text-xs text-red-600 mt-0.5">매매 기록, 노트, 설정 등 모든 데이터를 영구 삭제합니다</p>
            </div>
            {showClearConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                >
                  영구 삭제
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-300"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                전체 삭제
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Storage info */}
      <div className="text-center text-xs text-gray-400 pb-4">
        💾 모든 설정은 브라우저 로컬 스토리지에 저장됩니다
      </div>
    </div>
  );
}
