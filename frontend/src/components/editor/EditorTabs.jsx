import React from 'react';
import { X, FileCode } from 'lucide-react';

export const EditorTabs = ({ openFiles, activeFile, onSelectTab, onCloseTab }) => {
  return (
    <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center overflow-x-auto no-scrollbar px-1 gap-1 select-none">
      {openFiles.map((file) => {
        const isActive = activeFile?.id === file.id;
        return (
          <div
            key={file.id}
            onClick={() => onSelectTab(file)}
            className={`group h-8 px-3 rounded-t-lg flex items-center gap-2 text-xs font-medium cursor-pointer border-t-2 transition-all ${
              isActive
                ? 'bg-slate-900 text-slate-100 border-indigo-500 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-900/60 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate max-w-[120px]">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(file.id);
              }}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 opacity-60 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default EditorTabs;
