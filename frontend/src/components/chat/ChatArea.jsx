import React, { useState, useEffect, useRef } from 'react';
import { Hash, Lock, Users, MessageSquare } from 'lucide-react';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';
import ThreadDrawer from './ThreadDrawer';
import { messageService } from '../../services/messageService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import socketClient from '../../socket/socketClient';

export const ChatArea = ({ workspaceId, channel, conversation }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());

  const messagesEndRef = useRef(null);

  const targetRoom = channel ? `channel_${channel.id}` : conversation ? `conversation_${conversation.id}` : null;

  // Load message history
  useEffect(() => {
    if (!workspaceId || (!channel && !conversation)) return;

    setActiveThread(null);
    setTypingUsers(new Set());

    const fetchMessages = async () => {
      try {
        setLoading(true);
        const params = {};
        if (channel) params.channel_id = channel.id;
        if (conversation) params.conversation_id = conversation.id;

        const res = await messageService.getMessages(workspaceId, params);
        setMessages(res.data.messages || []);
      } catch (err) {
        showToast('Error loading messages: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [workspaceId, channel?.id, conversation?.id, showToast]);

  // Socket event listeners for real-time delivery
  useEffect(() => {
    if (!targetRoom) return;

    const handleNewMessage = (newMsg) => {
      if (newMsg.parent_id) return; // Replies are handled in thread drawer
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    };

    const handleUpdatedMessage = (updatedMsg) => {
      setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
    };

    const handleDeletedMessage = ({ message_id }) => {
      setMessages((prev) => prev.filter((m) => m.id !== message_id));
    };

    const handleReaction = ({ message_id, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message_id ? { ...m, reactions } : m))
      );
    };

    const handleTyping = ({ username }) => {
      setTypingUsers((prev) => new Set(prev).add(username));
    };

    const handleStoppedTyping = ({ username }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    };

    socketClient.on('message_new', handleNewMessage);
    socketClient.on('message_updated', handleUpdatedMessage);
    socketClient.on('message_deleted', handleDeletedMessage);
    socketClient.on('message_reaction', handleReaction);
    socketClient.on('user_typing', handleTyping);
    socketClient.on('user_stopped_typing', handleStoppedTyping);

    return () => {
      socketClient.off('message_new', handleNewMessage);
      socketClient.off('message_updated', handleUpdatedMessage);
      socketClient.off('message_deleted', handleDeletedMessage);
      socketClient.off('message_reaction', handleReaction);
      socketClient.off('user_typing', handleTyping);
      socketClient.off('user_stopped_typing', handleStoppedTyping);
    };
  }, [targetRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async ({ content, attachment_ids }) => {
    try {
      const payload = {
        content,
        attachment_ids,
        channel_id: channel?.id,
        conversation_id: conversation?.id,
      };
      await messageService.sendMessage(workspaceId, payload);
    } catch (err) {
      showToast('Send message failed: ' + err.message, 'error');
    }
  };

  const handleReact = async (messageId, emoji) => {
    try {
      await messageService.toggleReaction(workspaceId, messageId, emoji);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = async (messageId, content) => {
    try {
      await messageService.editMessage(workspaceId, messageId, content);
    } catch (err) {
      showToast('Edit failed: ' + err.message, 'error');
    }
  };

  const handleDelete = async (messageId) => {
    try {
      await messageService.deleteMessage(workspaceId, messageId);
      showToast('Message deleted', 'success');
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  };

  const handleTypingStart = () => {
    if (targetRoom) {
      socketClient.emit('typing_start', {
        room: targetRoom,
        username: user?.username,
        user_id: user?.id,
      });
    }
  };

  const handleTypingStop = () => {
    if (targetRoom) {
      socketClient.emit('typing_stop', {
        room: targetRoom,
        username: user?.username,
        user_id: user?.id,
      });
    }
  };

  return (
    <div className="flex-1 h-full flex flex-row overflow-hidden bg-white dark:bg-slate-950">
      {/* Main Conversation Stream */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-1">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              <p className="font-semibold text-slate-300">This is the start of the conversation.</p>
              <p className="text-xs text-slate-500 mt-1">Send a message to get started.</p>
            </div>
          ) : (
            messages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                currentUserId={user?.id}
                onReact={handleReact}
                onOpenThread={(msg) => setActiveThread(msg)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}

          {/* Typing Indicator Bar */}
          {typingUsers.size > 0 && (
            <div className="px-4 py-1 text-[11px] text-slate-400 italic animate-pulse">
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <MessageInput
          workspaceId={workspaceId}
          onSendMessage={handleSendMessage}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          placeholder={channel ? `Message #${channel.name}` : 'Send a direct message...'}
        />
      </div>

      {/* Thread Drawer (if thread is selected) */}
      {activeThread && (
        <ThreadDrawer
          workspaceId={workspaceId}
          parentMessage={activeThread}
          currentUserId={user?.id}
          onClose={() => setActiveThread(null)}
          onReact={handleReact}
        />
      )}
    </div>
  );
};

export default ChatArea;
