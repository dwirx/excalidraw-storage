import React, { useState } from 'react';

const FileManager = ({
  files,
  currentFile,
  onCreateFile,
  onLoadFile,
  onDeleteFile,
  onDuplicateFile,
  onRenameFile
}) => {
  const [newFileName, setNewFileName] = useState('');
  const [editingFile, setEditingFile] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleCreateFile = (e) => {
    e.preventDefault();
    if (newFileName.trim()) {
      onCreateFile(newFileName.trim());
      setNewFileName('');
    }
  };

  const handleStartRename = (file) => {
    setEditingFile(file.id);
    setEditingName(file.name);
  };

  const handleFinishRename = () => {
    if (editingName.trim() && editingFile) {
      onRenameFile(editingFile, editingName.trim());
    }
    setEditingFile(null);
    setEditingName('');
  };

  const handleCancelRename = () => {
    setEditingFile(null);
    setEditingName('');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <form className="new-file-form" onSubmit={handleCreateFile}>
        <input
          type="text"
          className="new-file-input"
          placeholder="Nama file baru..."
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
        />
      </form>

      <div className="file-list">
        {files.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#888',
            fontSize: '14px'
          }}>
            Belum ada file. Buat file baru dengan mengetik nama di atas.
          </div>
        ) : (
          files
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .map((file) => (
              <div
                key={file.id}
                className={`file-item ${currentFile?.id === file.id ? 'active' : ''}`}
                onClick={() => !editingFile && onLoadFile(file.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingFile === file.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleFinishRename();
                        } else if (e.key === 'Escape') {
                          handleCancelRename();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        background: 'transparent',
                        border: '1px solid #666',
                        color: '#fff',
                        padding: '2px 4px',
                        fontSize: '14px',
                        width: '100%',
                        borderRadius: '2px'
                      }}
                    />
                  ) : (
                    <>
                      <div className="file-name" title={file.name}>
                        {file.name}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#888', 
                        marginTop: '2px' 
                      }}>
                        {formatDate(file.updatedAt)}
                      </div>
                    </>
                  )}
                </div>

                {editingFile !== file.id && (
                  <div className="file-actions">
                    <button
                      className="file-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(file);
                      }}
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button
                      className="file-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateFile(file.id);
                      }}
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      className="file-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(file.id);
                      }}
                      title="Delete"
                      style={{ color: '#ff6b6b' }}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))
        )}
      </div>
    </>
  );
};

export default FileManager;
