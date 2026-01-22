import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Window from '../components/Window';
import FileManagerContent from '../components/FileManagerContent';
import TextEditorContent from '../components/TextEditorContent';
import TerminalContent from '../components/TerminalContent';
import DesktopIcon from '../components/DesktopIcon';
import ContextMenu from '../components/ContextMenu';
import ConfirmDialog from '../components/ConfirmDialog';
import ProgressBar from '../components/ProgressBar';
import fileSystemEvents from '../services/fileSystemEvents';
import { createProcess, deleteProcess } from '../services/processService';
import socketService from '../services/socketService';
import { createPortal } from 'react-dom';

interface DesktopItem {
  name: string;
  type: string;
  path?: string;
}

const Desktop = () => {
  const { user, computer, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [focusedWindow, setFocusedWindow] = useState<string>('');
  const [windowZIndices, setWindowZIndices] = useState<{ [key: string]: number }>({
    'terminal': 10,
    'filemanager': 11
  });
  const [minimizedWindows, setMinimizedWindows] = useState<{ [key: string]: boolean }>({});
  const [openWindows, setOpenWindows] = useState<Array<{
    id: string;
    type: string;
    title: string;
    x: number;
    y: number;
    filePath?: string;
  }>>([]);
  const [desktopItems, setDesktopItems] = useState<DesktopItem[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item?: DesktopItem } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DesktopItem | null>(null);
  const [clipboard, setClipboard] = useState<{ sourcePath: string; itemName: string; operation: string } | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [itemToRename, setItemToRename] = useState<DesktopItem | null>(null);
  const [newName, setNewName] = useState('');
  const [copyProgress, setCopyProgress] = useState<{ progress: number; fileSize: number; speed: number; label: string } | null>(null);
  const [windowPids, setWindowPids] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Socket.io: Join computer room and listen for process events
  useEffect(() => {
    if (!computer?._id) return;

    // Join this computer's room
    socketService.joinComputer(computer._id);

    // Listen for process killed events
    const unsubKill = socketService.on('process:killed', (data: { pid: number; name: string }) => {
      console.log('🔌 Process killed event:', data);

      // Find the window with this PID
      setWindowPids(currentPids => {
        const windowId = Object.entries(currentPids).find(
          ([, pid]) => pid === data.pid
        )?.[0];

        if (windowId) {
          console.log(`   └─ Closing window ${windowId} for killed process ${data.pid}`);

          // Close the window (without calling deleteProcess since it's already dead)
          setOpenWindows(prev => prev.filter(w => w.id !== windowId));
          setWindowZIndices(prev => {
            const copy = { ...prev };
            delete copy[windowId];
            return copy;
          });
          setMinimizedWindows(prev => {
            const copy = { ...prev };
            delete copy[windowId];
            return copy;
          });

          // Remove from windowPids
          const newPids = { ...currentPids };
          delete newPids[windowId];
          return newPids;
        }

        return currentPids;
      });
    });

    return () => {
      unsubKill();
      socketService.leaveComputer();
    };
  }, [computer]);

  // Load Desktop contents
  const loadDesktop = async () => {
    if (!user?.username) return;

    try {
      const token = localStorage.getItem('token');
      const desktopPath = `/home/${user.username}/Desktop`;
      const response = await axios.get(
        `http://localhost:3000/api/filesystem${desktopPath}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setDesktopItems(response.data.items);
    } catch (err) {
      console.error('Failed to load Desktop:', err);
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

  // Load Desktop on mount
  useEffect(() => {
    if (user?.username) {
      loadDesktop();
      fetchClipboard();
    }
  }, [user?.username]);

  // Subscribe to Desktop changes
  useEffect(() => {
    if (!user?.username) return;

    const desktopPath = `/home/${user.username}/Desktop`;
    const unsubscribe = fileSystemEvents.subscribe(desktopPath, () => {
      console.log('📢 Desktop changed, refreshing');
      loadDesktop();
    });

    return () => {
      unsubscribe();
    };
  }, [user?.username]);

  // Subscribe to clipboard changes
  useEffect(() => {
    const unsubscribe = fileSystemEvents.subscribe('__clipboard__', (data) => {
      console.log('📋 Clipboard changed:', data);
      setClipboard(data);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleDestroyComputer = async () => {
    if (!confirm('💣 DESTROY PC?\n\nThis will DELETE everything and create a fresh computer.\n\nAre you sure?')) {
      return;
    }

    setShowStartMenu(false);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:3000/auth/reset-computer',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Logout after reset - user needs to login again
      logout();
    } catch (err) {
      console.error('Failed to destroy computer:', err);
      alert('Failed to destroy computer');
    }
  };

  const handleWindowFocus = (windowId: string) => {
    setFocusedWindow(windowId);
    // Bring focused window to front
    const maxZ = Math.max(...Object.values(windowZIndices));
    setWindowZIndices(prev => ({
      ...prev,
      [windowId]: maxZ + 1
    }));
  };

  const handleWindowMinimize = (windowId: string, minimized: boolean) => {
    setMinimizedWindows(prev => ({
      ...prev,
      [windowId]: minimized
    }));
  };

  const handleWindowClose = async (windowId: string) => {
    // Kill the process in backend
    const pid = windowPids[windowId];
    if (pid) {
      try {
        await deleteProcess(pid);
      } catch (err) {
        console.error('Failed to kill process:', err);
      }
      setWindowPids(prev => {
        const copy = { ...prev };
        delete copy[windowId];
        return copy;
      });
    }

    // Remove window from openWindows array
    setOpenWindows(prev => prev.filter(w => w.id !== windowId));

    // Clean up window z-index state
    setWindowZIndices(prev => {
      const newIndices = { ...prev };
      delete newIndices[windowId];
      return newIndices;
    });

    // Clean up minimized state
    setMinimizedWindows(prev => {
      const newMinimized = { ...prev };
      delete newMinimized[windowId];
      return newMinimized;
    });
  };

  const handleTaskbarClick = (windowId: string) => {
    // Restore window and bring to front
    setMinimizedWindows(prev => ({
      ...prev,
      [windowId]: false
    }));
    handleWindowFocus(windowId);
  };

  const openNewWindow = async (type: string, title: string, filePath?: string) => {
    const windowId = `${type}-${Date.now()}`;
    const offset = openWindows.length * 30;

    // Map window types to process names
    const processNames: Record<string, string> = {
      terminal: 'terminal',
      filemanager: 'filemanager',
      texteditor: 'textedit',
      sysmonitor: 'sysmonitor'
    };

    // Create process in backend
    try {
      const processInfo = await createProcess(processNames[type] || type, 'user');
      setWindowPids(prev => ({ ...prev, [windowId]: processInfo.pid }));
    } catch (err) {
      console.error('Failed to create process:', err);
    }

    setOpenWindows(prev => [...prev, {
      id: windowId,
      type,
      title,
      x: 100 + offset,
      y: 80 + offset,
      filePath
    }]);

    setWindowZIndices(prev => ({
      ...prev,
      [windowId]: Math.max(...Object.values(prev), 0) + 1
    }));

    setMinimizedWindows(prev => ({
      ...prev,
      [windowId]: false
    }));

    setShowStartMenu(false);
  };

  // Handle double click on desktop icon
  const handleDesktopIconDoubleClick = (item: DesktopItem) => {
    if (!user?.username) return;

    const desktopPath = `/home/${user.username}/Desktop`;
    const itemPath = `${desktopPath}/${item.name}`;

    if (item.type === 'directory') {
      // Open folder in File Manager with the full path
      openNewWindow('filemanager', `FILE MANAGER - ${item.name}`, itemPath);
    } else if (item.type === 'text' || item.type === 'source') {
      // Open file in Text Editor
      openNewWindow('texteditor', `TEXT EDITOR - ${item.name}`, itemPath);
    }
  };

  // Context menu handlers for desktop icons
  const handleDesktopContextMenu = (e: React.MouseEvent, item: DesktopItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // Context menu handler for empty space
  const handleEmptySpaceContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Only show menu if clipboard has content
    if (clipboard) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCopy = async () => {
    if (!contextMenu || !contextMenu.item || !user?.username) return;

    const desktopPath = `/home/${user.username}/Desktop`;
    const itemPath = `${desktopPath}/${contextMenu.item.name}`;
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
      alert(err.response?.data?.error || 'Failed to copy item');
    }
  };

  const handleCut = async () => {
    if (!contextMenu || !contextMenu.item || !user?.username) return;

    const desktopPath = `/home/${user.username}/Desktop`;
    const itemPath = `${desktopPath}/${contextMenu.item.name}`;
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
      await loadDesktop();
    } catch (err: any) {
      console.error('Failed to cut:', err);
      alert(err.response?.data?.error || 'Failed to cut item');
    }
  };

  const handlePaste = async () => {
    if (!clipboard || !user?.username) return;

    // Determine target: folder or current directory (Desktop)
    const desktopPath = `/home/${user.username}/Desktop`;
    let targetPath = desktopPath;

    if (contextMenu?.item && contextMenu.item.type === 'directory') {
      // Paste inside the clicked folder
      targetPath = contextMenu.item.path || `${desktopPath}/${contextMenu.item.name}`;
    }

    setContextMenu(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3000/api/filesystem/paste',
        { targetPath },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { copyDelay, fileSize, newItem, operation, sourceDirPath } = response.data;

      // Show progressbar if delay > 50ms
      if (copyDelay > 50) {
        const label = operation === 'copy'
          ? `Copying ${clipboard.itemName}...`
          : `Moving ${clipboard.itemName}...`;

        setCopyProgress({
          progress: 0,
          fileSize,
          speed: 5,
          label
        });

        // Simulate progress
        const startTime = Date.now();
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min((elapsed / copyDelay) * 100, 99);
          setCopyProgress({
            progress,
            fileSize,
            speed: 5,
            label
          });
        }, 50);

        // Wait for the actual copy delay
        await new Promise(resolve => setTimeout(resolve, copyDelay));

        clearInterval(interval);

        // Complete progress
        setCopyProgress({
          progress: 100,
          fileSize,
          speed: 5,
          label
        });

        // Short delay to show completion
        await new Promise(resolve => setTimeout(resolve, 200));
        setCopyProgress(null);
      }

      console.log('📌 Pasted:', newItem.name);

      // Update clipboard state if it was a cut operation
      if (operation === 'cut') {
        setClipboard(null);
        fileSystemEvents.notify('__clipboard__', null);

        // Notify source directory if cut operation (so it updates and removes the item)
        if (sourceDirPath) {
          fileSystemEvents.notify(sourceDirPath, { action: 'cut', name: clipboard.itemName });
        }
      }

      // Notify target directory
      fileSystemEvents.notify(targetPath, { action: 'paste', name: newItem.name });

      // Refresh desktop if pasting to Desktop
      if (targetPath === desktopPath) {
        await loadDesktop();
      }
    } catch (err: any) {
      console.error('Failed to paste:', err);
      alert(err.response?.data?.error || 'Failed to paste item');
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
    if (!itemToDelete || !user?.username) return;

    const desktopPath = `/home/${user.username}/Desktop`;
    const itemPath = `${desktopPath}/${itemToDelete.name}`;
    setShowDeleteConfirm(false);

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

      // Notify about Desktop change
      console.log('🔔 Notifying about desktop item deletion');
      fileSystemEvents.notify(desktopPath, { action: 'delete', name: itemToDelete.name });

      // Refresh desktop
      await loadDesktop();
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      alert(err.response?.data?.error || 'Failed to delete item');
    } finally {
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
    if (!itemToRename || !newName.trim() || !user?.username) return;

    const desktopPath = `/home/${user.username}/Desktop`;
    const itemPath = `${desktopPath}/${itemToRename.name}`;
    setShowRenameDialog(false);

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
      fileSystemEvents.notify(desktopPath, { action: 'rename', oldName: response.data.oldName, newName: response.data.newName });

      // Refresh desktop
      await loadDesktop();
    } catch (err: any) {
      console.error('Failed to rename item:', err);
      alert(err.response?.data?.error || 'Failed to rename item');
    } finally {
      setItemToRename(null);
      setNewName('');
    }
  };

  const cancelRename = () => {
    setShowRenameDialog(false);
    setItemToRename(null);
    setNewName('');
  };

  // Expose openNewWindow to window object so FileManager can call it
  useEffect(() => {
    (window as any).openTextEditor = (filePath: string, fileName: string) => {
      openNewWindow('texteditor', `TEXT EDITOR - ${fileName}`, filePath);
    };
  }, [openWindows]);

  return (
    <div className="min-h-screen bg-dark-950 text-gray-100 font-mono flex flex-col">
      {/* Top Bar */}
      <div className="h-10 bg-dark-900/90 backdrop-blur-sm border-b border-cyber-500/20 flex items-center justify-between px-3 relative z-50">
        {/* Left: Start Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStartMenu(!showStartMenu)}
            className="flex items-center gap-2 px-3 py-1 hover:bg-cyber-500/10 border border-transparent hover:border-cyber-500/30 transition-all duration-300 relative group"
          >
            <div className="w-1 h-3 bg-cyber-500 animate-pulse-slow" />
            <span className="text-xs text-cyber-500 tracking-wider">START</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </button>

          {/* System Info */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>SYNAPSE</span>
            <div className="w-px h-3 bg-cyber-500/30" />
            <span>{user?.username}</span>
          </div>
        </div>

        {/* Right: System Tray */}
        <div className="flex items-center gap-4">
          {/* Network Indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">{computer?.ip}</span>
          </div>

          {/* System Load */}
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              <div className="w-0.5 h-2 bg-cyber-500/50" />
              <div className="w-0.5 h-3 bg-cyber-500/70" />
              <div className="w-0.5 h-2.5 bg-cyber-500" />
            </div>
            <span className="text-xs text-gray-400">CPU</span>
          </div>

          {/* Clipboard Indicator */}
          {clipboard && (
            <div className="flex items-center gap-1.5 px-2 border-l border-cyber-500/20" title={`${clipboard.operation === 'cut' ? 'Cut' : 'Copied'}: ${clipboard.itemName}`}>
              <span className="text-sm">
                {clipboard.itemName.includes('.') ? '📄' : '📁'}
              </span>
              <span className="text-xs text-gray-400 max-w-20 truncate">
                {clipboard.itemName}
              </span>
              {clipboard.operation === 'cut' && (
                <span className="text-xs text-yellow-500">✂</span>
              )}
            </div>
          )}

          {/* Clock */}
          <div className="flex items-center gap-2 px-2 border-l border-cyber-500/20">
            <span className="text-xs text-cyber-500 tracking-wider">{formatTime(currentTime)}</span>
            <span className="text-xs text-gray-500">{formatDate(currentTime)}</span>
          </div>
        </div>
      </div>

      {/* Start Menu Dropdown */}
      {showStartMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowStartMenu(false)}
          />

          {/* Menu */}
          <div className="absolute top-10 left-3 mt-1 w-64 bg-dark-900/95 backdrop-blur-sm border border-cyber-500/30 corner-brackets z-40">
            <div className="p-3">
              {/* User Info Header */}
              <div className="flex items-center gap-2 pb-3 border-b border-cyber-500/20">
                <div className="w-8 h-8 bg-cyber-500/10 border border-cyber-500/30 flex items-center justify-center">
                  <span className="text-cyber-500 text-xs">{user?.username.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div className="text-xs text-gray-100">{user?.username}</div>
                  <div className="text-xs text-gray-500">{user?.email}</div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="mt-3 space-y-1">
                <button
                  onClick={() => openNewWindow('terminal', 'TERMINAL')}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500 transition-colors duration-200 flex items-center gap-2"
                >
                  <div className="w-1 h-1 bg-cyber-500 rounded-full" />
                  Terminal
                </button>
                <button
                  onClick={() => openNewWindow('filemanager', 'FILE MANAGER')}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500 transition-colors duration-200 flex items-center gap-2"
                >
                  <div className="w-1 h-1 bg-cyber-500 rounded-full" />
                  File Manager
                </button>
                <button
                  onClick={() => openNewWindow('sysmonitor', 'SYSTEM MONITOR')}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500 transition-colors duration-200 flex items-center gap-2"
                >
                  <div className="w-1 h-1 bg-cyber-500 rounded-full" />
                  System Monitor
                </button>
                <button
                  onClick={() => openNewWindow('texteditor', 'TEXT EDITOR - New File')}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500 transition-colors duration-200 flex items-center gap-2"
                >
                  <div className="w-1 h-1 bg-cyber-500 rounded-full" />
                  Text Editor
                </button>
                <button className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500 transition-colors duration-200 flex items-center gap-2 opacity-50 cursor-not-allowed">
                  <div className="w-1 h-1 bg-gray-500 rounded-full" />
                  Network Scanner (Soon)
                </button>

                <div className="border-t border-cyber-500/20 my-2" />

                <button className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-cyber-500/10 hover:text-cyber-500 transition-colors duration-200 flex items-center gap-2">
                  <div className="w-1 h-1 bg-cyber-500 rounded-full" />
                  Settings
                </button>

                <div className="border-t border-red-500/20 my-2" />

                <button
                  onClick={handleDestroyComputer}
                  className="w-full text-left px-3 py-2 text-xs text-orange-400 hover:bg-orange-500/10 hover:text-orange-500 transition-colors duration-200 flex items-center gap-2"
                >
                  <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" />
                  💣 Destroy & Reset PC
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-colors duration-200 flex items-center gap-2"
                >
                  <div className="w-1 h-1 bg-red-500 rounded-full" />
                  Logout
                </button>
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 border-t border-cyber-500/20">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>SYS.V1.0.0</span>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                    <span>SECURE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Desktop Area */}
      <div className="flex-1 relative overflow-hidden pb-10" onContextMenu={handleEmptySpaceContextMenu}>
        {/* Grid background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0, 163, 255, 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 163, 255, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '80px 80px'
            }}
          />
        </div>

        {/* Scan line effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-cyber-500/30 to-transparent animate-scan" />
        </div>

        {/* Desktop Icons */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 flex-wrap" style={{ maxHeight: 'calc(100% - 2rem)' }}>
          {desktopItems.filter(item => !item.name.startsWith('.')).map((item, index) => {
            const desktopPath = user?.username ? `/home/${user.username}/Desktop` : '';
            const itemPath = `${desktopPath}/${item.name}`;
            const isCut = clipboard?.operation === 'cut' && clipboard?.sourcePath === itemPath;

            return (
              <DesktopIcon
                key={`${item.name}-${index}`}
                name={item.name}
                type={item.type}
                path={item.path || ''}
                onDoubleClick={() => handleDesktopIconDoubleClick(item)}
                onContextMenu={(e) => handleDesktopContextMenu(e, item)}
                isCut={isCut}
              />
            );
          })}
        </div>

        {/* Desktop Content - Windows */}
        <div className="relative h-full">
          {openWindows.map(window => (
            <Window
              key={window.id}
              id={window.id}
              title={window.title}
              initialX={window.x}
              initialY={window.y}
              initialWidth={window.type === 'terminal' ? 600 : window.type === 'sysmonitor' ? 700 : window.type === 'texteditor' ? 650 : 500}
              initialHeight={window.type === 'terminal' ? 400 : window.type === 'sysmonitor' ? 500 : window.type === 'texteditor' ? 450 : 350}
              onFocus={handleWindowFocus}
              onMinimize={handleWindowMinimize}
              onClose={handleWindowClose}
              isMinimized={minimizedWindows[window.id]}
              zIndex={windowZIndices[window.id] || 1}
            >
              {window.type === 'terminal' ? (
                <TerminalContent windowId={window.id} />
              ) : window.type === 'filemanager' ? (
                <FileManagerContent windowId={window.id} initialPath={window.filePath} />
              ) : window.type === 'texteditor' ? (
                <TextEditorContent windowId={window.id} filePath={window.filePath} />
              ) : window.type === 'sysmonitor' ? (
                <div className="h-full overflow-auto">
                  {/* Hardware Section */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyber-500/20">
                      <div className="w-1 h-3 bg-cyber-500 animate-pulse-slow" />
                      <span className="text-xs text-cyber-500 tracking-wider">HARDWARE</span>
                    </div>

                    {/* CPU */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-400">CPU</span>
                        <span className="text-xs text-cyber-500">{computer?.hardware?.cpu || 'Intel i7-9700K'} • {Math.floor(Math.random() * 40 + 20)}%</span>
                      </div>
                      <div className="h-2 bg-dark-800 border border-cyber-500/30 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyber-700 via-cyber-500 to-cyber-300 transition-all duration-500"
                          style={{ width: `${Math.floor(Math.random() * 40 + 20)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>{computer?.hardware?.cores || 8} Cores</span>
                        <span>3.6 GHz</span>
                      </div>
                    </div>

                    {/* RAM */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-400">RAM</span>
                        <span className="text-xs text-cyber-500">{computer?.hardware?.ram ? `${Math.floor(computer.hardware.ram * 0.65)}GB / ${computer.hardware.ram}GB` : '10GB / 16GB'}</span>
                      </div>
                      <div className="h-2 bg-dark-800 border border-cyber-500/30 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyber-700 via-cyber-500 to-cyber-300"
                          style={{ width: computer?.hardware?.ram ? `${(0.65 * 100).toFixed(0)}%` : '65%' }}
                        />
                      </div>
                    </div>

                    {/* Disk(s) - Dynamic rendering from disks[] array */}
                    {(computer?.hardware?.disks || []).map((disk: any, index: number) => (
                      <div key={disk.id || index} className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-400">
                            DISK {index} ({disk.type?.toUpperCase() || 'HDD'})
                          </span>
                          <span className="text-xs text-cyber-500">
                            {disk.capacity >= 1024
                              ? `${Math.floor(disk.capacity / 1024)}GB`
                              : `${disk.capacity}MB`}
                          </span>
                        </div>
                        <div className="h-2 bg-dark-800 border border-cyber-500/30 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyber-700 via-cyber-500 to-cyber-300"
                            style={{ width: '15%' }}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Fallback for legacy computers without disks[] */}
                    {(!computer?.hardware?.disks || computer.hardware.disks.length === 0) && computer?.hardware?.disk && (
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-400">DISK 0 (HDD)</span>
                          <span className="text-xs text-cyber-500">
                            {computer.hardware.disk.capacity >= 1024
                              ? `${Math.floor(computer.hardware.disk.capacity / 1024)}GB`
                              : `${computer.hardware.disk.capacity}MB`}
                          </span>
                        </div>
                        <div className="h-2 bg-dark-800 border border-cyber-500/30 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyber-700 via-cyber-500 to-cyber-300"
                            style={{ width: '15%' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* GPU */}
                    {computer?.hardware?.gpu && (
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-400">GPU</span>
                          <span className="text-xs text-cyber-500">{computer.hardware.gpu}</span>
                        </div>
                        <div className="text-xs text-gray-600">4GB VRAM</div>
                      </div>
                    )}
                  </div>

                  {/* System Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyber-500/20">
                      <div className="w-1 h-3 bg-cyber-500 animate-pulse-slow" />
                      <span className="text-xs text-cyber-500 tracking-wider">SYSTEM</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">OS</span>
                        <span className="text-gray-300">Synapse v1.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Hostname</span>
                        <span className="text-gray-300">{computer?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">IP Address</span>
                        <span className="text-cyber-500">{computer?.ip}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">MAC Address</span>
                        <span className="text-gray-300">
                          {computer?.ip?.split('.').map(n => parseInt(n).toString(16).padStart(2, '0')).join(':').toUpperCase() || 'XX:XX:XX:XX:XX:XX'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Uptime</span>
                        <span className="text-gray-300">{Math.floor(Math.random() * 72)}h {Math.floor(Math.random() * 60)}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">User</span>
                        <span className="text-gray-300">{user?.username}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </Window>
          ))}
        </div>
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
        <div className="fixed inset-0 bg-dark-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="w-full max-w-md border border-cyber-500/30 bg-dark-800/50 p-4 space-y-4 mx-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-cyber-500" />
              <h3 className="text-sm text-cyber-500">RENAME ITEM</h3>
            </div>

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

      {/* Context Menu */}
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

      {/* Taskbar - Bottom */}
      <div className="h-10 bg-dark-900/90 backdrop-blur-sm border-t border-cyber-500/20 fixed bottom-0 left-0 right-0 z-50">
        <div className="h-full flex items-center px-3 gap-2">
          {openWindows.filter(w => minimizedWindows[w.id]).map(window => (
            <button
              key={window.id}
              onClick={() => handleTaskbarClick(window.id)}
              className="flex items-center gap-2 px-3 py-1 bg-dark-800/80 border border-cyber-500/30 hover:border-cyber-500/50 hover:bg-cyber-500/10 transition-all duration-200 group relative"
            >
              <div className="w-1 h-3 bg-cyber-500 animate-pulse-slow" />
              <span className="text-xs text-gray-300 tracking-wider">{window.title}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </button>
          ))}

          {openWindows.filter(w => minimizedWindows[w.id]).length === 0 && (
            <div className="text-xs text-gray-600 italic">No minimized windows</div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
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

export default Desktop;
