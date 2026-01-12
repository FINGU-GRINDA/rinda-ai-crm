import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Proposal } from '../types';
import {
  IconX,
  IconDownload,
  IconCopy,
  IconCheck,
  IconTrash,
  IconFileText
} from './Icons';

interface ProposalViewModalProps {
  proposal: Proposal;
  customerName: string;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (proposalId: string) => void;
}

export const ProposalViewModal: React.FC<ProposalViewModalProps> = ({
  proposal,
  customerName,
  isOpen,
  onClose,
  onDelete
}) => {
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(proposal.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadAsText = () => {
    const blob = new Blob([proposal.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proposal.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(proposal.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <IconFileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-800 truncate">{proposal.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {customerName} • {new Date(proposal.createdAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Cover Image */}
        {proposal.imageUrl && (
          <div className="bg-slate-50 border-b border-slate-200">
            <img
              src={proposal.imageUrl}
              alt="Proposal Cover"
              className="w-full h-64 object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <div className="prose prose-slate prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-4" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-slate-800 mt-5 mb-3" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-slate-700 mt-4 mb-2" {...props} />,
                p: ({node, ...props}) => <p className="text-slate-600 leading-relaxed mb-4" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-2 mb-4 text-slate-600" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-2 mb-4 text-slate-600" {...props} />,
                li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                strong: ({node, ...props}) => <strong className="font-semibold text-slate-800" {...props} />,
                em: ({node, ...props}) => <em className="italic text-slate-700" {...props} />,
                blockquote: ({node, ...props}) => (
                  <blockquote className="border-l-4 border-emerald-500 pl-4 py-2 my-4 bg-slate-50 text-slate-600 italic" {...props} />
                ),
                code: ({node, ...props}) => (
                  <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono text-emerald-700" {...props} />
                ),
                hr: ({node, ...props}) => <hr className="my-6 border-slate-200" {...props} />
              }}
            >
              {proposal.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-300 rounded-lg transition-all"
            >
              {copied ? (
                <>
                  <IconCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600">복사됨!</span>
                </>
              ) : (
                <>
                  <IconCopy className="w-4 h-4" />
                  <span>복사</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadAsText}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-300 rounded-lg transition-all"
            >
              <IconDownload className="w-4 h-4" />
              <span>다운로드</span>
            </button>
          </div>

          {onDelete && (
            <div className="relative">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded-lg transition-all"
                >
                  <IconTrash className="w-4 h-4" />
                  <span>삭제</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600 font-medium mr-2">정말 삭제하시겠습니까?</span>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
