import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export const WorkspaceSwitcher = ({ onOpenProfile, onToggleNavigation, navigationVisible }) => {
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  return (
    <aside className="relative h-full w-16 shrink-0 border-r border-slate-800 bg-slate-900 py-3 flex flex-col items-center gap-3 select-none dark:bg-slate-950">
      {/* Workspaces List */}
      <div className="flex-1 w-full flex flex-col items-center gap-2.5 overflow-y-auto no-scrollbar py-1">
        {workspaces.map((ws) => {
          const isActive = currentWorkspace?.id === ws.id;
          return (
            <button
              key={ws.id}
              aria-expanded={isActive ? navigationVisible : undefined}
              onClick={() => {
                if (isActive) onToggleNavigation();
                else selectWorkspace(ws.id);
              }}
              title={isActive ? `${ws.name} (hide navigation)` : ws.name}
              className={`relative group w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white hover:rounded-xl'
              }`}
            >
              {/* Active Indicator Bar on Left */}
              {isActive && (
                <span className="absolute -left-3.5 w-1.5 h-6 bg-white rounded-r-full" />
              )}
              {ws.name.substring(0, 2).toUpperCase()}
            </button>
          );
        })}

      </div>

      {/* Bottom utility controls */}
      <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-800/80 w-full">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>

        {/* Profile */}
        <button
          onClick={onOpenProfile}
          title="Profile"
          className="w-10 h-10 rounded-xl bg-slate-800 hover:ring-2 hover:ring-indigo-500 flex items-center justify-center text-sm font-semibold text-slate-200 transition-all overflow-hidden"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            (user?.username?.[0] || 'U').toUpperCase()
          )}
        </button>
      </div>
    </aside>
  );
};

export default WorkspaceSwitcher;
