import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { MonacoBinding } from 'y-monaco';
import {
  Sparkles,
  CheckCircle2,
  Code2,
  Users,
  UserPlus,
} from 'lucide-react';
import FileTree from './FileTree';
import EditorTabs from './EditorTabs';
import AIPanel from '../ai/AIPanel';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import socketClient from '../../socket/socketClient';
import { workspaceService } from '../../services/workspaceService';

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

export const CodeWorkspace = ({ workspaceId, project, effectiveRole, readOnly = false }) => {
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
  const [editorMounted, setEditorMounted] = useState(false);
  const [showProjectMembers, setShowProjectMembers] = useState(false);
  const [showProjectAccessUsers, setShowProjectAccessUsers] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedMemberRole, setSelectedMemberRole] = useState('viewer');
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    if (!showProjectMembers && !showProjectAccessUsers) return undefined;
    const handleOutsideClick = (event) => {
      if (!event.target.closest('[data-project-access-ui]')) {
        setShowProjectMembers(false);
        setShowProjectAccessUsers(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showProjectMembers, showProjectAccessUsers]);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);
  const awarenessRef = useRef(null);
  const myColorRef = useRef(
    PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
  );

  // Open file in tab
  const handleOpenFile = useCallback((file) => {
    if (!file || file.is_directory) return;

    setOpenFiles((prev) => {
      if (!prev.some((f) => f.id === file.id)) {
        return [...prev, file];
      }
      return prev;
    });
    setActiveFile(file);
  }, []);

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
  }, [workspaceId, project.id, openFiles.length, showToast, handleOpenFile]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleCloseTab = (fileId) => {
    const remaining = openFiles.filter((f) => f.id !== fileId);
    setOpenFiles(remaining);
    if (activeFile?.id === fileId) {
      setActiveFile(remaining[remaining.length - 1] || null);
    }
  };

  // Setup Yjs Collaborative session whenever activeFile changes or editor mounts
  useEffect(() => {
    if (!activeFile || !editorRef.current) return;

    // 1. Clean up previous binding & doc & awareness
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }
    if (awarenessRef.current) {
      awarenessRef.current.destroy();
      awarenessRef.current = null;
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

    // Create Yjs Awareness for multi-user cursors & selections
    const awareness = new awarenessProtocol.Awareness(doc);
    awarenessRef.current = awareness;
    awareness.setLocalStateField('user', {
      name: user?.full_name || user?.username || 'Collaborator',
      color: myColorRef.current,
    });

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

        // 3. Bind Y.Text & Awareness to Monaco editor model
        if (editorRef.current) {
          const model = editorRef.current.getModel();
          if (model) {
            // Bind Monaco with Yjs CRDT + Live Awareness (Cursors & Selections)
            const binding = new MonacoBinding(
              ytext,
              model,
              new Set([editorRef.current]),
              awareness
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
      if (origin === 'remote' || readOnly) return;

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

    // Broadcast local cursor/selection changes
    const handleAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === 'remote') return;
      const changedClients = added.concat(updated).concat(removed);
      const encoded = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
      socketClient.emit('yjs_awareness_update', {
        project_id: project.id,
        file_id: activeFile.id,
        awareness: uint8ArrayToBase64(encoded),
      });
    };

    doc.on('update', handleDocUpdate);
    awareness.on('update', handleAwarenessUpdate);

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

    const handleRemoteAwareness = (data) => {
      if (data.file_id === activeFile.id && data.awareness && awarenessRef.current) {
        try {
          const bytes = base64ToUint8Array(data.awareness);
          awarenessProtocol.applyAwarenessUpdate(awarenessRef.current, bytes, 'remote');
        } catch (err) {
          console.error('Remote awareness error:', err);
        }
      }
    };

    const handlePeersUpdate = (data) => {
      if (data.file_id === activeFile.id) {
        setActivePeers(data.peers || []);
      }
    };

    socketClient.on('yjs_sync_update', handleRemoteUpdate);
    socketClient.on('yjs_awareness_update', handleRemoteAwareness);
    socketClient.on('collab_peers_update', handlePeersUpdate);

    return () => {
      socketClient.off('yjs_sync_update', handleRemoteUpdate);
      socketClient.off('yjs_awareness_update', handleRemoteAwareness);
      socketClient.off('collab_peers_update', handlePeersUpdate);
      doc.off('update', handleDocUpdate);
      awareness.off('update', handleAwarenessUpdate);
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      awareness.destroy();
      awarenessRef.current = null;
      doc.destroy();
      socketClient.emit('collab_leave', {
        project_id: project.id,
        file_id: activeFile.id,
      });
    };
  }, [activeFile?.id, project.id, workspaceId, user, editorMounted, readOnly]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorMounted(true);

    // Track text selection for AI assistant
    editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel();
      if (model && e.selection) {
        const selected = model.getValueInRange(e.selection);
        setSelectedCode(selected);
      }
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

  const loadProjectMembers = async () => {
    setMembersLoading(true);
    try {
      const [projectResult, workspaceResult] = await Promise.all([
        projectService.getProject(workspaceId, project.id),
        workspaceService.getMembers(workspaceId),
      ]);
      setProjectMembers(projectResult.data.project.members || []);
      setWorkspaceMembers(workspaceResult.data.members || []);
    } catch (err) {
      showToast(`Could not load project members: ${err.message}`, 'error');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleAddProjectMember = async (event) => {
    event.preventDefault();
    if (!selectedMemberId) return;
    try {
      await projectService.addMember(
        workspaceId,
        project.id,
        Number(selectedMemberId),
        selectedMemberRole
      );
      setSelectedMemberId('');
      setSelectedMemberRole('viewer');
      await loadProjectMembers();
      showToast('Member assigned to project', 'success');
    } catch (err) {
      showToast(`Could not assign member: ${err.message}`, 'error');
    }
  };

  const eligibleMembers = workspaceMembers.filter(
    (member) =>
      ['developer', 'team_member', 'guest'].includes(member.role) &&
      !projectMembers.some((assigned) => assigned.user_id === member.user_id)
  );
  const canManageProjectMembers = effectiveRole === 'project_manager';

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
        readOnly={readOnly}
      />

      {/* Main Center Editor Area */}
      <div className="relative flex-1 flex flex-col h-full min-w-0 overflow-hidden">
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
            {canManageProjectMembers && (
              <>
                <button
                  data-project-access-ui
                  onClick={() => {
                    const opening = !showProjectMembers;
                    setShowProjectMembers(opening);
                    setShowProjectAccessUsers(false);
                    if (opening) loadProjectMembers();
                  }}
                  className="px-2 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700"
                >
                  Project access
                </button>
                <button
                  data-project-access-ui
                  onClick={() => {
                    const opening = !showProjectAccessUsers;
                    setShowProjectAccessUsers(opening);
                    setShowProjectMembers(false);
                    if (opening) loadProjectMembers();
                  }}
                  aria-label="Show project access users"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700"
                >
                  <Users className="h-3.5 w-3.5" />
                  Access users
                </button>
              </>
            )}
            {/* AI Assistant Toggle Button */}
            {!readOnly && <button
              onClick={() => setIsAiOpen(!isAiOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isAiOpen
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>AI Assistant</span>
            </button>}
          </div>
        </div>

        {showProjectMembers && canManageProjectMembers && (
          <section data-project-access-ui className="absolute right-3 top-16 z-20 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Project access</h2>
              <button onClick={() => setShowProjectMembers(false)} className="text-xs text-slate-400 hover:text-white">Close</button>
            </div>
            {membersLoading ? <p className="text-xs text-slate-400">Loading members...</p> : (
                <form onSubmit={handleAddProjectMember} className="space-y-2">
                  <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-white">
                    <option value="">Select workspace member</option>
                    {eligibleMembers.length === 0 ? (
                      <option value="" disabled>No eligible workspace members available</option>
                    ) : eligibleMembers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.user?.full_name || member.user?.username} · {member.role.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <select value={selectedMemberRole} onChange={(event) => setSelectedMemberRole(event.target.value)} className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-white">
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button disabled={!selectedMemberId} className="rounded-lg bg-indigo-600 px-2 py-1.5 text-white disabled:opacity-50" title="Assign project access">
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                </form>
            )}

          </section>
        )}

        {showProjectAccessUsers && canManageProjectMembers && (
              <section data-project-access-ui className="absolute right-3 top-16 z-20 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white">Users with project access</h2>
                  <button onClick={() => setShowProjectAccessUsers(false)} className="text-xs text-slate-400 hover:text-white">Close</button>
                </div>
                {membersLoading ? <p className="text-xs text-slate-400">Loading users...</p> : projectMembers.length === 0 ? (
                  <p className="text-xs text-slate-400">No access users have been assigned to this project yet.</p>
                ) : (
                  <div className="space-y-2">
                    {projectMembers.map((member) => (
                      <div key={member.user_id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs">
                        <span className="truncate text-slate-200">
                          {member.user?.full_name || member.user?.username || 'Workspace user'}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 capitalize text-slate-400">
                          {member.role}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Remove ${member.user?.full_name || member.user?.username || 'this user'} from project access?`)) {
                                projectService.removeMember(workspaceId, project.id, member.user_id)
                                  .then(loadProjectMembers)
                                  .then(() => showToast('Project access removed', 'success'))
                                  .catch((error) => showToast(`Could not remove project access: ${error.message}`, 'error'));
                              }
                            }}
                            className="rounded px-1.5 py-0.5 text-rose-400 hover:bg-rose-950/50"
                          >
                            Remove
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
        )}

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
                readOnly,
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
      {isAiOpen && !readOnly && (
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
