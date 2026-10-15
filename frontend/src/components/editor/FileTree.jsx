import React, { useState } from 'react';
import {
  FileCode,
  Folder,
  FolderOpen,
  Plus,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  FileText,
  FileJson,
} from 'lucide-react';

export const FileTree = ({
  files,
  activeFile,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  readOnly = false,
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());
  const [newItemModal, setNewItemModal] = useState({ isOpen: false, isDir: false });
  const [newItemPath, setNewItemPath] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const toggleFolder = (path) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const getFileIcon = (file) => {
    if (file.is_directory) {
      return collapsedFolders.has(file.path) ? (
        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
      ) : (
        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
      );
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py':
        return <span className="text-xs font-mono font-bold text-sky-400 shrink-0">Py</span>;
      case 'js':
      case 'jsx':
        return <span className="text-xs font-mono font-bold text-amber-400 shrink-0">JS</span>;
      case 'ts':
      case 'tsx':
        return <span className="text-xs font-mono font-bold text-blue-400 shrink-0">TS</span>;
      case 'json':
        return <FileJson className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
      case 'md':
      case 'txt':
        return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
      default:
        return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newItemPath.trim()) return;
    onCreateFile({
      path: newItemPath.trim(),
      is_directory: newItemModal.isDir,
    });
    setNewItemModal({ isOpen: false, isDir: false });
    setNewItemPath('');
  };

  const handleRenameSubmit = (file) => {
    if (renameValue.trim() && renameValue !== file.path) {
      onRenameFile(file.id, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="w-60 h-full bg-slate-900 border-r border-slate-800 flex flex-col text-slate-300 select-none shrink-0">
      {/* File Tree Header */}
      <div className="h-10 px-3 border-b border-slate-800 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span>Files</span>
        {!readOnly && <div className="flex items-center gap-1">
          <button
            onClick={() => setNewItemModal({ isOpen: true, isDir: false })}
            title="New File"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setNewItemModal({ isOpen: true, isDir: true })}
            title="New Folder"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>}
      </div>

      {/* Creation Input Field */}
      {newItemModal.isOpen && (
        <form onSubmit={handleCreateSubmit} className="p-2 border-b border-slate-800 bg-slate-850">
          <div className="text-[11px] text-slate-400 mb-1 font-medium">
            {newItemModal.isDir ? 'New Folder Name:' : 'New File Name (e.g. app.py):'}
          </div>
          <input
            type="text"
            autoFocus
            value={newItemPath}
            onChange={(e) => setNewItemPath(e.target.value)}
            onBlur={() => setNewItemModal({ isOpen: false, isDir: false })}
            className="w-full px-2 py-1 text-xs bg-slate-950 border border-indigo-500 rounded text-white focus:outline-none"
            placeholder={newItemModal.isDir ? 'components' : 'index.js'}
          />
        </form>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-xs">
        {files.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-xs">No files in project</div>
        ) : (
          files.map((file) => {
            const isActive = activeFile?.id === file.id;
            const isRenaming = renamingId === file.id;

            return (
              <div
                key={file.id}
                onClick={() => file.is_directory ? toggleFolder(file.path) : onSelectFile(file)}
                className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-indigo-600/30 text-indigo-300 font-medium'
                    : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  {file.is_directory && (
                    collapsedFolders.has(file.path) ? (
                      <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                    )
                  )}
                  {getFileIcon(file)}
                  {isRenaming ? (
                    <input
                      type="text"
                      autoFocus
                      defaultValue={file.path}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(file)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(file)}
                      className="w-full px-1 py-0.5 text-xs bg-slate-950 border border-indigo-500 rounded text-white"
                    />
                  ) : (
                    <span className="truncate">{file.name}</span>
                  )}
                </div>

                {/* File Action Hover Icons */}
                {!readOnly && <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(file.id);
                      setRenameValue(file.path);
                    }}
                    title="Rename"
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete '${file.name}'?`)) {
                        onDeleteFile(file.id);
                      }
                    }}
                    title="Delete"
                    className="p-1 rounded hover:bg-rose-900/60 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FileTree;
