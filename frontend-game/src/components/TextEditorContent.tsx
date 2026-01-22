import { useState, useEffect } from 'react';
import axios from 'axios';
import fileSystemEvents from '../services/fileSystemEvents';

interface TextEditorContentProps {
  windowId: string;
  filePath?: string;
}

interface FileData {
  name: string;
  path: string;
  type: string;
  size: number;
  content: string;
  owner: string;
  permissions: string;
  createdAt: string;
  modifiedAt: string;
}

const TextEditorContent = ({ windowId, filePath }: TextEditorContentProps) => {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState('/home');
  const [saveAsName, setSaveAsName] = useState('');
  const [compileMessage, setCompileMessage] = useState('');

  useEffect(() => {
    if (filePath) {
      loadFile(filePath);
    } else {
      // New file - start in editing mode
      setIsEditing(true);
      setEditedContent('');
    }
  }, [filePath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing && (e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (editedContent !== fileData?.content) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, editedContent, fileData]);

  const loadFile = async (path: string) => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:3000/api/filesystem/file${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setFileData(response.data);
      setEditedContent(response.data.content || '');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (fileData) {
      setEditedContent(fileData.content);
    }
  };

  const handleSave = async () => {
    // If it's a new file (no filePath), show Save As dialog
    if (!filePath) {
      setShowSaveAsDialog(true);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:3000/api/filesystem/file${filePath}`,
        {
          content: editedContent
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Update fileData with new content
      if (fileData) {
        setFileData({
          ...fileData,
          content: editedContent,
          size: new Blob([editedContent]).size,
          modifiedAt: new Date().toISOString()
        });
      }

      // Notify other windows about file update
      const parentPath = filePath.split('/').slice(0, -1).join('/') || '/';
      const fileName = filePath.split('/').pop();
      console.log('🔔 Notifying other windows about file update:', parentPath);
      fileSystemEvents.notify(parentPath, { action: 'update', name: fileName });

      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAs = async () => {
    if (!saveAsName.trim()) {
      setError('File name cannot be empty');
      return;
    }

    const newFilePath = `${saveAsPath}/${saveAsName.trim()}`;
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `http://localhost:3000/api/filesystem/file${newFilePath}`,
        {
          content: editedContent
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Create fileData for the newly saved file
      setFileData({
        name: saveAsName.trim(),
        path: newFilePath,
        type: response.data.file.type,
        size: response.data.file.size,
        content: editedContent,
        owner: 'user',
        permissions: '644',
        createdAt: response.data.file.modifiedAt,
        modifiedAt: response.data.file.modifiedAt
      });

      setShowSaveAsDialog(false);
      setIsEditing(false);

      // Notify other windows about new file creation
      console.log('🔔 Notifying other windows about new file:', saveAsPath);
      fileSystemEvents.notify(saveAsPath, { action: 'create', name: saveAsName.trim() });

      // Update window title via global function
      if ((window as any).updateWindowTitle) {
        (window as any).updateWindowTitle(windowId, `TEXT EDITOR - ${saveAsName.trim()}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompile = async () => {
    if (!filePath) {
      setError('Save the file before compiling');
      return;
    }

    // Check if it's a .syscript file
    if (!filePath.endsWith('.syscript')) {
      setError('Only .syscript files can be compiled');
      return;
    }

    setIsLoading(true);
    setError('');
    setCompileMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3000/api/compiler/compile',
        {
          sourcePath: filePath
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setCompileMessage(`✓ Compiled successfully to ${response.data.outputPath} (${response.data.bytecodeSize} bytes)`);

        // Notify file manager about new binary
        const parentPath = response.data.outputPath.split('/').slice(0, -1).join('/') || '/';
        const binaryName = response.data.outputPath.split('/').pop();
        fileSystemEvents.notify(parentPath, { action: 'create', name: binaryName });
      } else {
        setError(`Compilation failed:\n${response.data.errors.join('\n')}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.join('\n') || 'Compilation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case 'text': return 'TEXT FILE';
      case 'source': return 'SOURCE CODE';
      default: return type.toUpperCase();
    }
  };

  return (
    <div className="h-full flex flex-col relative">
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

      {!filePath && !isEditing ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-4xl mb-4">📝</div>
            <div className="text-xs text-gray-500">No file selected</div>
            <div className="text-xs text-gray-600 mt-1">Open a file from File Manager</div>
          </div>
        </div>
      ) : showSaveAsDialog ? (
        <div className="flex items-center justify-center h-full p-4">
          <div className="w-full max-w-md border border-cyber-500/30 bg-dark-800/50 p-4 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-cyber-500" />
              <h3 className="text-sm text-cyber-500">SAVE FILE AS</h3>
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
              <label className="text-xs text-gray-400 mb-1 block">Directory</label>
              <input
                type="text"
                value={saveAsPath}
                onChange={(e) => setSaveAsPath(e.target.value)}
                className="w-full bg-dark-900 border border-cyber-500/30 text-gray-100 text-xs px-3 py-2 focus:outline-none focus:border-cyber-500"
                placeholder="/home"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">File Name</label>
              <input
                type="text"
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAs();
                  if (e.key === 'Escape') setShowSaveAsDialog(false);
                }}
                className="w-full bg-dark-900 border border-cyber-500/30 text-gray-100 text-xs px-3 py-2 focus:outline-none focus:border-cyber-500"
                placeholder="myfile.txt or script.sc"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveAsDialog(false)}
                className="px-4 py-2 text-xs text-gray-400 border border-gray-600/30 hover:bg-gray-600/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAs}
                className="px-4 py-2 text-xs text-cyber-500 border border-cyber-500/30 hover:bg-cyber-500/10 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (fileData || (!filePath && isEditing)) ? (
        <>
          {/* Error message */}
          {error && (
            <div className="border border-red-500/30 bg-red-500/5 text-red-400 text-xs p-2.5 m-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="whitespace-pre-wrap">{error}</span>
              </div>
            </div>
          )}

          {/* Success message */}
          {compileMessage && (
            <div className="border border-green-500/30 bg-green-500/5 text-green-400 text-xs p-2.5 m-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span>{compileMessage}</span>
              </div>
            </div>
          )}

          {/* File info bar */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-cyber-500/20">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3 bg-cyber-500 animate-pulse-slow" />
              <span className="text-xs text-cyber-500">{fileData?.name || 'Untitled'}</span>
              {fileData && (
                <>
                  <span className="text-xs text-gray-600">|</span>
                  <span className="text-xs text-gray-500">{getFileTypeLabel(fileData.type)}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs">
              {fileData && (
                <>
                  <span className="text-gray-500">{fileData.size}B</span>
                  <span className="text-gray-500">{fileData.owner}:{fileData.permissions}</span>
                </>
              )}
              {!isEditing ? (
                <>
                  <span className="text-cyber-500/50">READ-ONLY</span>
                  {filePath?.endsWith('.syscript') && (
                    <button
                      onClick={handleCompile}
                      className="px-3 py-1 text-green-500 border border-green-500/30 hover:bg-green-500/10 transition-colors"
                    >
                      Compile
                    </button>
                  )}
                  <button
                    onClick={handleEditClick}
                    className="px-3 py-1 text-cyber-500 border border-cyber-500/30 hover:bg-cyber-500/10 transition-colors"
                  >
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <span className="text-yellow-500">{fileData ? 'EDITING' : 'NEW FILE'}</span>
                  <button
                    onClick={handleSave}
                    disabled={fileData && editedContent === fileData.content}
                    className="px-3 py-1 text-cyber-500 border border-cyber-500/30 hover:bg-cyber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  {fileData && (
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-gray-400 border border-gray-600/30 hover:bg-gray-600/10 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-auto">
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-full bg-dark-900 text-gray-100 font-mono text-xs p-3 focus:outline-none resize-none"
                spellCheck={false}
              />
            ) : fileData ? (
              <div className="font-mono text-xs">
                {(fileData.content || '').split('\n').map((line, index) => (
                  <div key={index} className="flex hover:bg-cyber-500/5 transition-colors">
                    <div className="w-12 text-right pr-3 text-gray-600 select-none border-r border-cyber-500/10">
                      {index + 1}
                    </div>
                    <div className="flex-1 px-3 py-0.5 text-gray-100 whitespace-pre">
                      {line || ' '}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-cyber-500/20 text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span>{(isEditing ? editedContent : (fileData?.content || '')).split('\n').length} lines</span>
              <span>{fileData?.path || 'Unsaved'}</span>
              {isEditing && fileData && editedContent !== fileData.content && (
                <span className="text-yellow-500">● Modified</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isEditing ? 'bg-yellow-500' : 'bg-green-500'}`} />
              <span className={isEditing ? 'text-yellow-500' : 'text-green-500'}>
                {isEditing ? (fileData ? 'Editing' : 'New File') : 'Loaded'}
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default TextEditorContent;
