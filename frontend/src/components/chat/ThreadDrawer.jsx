import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare } from 'lucide-react';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';
import { messageService } from '../../services/messageService';
import socketClient from '../../socket/socketClient';

export const ThreadDrawer = ({
  workspaceId,
  parentMessage,
  currentUserId,
  onClose,
  onReact,
}) => {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const repliesEndRef = useRef(null);

  useEffect(() => {
    if (!parentMessage) return;

    // Join thread socket room
    const threadRoom = `thread_${parentMessage.id}`;
    socketClient.joinRoom(threadRoom);

    const fetchReplies = async () => {
      try {
        setLoading(true);
        const res = await messageService.getMessages(workspaceId, {
          parent_id: parentMessage.id,
        });
        setReplies(res.data.messages || []);
      } catch (err) {
        console.error('Failed to load thread replies:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReplies();

    const handleNewReply = (newMsg) => {
      if (newMsg.parent_id === parentMessage.id) {
        setReplies((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    };

    socketClient.on('message_new', handleNewReply);

    return () => {
      socketClient.leaveRoom(threadRoom);
      socketClient.off('message_new', handleNewReply);
    };
  }, [workspaceId, parentMessage]);

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleSendReply = async ({ content, attachment_ids }) => {
    try {
      await messageService.sendMessage(workspaceId, {
        parent_id: parentMessage.id,
        content,
        attachment_ids,
      });
    } catch (err) {
      console.error('Error sending reply:', err);
    }
  };

  if (!parentMessage) return null;

  return (
    <aside className="w-80 lg:w-96 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shrink-0">
      {/* Thread Header */}
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span>Thread</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent Message Preview */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <MessageItem
          message={parentMessage}
          currentUserId={currentUserId}
          onReact={onReact}
          onOpenThread={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </div>

      {/* Replies Stream */}
      <div className="flex-1 overflow-y-auto py-2 divide-y divide-slate-100 dark:divide-slate-800/40">
        {loading ? (
          <div className="p-4 text-center text-xs text-slate-400">Loading replies...</div>
        ) : replies.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No replies yet. Start the conversation!
          </div>
        ) : (
          replies.map((reply) => (
            <MessageItem
              key={reply.id}
              message={reply}
              currentUserId={currentUserId}
              onReact={onReact}
              onOpenThread={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ))
        )}
        <div ref={repliesEndRef} />
      </div>

      {/* Reply Input */}
      <MessageInput
        workspaceId={workspaceId}
        onSendMessage={handleSendReply}
        placeholder="Reply in thread..."
      />
    </aside>
  );
};

export default ThreadDrawer;
