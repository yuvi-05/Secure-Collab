import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { workspaceService } from '../services/workspaceService';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';

export const InviteAcceptPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { loadWorkspaces, selectWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      // Redirect to login preserving destination
      navigate(`/login?next=/invite/${token}`);
      return;
    }

    const acceptInvitation = async () => {
      try {
        const res = await workspaceService.joinViaToken(token);
        showToast('Successfully joined workspace!', 'success');
        await loadWorkspaces();
        selectWorkspace(res.data.workspace_id);
        navigate('/');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    acceptInvitation();
  }, [token, isAuthenticated, navigate, loadWorkspaces, selectWorkspace, showToast]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/40 mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>

        {loading ? (
          <div>
            <h2 className="text-lg font-bold text-white">Joining Workspace...</h2>
            <p className="text-xs text-slate-400 mt-1">Verifying your invitation token</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-rose-400 font-semibold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Invitation Error</span>
            </div>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">Welcome to the Team!</h2>
            <p className="text-xs text-slate-400">Redirecting to workspace...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteAcceptPage;
