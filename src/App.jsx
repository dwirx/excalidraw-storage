import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Excalidraw, exportToCanvas, exportToSvg, exportToBlob } from '@excalidraw/excalidraw';
import FileManager from './components/FileManager';
import Toolbar from './components/Toolbar';

const App = () => {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
  const [initialData, setInitialData] = useState({ elements: [], appState: {} });
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

    return newFile;
  }, []);

  const saveCurrentFile = useCallback(() => {
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

      setFiles(prev => prev.map(file => 
        file.id === currentFile.id ? updatedFile : file
      ));

      setCurrentFile(updatedFile);
      localStorage.setItem('excalidraw-last-file', currentFile.id);
      
      setSaveStatus('saved');
      console.log(`File "${currentFile.name}" berhasil disimpan`);
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('unsaved');
      alert('Gagal menyimpan file');
    }
  }, [currentFile, excalidrawAPI]);

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
  }, [files]);

  const deleteFile = useCallback((fileId) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus file ini?')) {
      setFiles(prev => prev.filter(file => file.id !== fileId));
      
      if (currentFile && currentFile.id === fileId) {
        setCurrentFile(null);
        setInitialData({ elements: [], appState: {} });
        setSaveStatus('saved');
      }
    }
  }, [currentFile]);

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
              }
            });
          } catch (error) {
            console.error('PNG export error:', error);
            alert('Gagal mengekspor sebagai PNG');
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
            alert('Gagal mengekspor sebagai SVG');
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
            alert('Gagal mengekspor sebagai .excalidraw');
            return;
          }
          break;

        default:
          return;
      }

      if (blob && filename) {
        downloadBlob(blob, filename);
      }
    } catch (error) {
      console.error('General export error:', error);
      alert('Terjadi kesalahan saat mengekspor file');
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
        } else {
          alert('Format file tidak didukung. Hanya file .excalidraw yang dapat diimpor.');
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Terjadi kesalahan saat mengimpor file. Pastikan file adalah format .excalidraw yang valid.');
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

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Excalidraw Files</h2>
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

      <div className="main-content">
        <Toolbar
          currentFile={currentFile}
          saveStatus={saveStatus}
          onSave={saveCurrentFile}
          onExport={exportFile}
          onImport={importFile}
        />
        
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
    </div>
  );
};

export default App;
