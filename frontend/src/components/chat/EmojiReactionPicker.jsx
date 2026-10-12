import React from 'react';

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '🚀', '🎉', '👀', '💯', '👏'];

export const EmojiReactionPicker = ({ onSelect, onClose }) => {
  return (
    <div className="absolute bottom-full mb-1 left-0 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-1.5 flex items-center gap-1 z-30 animate-in fade-in zoom-in-95">
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(emoji);
            onClose();
          }}
          className="w-7 h-7 rounded-lg hover:bg-slate-700 flex items-center justify-center text-sm transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiReactionPicker;
