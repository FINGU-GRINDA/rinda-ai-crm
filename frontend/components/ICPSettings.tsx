import React, { useState, useEffect } from 'react';
import { ICPProfile } from '../types';
import { 
  getICPProfiles, 
  saveICPProfiles, 
  getCollectionSettings, 
  saveCollectionSettings,
  CollectionSettings,
  runProspectCollection
} from '../services/prospectService';
import { IconX, IconPlus, IconCheck, IconSparkles, IconPlay, IconClock } from './Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onManualRun?: () => void;
  existingCompanyNames?: string[];
}

export const ICPSettings: React.FC<Props> = ({ isOpen, onClose, onManualRun, existingCompanyNames = [] }) => {
  const [profiles, setProfiles] = useState<ICPProfile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ICPProfile>>({
    name: '',
    industries: [],
    keywords: [],
    companySize: '',
    targetRegions: []
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [industryInput, setIndustryInput] = useState('');
  
  // Collection Settings
  const [collectionSettings, setCollectionSettings] = useState<CollectionSettings>(() => getCollectionSettings());
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<{ newProspects: number; totalArticles: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const saved = getICPProfiles();
      setProfiles(saved);
      setCollectionSettings(getCollectionSettings());
    }
  }, [isOpen]);

  const handleManualRun = async () => {
    if (profiles.length === 0) {
      alert('먼저 ICP 프로필을 추가해주세요.');
      return;
    }

    setIsRunning(true);
    setLastRunResult(null);
    try {
      const result = await runProspectCollection(existingCompanyNames);
      setLastRunResult({
        newProspects: result.newProspects.length,
        totalArticles: result.totalArticles
      });
      if (onManualRun) {
        onManualRun();
      }
    } catch (error: any) {
      alert(`수집 실패: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSettingsChange = (updates: Partial<CollectionSettings>) => {
    const updated = { ...collectionSettings, ...updates };
    setCollectionSettings(updated);
    saveCollectionSettings(updated);
  };

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

  const handleSave = () => {
    if (!formData.name || formData.name.trim() === '') {
      alert('ICP 프로필 이름을 입력해주세요.');
      return;
    }

    if (formData.industries?.length === 0) {
      alert('최소 하나의 산업을 선택해주세요.');
      return;
    }

    if (formData.keywords?.length === 0) {
      alert('최소 하나의 키워드를 입력해주세요.');
      return;
    }

    const now = new Date().toISOString();
    let updated: ICPProfile[];

    if (editingId) {
      // 수정
      updated = profiles.map(p => 
        p.id === editingId 
          ? {
              ...p,
              ...formData,
              name: formData.name!,
              industries: formData.industries!,
              keywords: formData.keywords!,
              updatedAt: now
            }
          : p
      );
    } else {
      // 새로 생성
      const newProfile: ICPProfile = {
        id: `icp_${now}_${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name!,
        industries: formData.industries!,
        keywords: formData.keywords!,
        companySize: formData.companySize,
        targetRegions: formData.targetRegions,
        createdAt: now,
        updatedAt: now
      };
      updated = [...profiles, newProfile];
    }

    setProfiles(updated);
    saveICPProfiles(updated);
    resetForm();
  };

  const handleEdit = (profile: ICPProfile) => {
    setFormData({
      name: profile.name,
      industries: [...profile.industries],
      keywords: [...profile.keywords],
      companySize: profile.companySize,
      targetRegions: profile.targetRegions
    });
    setEditingId(profile.id);
    setKeywordInput(profile.keywords.join(', '));
    setIndustryInput('');
  };

  const handleDelete = (id: string) => {
    if (confirm('이 ICP 프로필을 삭제하시겠습니까?')) {
      const updated = profiles.filter(p => p.id !== id);
      setProfiles(updated);
      saveICPProfiles(updated);
      if (editingId === id) {
        resetForm();
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      industries: [],
      keywords: [],
      companySize: '',
      targetRegions: []
    });
    setKeywordInput('');
    setIndustryInput('');
    setEditingId(null);
  };

  const addKeyword = () => {
    const keywords = keywordInput.split(',').map(k => k.trim()).filter(k => k !== '');
    if (keywords.length > 0) {
      setFormData(prev => ({
        ...prev,
        keywords: [...(prev.keywords || []), ...keywords]
      }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords?.filter((_, i) => i !== index) || []
    }));
  };

  const addIndustry = () => {
    if (industryInput.trim() !== '') {
      setFormData(prev => ({
        ...prev,
        industries: [...(prev.industries || []), industryInput.trim()]
      }));
      setIndustryInput('');
    }
  };

  const removeIndustry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      industries: prev.industries?.filter((_, i) => i !== index) || []
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">ICP 설정</h2>
            <p className="text-sm text-slate-500 mt-1">잠재 고객 수집 설정 및 ICP 프로필 관리</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100"
          >
            <IconX className="w-6 h-6" />
          </button>
        </div>

        {/* Collection Settings Section */}
        <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <IconSparkles className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-800">잠재 고객 수집 설정</h3>
          </div>

          <div className="space-y-4">
            {/* Auto Run Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">자동 수집 활성화</label>
                <p className="text-xs text-slate-500 mt-1">설정한 주기마다 자동으로 잠재 고객을 수집합니다</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={collectionSettings.autoRun}
                  onChange={(e) => handleSettingsChange({ autoRun: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Collection Interval */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                수집 주기
              </label>
              <select
                value={collectionSettings.interval}
                onChange={(e) => handleSettingsChange({ interval: parseInt(e.target.value) })}
                disabled={!collectionSettings.autoRun}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value={1800000}>30분마다</option>
                <option value={3600000}>1시간마다</option>
                <option value={7200000}>2시간마다</option>
                <option value={21600000}>6시간마다</option>
                <option value={43200000}>12시간마다</option>
                <option value={86400000}>24시간마다</option>
              </select>
              {collectionSettings.autoRun && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <IconClock className="w-3 h-3" />
                  다음 수집: 약 {formatInterval(collectionSettings.interval)} 후
                </p>
              )}
            </div>

            {/* Manual Run Button */}
            <div className="pt-2 border-t border-slate-200">
              <button
                onClick={handleManualRun}
                disabled={isRunning || profiles.length === 0}
                className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {isRunning ? (
                  <>
                    <IconSparkles className="w-4 h-4 animate-spin" />
                    <span>잠재 고객을 수집하는 중입니다</span>
                  </>
                ) : (
                  <>
                    <IconPlay className="w-4 h-4" />
                    <span>지금 수집하기</span>
                  </>
                )}
              </button>
              {lastRunResult && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold">최근 수집 결과:</span> {lastRunResult.totalArticles}개 기사 분석, 
                    <span className="text-blue-600 font-semibold"> {lastRunResult.newProspects}개</span> 잠재 고객 발견
                  </p>
                </div>
              )}
              {profiles.length === 0 && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                  먼저 이상적 고객 조건(ICP) 프로필을 추가해 주세요
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              ICP 프로필 이름 *
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="예: SaaS 스타트업"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              산업 분야 *
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={industryInput}
                onChange={(e) => setIndustryInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addIndustry())}
                className="flex-1 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="예: SaaS"
              />
              <button
                onClick={addIndustry}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.industries?.map((industry, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm"
                >
                  {industry}
                  <button
                    onClick={() => removeIndustry(index)}
                    className="text-blue-700 hover:text-blue-900"
                  >
                    <IconX className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              키워드 * (쉼표로 구분)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                className="flex-1 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="예: AI, 자동화, 클라우드"
              />
              <button
                onClick={addKeyword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.keywords?.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm"
                >
                  {keyword}
                  <button
                    onClick={() => removeKeyword(index)}
                    className="text-blue-700 hover:text-blue-900"
                  >
                    <IconX className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              회사 규모 (선택)
            </label>
            <input
              type="text"
              value={formData.companySize || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, companySize: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="예: 50-200명"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <IconCheck className="w-4 h-4" />
              {editingId ? '수정 저장' : '프로필 추가'}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                취소
              </button>
            )}
          </div>
        </div>

        {/* Existing Profiles */}
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">저장된 ICP 프로필</h3>
          {profiles.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">저장된 프로필이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className="bg-slate-50 rounded-lg p-4 border border-slate-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-slate-800">{profile.name}</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(profile)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(profile.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-600 font-medium">산업: </span>
                      <span className="text-slate-700">{profile.industries.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 font-medium">키워드: </span>
                      <span className="text-slate-700">{profile.keywords.join(', ')}</span>
                    </div>
                    {profile.companySize && (
                      <div>
                        <span className="text-slate-600 font-medium">규모: </span>
                        <span className="text-slate-700">{profile.companySize}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

