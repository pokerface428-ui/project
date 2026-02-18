import { useState, useRef, useCallback } from 'react';
import {
  Plus, Search, Filter, X, Save, Trash2, Edit2,
  ImagePlus, Video, FileUp, Download,
  Tag, BookOpen, Building2,
  Calendar, Clock, Paperclip, Eye, EyeOff,
  Type, Image as ImageIcon, ChevronDown, ChevronUp
} from 'lucide-react';
import { StudyNote, StudyFile } from '../types';
import { generateId, compressImage } from '../utils/helpers';

interface StudyNotesProps {
  notes: StudyNote[];
  onSave: (note: StudyNote) => void;
  onDelete: (id: string) => void;
}

type CategoryType = 'all' | 'analysis' | 'study';

const CATEGORIES: { id: StudyNote['category']; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
  { id: 'analysis', label: '기업 분석', icon: <Building2 className="w-4 h-4" />, color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { id: 'study', label: '주식 공부', icon: <BookOpen className="w-4 h-4" />, color: 'text-purple-700', bgColor: 'bg-purple-100' },
];

const getCategoryInfo = (cat: StudyNote['category']) => CATEGORIES.find(c => c.id === cat) || CATEGORIES[0];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Parse content - detect YouTube URLs and image markers
function parseContent(content: string, images: string[]): { type: 'text' | 'youtube' | 'image'; value: string }[] {
  const lines = content.split('\n');
  const blocks: { type: 'text' | 'youtube' | 'image'; value: string }[] = [];
  let textBuffer: string[] = [];

  const flushText = () => {
    if (textBuffer.length > 0) {
      blocks.push({ type: 'text', value: textBuffer.join('\n') });
      textBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for image marker {{img:N}}
    const imgMatch = trimmed.match(/^\{\{img:(\d+)\}\}$/);
    if (imgMatch) {
      flushText();
      const idx = parseInt(imgMatch[1]);
      if (idx < images.length) {
        blocks.push({ type: 'image', value: images[idx] });
      }
      continue;
    }

    // Check for YouTube URL on its own line
    const ytId = extractYoutubeId(trimmed);
    if (ytId && (trimmed.includes('youtube') || trimmed.includes('youtu.be'))) {
      flushText();
      blocks.push({ type: 'youtube', value: `https://www.youtube.com/embed/${ytId}` });
      continue;
    }

    textBuffer.push(line);
  }
  flushText();

  return blocks;
}

function getDefaultNote(): Omit<StudyNote, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    category: 'analysis',
    stockName: '',
    stockCode: '',
    content: '',
    images: [],
    videos: [],
    files: [],
    tags: [],
  };
}

