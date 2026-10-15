import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Search,
  FileText,
  Download,
  Trash2,
  Eye,
  FileCode,
  Image as ImageIcon,
} from 'lucide-react';
import { fileService } from '../../services/fileService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import FilePreviewModal from './FilePreviewModal';

export const FileManager = ({ workspaceId, readOnly = false }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fileService.listFiles(workspaceId, searchQuery);
      setFiles(res.data.files || []);
    } catch (err) {
      showToast('Failed to load files: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, searchQuery, showToast]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUploadFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const f of fileList) {
        await fileService.uploadFile(workspaceId, f);
      }
      showToast('Files uploaded successfully!', 'success');
      loadFiles();
    } catch (err) {
      showToast('Upload error: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await fileService.deleteFile(workspaceId, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      showToast('File deleted', 'success');
    } catch (err) {
      showToast('Delete error: ' + err.message, 'error');
    }
  };

  const getIcon = (contentType, name) => {
    if (contentType?.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-400" />;
    if (name?.endsWith('.py') || name?.endsWith('.js') || name?.endsWith('.json')) {
      return <FileCode className="w-5 h-5 text-emerald-400" />;
    }
    return <FileText className="w-5 h-5 text-amber-400" />;
  };

  return (
    <div className="flex-1 h-full flex flex-col p-6 overflow-y-auto bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Shared Files & Documents</h1>
          <p className="text-xs text-slate-400 mt-1">
            Securely access, upload, and preview files shared in this workspace.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      {!readOnly && <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleUploadFiles(e.dataTransfer.files);
        }}
        className={`mb-6 p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
        }`}
      >
        <Upload className="w-8 h-8 text-indigo-400 mb-2" />
        <p className="text-sm font-semibold text-slate-200">
          {uploading ? 'Uploading files...' : 'Drag and drop files here, or browse'}
        </p>
        <p className="text-xs text-slate-500 mt-1">Supports code files, images, PDFs, text up to 50MB</p>
        <label className="mt-3 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-indigo-600/30 transition-all">
          Browse Files
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />
        </label>
      </div>}

      {/* Files Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-sm">No files uploaded yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="group bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all hover:shadow-xl"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-slate-800 shrink-0">
                    {getIcon(file.content_type, file.filename)}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewFile(file)}
                      title="Preview"
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={file.download_url}
                      download
                      title="Download"
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {!readOnly && (file.user_id === user?.id || user?.id === 1) && (
                      <button
                        onClick={() => handleDelete(file.id)}
                        title="Delete"
                        className="p-1.5 rounded-lg hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <h3
                  onClick={() => setPreviewFile(file)}
                  className="font-semibold text-sm text-slate-200 truncate cursor-pointer hover:text-indigo-400 transition-colors"
                  title={file.filename}
                >
                  {file.filename}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>{(file.file_size / 1024).toFixed(1)} KB</span>
                <span className="truncate max-w-[100px]">
                  by {file.uploader?.username || 'member'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          file={previewFile}
        />
      )}
    </div>
  );
};

export default FileManager;
