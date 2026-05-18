import React, { useEffect, useState } from 'react';
import { ICPProfile } from '../../../types';
import {
  getICPProfiles,
  saveICPProfiles,
  getCollectionSettings,
  saveCollectionSettings,
  CollectionSettings,
  runProspectCollection,
} from '../../../services/prospectService';
import { IconX, IconClock, IconLoader, IconSparkles } from '../../Icons';
import { useSettingsToast } from '../SettingsToastContext';
import {
  pageTitle,
  pageDesc,
  card,
  sectionTitle,
  sectionDesc,
  toggle,
  btnPrimary,
  btnSecondary,
  btnGhost,
  inputBase,
  chip,
} from '../tokens';

interface ProspectSettingsTabProps {
  onSettingsChange?: () => void;
  existingCompanyNames?: string[];
}

const IconPlay: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const formatInterval = (ms: number): string => {
  const hours = ms / 3600000;
  if (hours < 1) {
    const minutes = ms / 60000;
    return `${minutes}분`;
  }
  if (hours === 1) return '1시간';
  if (hours < 24) return `${hours}시간`;
  return `${hours / 24}일`;
};

export const ProspectSettingsTab: React.FC<ProspectSettingsTabProps> = ({
  onSettingsChange,
  existingCompanyNames = [],
}) => {
  const toast = useSettingsToast();
  const [profiles, setProfiles] = useState<ICPProfile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ICPProfile>>({
    name: '',
    industries: [],
    keywords: [],
    companySize: '',
    targetRegions: [],
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [industryInput, setIndustryInput] = useState('');

  const [collectionSettings, setCollectionSettings] = useState<CollectionSettings>(() =>
    getCollectionSettings(),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<{
    newProspects: number;
    totalArticles: number;
  } | null>(null);

  useEffect(() => {
    setProfiles(getICPProfiles());
    setCollectionSettings(getCollectionSettings());
  }, []);

  const persistCollection = (updates: Partial<CollectionSettings>, message = '저장되었습니다') => {
    const next = { ...collectionSettings, ...updates };
    setCollectionSettings(next);
    try {
      saveCollectionSettings(next);
      toast.show('success', message);
    } catch {
      toast.show('error', '저장에 실패했습니다');
    }
  };

  const handleManualRun = async () => {
    if (profiles.length === 0) {
      toast.show('error', 'ICP 프로필을 먼저 추가하세요');
      return;
    }

    setIsRunning(true);
    setLastRunResult(null);
    try {
      const result = await runProspectCollection(existingCompanyNames);
      setLastRunResult({
        newProspects: result.newProspects.length,
        totalArticles: result.totalArticles,
      });
      onSettingsChange?.();
      toast.show(
        'success',
        `${result.totalArticles}건 분석 · 신규 ${result.newProspects.length}건`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.show('error', `수집 실패: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', industries: [], keywords: [], companySize: '', targetRegions: [] });
    setKeywordInput('');
    setIndustryInput('');
    setEditingId(null);
  };

  const handleSave = () => {
    if (!formData.name?.trim()) {
      toast.show('error', '프로필 이름을 입력하세요');
      return;
    }
    if (!formData.industries?.length) {
      toast.show('error', '산업을 1개 이상 추가하세요');
      return;
    }
    if (!formData.keywords?.length) {
      toast.show('error', '키워드를 1개 이상 추가하세요');
      return;
    }

    const now = new Date().toISOString();
    let updated: ICPProfile[];

    if (editingId) {
      updated = profiles.map((p) =>
        p.id === editingId
          ? {
              ...p,
              ...formData,
              name: formData.name!,
              industries: formData.industries!,
              keywords: formData.keywords!,
              updatedAt: now,
            }
          : p,
      );
    } else {
      const newProfile: ICPProfile = {
        id: `icp_${now}_${Math.random().toString(36).slice(2, 11)}`,
        name: formData.name!,
        industries: formData.industries!,
        keywords: formData.keywords!,
        companySize: formData.companySize,
        targetRegions: formData.targetRegions,
        createdAt: now,
        updatedAt: now,
      };
      updated = [...profiles, newProfile];
    }

    setProfiles(updated);
    saveICPProfiles(updated);
    resetForm();
    onSettingsChange?.();
    toast.show('success', editingId ? '프로필이 수정되었습니다' : '프로필이 추가되었습니다');
  };

  const handleEdit = (profile: ICPProfile) => {
    setFormData({
      name: profile.name,
      industries: [...profile.industries],
      keywords: [...profile.keywords],
      companySize: profile.companySize,
      targetRegions: profile.targetRegions,
    });
    setEditingId(profile.id);
    setKeywordInput('');
    setIndustryInput('');
  };

  const handleDelete = (id: string) => {
    if (!confirm('이 ICP 프로필을 삭제할까요?')) return;
    const updated = profiles.filter((p) => p.id !== id);
    setProfiles(updated);
    saveICPProfiles(updated);
    if (editingId === id) resetForm();
    toast.show('success', '프로필이 삭제되었습니다');
  };

  const addKeywords = () => {
    const parts = keywordInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setFormData((prev) => ({ ...prev, keywords: [...(prev.keywords || []), ...parts] }));
    setKeywordInput('');
  };

  const removeKeyword = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords?.filter((_, i) => i !== index) || [],
    }));
  };

  const addIndustry = () => {
    const v = industryInput.trim();
    if (!v) return;
    setFormData((prev) => ({ ...prev, industries: [...(prev.industries || []), v] }));
    setIndustryInput('');
  };

  const removeIndustry = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      industries: prev.industries?.filter((_, i) => i !== index) || [],
    }));
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className={pageTitle}>잠재고객 탐색</h3>
        <p className={pageDesc}>
          이상적인 고객 프로필(ICP)을 정의하면 AI가 뉴스·시장 데이터에서 일치하는 기업을 찾아냅니다.
        </p>
      </header>

      {/* Collection control */}
      <section>
        <div className="mb-3">
          <h4 className={sectionTitle}>자동 수집</h4>
          <p className={sectionDesc}>설정한 주기로 새로운 잠재고객을 자동 검색합니다</p>
        </div>

        <div className={`${card} space-y-5`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">자동 수집 사용</p>
              <p className="text-xs text-slate-500 mt-0.5">백그라운드에서 주기적으로 실행됩니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={collectionSettings.autoRun}
                onChange={(e) => persistCollection({ autoRun: e.target.checked })}
                className="sr-only peer"
              />
              <div className={toggle} />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">수집 주기</label>
            <select
              value={collectionSettings.interval}
              onChange={(e) => persistCollection({ interval: parseInt(e.target.value, 10) })}
              disabled={!collectionSettings.autoRun}
              className={`${inputBase} disabled:bg-slate-50 disabled:cursor-not-allowed`}
            >
              <option value={1800000}>30분마다</option>
              <option value={3600000}>1시간마다</option>
              <option value={7200000}>2시간마다</option>
              <option value={21600000}>6시간마다</option>
              <option value={43200000}>12시간마다</option>
              <option value={86400000}>24시간마다</option>
            </select>
            {collectionSettings.autoRun && (
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                <IconClock className="w-3 h-3" />
                다음 실행 약 {formatInterval(collectionSettings.interval)} 후
              </p>
            )}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleManualRun}
              disabled={isRunning || profiles.length === 0}
              className={`${btnPrimary} w-full sm:w-auto`}
            >
              {isRunning ? (
                <>
                  <IconLoader className="w-4 h-4 animate-spin" />
                  수집 중...
                </>
              ) : (
                <>
                  <IconPlay className="w-4 h-4" />
                  지금 수집 실행
                </>
              )}
            </button>
            {profiles.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">먼저 ICP 프로필을 추가하세요</p>
            )}
            {lastRunResult && (
              <p className="text-xs text-slate-600 mt-3">
                최근 결과: 기사 <span className="font-semibold text-slate-900">{lastRunResult.totalArticles}</span>건
                분석 · 신규 잠재고객 <span className="font-semibold text-emerald-700">{lastRunResult.newProspects}</span>건
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ICP form */}
      <section>
        <div className="mb-3">
          <h4 className={sectionTitle}>
            {editingId ? 'ICP 프로필 수정' : 'ICP 프로필 추가'}
          </h4>
          <p className={sectionDesc}>
            산업과 키워드를 조합해 찾고 싶은 기업 유형을 정의합니다
          </p>
        </div>

        <div className={`${card} space-y-4`}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              프로필 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className={inputBase}
              placeholder="예: SaaS 스타트업"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              산업 분야 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={industryInput}
                onChange={(e) => setIndustryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addIndustry();
                  }
                }}
                className={inputBase}
                placeholder="예: SaaS, 핀테크"
              />
              <button type="button" onClick={addIndustry} className={btnSecondary + ' flex-shrink-0'}>
                추가
              </button>
            </div>
            {formData.industries && formData.industries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.industries.map((industry, index) => (
                  <span key={index} className={chip}>
                    {industry}
                    <button
                      type="button"
                      onClick={() => removeIndustry(index)}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label={`${industry} 제거`}
                    >
                      <IconX className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              키워드 <span className="text-red-500">*</span>
              <span className="ml-1 text-xs font-normal text-slate-500">(쉼표로 여러 개 입력 가능)</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeywords();
                  }
                }}
                className={inputBase}
                placeholder="예: AI, 자동화, 클라우드"
              />
              <button type="button" onClick={addKeywords} className={btnSecondary + ' flex-shrink-0'}>
                추가
              </button>
            </div>
            {formData.keywords && formData.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.keywords.map((keyword, index) => (
                  <span key={index} className={chip}>
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label={`${keyword} 제거`}
                    >
                      <IconX className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              회사 규모 <span className="text-xs font-normal text-slate-500">(선택)</span>
            </label>
            <input
              type="text"
              value={formData.companySize || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, companySize: e.target.value }))}
              className={inputBase}
              placeholder="예: 50-200명"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleSave} className={btnPrimary}>
              <IconSparkles className="w-4 h-4" />
              {editingId ? '수정 저장' : '프로필 추가'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className={btnGhost}>
                취소
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Saved profiles */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h4 className={sectionTitle}>저장된 프로필</h4>
            <p className={sectionDesc}>
              {profiles.length === 0
                ? '아직 추가된 프로필이 없습니다'
                : `총 ${profiles.length}개`}
            </p>
          </div>
        </div>

        {profiles.length === 0 ? (
          <div className={`${card} text-center py-8`}>
            <p className="text-sm text-slate-500">위 양식에서 첫 번째 프로필을 추가하세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <article key={profile.id} className={card}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h5 className="text-sm font-semibold text-slate-900">{profile.name}</h5>
                  <div className="flex gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(profile)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(profile.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <dl className="space-y-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="text-slate-500 font-medium w-12 flex-shrink-0">산업</dt>
                    <dd className="text-slate-700">{profile.industries.join(', ')}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate-500 font-medium w-12 flex-shrink-0">키워드</dt>
                    <dd className="text-slate-700">{profile.keywords.join(', ')}</dd>
                  </div>
                  {profile.companySize && (
                    <div className="flex gap-2">
                      <dt className="text-slate-500 font-medium w-12 flex-shrink-0">규모</dt>
                      <dd className="text-slate-700">{profile.companySize}</dd>
                    </div>
                  )}
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
