import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import {
  Sparkles,
  Save,
  Play,
  RotateCcw,
  Users,
  CheckCircle2,
  AlertCircle,
  Code2,
} from 'lucide-react';
import FileTree from './FileTree';
import EditorTabs from './EditorTabs';
import AIPanel from '../ai/AIPanel';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import socketClient from '../../socket/socketClient';

// Helper to convert Uint8Array <-> base64
function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

const PEER_COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6'
];

export const CodeWorkspace = ({ workspaceId, project }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [files, setFiles] = useState([]);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isAiOpen, setIsAiOpen] = useState(true);
  const [selectedCode, setSelectedCode] = useState('');
  const [activePeers, setActivePeers] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'synced'

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);
  const myColorRef = useRef(
    PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
  );

  // Load project files on mount
  const loadFiles = useCallback(async () => {
    try {
      const res = await projectService.getFiles(workspaceId, project.id);
      const list = res.data?.files || [];
      setFiles(list);

      // Auto-open main file or first file
      if (list.length > 0 && openFiles.length === 0) {
        const starter = list.find((f) => !f.is_directory && (f.name === 'main.py' || f.name.includes('main'))) || list.find((f) => !f.is_directory);
        if (starter) {
          handleOpenFile(starter);
        }
      }
    } catch (err) {
      showToast('Error loading project files: ' + err.message, 'error');
    }
  }, [workspaceId, project.id, openFiles.length, showToast]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Open file in tab
  const handleOpenFile = async (file) => {
    if (file.is_directory) return;

    if (!openFiles.some((f) => f.id === file.id)) {
      setOpenFiles((prev) => [...prev, file]);
    }
    setActiveFile(file);
  };

  const handleCloseTab = (fileId) => {
    const remaining = openFiles.filter((f) => f.id !== fileId);
    setOpenFiles(remaining);
    if (activeFile?.id === fileId) {
      setActiveFile(remaining[remaining.length - 1] || null);
    }
  };

  // Setup Yjs Collaborative session whenever activeFile changes
  useEffect(() => {
    if (!activeFile || !editorRef.current) return;

    // 1. Clean up previous binding & doc
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }

    // Leave previous file collab room
    socketClient.emit('collab_leave', {
      project_id: project.id,
      file_id: activeFile.id,
    });

    const doc = new Y.Doc();
    ydocRef.current = doc;
    const ytext = doc.getText('monaco');

    // 2. Load latest Yjs state / initial file content from backend
    const initializeDoc = async () => {
      try {
        const res = await projectService.getYjsState(workspaceId, project.id, activeFile.id);
        const { yjs_state, plaintext_content } = res.data;

        if (yjs_state && yjs_state.trim()) {
          try {
            const update = base64ToUint8Array(yjs_state);
            Y.applyUpdate(doc, update, 'initial');
          } catch {
            if (plaintext_content) {
              ytext.insert(0, plaintext_content);
            }
          }
        } else if (plaintext_content) {
          ytext.insert(0, plaintext_content);
        } else if (activeFile.content) {
          ytext.insert(0, activeFile.content);
        }

        // 3. Bind Y.Text to Monaco editor model
        if (editorRef.current) {
          const model = editorRef.current.getModel();
          if (model) {
            // Bind Monaco with Yjs CRDT
            const binding = new MonacoBinding(
              ytext,
              model,
              new Set([editorRef.current]),
              null
            );
            bindingRef.current = binding;
          }
        }

        // 4. Join Socket.IO collaboration room
        socketClient.emit('collab_join', {
          project_id: project.id,
          file_id: activeFile.id,
          user: user,
          color: myColorRef.current,
        });
      } catch (err) {
        console.error('Collab initialization error:', err);
      }
    };

    initializeDoc();

    // 5. Broadcast local changes to room peers
    const handleDocUpdate = (update, origin) => {
      if (origin === 'remote') return; // Don't echo remote updates back

      setSaveStatus('saving');
      const b64 = uint8ArrayToBase64(update);
      const currentPlaintext = ytext.toString();

      // Emit to peers via Socket.IO
      socketClient.emit('yjs_sync_update', {
        project_id: project.id,
        file_id: activeFile.id,
        update: b64,
        plaintext: currentPlaintext,
        user_id: user?.id,
      });

      setSaveStatus('synced');
    };

    doc.on('update', handleDocUpdate);

    // 6. Listen for incoming remote Yjs updates
    const handleRemoteUpdate = (data) => {
      if (data.file_id === activeFile.id && data.update) {
        try {
          const bytes = base64ToUint8Array(data.update);
          Y.applyUpdate(doc, bytes, 'remote');
        } catch (err) {
          console.error('Remote update application error:', err);
        }
      }
    };

    const handlePeersUpdate = (data) => {
      if (data.file_id === activeFile.id) {
        setActivePeers(data.peers || []);
      }
    };

    socketClient.on('yjs_sync_update', handleRemoteUpdate);
    socketClient.on('collab_peers_update', handlePeersUpdate);

    return () => {
      socketClient.off('yjs_sync_update', handleRemoteUpdate);
      socketClient.off('collab_peers_update', handlePeersUpdate);
      doc.off('update', handleDocUpdate);
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      doc.destroy();
      socketClient.emit('collab_leave', {
        project_id: project.id,
        file_id: activeFile.id,
      });
    };
  }, [activeFile?.id, project.id, workspaceId, user]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track text selection for AI assistant
    editor.onDidChangeCursorSelection((e) => {
      const selected = editor.getModel().getValueInRange(e.selection);
      setSelectedCode(selected);
    });
  };

  // Actions for file CRUD
  const handleCreateFile = async (data) => {
    try {
      const res = await projectService.createFile(workspaceId, project.id, data);
      const created = res.data.file;
      setFiles((prev) => [...prev, created]);
      if (!created.is_directory) {
        handleOpenFile(created);
      }
      showToast(`Created ${created.name}`, 'success');
    } catch (err) {
      showToast('Create failed: ' + err.message, 'error');
    }
  };

  const handleRenameFile = async (fileId, newPath) => {
    try {
      const res = await projectService.updateFile(workspaceId, project.id, fileId, { path: newPath });
      const updated = res.data.file;
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
      setOpenFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
      if (activeFile?.id === fileId) setActiveFile(updated);
      showToast('File renamed', 'success');
    } catch (err) {
      showToast('Rename failed: ' + err.message, 'error');
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await projectService.deleteFile(workspaceId, project.id, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      handleCloseTab(fileId);
      showToast('File deleted', 'success');
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  };

  // Replace or insert code into editor (e.g. from AI assistant)
  const handleApplyAiCode = (code, replaceSelection = false) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();

    if (replaceSelection && selection && !selection.isEmpty()) {
      editor.executeEdits('ai-assistant', [
        { range: selection, text: code, forceMoveMarkers: true },
      ]);
    } else {
      const position = editor.getPosition();
      editor.executeEdits('ai-assistant', [
        {
          range: new monacoRef.current.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          text: code,
          forceMoveMarkers: true,
        },
      ]);
    }
    showToast('Applied code changes into editor!', 'success');
  };

  return (
    <div className="flex-1 h-full flex flex-row overflow-hidden bg-slate-950">
      {/* Left File Tree Explorer */}
      <FileTree
        files={files}
        activeFile={activeFile}
        onSelectFile={handleOpenFile}
        onCreateFile={handleCreateFile}
        onRenameFile={handleRenameFile}
        onDeleteFile={handleDeleteFile}
      />

      {/* Main Center Editor Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Editor Tabs */}
        <div className="flex items-center justify-between bg-slate-950 pr-3 border-b border-slate-800">
          <div className="flex-1 min-w-0">
            <EditorTabs
              openFiles={openFiles}
              activeFile={activeFile}
              onSelectTab={setActiveFile}
              onCloseTab={handleCloseTab}
            />
          </div>

          {/* Active Collaborators Presence Avatars */}
          <div className="flex items-center gap-2 pl-2 shrink-0">
            {activePeers.length > 0 && (
              <div className="flex items-center -space-x-1.5" title="Active collaborators editing this file">
                {activePeers.map((peer, idx) => (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow"
                    style={{ backgroundColor: peer.color || '#6366f1' }}
                    title={`${peer.username} (active)`}
                  >
                    {(peer.username?.[0] || 'U').toUpperCase()}
                  </div>
                ))}
              </div>
            )}

            {/* AI Assistant Toggle Button */}
            <button
              onClick={() => setIsAiOpen(!isAiOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isAiOpen
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>AI Assistant</span>
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 relative min-h-0 bg-slate-950">
          {activeFile ? (
            <Editor
              height="100%"
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              language={activeFile.language || 'plaintext'}
              defaultValue={activeFile.content || ''}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 13,
                fontFamily: 'Consolas, "Fira Code", monospace',
                tabSize: 4,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                bracketPairColorization: { enabled: true },
                formatOnPaste: true,
                automaticLayout: true,
                padding: { top: 12 },
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
              <Code2 className="w-12 h-12 stroke-[1.2]" />
              <p className="text-sm">Select a file from the explorer or create a new one to start coding</p>
            </div>
          )}
        </div>

        {/* Editor Bottom Status Bar */}
        <div className="h-6 px-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              {saveStatus === 'saved' ? 'Saved' : 'Synchronizing...'}
            </span>
            <span>{activeFile?.language?.toUpperCase() || 'PLAINTEXT'}</span>
            <span>UTF-8</span>
          </div>

          <div className="flex items-center gap-3">
            <span>{activePeers.length} collaborator{activePeers.length !== 1 ? 's' : ''} in room</span>
          </div>
        </div>
      </div>

      {/* Right AI Coding Assistant Panel */}
      {isAiOpen && (
        <AIPanel
          workspaceId={workspaceId}
          projectId={project.id}
          activeFile={activeFile}
          selectedCode={selectedCode}
          onApplyCode={handleApplyAiCode}
          onClose={() => setIsAiOpen(false)}
        />
      )}
    </div>
  );
};

export default CodeWorkspace;
