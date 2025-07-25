import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Excalidraw, exportToCanvas, exportToSvg, exportToBlob } from '@excalidraw/excalidraw';
import FileManager from './components/FileManager';
import ToastContainer, { showToast } from './components/ToastContainer';

const App = () => {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
  const [initialData, setInitialData] = useState({ elements: [], appState: {} });
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const exportButtonRef = useRef(null);

  // PWA and offline status management
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Back online! Your changes will be synced.', 'success');
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('You are offline. Your work will be saved locally.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if PWA is installed
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://')) {
      setIsPWAInstalled(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync offline data when coming back online
  const syncOfflineData = useCallback(async () => {
    try {
      const offlineChanges = localStorage.getItem('excalidraw-offline-changes');
      if (offlineChanges) {
        const changes = JSON.parse(offlineChanges);
        // Process offline changes
        console.log('Syncing offline changes:', changes);
        localStorage.removeItem('excalidraw-offline-changes');
        showToast('Offline changes synced successfully!', 'success');
      }
    } catch (error) {
      console.error('Error syncing offline data:', error);
      showToast('Error syncing offline changes', 'error');
    }
  }, []);

  // Enhanced save function with offline support
  const saveWithOfflineSupport = useCallback(async (fileData) => {
    try {
      // Always save to localStorage first
      const savedFiles = localStorage.getItem('excalidraw-files');
      let existingFiles = savedFiles ? JSON.parse(savedFiles) : [];
      
      const fileIndex = existingFiles.findIndex(f => f.id === fileData.id);
      if (fileIndex >= 0) {
        existingFiles[fileIndex] = fileData;
      } else {
        existingFiles.push(fileData);
      }
      
      localStorage.setItem('excalidraw-files', JSON.stringify(existingFiles));
      
      // If offline, add to offline changes queue
      if (!isOnline) {
        const offlineChanges = localStorage.getItem('excalidraw-offline-changes');
        const changes = offlineChanges ? JSON.parse(offlineChanges) : [];
        changes.push({
          type: 'save',
          fileId: fileData.id,
          timestamp: new Date().toISOString(),
          data: fileData
        });
        localStorage.setItem('excalidraw-offline-changes', JSON.stringify(changes));
      }
      
      // Also cache using PWA cache if available
      if (window.pwaManager) {
        await window.pwaManager.saveToCache(`file-${fileData.id}`, fileData);
      }
      
      return true;
    } catch (error) {
      console.error('Error saving with offline support:', error);
      return false;
    }
  }, [isOnline]);

  // Load files from localStorage on startup
  useEffect(() => {
    const savedFiles = localStorage.getItem('excalidraw-files');
    if (savedFiles) {
      try {
        const parsedFiles = JSON.parse(savedFiles);
        setFiles(parsedFiles);
        
        // Load the last opened file if exists
        const lastFile = localStorage.getItem('excalidraw-last-file');
        if (lastFile) {
          const foundFile = parsedFiles.find(f => f.id === lastFile);
          if (foundFile) {
            setCurrentFile(foundFile);
            setInitialData({
              elements: foundFile.elements || [],
              appState: foundFile.appState || {}
            });
            setSaveStatus('saved');
          }
        }
      } catch (error) {
        console.error('Error loading files:', error);
      }
    }
  }, []);

  // Save files to localStorage whenever files array changes
  useEffect(() => {
    localStorage.setItem('excalidraw-files', JSON.stringify(files));
  }, [files]);

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const createNewFile = useCallback((name) => {
    const newFile = {
      id: generateId(),
      name: name,
      elements: [],
      appState: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setFiles(prev => [...prev, newFile]);
    setCurrentFile(newFile);
    setInitialData({ elements: [], appState: {} });
    setSaveStatus('saved');
    
    // Auto-close sidebar on mobile after creating file (with delay)
    if (isMobile && !sidebarClosing) {
      setSidebarClosing(true);
      setTimeout(() => {
        setSidebarVisible(false);
        setSidebarClosing(false);
      }, 500);
    }

    return newFile;
  }, [isMobile, sidebarClosing]);

  const saveCurrentFile = useCallback(async () => {
    if (!currentFile || !excalidrawAPI) return;

    setSaveStatus('saving');

    try {
      const sceneData = excalidrawAPI.getSceneElements();
      const currentAppState = excalidrawAPI.getAppState();

      const updatedFile = {
        ...currentFile,
        elements: sceneData,
        appState: {
          viewBackgroundColor: currentAppState.viewBackgroundColor,
          zoom: currentAppState.zoom,
          scrollX: currentAppState.scrollX,
          scrollY: currentAppState.scrollY,
          gridSize: currentAppState.gridSize,
          theme: currentAppState.theme
        },
        updatedAt: new Date().toISOString()
      };

      // Use offline-aware save function
      const saveSuccess = await saveWithOfflineSupport(updatedFile);
      
      if (saveSuccess) {
        setFiles(prev => prev.map(file => 
          file.id === currentFile.id ? updatedFile : file
        ));

        setCurrentFile(updatedFile);
        localStorage.setItem('excalidraw-last-file', currentFile.id);
        
        setSaveStatus('saved');
        const statusMessage = isOnline ? 
          `File "${currentFile.name}" berhasil disimpan` : 
          `File "${currentFile.name}" disimpan offline`;
        showToast(statusMessage, 'success');
      } else {
        throw new Error('Save operation failed');
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('unsaved');
      showToast('Gagal menyimpan file', 'error');
    }
  }, [currentFile, excalidrawAPI, isOnline, saveWithOfflineSupport]);

  const loadFile = useCallback((fileId) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    setCurrentFile(file);
    setInitialData({
      elements: file.elements || [],
      appState: file.appState || {}
    });
    setSaveStatus('saved');

    localStorage.setItem('excalidraw-last-file', fileId);
    
    // Auto-close sidebar on mobile after selecting file (with delay to show selection)
    if (isMobile && !sidebarClosing) {
      setSidebarClosing(true);
      setTimeout(() => {
        setSidebarVisible(false);
        setSidebarClosing(false);
      }, 500); // Longer delay to see selection
    }
  }, [files, isMobile, sidebarClosing]);

  const deleteFile = useCallback((fileId) => {
    const file = files.find(f => f.id === fileId);
    if (file && window.confirm(`Apakah Anda yakin ingin menghapus file "${file.name}"?`)) {
      setFiles(prev => prev.filter(file => file.id !== fileId));
      
      if (currentFile && currentFile.id === fileId) {
        setCurrentFile(null);
        setInitialData({ elements: [], appState: {} });
        setSaveStatus('saved');
      }
      
      showToast(`File "${file.name}" berhasil dihapus`, 'success');
    }
  }, [currentFile, files]);

  const duplicateFile = useCallback((fileId) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    const duplicatedFile = {
      ...file,
      id: generateId(),
      name: `${file.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setFiles(prev => [...prev, duplicatedFile]);
    showToast(`File "${file.name}" berhasil diduplikasi`, 'success');
  }, [files]);

  const renameFile = useCallback((fileId, newName) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, name: newName, updatedAt: new Date().toISOString() }
        : file
    ));

    if (currentFile && currentFile.id === fileId) {
      setCurrentFile(prev => ({ ...prev, name: newName }));
    }
  }, [currentFile]);

  const exportFile = useCallback(async (format) => {
    if (!excalidrawAPI || !currentFile) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();

      let blob;
      let filename;

      switch (format) {
        case 'png':
          try {
            const canvas = await exportToCanvas({
              elements,
              appState,
              files: excalidrawAPI.getFiles(),
            });
            canvas.toBlob((canvasBlob) => {
              if (canvasBlob) {
                downloadBlob(canvasBlob, `${currentFile.name}.png`);
                showToast(`File berhasil diekspor sebagai ${currentFile.name}.png`, 'success');
              }
            });
          } catch (error) {
            console.error('PNG export error:', error);
            showToast('Gagal mengekspor sebagai PNG', 'error');
          }
          return;

        case 'svg':
          try {
            const svg = await exportToSvg({
              elements,
              appState,
              files: excalidrawAPI.getFiles(),
            });
            blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
            filename = `${currentFile.name}.svg`;
          } catch (error) {
            console.error('SVG export error:', error);
            showToast('Gagal mengekspor sebagai SVG', 'error');
            return;
          }
          break;

        case 'excalidraw':
          try {
            const sceneData = {
              type: 'excalidraw',
              version: 2,
              source: 'https://excalidraw.com',
              elements,
              appState,
              files: excalidrawAPI.getFiles()
            };
            blob = new Blob([JSON.stringify(sceneData, null, 2)], { 
              type: 'application/json' 
            });
            filename = `${currentFile.name}.excalidraw`;
          } catch (error) {
            console.error('Excalidraw export error:', error);
            showToast('Gagal mengekspor sebagai .excalidraw', 'error');
            return;
          }
          break;

        default:
          return;
      }

      if (blob && filename) {
        downloadBlob(blob, filename);
        showToast(`File berhasil diekspor sebagai ${filename}`, 'success');
      }
    } catch (error) {
      console.error('General export error:', error);
      showToast('Terjadi kesalahan saat mengekspor file', 'error');
    }
  }, [excalidrawAPI, currentFile]);

  const downloadBlob = (blob, filename) => {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log(`File ${filename} berhasil didownload`);
    } catch (error) {
      console.error('Download error:', error);
      alert('Gagal mendownload file');
    }
  };

  const importFile = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.type === 'excalidraw') {
          const fileName = file.name.replace('.excalidraw', '');
          const newFile = {
            id: generateId(),
            name: fileName,
            elements: data.elements || [],
            appState: data.appState || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          setFiles(prev => [...prev, newFile]);
          setCurrentFile(newFile);
          setInitialData({
            elements: newFile.elements,
            appState: newFile.appState
          });
          setSaveStatus('saved');
          
          console.log(`File "${fileName}" berhasil diimpor`);
          showToast(`File "${fileName}" berhasil diimpor`, 'success');
        } else {
          showToast('Format file tidak didukung. Hanya file .excalidraw yang dapat diimpor.', 'error');
        }
      } catch (error) {
        console.error('Import error:', error);
        showToast('Terjadi kesalahan saat mengimpor file. Pastikan file adalah format .excalidraw yang valid.', 'error');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentFile && saveStatus === 'unsaved') {
        saveCurrentFile();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentFile, saveStatus, saveCurrentFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S to save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (currentFile) {
          saveCurrentFile();
        }
      }
      
      // Ctrl+N to create new file
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        const fileName = prompt('Nama file baru:');
        if (fileName && fileName.trim()) {
          createNewFile(fileName.trim());
        }
      }

      // Ctrl+O to open file (show file list focus)
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        // Focus on the first file or new file input
        const fileList = document.querySelector('.file-list');
        const firstFile = fileList?.querySelector('.file-item');
        const newFileInput = document.querySelector('.new-file-input');
        
        if (firstFile) {
          firstFile.click();
        } else if (newFileInput) {
          newFileInput.focus();
        }
      }

      // Ctrl+B to toggle sidebar
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        handleSidebarToggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, saveCurrentFile, createNewFile]);

  // Handle onChange with debouncing to prevent infinite loops
  const handleExcalidrawChange = useCallback((elements, appState) => {
    if (currentFile && saveStatus === 'saved') {
      setSaveStatus('unsaved');
    }
  }, [currentFile, saveStatus]);

  // Listen for createNewFile events from toolbar
  useEffect(() => {
    const handleCreateNewFileEvent = (event) => {
      createNewFile(event.detail.name);
    };

    window.addEventListener('createNewFile', handleCreateNewFileEvent);
    return () => window.removeEventListener('createNewFile', handleCreateNewFileEvent);
  }, [createNewFile]);

  // Initial mobile detection
  useEffect(() => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);
    
    // Only auto-hide sidebar on initial load for mobile
    if (mobile) {
      setSidebarVisible(false);
    }
  }, []); // Run only once on mount

  // Manage body class for mobile sidebar and detect mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      if (mobile && sidebarVisible) {
        document.body.classList.add('sidebar-open');
      } else {
        document.body.classList.remove('sidebar-open');
      }
    };

    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.classList.remove('sidebar-open');
    };
  }, [sidebarVisible]);

  // Auto-hide sidebar on mobile when clicking outside
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      if (!isMobile && sidebarVisible) {
        document.body.classList.remove('sidebar-open');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarVisible]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportDropdown && exportButtonRef.current && 
          !exportButtonRef.current.contains(event.target) &&
          !event.target.closest('.dropdown-menu')) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportDropdown]);

  // Helper functions for toolbar UI
  const getSaveButtonText = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <>
            <span className="saving-spinner">⟳</span> Saving...
          </>
        );
      case 'unsaved':
        return '💾 Save *';
      default:
        return '💾 Save';
    }
  };

  const getSaveButtonClass = () => {
    const baseClass = "btn primary";
    switch (saveStatus) {
      case 'saving':
        return baseClass + " saving";
      case 'unsaved':
        return baseClass + " unsaved";
      default:
        return baseClass;
    }
  };

  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (file) {
      importFile(file);
    }
    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  // Handle sidebar toggle with mobile optimization
  const handleSidebarToggle = useCallback(() => {
    if (sidebarClosing) return; // Prevent rapid toggle
    
    setSidebarVisible(prev => !prev);
    
    // Reset any pending close actions
    setSidebarClosing(false);
  }, [sidebarClosing]);

  const handleExportDropdownToggle = () => {
    if (!showExportDropdown && exportButtonRef.current) {
      const rect = exportButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 140; // min-width dari CSS
      const dropdownHeight = 120; // estimasi tinggi dropdown
      
      let top = rect.bottom + 4;
      let left = rect.left;
      
      // Pastikan dropdown tidak keluar dari viewport
      if (left + dropdownWidth > window.innerWidth) {
        left = window.innerWidth - dropdownWidth - 10;
      }
      
      if (top + dropdownHeight > window.innerHeight) {
        top = rect.top - dropdownHeight - 4;
      }
      
      setDropdownPosition({ top, left });
    }
    setShowExportDropdown(!showExportDropdown);
  };

  return (
    <div className="app-container">
      {/* Overlay for mobile when sidebar is open - only show on mobile */}
      {sidebarVisible && isMobile && (
        <div 
          className="sidebar-overlay visible"
          onClick={() => setSidebarVisible(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            display: 'block'
          }}
        />
      )}
      
      <button 
        className={`sidebar-toggle ${sidebarVisible ? 'sidebar-visible' : ''}`}
        onClick={handleSidebarToggle}
        title={`${sidebarVisible ? 'Hide' : 'Show'} Sidebar (Ctrl+B)`}
        aria-label={`${sidebarVisible ? 'Hide' : 'Show'} Sidebar`}
      >
        {sidebarVisible ? '✕' : '☰'}
      </button>

      <div className={`sidebar ${sidebarVisible ? '' : 'hidden'}`}>
        <div className="sidebar-header">
          <div className="status-indicators">
            {!isOnline && (
              <span className="offline-indicator" title="Offline - Changes saved locally">
                🔴 Offline
              </span>
            )}
            {isPWAInstalled && (
              <span className="pwa-indicator" title="Running as installed app">
                📱 PWA
              </span>
            )}
          </div>
          <h2 className="sidebar-title">Excalidraw Files</h2>
          <p className="sidebar-subtitle">
            {files.length} file{files.length !== 1 ? 's' : ''} • Manage your drawings
          </p>
        </div>
        
        {/* Toolbar moved to sidebar */}
        <div className="sidebar-toolbar">
          <div className="current-file-info">
            {currentFile ? (
              <>
                <span className="current-file-name">{currentFile.name}</span>
                {saveStatus === 'unsaved' && <span className="unsaved-indicator">●</span>}
                {saveStatus === 'saving' && <span className="saving-indicator">...</span>}
              </>
            ) : (
              <span className="no-file">Tidak ada file terbuka</span>
            )}
          </div>
          
          <div className="toolbar-actions">
            <button 
              className={getSaveButtonClass()}
              onClick={saveCurrentFile}
              disabled={!currentFile || saveStatus === 'saving'}
              aria-label="Save current file"
            >
              {getSaveButtonText()}
            </button>
            
            <div className="toolbar-group">
              <button 
                className="btn secondary"
                onClick={() => document.getElementById('file-input').click()}
                aria-label="Import file"
              >
                📁 Import
              </button>
              
              <div className="export-dropdown">
                <button 
                  ref={exportButtonRef}
                  className="btn secondary"
                  onClick={handleExportDropdownToggle}
                  disabled={!currentFile}
                  aria-label="Export options"
                  aria-expanded={showExportDropdown}
                  aria-haspopup="menu"
                >
                  📤 Export ▼
                </button>
                {showExportDropdown && (
                  <div 
                    className="dropdown-menu"
                    role="menu"
                    style={{
                      position: 'fixed',
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`,
                      zIndex: 99999,
                      background: '#2d2d2d',
                      border: '1px solid #555',
                      borderRadius: '6px',
                      minWidth: '140px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
                      display: 'block'
                    }}
                  >
                    <button 
                      onClick={() => { exportFile('png'); setShowExportDropdown(false); }}
                      role="menuitem"
                    >
                      🖼️ Export as PNG
                    </button>
                    <button 
                      onClick={() => { exportFile('svg'); setShowExportDropdown(false); }}
                      role="menuitem"
                    >
                      📄 Export as SVG
                    </button>
                    <button 
                      onClick={() => { exportFile('json'); setShowExportDropdown(false); }}
                      role="menuitem"
                    >
                      💾 Export as JSON
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <FileManager
          files={files}
          currentFile={currentFile}
          onCreateFile={createNewFile}
          onLoadFile={loadFile}
          onDeleteFile={deleteFile}
          onDuplicateFile={duplicateFile}
          onRenameFile={renameFile}
        />
      </div>

      <div className={`main-content ${!sidebarVisible ? 'sidebar-hidden' : ''}`}>
        <div className="excalidraw-container">
          <Excalidraw
            key={currentFile?.id || 'empty'}
            initialData={initialData}
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
            onChange={handleExcalidrawChange}
            theme="light"
          />
        </div>
      </div>
      
      {/* Hidden file input for import */}
      <input
        id="file-input"
        type="file"
        accept=".excalidraw,.json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
      
      <ToastContainer />
    </div>
  );
};

export default App;
