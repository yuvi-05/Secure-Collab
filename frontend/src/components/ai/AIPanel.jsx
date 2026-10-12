import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  Code2,
  Bug,
  RefreshCw,
  CheckCircle,
  Copy,
  ArrowRight,
  GitCompare,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { useToast } from '../../contexts/ToastContext';
import AIDiffModal from './AIDiffModal';

export const AIPanel = ({
  workspaceId,
  projectId,
  activeFile,
  selectedCode,
  onApplyCode,
  onClose,
}) => {
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [includeProjectContext, setIncludeProjectContext] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [diffModal, setDiffModal] = useState({ isOpen: false, diff: '', code: '' });

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load previous conversation history for project
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await aiService.listConversations(workspaceId, projectId);
        const convs = res.data?.conversations || [];
        if (convs.length > 0) {
          const latest = await aiService.getConversation(workspaceId, convs[0].id);
          setCurrentConversationId(latest.data.conversation.id);
          setMessages(latest.data.conversation.messages || []);
        } else {
          // Welcome greeting
          setMessages([
            {
              id: 'welcome',
              sender: 'assistant',
              content:
                "👋 Hi! I'm your Secure-Collab AI Coding Assistant. Select code and click **Explain**, **Debug**, or **Refactor**, or ask any programming question below!",
            },
          ]);
        }
      } catch (err) {
        console.warn('Could not load AI history:', err);
      }
    };

    loadHistory();
  }, [workspaceId, projectId]);

  const handleSend = async (actionType = 'custom', customPrompt = '') => {
    const textToSend = customPrompt || prompt;
    if (!textToSend.trim() && actionType === 'custom') return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      content: textToSend || `Action: ${actionType}`,
      code_context: selectedCode || (activeFile ? activeFile.name : null),
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const res = await aiService.chatWithAI(workspaceId, {
        prompt: textToSend,
        action: actionType,
        code_context: selectedCode || (activeFile ? activeFile.content : ''),
        filename: activeFile?.name || '',
        language: activeFile?.language || '',
        project_id: projectId,
        conversation_id: currentConversationId,
        include_project_context: includeProjectContext,
      });

      const { message, conversation_id } = res.data;
      setCurrentConversationId(conversation_id);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      showToast('AI Request failed: ' + err.message, 'error');
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'assistant',
          content: '⚠️ Failed to reach AI service: ' + err.message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Code copied to clipboard!', 'success');
  };

  const extractCodeBlocks = (content) => {
    const blocks = [];
    const regex = /```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      blocks.push(match[1]);
    }
    return blocks;
  };

  return (
    <aside className="w-80 lg:w-96 h-full bg-slate-900 border-l border-slate-800 flex flex-col z-20 shrink-0">
      {/* Panel Header */}
      <div className="h-10 px-4 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>AI Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Pills */}
      <div className="p-2.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap gap-1.5 text-xs">
        <button
          disabled={loading}
          onClick={() => handleSend('explain', 'Explain this code in detail')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600/30 hover:text-indigo-300 text-slate-300 transition-colors disabled:opacity-50"
        >
          <Code2 className="w-3 h-3 text-indigo-400" />
          Explain
        </button>
        <button
          disabled={loading}
          onClick={() => handleSend('debug', 'Identify bugs and suggest fixes')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600/30 hover:text-rose-300 text-slate-300 transition-colors disabled:opacity-50"
        >
          <Bug className="w-3 h-3 text-rose-400" />
          Debug
        </button>
        <button
          disabled={loading}
          onClick={() => handleSend('refactor', 'Refactor and modernize this code')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600/30 hover:text-emerald-300 text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-3 h-3 text-emerald-400" />
          Refactor
        </button>
        <button
          disabled={loading}
          onClick={() => handleSend('test', 'Generate unit tests for this code')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-600/30 hover:text-amber-300 text-slate-300 transition-colors disabled:opacity-50"
        >
          <CheckCircle className="w-3 h-3 text-amber-400" />
          Tests
        </button>
      </div>

      {/* Context Badge */}
      <div className="px-3 py-1.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate">
          Context: {selectedCode ? 'Selection' : activeFile ? activeFile.name : 'None'}
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 hover:text-slate-200">
          <input
            type="checkbox"
            checked={includeProjectContext}
            onChange={(e) => setIncludeProjectContext(e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-3 h-3"
          />
          All files
        </label>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {messages.map((m, idx) => {
          const isUser = m.sender === 'user';
          const codeBlocks = extractCodeBlocks(m.content);

          return (
            <div
              key={m.id || idx}
              className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] p-3 rounded-2xl ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-none shadow-sm'
                }`}
              >
                {/* Code Context Preview if User */}
                {isUser && m.code_context && (
                  <div className="mb-2 p-1.5 rounded bg-indigo-700/60 font-mono text-[10px] truncate max-w-full">
                    📎 {m.code_context.substring(0, 50)}...
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                  {m.content}
                </div>

                {/* Diff Review or Insert Actions for Code Blocks */}
                {!isUser && (m.suggested_diff || codeBlocks.length > 0) && (
                  <div className="mt-3 pt-2 border-t border-slate-700/80 flex flex-wrap gap-2">
                    {m.suggested_diff && (
                      <button
                        onClick={() =>
                          setDiffModal({
                            isOpen: true,
                            diff: m.suggested_diff,
                            code: codeBlocks[0] || '',
                          })
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-medium text-[11px] transition-colors"
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                        Review Diff
                      </button>
                    )}
                    {codeBlocks.map((blk, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(blk)}
                          title="Copy Code"
                          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px]"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                        <button
                          onClick={() => onApplyCode(blk, false)}
                          title="Insert Code at Cursor"
                          className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-medium text-[11px]"
                        >
                          <ArrowRight className="w-3 h-3" />
                          Insert
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 p-3 bg-slate-850 rounded-2xl text-slate-400 text-xs animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            <span>AI is analyzing and generating code...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Prompt Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend('custom');
        }}
        className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask a question or describe code..."
          disabled={loading}
          className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shadow-indigo-600/30"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Review Diff Modal */}
      <AIDiffModal
        isOpen={diffModal.isOpen}
        onClose={() => setDiffModal({ isOpen: false, diff: '', code: '' })}
        diff={diffModal.diff}
        suggestedCode={diffModal.code}
        onApply={() => onApplyCode(diffModal.code, true)}
      />
    </aside>
  );
};

export default AIPanel;
