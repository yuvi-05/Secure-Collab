import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Briefcase, ShieldCheck } from 'lucide-react';
import { workspaceService } from '../../services/workspaceService';
import { useToast } from '../../contexts/ToastContext';

const WorkspaceAdminPanel = ({ workspaceId }) => {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [maxHours, setMaxHours] = useState('unlimited');

  const formatDetails = (details) => {
    if (!details) return '';
    try {
      const parsed = typeof details === 'string' ? JSON.parse(details) : details;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return String(details);
      return Object.entries(parsed)
        .map(([key, value]) => {
          const label = key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
          const displayValue = Array.isArray(value)
            ? value.join(', ')
            : typeof value === 'boolean'
              ? (value ? 'Yes' : 'No')
              : String(value);
          return `${label}: ${displayValue}`;
        })
        .join(' · ');
    } catch {
      return String(details);
    }
  };

  const loadSummary = useCallback(async () => {
    try {
      const response = await workspaceService.getAdminSummary(workspaceId);
      setSummary(response.data);
      setMaxHours(response.data.emergency_access_max_hours);
    } catch (error) {
      showToast(`Could not load workspace administration: ${error.message}`, 'error');
    }
  }, [showToast, workspaceId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const updateProject = async (project) => {
    try {
      await workspaceService.updateProjectStatus(workspaceId, project.id, !project.is_active);
      showToast(`Project ${project.is_active ? 'deactivated' : 'activated'}`, 'success');
      loadSummary();
    } catch (error) {
      showToast(`Could not update project: ${error.message}`, 'error');
    }
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    const value = maxHours === 'unlimited' ? maxHours : Number(maxHours);
    try {
      await workspaceService.updateEmergencyAccessPolicy(workspaceId, value);
      showToast('Emergency access policy updated', 'success');
      loadSummary();
    } catch (error) {
      showToast(`Could not update policy: ${error.message}`, 'error');
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-950 p-6 text-slate-100">
      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Briefcase className="h-4 w-4 text-indigo-400" />
          Projects
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Create projects from the sidebar. Deactivated projects are hidden from workspace members.
        </p>
        <div className="divide-y divide-slate-800">
          {(summary?.projects || []).map((project) => (
            <div key={project.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-100">{project.name}</p>
                <p className="text-xs text-slate-400">{project.is_active ? 'Active' : 'Deactivated'}</p>
              </div>
              <button
                type="button"
                onClick={() => updateProject(project)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                {project.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
          {summary && summary.projects.length === 0 && (
            <p className="py-3 text-sm text-slate-400">No projects in this workspace yet.</p>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-white">
          <ShieldCheck className="h-4 w-4 text-amber-400" />
          Emergency Access Policy
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Set the maximum duration an owner may grant for a temporary emergency role.
        </p>
        <form onSubmit={savePolicy} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-300">
            Maximum grant duration
            <select
              value={maxHours}
              onChange={(event) => setMaxHours(event.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {[1, 4, 8, 12, 24, 72, 168, 720].map((hours) => (
                <option key={hours} value={hours}>{hours} hours</option>
              ))}
              <option value="unlimited">No maximum</option>
            </select>
          </label>
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
            Save policy
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Activity className="h-4 w-4 text-emerald-400" />
          Workspace Audit History
        </h2>
        <div className="space-y-2">
          {(summary?.audit_logs || []).map((entry) => (
            <article key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="text-xs font-semibold text-slate-200">
                  {entry.actor?.full_name || entry.actor?.username || 'Workspace member'} · {entry.action.replaceAll('.', ' ')}
                </p>
                <time className="text-[11px] text-slate-500">
                  {new Date(entry.created_at).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {entry.target_type} {entry.target_id}
                {entry.details && ` · ${formatDetails(entry.details)}`}
              </p>
            </article>
          ))}
          {summary && summary.audit_logs.length === 0 && (
            <p className="text-sm text-slate-400">No workspace audit events yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default WorkspaceAdminPanel;
