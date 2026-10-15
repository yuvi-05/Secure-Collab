import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, X } from 'lucide-react';
import { fileService } from '../../services/fileService';
import { useToast } from '../../contexts/ToastContext';
import EmojiReactionPicker from './EmojiReactionPicker';

export const MessageInput = ({ workspaceId, onSendMessage, onTypingStart, onTypingStop, placeholder }) => {
  const { showToast } = useToast();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!showEmojiPicker) return undefined;

    const handleOutsideClick = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showEmojiPicker]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e) => {
    setContent(e.target.value);
    if (onTypingStart) {
      onTypingStart();
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (onTypingStop) onTypingStop();
      }, 2000);
    }
  };

  const processFiles = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const res = await fileService.uploadFile(workspaceId, file);
        setAttachments((prev) => [...prev, res.data.file]);
      }
      showToast('Attachment uploaded', 'success');
    } catch (err) {
      showToast('File upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e) => {
    processFiles(e.target.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!content.trim() && attachments.length === 0) return;

    onSendMessage({
      content: content.trim(),
      attachment_ids: attachments.map((a) => a.id),
    });

    setContent('');
    setAttachments([]);
    if (onTypingStop) onTypingStop();
  };

  const insertEmoji = (emoji) => {
    setContent((previous) => `${previous}${emoji}`);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-3 bg-white dark:bg-slate-900 border-t transition-colors ${
        isDragging
          ? 'border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/20'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Uploaded Attachments Preview Chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200"
            >
              <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
              <span className="truncate max-w-[150px]">{att.filename}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Box */}
      <form
        onSubmit={handleSubmit}
        className={`flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border transition-colors ${
          isDragging
            ? 'border-indigo-500 ring-2 ring-indigo-500/30'
            : 'border-slate-200 dark:border-slate-700/80 focus-within:border-indigo-500'
        }`}
      >
        {/* Attachment Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Upload File"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <div ref={emojiPickerRef} className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((previous) => !previous)}
            title="Add Emoji"
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Smile className="w-4 h-4" />
          </button>
          {showEmojiPicker && (
            <EmojiReactionPicker
              onSelect={insertEmoji}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          multiple
        />

        {/* Text Input */}
        <input
          type="text"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Send a message...'}
          className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!content.trim() && attachments.length === 0}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-all shadow-md shadow-indigo-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
