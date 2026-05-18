import React from 'react';
import { EnrichedData } from '../types';
import { IconGlobe, IconNews, IconBuilding, IconSearch, IconBrain, IconArrowRight } from './Icons';

interface Props {
  data: EnrichedData;
  isLoading: boolean;
  lastEnrichedAt?: string | number;
}

export const EnrichmentPanel: React.FC<Props> = ({ data, isLoading, lastEnrichedAt }) => {
  if (isLoading) {
    return (
      <div className="p-6 border border-violet-100 bg-violet-50 rounded-xl animate-pulse">
        <div className="flex items-center space-x-3 mb-4">
          <IconSearch className="w-5 h-5 text-violet-600 animate-spin" />
          <span className="text-violet-700 font-medium">AI가 회사 정보를 찾고 있어요</span>
        </div>
        <div className="h-4 bg-violet-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-violet-200 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
      <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center">
          <IconBuilding className="w-4 h-4 mr-2 text-blue-600" />
          AI가 찾아낸 회사 정보
        </h3>
        {lastEnrichedAt && (
           <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full border border-slate-200">
             {new Date(lastEnrichedAt).toLocaleString('ko-KR', {
               year: 'numeric',
               month: 'short',
               day: 'numeric',
               hour: '2-digit',
               minute: '2-digit'
             })}에 수집
           </span>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Sales Opportunity - AI accent */}
        <div className="bg-violet-50 p-4 rounded-lg border border-violet-100 shadow-sm">
          <h4 className="text-xs uppercase tracking-wider text-violet-700 font-bold mb-3 flex items-center">
            <IconBrain className="w-4 h-4 mr-2 text-violet-600" />
            AI가 발견한 영업 기회
          </h4>
          <p className="text-slate-800 text-sm font-medium leading-relaxed">{data.salesOpportunity}</p>
        </div>

        {/* Summary */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">회사 소개</h4>
          <p className="text-slate-700 leading-relaxed text-sm">{data.summary}</p>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
            <div className="text-xs text-slate-500 mb-1 font-medium">대표</div>
            <div className="font-semibold text-slate-800 text-sm">{data.ceo || '정보 없음'}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
            <div className="text-xs text-slate-500 mb-1 font-medium">설립 연도</div>
            <div className="font-semibold text-slate-800 text-sm">{data.foundedYear || '정보 없음'}</div>
          </div>
        </div>

        {/* Recent News */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3 flex items-center">
            <IconNews className="w-3 h-3 mr-1" />
            최근 소식
          </h4>
          <ul className="space-y-2.5">
            {data.recentNews.map((news, idx) => (
              <li key={idx} className="flex items-start text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                <span className="text-blue-500 mr-2 mt-0.5 font-bold">•</span>
                <span className="flex-1">{news}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sources / Grounding */}
        {data.sources.length > 0 && (
          <div className="pt-4 border-t border-slate-200">
             <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3 flex items-center">
               <IconGlobe className="w-3 h-3 mr-1" />
               참고한 웹사이트
             </h4>
             <div className="flex flex-wrap gap-2">
               {data.sources.map((source, idx) => (
                 <a 
                    key={idx} 
                    href={source.uri} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-blue-600 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm transition-all truncate max-w-[200px] group"
                 >
                   <span className="truncate">{source.title}</span>
                   <IconArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                 </a>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};