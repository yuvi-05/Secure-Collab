import React, { useState, useEffect } from 'react';
import { Download, X, FileText } from 'lucide-react';
import Modal from '../common/Modal';
import api from '../../services/api';

export const FilePreviewModal = ({ isOpen, onClose, file }) => {
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file || !isOpen) return;

    const isText =
      file.content_type?.startsWith('text/') ||
      file.filename.endsWith('.txt') ||
      file.filename.endsWith('.json') ||
      file.filename.endsWith('.py') ||
      file.filename.endsWith('.js') ||
      file.filename.endsWith('.md');

    if (isText) {
      setLoading(true);
      fetch(file.preview_url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then((res) => res.text())
        .then((text) => setTextContent(text))
        .catch(() => setTextContent('Failed to load file preview.'))
        .finally(() => setLoading(false));
    }
  }, [file, isOpen]);

  if (!file) return null;

  const isImage = file.content_type?.startsWith('image/');
  const isPdf = file.content_type === 'application/pdf';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={file.filename} maxWidth="max-w-4xl">
      <div className="space-y-4">
        {/* Media or Text Container */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[600px] p-2">
          {isImage ? (
            <img
              src={file.preview_url}
              alt={file.filename}
              className="max-h-[550px] max-w-full object-contain rounded-lg"
            />
          ) : isPdf ? (
            <iframe
              src={file.preview_url}
              title={file.filename}
              className="w-full h-[550px] border-0 rounded-lg"
            />
          ) : loading ? (
            <div className="text-xs text-slate-400">Loading preview...</div>
          ) : textContent ? (
            <pre className="p-4 font-mono text-xs text-slate-300 w-full h-[500px] overflow-auto whitespace-pre-wrap select-text">
              {textContent}
            </pre>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <FileText className="w-12 h-12 stroke-[1.2]" />
              <p className="text-xs">Inline preview not supported for this file type.</p>
            </div>
          )}
        </div>

        {/* Footer with Metadata & Download */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <div>
            Size: {(file.file_size / 1024).toFixed(1)} KB • Uploaded by{' '}
            <span className="font-semibold text-slate-200">
              {file.uploader?.username || 'Member'}
            </span>
          </div>
          <a
            href={file.download_url}
            download
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-md shadow-indigo-600/30"
          >
            <Download className="w-4 h-4" />
            Download File
          </a>
        </div>
      </div>
    </Modal>
  );
};

export default FilePreviewModal;
