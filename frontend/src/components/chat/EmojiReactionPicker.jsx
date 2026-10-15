import React from 'react';

const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🫡', '🤭', '🤫', '🤥', '😶', '🫠', '🙄', '😬', '😮',
  '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷',
  '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✍️', '💪', '🫶',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '🔥', '✨', '⭐', '🌟', '💯', '✅', '❌', '⚠️', '💡', '🎉',
  '🎊', '🎈', '🚀', '👀', '💬', '💭', '📌', '📎', '🎯', '🏆',
  '⚡', '☀️', '🌙', '🌈', '☕', '🍕', '🍔', '🍎', '⚽', '🎵',
];

export const EmojiReactionPicker = ({ onSelect, onClose, placement = 'top' }) => {
  return (
    <div className={`absolute left-0 w-72 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 grid grid-cols-10 gap-1 z-[200] animate-in fade-in zoom-in-95 ${
      placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
    }`}>
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(emoji);
            onClose();
          }}
          className="w-6 h-6 rounded-lg hover:bg-slate-700 flex items-center justify-center text-base transition-transform hover:scale-125"
          title={`Add ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiReactionPicker;
