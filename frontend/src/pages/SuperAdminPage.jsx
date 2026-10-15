import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, Plus, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { workspaceService } from '../services/workspaceService';

export const SuperAdminPage = () => {
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [workspaces, setWorkspaces] = useState(null);
  const [personalProjects, setPersonalProjects] = useState([]);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const loading = workspaces === null;
  const workspaceList = workspaces || [];

  const loadData = useCallback(async () => {
    try {
      const [workspaceResponse, userResponse, projectResponse] = await Promise.all([
        workspaceService.listAdminWorkspaces(),
        workspaceService.listAdminUsers(),
        workspaceService.listPersonalProjects(),
      ]);
      const availableUsers = userResponse.data.users || [];
      setWorkspaces(workspaceResponse.data.workspaces || []);
      setUsers(availableUsers);
      setPersonalProjects(projectResponse.data.projects || []);
      setOwnerId((current) => current || String(availableUsers[0]?.id || ''));
    } catch (error) {
      showToast(`Could not load workspace administration: ${error.message}`, 'error');
      setWorkspaces((current) => current || []);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createWorkspace = async (event) => {
    event.preventDefault();
    try {
      await workspaceService.createWorkspace({
        name: name.trim(),
        description: description.trim(),
        owner_id: Number(ownerId),
      });
      setName('');
      setDescription('');
      showToast('Workspace created', 'success');
      await loadData();
    } catch (error) {
      showToast(`Workspace could not be created: ${error.message}`, 'error');
    }
  };

  const changeOwner = async (workspaceId, nextOwnerId) => {
    try {
      const response = await workspaceService.updateWorkspaceOwner(workspaceId, Number(nextOwnerId));
      const updatedWorkspace = response.data.workspace;
      setWorkspaces((current) => current.map((workspace) => (
        workspace.id === workspaceId ? updatedWorkspace : workspace
      )));
      showToast('Workspace owner updated', 'success');
    } catch (error) {
      showToast(`Owner could not be updated: ${error.message}`, 'error');
      await loadData();
    }
  };

  const deleteWorkspace = async (workspace) => {
    if (!window.confirm(`Delete "${workspace.name}" and all of its workspace data? This cannot be undone.`)) {
      return;
    }
    try {
      await workspaceService.deleteWorkspace(workspace.id);
      setWorkspaces((current) => current.filter((item) => item.id !== workspace.id));
      showToast('Workspace deleted', 'success');
    } catch (error) {
      showToast(`Workspace could not be deleted: ${error.message}`, 'error');
    }
  };

  const deletePersonalProject = async (project) => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await workspaceService.deletePersonalProject(project.id);
      setPersonalProjects((current) => current.filter((item) => item.id !== project.id));
      showToast('Personal project deleted', 'success');
    } catch (error) {
      showToast(`Project could not be deleted: ${error.message}`, 'error');
    }
  };

  const warnPersonalProject = async (project) => {
    const message = window.prompt(`Warning for ${project.name}:`);
    if (!message?.trim()) return;
    try {
      await workspaceService.warnPersonalProject(project.id, message.trim());
      showToast('Warning sent to project owner', 'success');
    } catch (error) {
      showToast(`Warning could not be sent: ${error.message}`, 'error');
    }
  };

  const filteredWorkspaces = workspaceList.filter((workspace) =>
    `${workspace.name} ${workspace.description} ${workspace.owner?.full_name} ${workspace.owner?.username}`
      .toLowerCase().includes(workspaceSearch.toLowerCase())
  );
  const filteredProjects = personalProjects.filter((project) =>
    `${project.name} ${project.owner?.full_name} ${project.owner?.username} ${project.workspace_name}`
      .toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <main className="min-h-screen overflow-y-auto bg-slate-100 p-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-indigo-600 p-3 text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold">Platform Administration</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manage workspaces and their owners.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </header>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Plus className="h-5 w-5 text-indigo-500" /> Create workspace
          </h2>
          {users.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create a regular user account before creating a workspace.
            </p>
          ) : (
            <form onSubmit={createWorkspace} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Workspace name
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="text-sm font-medium">
                Initial owner
                <select
                  required
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  {users.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.full_name || candidate.username}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Description
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <button
                type="submit"
                disabled={!ownerId}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 sm:col-span-2 sm:justify-self-end"
              >
                Create workspace
              </button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-indigo-500" /> Workspaces ({workspaceList.length})
            </h2>
            <button
              type="button"
              disabled={refreshing}
              aria-label="Refresh workspaces"
              onClick={() => {
                setRefreshing(true);
                loadData().finally(() => setRefreshing(false));
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <input
            value={workspaceSearch}
            onChange={(event) => setWorkspaceSearch(event.target.value)}
            placeholder="Search workspaces..."
            className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          {loading ? (
            <p className="text-sm text-slate-500">Loading workspaces...</p>
          ) : filteredWorkspaces.length === 0 ? (
            <p className="text-sm text-slate-500">No workspaces created yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredWorkspaces.map((workspace) => (
                <li key={workspace.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{workspace.name}</h3>
                    <p className="text-xs text-slate-500">
                      {workspace.description || 'No description'} · {workspace.member_count} members
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span>Owner</span>
                    <select
                      value={workspace.owner_id || ''}
                      onChange={(event) => changeOwner(workspace.id, event.target.value)}
                      aria-label={`Change owner for ${workspace.name}`}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      {users.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.full_name || candidate.username}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteWorkspace(workspace)}
                    aria-label={`Delete ${workspace.name}`}
                    title="Delete workspace"
                    className="self-end rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 sm:self-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-indigo-500" /> Personal projects ({filteredProjects.length})
          </h2>
          <input
            value={projectSearch}
            onChange={(event) => setProjectSearch(event.target.value)}
            placeholder="Search personal projects or users..."
            className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          {filteredProjects.length === 0 ? (
            <p className="text-sm text-slate-500">No personal projects found.</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredProjects.map((project) => (
                <li key={project.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{project.name}</h3>
                    <p className="text-xs text-slate-500">
                      {project.owner?.full_name || project.owner?.username || 'Unknown owner'} · {project.workspace_name}
                    </p>
                  </div>
                  <button type="button" onClick={() => warnPersonalProject(project)} className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30">
                    Warn
                  </button>
                  <button type="button" onClick={() => deletePersonalProject(project)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40" title="Delete personal project">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
};

export default SuperAdminPage;