export function StudyNotes({ notes, onSave, onDelete }: StudyNotesProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingNote, setEditingNote] = useState<StudyNote | null>(null);
  const [form, setForm] = useState(getDefaultNote());
  const [viewingNote, setViewingNote] = useState<StudyNote | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryType>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [showVideoInput, setShowVideoInput] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const studyImageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter & Search
  const filtered = notes
    .filter(n => {
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          n.title.toLowerCase().includes(s) ||
          n.stockName.toLowerCase().includes(s) ||
          n.stockCode.toLowerCase().includes(s) ||
          n.content.toLowerCase().includes(s) ||
          n.tags.some(t => t.toLowerCase().includes(s))
        );
      }
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const handleNew = () => {
    setEditingNote(null);
    setForm(getDefaultNote());
    setVideoUrl('');
    setTagInput('');
    setErrors({});
    setIsEditing(true);
    setViewingNote(null);
    setShowPreview(true);
    setShowVideoInput(false);
  };

  const handleEdit = (note: StudyNote) => {
    setEditingNote(note);
    setForm({
      title: note.title,
      category: note.category,
      stockName: note.stockName,
      stockCode: note.stockCode,
      content: note.content,
      images: [...note.images],
      videos: [...note.videos],
      files: [...note.files],
      tags: [...note.tags],
    });
    setVideoUrl('');
    setTagInput('');
    setErrors({});
    setIsEditing(true);
    setViewingNote(null);
    setShowPreview(true);
    setShowVideoInput(false);
  };

  const handleView = (note: StudyNote) => {
    setViewingNote(note);
    setIsEditing(false);
  };

  const handleClose = () => {
    setIsEditing(false);
    setEditingNote(null);
    setViewingNote(null);
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // === Analysis: separate image upload ===
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (form.images.length + newImages.length >= 20) break;
      try {
        const compressed = await compressImage(files[i], 1200, 0.8);
        newImages.push(compressed);
      } catch { /* skip */ }
    }
    setForm(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleRemoveImage = (idx: number) => {
    if (form.category === 'study') {
      const marker = `{{img:${idx}}}`;
      let newContent = form.content.replace(marker, '');
      for (let i = idx + 1; i < form.images.length; i++) {
        newContent = newContent.replace(`{{img:${i}}}`, `{{img:${i - 1}}}`);
      }
      newContent = newContent.replace(/\n{3,}/g, '\n\n').trim();
      setForm(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== idx),
        content: newContent,
      }));
    } else {
      setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
    }
  };

  // === Study: inline image insert into content ===
  const handleStudyImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      if (form.images.length >= 20) break;
      try {
        const compressed = await compressImage(files[i], 1200, 0.8);
        const newIdx = form.images.length;
        const marker = `\n{{img:${newIdx}}}\n`;
        setForm(prev => {
          const textarea = textareaRef.current;
          let newContent = prev.content;
          if (textarea) {
            const pos = textarea.selectionStart || prev.content.length;
            newContent = prev.content.slice(0, pos) + marker + prev.content.slice(pos);
          } else {
            newContent = prev.content + marker;
          }
          return {
            ...prev,
            images: [...prev.images, compressed],
            content: newContent,
          };
        });
      } catch { /* skip */ }
    }
    if (studyImageInputRef.current) studyImageInputRef.current.value = '';
  }, [form.images.length]);

  // === Study: inline YouTube insert into content ===
  const handleStudyVideoInsert = () => {
    const url = videoUrl.trim();
    if (!url) return;
    const ytId = extractYoutubeId(url);
    if (!ytId) return;
    const videoLine = `\nhttps://www.youtube.com/watch?v=${ytId}\n`;
    const textarea = textareaRef.current;
    let newContent = form.content;
    if (textarea) {
      const pos = textarea.selectionStart || form.content.length;
      newContent = form.content.slice(0, pos) + videoLine + form.content.slice(pos);
    } else {
      newContent = form.content + videoLine;
    }
    setForm(prev => ({ ...prev, content: newContent }));
    setVideoUrl('');
    setShowVideoInput(false);
  };

  // === Analysis: separate video embed ===
  const handleAddVideo = () => {
    const url = videoUrl.trim();
    if (!url) return;
    const ytId = extractYoutubeId(url);
    if (ytId) {
      setForm(prev => ({ ...prev, videos: [...prev.videos, `https://www.youtube.com/embed/${ytId}`] }));
      setVideoUrl('');
    }
  };

  const handleRemoveVideo = (idx: number) => {
    setForm(prev => ({ ...prev, videos: prev.videos.filter((_, i) => i !== idx) }));
  };

  // File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      if (form.files.length >= 10) break;
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) continue;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as string;
        const newFile: StudyFile = { name: file.name, size: file.size, type: file.type, data };
        setForm(prev => ({ ...prev, files: [...prev.files, newFile] }));
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (idx: number) => {
    setForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== idx) }));
  };

  const handleDownloadFile = (file: StudyFile) => {
    const a = document.createElement('a');
    a.href = file.data;
    a.download = file.name;
    a.click();
  };

  // Tags
  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (idx: number) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== idx) }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) newErrors.title = '제목을 입력해주세요';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const isStudy = form.category === 'study';
    const note: StudyNote = {
      id: editingNote?.id || generateId(),
      title: form.title.trim(),
      category: form.category,
      stockName: isStudy ? '' : form.stockName.trim(),
      stockCode: isStudy ? '' : form.stockCode.trim(),
      content: form.content,
      images: form.images,
      videos: isStudy ? [] : form.videos,
      files: form.files,
      tags: form.tags,
      createdAt: editingNote?.createdAt || now,
      updatedAt: now,
    };
    onSave(note);
    setIsEditing(false);
    setEditingNote(null);
    setViewingNote(note);
  };

  const handleDeleteConfirm = (id: string) => {
    onDelete(id);
    setDeleteConfirm(null);
    if (viewingNote?.id === id) setViewingNote(null);
  };

  // ========== Render inline content (images + videos) ==========
  const renderInlineContent = (content: string, images: string[]) => {
    const blocks = parseContent(content, images);
    if (blocks.length === 0) return <p className="text-gray-300 italic">내용 없음</p>;
    return (
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          if (block.type === 'image') {
            return (
              <div key={idx} className="rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setPreviewImage(block.value)}>
                <img src={block.value} alt={`이미지 ${idx}`} className="w-full max-h-[500px] object-contain bg-gray-50" />
              </div>
            );
          }
          if (block.type === 'youtube') {
            return (
              <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-gray-200 bg-black">
                <iframe
                  src={block.value}
                  title={`동영상 ${idx}`}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            );
          }
          return (
            <div key={idx} className="whitespace-pre-wrap text-gray-700 leading-relaxed text-[15px]">
              {block.value}
            </div>
          );
        })}
      </div>
    );
  };

  // ========== VIEW MODE ==========
  if (viewingNote) {
    const note = viewingNote;
    const catInfo = getCategoryInfo(note.category);
    const isStudy = note.category === 'study';

    return (
      <div className="space-y-4">
        <button onClick={handleClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-semibold transition-colors">
          ← 목록으로 돌아가기
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${catInfo.bgColor} ${catInfo.color}`}>
                    {catInfo.icon}{catInfo.label}
                  </span>
                  {!isStudy && note.stockName && (
                    <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">
                      {note.stockName} {note.stockCode && `(${note.stockCode})`}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{note.title}</h2>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(note.createdAt).toLocaleDateString('ko-KR')}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(note.updatedAt).toLocaleString('ko-KR')}</span>
                </div>
              </div>
              <button onClick={() => handleEdit(note)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-bold hover:bg-indigo-100 transition-colors">
                <Edit2 className="w-4 h-4" />수정
              </button>
            </div>
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {note.tags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">
                    <Tag className="w-3 h-3" />{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {isStudy ? (
              /* === 주식 공부: 인라인 렌더링 === */
              note.content ? renderInlineContent(note.content, note.images) : <p className="text-gray-300 italic">내용 없음</p>
            ) : (
              /* === 기업 분석: 기존 방식 유지 === */
              <>
                {note.content && (
                  <div className="prose max-w-none mb-6">
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-[15px]">{note.content}</div>
                  </div>
                )}
                {note.images.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                      <ImagePlus className="w-4 h-4" />이미지 ({note.images.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {note.images.map((img, idx) => (
                        <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPreviewImage(img)}>
                          <img src={img} alt={`이미지 ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {note.videos.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                      <Video className="w-4 h-4" />동영상 ({note.videos.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {note.videos.map((url, idx) => (
                        <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-gray-200 bg-black">
                          <iframe src={url} title={`동영상 ${idx + 1}`} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Files */}
            {note.files.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />첨부 파일 ({note.files.length})
                </h4>
                <div className="space-y-2">
                  {note.files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-white rounded-lg border border-gray-200"><FileUp className="w-4 h-4 text-gray-500" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-700 truncate">{file.name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDownloadFile(file)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors flex-shrink-0">
                        <Download className="w-3 h-3" />다운로드
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Image preview modal */}
        {previewImage && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh]">
              <img src={previewImage} alt="미리보기" className="max-w-full max-h-[90vh] object-contain rounded-xl" />
              <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== EDIT/CREATE MODE ==========
  if (isEditing) {
    const isStudy = form.category === 'study';

    return (
      <div className="space-y-4">
        <button onClick={handleClose} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-semibold transition-colors">
          ← 목록으로 돌아가기
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              {editingNote ? <Edit2 className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
              {editingNote ? '노트 수정' : '새 노트 작성'}
            </h2>
          </div>

          <div className="p-6 space-y-5">
            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">카테고리</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleChange('category', cat.id)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                      form.category === cat.id
                        ? `${cat.bgColor} ${cat.color} ring-2 ring-offset-1 ring-current shadow-sm`
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {cat.icon}{cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">제목 *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="노트 제목을 입력하세요"
                className={`w-full px-4 py-3 rounded-xl border ${errors.title ? 'border-red-300 bg-red-50' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-lg font-semibold`}
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>

            {/* ===== 기업 분석 전용: 종목명/종목코드 ===== */}
            {!isStudy && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">종목명</label>
                  <input type="text" value={form.stockName} onChange={e => handleChange('stockName', e.target.value)} placeholder="삼성전자" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">종목코드</label>
                  <input type="text" value={form.stockCode} onChange={e => handleChange('stockCode', e.target.value)} placeholder="005930" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all" />
                </div>
              </div>
            )}

            {/* ===================================================================
                주식 공부: 리치 콘텐츠 에디터 (인라인 이미지/동영상)
                =================================================================== */}
            {isStudy ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">내용</label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(prev => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      showPreview ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {showPreview ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {showPreview ? '미리보기 ON' : '미리보기 OFF'}
                  </button>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2 mb-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 cursor-pointer transition-all shadow-sm">
                    <ImageIcon className="w-4 h-4" />
                    이미지 삽입
                    <input
                      ref={studyImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleStudyImageUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowVideoInput(prev => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all shadow-sm ${
                      showVideoInput ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    YouTube 삽입
                    {showVideoInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <div className="flex-1" />
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Type className="w-3 h-3" />
                    이미지/YouTube URL은 실시간 렌더링됩니다
                  </span>
                </div>

                {/* YouTube URL input (토글) */}
                {showVideoInput && (
                  <div className="flex gap-2 mb-2 p-3 bg-red-50 rounded-xl border border-red-200 animate-in">
                    <div className="relative flex-1">
                      <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                      <input
                        type="text"
                        value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleStudyVideoInsert(); } }}
                        placeholder="YouTube URL 붙여넣기 (예: https://youtube.com/watch?v=...)"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 text-sm bg-white"
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleStudyVideoInsert}
                      disabled={!videoUrl.trim()}
                      className="px-4 py-2.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />내용에 삽입
                    </button>
                  </div>
                )}

                {/* Editor + Live Preview */}
                <div className={`grid gap-4 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                  {/* Editor */}
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Edit2 className="w-3 h-3" /> 편집
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={form.content}
                      onChange={e => handleChange('content', e.target.value)}
                      placeholder={`내용을 자유롭게 작성하세요...\n\n📷 이미지: 상단 '이미지 삽입' 버튼 클릭\n🎬 동영상: 상단 'YouTube 삽입' 버튼 클릭\n\n삽입된 이미지와 동영상은 우측 미리보기에서\n바로 확인할 수 있습니다.`}
                      rows={20}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all resize-y leading-relaxed font-mono text-sm bg-gray-50"
                    />
                    {/* 삽입된 이미지 목록 */}
                    {form.images.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5" />
                          삽입된 이미지 ({form.images.length}/20)
                        </p>
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                          {form.images.map((img, idx) => (
                            <div key={idx} className="relative group">
                              <div className="aspect-square rounded-lg overflow-hidden border border-blue-200 bg-white">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 bg-indigo-500 text-white text-[9px] font-bold rounded-md shadow">
                                {idx}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Live Preview */}
                  {showPreview && (
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> 미리보기
                      </div>
                      <div className="px-4 py-3 rounded-xl border border-indigo-200 bg-white min-h-[500px] max-h-[700px] overflow-y-auto">
                        {form.content.trim() ? (
                          renderInlineContent(form.content, form.images)
                        ) : (
                          <p className="text-gray-300 text-sm italic">내용을 입력하면 미리보기가 표시됩니다...</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ===================================================================
                 기업 분석: 기존 에디터 (별도 이미지/동영상 섹션)
                 =================================================================== */
              <>
                {/* Content */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">내용</label>
                  <textarea
                    value={form.content}
                    onChange={e => handleChange('content', e.target.value)}
                    placeholder="기업 분석 내용을 작성하세요..."
                    rows={10}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all resize-y leading-relaxed"
                  />
                </div>

                {/* Images */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📷 이미지 <span className="text-gray-400 font-normal">({form.images.length}/20)</span>
                  </label>
                  {form.images.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
                      {form.images.map((img, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {form.images.length < 20 && (
                    <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all text-sm text-gray-500 hover:text-indigo-600">
                      <ImagePlus className="w-5 h-5" /><span>이미지 추가 (최대 20장)</span>
                      <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>

                {/* Videos */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎬 동영상 임베드 <span className="text-gray-400 font-normal">({form.videos.length}개)</span>
                  </label>
                  {form.videos.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {form.videos.map((url, idx) => (
                        <div key={idx} className="relative group">
                          <div className="aspect-video rounded-xl overflow-hidden border border-gray-200 bg-black">
                            <iframe src={url} title={`동영상 ${idx + 1}`} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                          </div>
                          <button type="button" onClick={() => handleRemoveVideo(idx)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddVideo(); } }}
                        placeholder="YouTube URL (예: https://youtube.com/watch?v=...)"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-sm"
                      />
                    </div>
                    <button type="button" onClick={handleAddVideo} disabled={!videoUrl.trim()} className="px-5 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5">
                      <Plus className="w-4 h-4" />추가
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Files (공통) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📎 파일 첨부 <span className="text-gray-400 font-normal">({form.files.length}/10, 최대 5MB/파일)</span>
              </label>
              {form.files.length > 0 && (
                <div className="space-y-2 mb-3">
                  {form.files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-white rounded-lg border border-gray-200"><FileUp className="w-4 h-4 text-gray-500" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-700 truncate">{file.name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => handleRemoveFile(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {form.files.length < 10 && (
                <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all text-sm text-gray-500 hover:text-indigo-600">
                  <FileUp className="w-5 h-5" /><span>파일 추가 (PDF, 문서, 스프레드시트 등)</span>
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Tags (공통) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">🏷️ 태그</label>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {form.tags.map((tag, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold group">
                      <Tag className="w-3 h-3" />{tag}
                      <button type="button" onClick={() => handleRemoveTag(idx)} className="ml-0.5 p-0.5 rounded-full hover:bg-indigo-200 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder="태그 입력 후 Enter" className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all text-sm" />
                <button type="button" onClick={handleAddTag} disabled={!tagInput.trim()} className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  추가
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmit} className="flex-1 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />{editingNote ? '수정 완료' : '노트 저장'}
              </button>
              <button onClick={handleClose} className="px-6 py-4 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all">
                취소
              </button>
            </div>
          </div>
        </div>

        {/* Image preview */}
        {previewImage && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh]">
              <img src={previewImage} alt="미리보기" className="max-w-full max-h-[90vh] object-contain rounded-xl" />
              <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"><X className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== LIST VIEW ==========
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">📚 기업 분석 / 주식 공부</h2>
          <p className="text-sm text-gray-400 mt-1">투자 아이디어, 기업 분석, 학습 내용을 기록하세요</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-200 hover:shadow-xl transition-all">
          <Plus className="w-4 h-4" />새 노트
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="제목, 종목명, 태그, 내용 검색..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <button onClick={() => setCategoryFilter('all')} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${categoryFilter === 'all' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            전체
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                categoryFilter === cat.id ? `${cat.bgColor} ${cat.color}` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {cat.icon}{cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">전체</p>
          <p className="text-xl font-bold text-gray-800">{notes.length}</p>
        </div>
        {CATEGORIES.map(cat => {
          const count = notes.filter(n => n.category === cat.id).length;
          return (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">{cat.icon}{cat.label}</p>
              <p className={`text-xl font-bold ${cat.color}`}>{count}</p>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-gray-400">총 <span className="font-bold text-gray-600">{filtered.length}</span>건</p>

      {/* Note Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-gray-500 font-semibold mb-2">{notes.length === 0 ? '아직 작성한 노트가 없습니다' : '검색 결과가 없습니다'}</p>
          <p className="text-gray-400 text-sm mb-6">기업 분석, 투자 학습 내용을 기록해보세요</p>
          {notes.length === 0 && (
            <button onClick={handleNew} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl transition-all">
              <Plus className="w-5 h-5" />첫 노트 작성하기
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(note => {
            const catInfo = getCategoryInfo(note.category);
            const isStudy = note.category === 'study';
            const hasMedia = note.images.length > 0 || note.videos.length > 0;
            const hasFiles = note.files.length > 0;
            const hasYouTubeInContent = isStudy && /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(note.content);

            return (
              <div
                key={note.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all group cursor-pointer"
                onClick={() => handleView(note)}
              >
                {/* Thumbnail */}
                {note.images.length > 0 && (
                  <div className="h-40 overflow-hidden">
                    <img src={note.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                {note.images.length === 0 && (note.videos.length > 0 || hasYouTubeInContent) && (
                  <div className="h-40 bg-gray-900 flex items-center justify-center">
                    <div className="text-center">
                      <Video className="w-10 h-10 text-red-500 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">동영상 포함</p>
                    </div>
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${catInfo.bgColor} ${catInfo.color}`}>
                      {catInfo.icon}{catInfo.label}
                    </span>
                    {!isStudy && note.stockName && (
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        {note.stockName}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">{note.title}</h3>
                  {note.content && (
                    <p className="text-sm text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                      {note.content.replace(/\{\{img:\d+\}\}/g, '📷').replace(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)\S+/g, '🎬')}
                    </p>
                  )}
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {note.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">#{tag}</span>
                      ))}
                      {note.tags.length > 3 && <span className="text-[10px] text-gray-400">+{note.tags.length - 3}</span>}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{new Date(note.updatedAt).toLocaleDateString('ko-KR')}</span>
                      {hasMedia && (
                        <span className="flex items-center gap-0.5"><ImagePlus className="w-3 h-3" />{note.images.length + note.videos.length}</span>
                      )}
                      {hasFiles && (
                        <span className="flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{note.files.length}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleEdit(note)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 transition-colors" title="수정">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {deleteConfirm === note.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDeleteConfirm(note.id)} className="px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold">삭제</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded-lg bg-gray-200 text-gray-600 text-[10px] font-bold">취소</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(note.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="삭제">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={previewImage} alt="미리보기" className="max-w-full max-h-[90vh] object-contain rounded-xl" />
            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
