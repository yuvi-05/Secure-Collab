import React from 'react';

export const Avatar = ({ name = 'User', src = '', size = 'md', isOnline = false, className = '' }) => {
  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const indicatorSizes = {
    xs: 'w-1.5 h-1.5 right-0 bottom-0',
    sm: 'w-2 h-2 right-0 bottom-0',
    md: 'w-2.5 h-2.5 right-0 bottom-0',
    lg: 'w-3 h-3 right-0.5 bottom-0.5',
    xl: 'w-4 h-4 right-1 bottom-1',
  };

  const initials = (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Pick deterministic pastel color based on name
  const colors = [
    'bg-indigo-600',
    'bg-purple-600',
    'bg-sky-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-teal-600',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClasses[size] || sizeClasses.md} rounded-xl object-cover ring-1 ring-white/10`}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      ) : (
        <div
          className={`${sizeClasses[size] || sizeClasses.md} ${color} rounded-xl flex items-center justify-center font-bold text-white shadow-sm ring-1 ring-white/10`}
        >
          {initials}
        </div>
      )}
      {isOnline !== undefined && (
        <span
          className={`absolute rounded-full border-2 border-slate-900 ${
            isOnline ? 'bg-emerald-400' : 'bg-slate-400'
          } ${indicatorSizes[size] || indicatorSizes.md}`}
        />
      )}
    </div>
  );
};

export default Avatar;
