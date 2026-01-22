import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import fileSystemEvents from '../services/fileSystemEvents';
import ContextMenu from './ContextMenu';
import ConfirmDialog from './ConfirmDialog';
import ProgressBar from './ProgressBar';

interface FileItem {
  name: string;
  type: string;
  size?: number;
  path?: string;
  description?: string;
  modifiedAt?: string;
}

interface FileManagerContentProps {
  windowId: string;
  initialPath?: string;
}

const FileManagerContent = ({ windowId, initialPath }: FileManagerContentProps) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '/home');
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item?: FileItem } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FileItem | null>(null);
  const [clipboard, setClipboard] = useState<{ sourcePath: string; itemName: string; operation: string } | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [itemToRename, setItemToRename] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState('');
  const [copyProgress, setCopyProgress] = useState<{ progress: number; fileSize: number; speed: number; label: string } | null>(null);

  const fetchDirectory = async (path: string) => {
    console.log('🔍 Fetching directory:', path);
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const url = `http://localhost:3000/api/filesystem${path}`;
      console.log('📡 API call:', url);

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('✅ Response:', response.data);
      setItems(response.data.items);
      setCurrentPath(response.data.path);
    } catch (err: any) {
      console.error('❌ Error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Failed to load directory');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClipboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3000/api/filesystem/clipboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClipboard(response.data.clipboard);
    } catch (err) {
      console.error('Failed to fetch clipboard:', err);
    }
  };

  useEffect(() => {
    fetchDirectory(currentPath);
    fetchClipboard();
  }, []);

  // Suscribirse a cambios en el directorio actual
  useEffect(() => {
    const unsubscribe = fileSystemEvents.subscribe(currentPath, () => {
      console.log('📢 Directory changed, refreshing:', currentPath);
      fetchDirectory(currentPath);
    });

    return () => {
      unsubscribe();
    };
  }, [currentPath]);

  const handleItemClick = (item: FileItem) => {
    console.log('🖱️ Click on item:', item);
    if (item.type === 'directory') {
      const targetPath = item.path || `${currentPath}/${item.name}`;
      console.log('📂 Opening directory, path:', targetPath);
      fetchDirectory(targetPath);
    } else if (item.type === 'text' || item.type === 'source') {
      // Open text editor for text and source files
      const filePath = `${currentPath}/${item.name}`;
      console.log('📝 Opening text editor for:', filePath);
      if ((window as any).openTextEditor) {
        (window as any).openTextEditor(filePath, item.name);
      } else {
        console.error('openTextEditor function not available');
      }
    } else {
      // TODO: Handle other file types (binaries, etc.)
      console.log('📄 Open file:', item.name, 'Type:', item.type);
    }
  };

  const handleBackClick = () => {
    if (currentPath === '/') return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    fetchDirectory(parentPath);
  };

  const handleNewFolderClick = () => {
    setNewFolderName('');
    setShowNewFolderForm(true);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:3000/api/filesystem${currentPath}`,
        {
          name: newFolderName.trim(),
          type: 'directory'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Notificar a todas las ventanas que están viendo este directorio
      console.log('🔔 Notifying other windows about directory change:', currentPath);
      fileSystemEvents.notify(currentPath, { action: 'create', name: newFolderName.trim() });

      // Refresh directory
      await fetchDirectory(currentPath);
      setShowNewFolderForm(false);
      setNewFolderName('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create folder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelNewFolder = () => {
    setShowNewFolderForm(false);
    setNewFolderName('');
    setError('');
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering empty space handler
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleEmptySpaceContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to Desktop
    // Only show context menu if there's something in clipboard
    if (clipboard) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCopy = async () => {
    if (!contextMenu || !contextMenu.item) return;

    const itemPath = `${currentPath}/${contextMenu.item.name}`;
    setContextMenu(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3000/api/filesystem/clipboard',
        { sourcePath: itemPath, operation: 'copy' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setClipboard(response.data.clipboard);
      fileSystemEvents.notify('__clipboard__', response.data.clipboard);
      console.log('📋 Copied to clipboard:', contextMenu.item.name);
    } catch (err: any) {
      console.error('Failed to copy:', err);
      setError(err.response?.data?.error || 'Failed to copy item');
    }
  };

  const handleCut = async () => {
    if (!contextMenu || !contextMenu.item) return;

    const itemPath = `${currentPath}/${contextMenu.item.name}`;
    setContextMenu(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3000/api/filesystem/clipboard',
        { sourcePath: itemPath, operation: 'cut' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setClipboard(response.data.clipboard);
      fileSystemEvents.notify('__clipboard__', response.data.clipboard);
      console.log('✂️ Cut to clipboard:', contextMenu.item.name);

      // Refresh to show visual feedback
      await fetchDirectory(currentPath);
    } catch (err: any) {
      console.error('Failed to cut:', err);
      setError(err.response?.data?.error || 'Failed to cut item');
    }
  };

  const handlePaste = async () => {
    if (!clipboard) return;

    setError('');

    // Determine target path: if clicked on a folder, paste inside it; otherwise, paste in current directory
    let targetPath = currentPath;
    if (contextMenu?.item && contextMenu.item.type === 'directory') {
      targetPath = contextMenu.item.path || `${currentPath}/${contextMenu.item.name}`;
    }

    setContextMenu(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3000/api/filesystem/paste',
        { targetPath },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { copyDelay, fileSize, newItem, operation } = response.data;
      const diskSpeed = 5; // MB/s - should match backend

      console.log('📌 Pasting:', newItem.name, 'Delay:', copyDelay, 'ms', 'Size:', fileSize, 'bytes');

      // Show progress bar if delay > 50ms
      if (copyDelay > 50) {
        const label = operation === 'copy' ? `Copying ${clipboard.itemName}...` : `Moving ${clipboard.itemName}...`;
        setCopyProgress({ progress: 0, fileSize, speed: diskSpeed, label });

        // Simulate progress
        const startTime = Date.now();
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min((elapsed / copyDelay) * 100, 99);
          setCopyProgress({ progress, fileSize, speed: diskSpeed, label });

          if (elapsed >= copyDelay) {
            clearInterval(interval);
          }
        }, 50);

        // Wait for the delay
        await new Promise(resolve => setTimeout(resolve, copyDelay));
        clearInterval(interval);

        // Set to 100% briefly before closing
        setCopyProgress({ progress: 100, fileSize, speed: diskSpeed, label });
        await new Promise(resolve => setTimeout(resolve, 200));
        setCopyProgress(null);
      }

      // Update clipboard state if it was a cut operation
      if (operation === 'cut') {
        setClipboard(null);
        fileSystemEvents.notify('__clipboard__', null);

        // Notify source directory if cut operation (so it updates and removes the item)
        if (response.data.sourceDirPath) {
          fileSystemEvents.notify(response.data.sourceDirPath, { action: 'cut', name: clipboard.itemName });
        }
      }

      // Notify target directory
      fileSystemEvents.notify(currentPath, { action: 'paste', name: newItem.name });

      // Refresh directory
      await fetchDirectory(currentPath);
    } catch (err: any) {
      console.error('Failed to paste:', err);
      setError(err.response?.data?.error || 'Failed to paste item');
      setCopyProgress(null);
    }
  };

  const handleDelete = () => {
    if (!contextMenu || !contextMenu.item) return;

    // Show confirmation dialog
    setItemToDelete(contextMenu.item);
    setShowDeleteConfirm(true);
    setContextMenu(null); // Close context menu
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    const itemPath = `${currentPath}/${itemToDelete.name}`;
    setShowDeleteConfirm(false);
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `http://localhost:3000/api/filesystem${itemPath}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Notify other windows
      console.log('🔔 Notifying other windows about deletion:', currentPath);
      fileSystemEvents.notify(currentPath, { action: 'delete', name: itemToDelete.name });

      // Refresh directory
      await fetchDirectory(currentPath);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete item');
    } finally {
      setIsLoading(false);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  const handleRename = () => {
    if (!contextMenu || !contextMenu.item) return;

    setItemToRename(contextMenu.item);
    setNewName(contextMenu.item.name);
    setShowRenameDialog(true);
    setContextMenu(null);
  };

  const confirmRename = async () => {
    if (!itemToRename || !newName.trim()) return;

    const itemPath = `${currentPath}/${itemToRename.name}`;
    setShowRenameDialog(false);
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        'http://localhost:3000/api/filesystem/rename',
        {
          itemPath,
          newName: newName.trim()
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('✏️ Renamed:', response.data.oldName, '→', response.data.newName);

      // Notify other windows
      fileSystemEvents.notify(currentPath, { action: 'rename', oldName: response.data.oldName, newName: response.data.newName });

      // Refresh directory
      await fetchDirectory(currentPath);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to rename item');
    } finally {
      setIsLoading(false);
      setItemToRename(null);
      setNewName('');
    }
  };

  const cancelRename = () => {
    setShowRenameDialog(false);
    setItemToRename(null);
    setNewName('');
    setError('');
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'directory':
        return '📁';
      case 'systemBinary':
        return '⚙️';
      case 'binary':
        return '🔧';
      case 'source':
        return '📄';
      case 'text':
        return '📝';
      default:
        return '📄';
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="h-full flex flex-col relative" onContextMenu={handleEmptySpaceContextMenu}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-dark-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-500 animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-500/50 animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-500/30 animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
        </div>
      )}

      {/* Path bar */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyber-500/20">
        {currentPath !== '/' && (
          <button
            onClick={handleBackClick}
            className="w-6 h-6 flex items-center justify-center hover:bg-cyber-500/20 transition-colors"
          >
            <span className="text-cyber-500">←</span>
          </button>
        )}
        <div className="w-1 h-3 bg-cyber-500 animate-pulse-slow" />
        <span className="text-xs text-cyber-500 flex-1">{currentPath}</span>
        <button
          onClick={handleNewFolderClick}
          className="px-2 py-1 text-xs text-cyber-500 border border-cyber-500/30 hover:bg-cyber-500/10 transition-colors"
        >
          + New Folder
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {showNewFolderForm ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="w-full max-w-md border border-cyber-500/30 bg-dark-800/50 p-4 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-cyber-500" />
                <h3 className="text-sm text-cyber-500">CREATE NEW FOLDER</h3>
              </div>

              {error && (
                <div className="border border-red-500/30 bg-red-500/5 text-red-400 text-xs p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') handleCancelNewFolder();
                  }}
                  className="w-full bg-dark-900 border border-cyber-500/30 text-gray-100 text-xs px-3 py-2 focus:outline-none focus:border-cyber-500"
                  placeholder="Enter folder name..."
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancelNewFolder}
                  className="px-4 py-2 text-xs text-gray-400 border border-gray-600/30 hover:bg-gray-600/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="px-4 py-2 text-xs text-cyber-500 border border-cyber-500/30 hover:bg-cyber-500/10 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="border border-red-500/30 bg-red-500/5 text-red-400 text-xs p-2.5 rounded m-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span>{error}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {items.filter(item => !item.name.startsWith('.')).map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                onClick={() => handleItemClick(item)}
                onContextMenu={(e) => handleContextMenu(e, item)}
                className={`flex items-center justify-between p-2 hover:bg-cyber-500/10 cursor-pointer transition-colors group ${
                  clipboard?.operation === 'cut' &&
                  clipboard?.sourcePath === `${currentPath}/${item.name}`
                    ? 'opacity-50'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm">{getFileIcon(item.type)}</span>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-100">{item.name}</span>
                    {item.description && (
                      <span className="text-xs text-gray-600">{item.description}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {item.type !== 'directory' && item.size && (
                    <span>{formatSize(item.size)}</span>
                  )}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-cyber-500">
                    {item.type === 'directory' ? '→' : item.type}
                  </span>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center text-gray-600 text-xs py-8">
                Empty directory
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      {showDeleteConfirm && itemToDelete && (
        <ConfirmDialog
          title="CONFIRM DELETION"
          message={`Are you sure you want to delete "${itemToDelete.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          confirmText="Delete"
          cancelText="Cancel"
          isDangerous={true}
        />
      )}

      {/* Rename Dialog */}
      {showRenameDialog && itemToRename && (
        <div className="absolute inset-0 bg-dark-900/50 backdrop-blur-sm z-20 flex items-center justify-center">
          <div className="w-full max-w-md border border-cyber-500/30 bg-dark-800/50 p-4 space-y-4 mx-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-cyber-500" />
              <h3 className="text-sm text-cyber-500">RENAME ITEM</h3>
            </div>

            {error && (
              <div className="border border-red-500/30 bg-red-500/5 text-red-400 text-xs p-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 mb-1 block">New Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                className="w-full bg-dark-900 border border-cyber-500/30 text-gray-100 text-xs px-3 py-2 focus:outline-none focus:border-cyber-500"
                placeholder="Enter new name..."
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelRename}
                className="px-4 py-2 text-xs text-gray-400 border border-gray-600/30 hover:bg-gray-600/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRename}
                className="px-4 py-2 text-xs text-cyber-500 border border-cyber-500/30 hover:bg-cyber-500/10 transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu - Rendered via Portal */}
      {contextMenu && createPortal(
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCopy={contextMenu.item ? handleCopy : undefined}
          onCut={contextMenu.item ? handleCut : undefined}
          onPaste={handlePaste}
          onRename={contextMenu.item ? handleRename : undefined}
          onDelete={contextMenu.item ? handleDelete : undefined}
          canPaste={clipboard !== null}
        />,
        document.body
      )}

      {/* Progress Bar - Rendered via Portal */}
      {copyProgress && createPortal(
        <ProgressBar
          progress={copyProgress.progress}
          label={copyProgress.label}
          fileSize={copyProgress.fileSize}
          speed={copyProgress.speed}
        />,
        document.body
      )}
    </div>
  );
};

export default FileManagerContent;
