import React from 'react';
import { Check } from 'lucide-react';
import Modal from '../common/Modal';

export const AIDiffModal = ({ isOpen, onClose, diff, suggestedCode, onApply }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review AI Code Changes" maxWidth="max-w-3xl">
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Review the suggested diff below before applying the changes to your active file.
        </p>

        {/* Diff Content Box */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs overflow-x-auto max-h-96">
          {diff ? (
            <pre className="space-y-0.5">
              {diff.split('\n').map((line, idx) => {
                let color = 'text-slate-300';
                let bg = '';
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  color = 'text-emerald-400';
                  bg = 'bg-emerald-950/30';
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  color = 'text-rose-400';
                  bg = 'bg-rose-950/30';
                } else if (line.startsWith('@@')) {
                  color = 'text-indigo-400 font-bold';
                }
                return (
                  <div key={idx} className={`${color} ${bg} px-1.5 py-0.5 rounded leading-relaxed`}>
                    {line || ' '}
                  </div>
                );
              })}
            </pre>
          ) : (
            <pre className="text-emerald-400">{suggestedCode}</pre>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Check className="w-4 h-4" />
            Approve & Apply to Editor
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AIDiffModal;
