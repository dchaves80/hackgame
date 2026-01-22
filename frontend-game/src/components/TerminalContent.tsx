import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import fileSystemEvents from '../services/fileSystemEvents';
import socketService from '../services/socketService';
import { useAuth } from '../contexts/AuthContext';

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  content: string;
  prompt?: string;
}

interface TerminalContentProps {
  windowId: string;
}

const TerminalContent = ({ windowId }: TerminalContentProps) => {
  const { computer } = useAuth();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [workingDir, setWorkingDir] = useState('/home/user');
  const [hostname, setHostname] = useState('pc');
  const [username, setUsername] = useState('user');
  const [isExecuting, setIsExecuting] = useState(false);  // Block input while command runs
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const currentCommandIdRef = useRef<string | null>(null);

  // Load terminal session on mount or when computer changes
  useEffect(() => {
    if (computer?._id) {
      loadSession();
    }
  }, [computer?._id]);

  // Auto-scroll to bottom when new lines added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Listen for streaming output via WebSocket
  useEffect(() => {
    const unsubOutput = socketService.on('terminal:output', (data: {
      commandId: string;
      line: string;
    }) => {
      // Only process if it's for our current command
      if (data.commandId === currentCommandIdRef.current) {
        setLines(prev => [...prev, {
          type: 'output',
          content: data.line
        }]);
      }
    });

    return () => {
      unsubOutput();
    };
  }, []);

  // Focus input when clicking terminal
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  // Load terminal session info
  const loadSession = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = computer?._id
        ? `http://localhost:3000/api/terminal/session?computerId=${computer._id}`
        : 'http://localhost:3000/api/terminal/session';
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setWorkingDir(response.data.workingDir);
      setHostname(response.data.hostname);
      setUsername(response.data.username);

      // Add welcome message
      setLines([
        { type: 'output', content: `Welcome to Synapse Terminal` },
        { type: 'output', content: `Type 'help' for available commands` },
        { type: 'output', content: '' }
      ]);
    } catch (error) {
      console.error('Failed to load session:', error);
      setLines([{ type: 'error', content: 'Failed to initialize terminal session' }]);
    }
  };

  // Execute command
  const executeCommand = async (commandLine: string) => {
    const trimmed = commandLine.trim();
    if (!trimmed) return;

    // Add command to history
    setCommandHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);

    // Add input line to terminal
    const prompt = `${username}@${hostname}:${workingDir}$`;
    setLines(prev => [...prev, { type: 'input', content: trimmed, prompt }]);

    // Parse command and arguments
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    // Generate commandId for WebSocket correlation
    const commandId = crypto.randomUUID();
    currentCommandIdRef.current = commandId;

    // Block input while executing
    setIsExecuting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:3000/api/terminal/execute',
        { command, args, commandId, computerId: computer?._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Don't clear commandId here - late WebSocket events may still arrive
      // It will be overwritten by the next command

      // Update working directory if changed
      if (response.data.workingDir) {
        setWorkingDir(response.data.workingDir);
      }

      // Handle clear command
      if (response.data.clear) {
        setLines([]);
        setCurrentInput('');
        return;
      }

      // Handle error output from HTTP response (exitCode != 0)
      if (response.data.exitCode !== 0 && response.data.output) {
        const outputLines = response.data.output.split('\n');
        setLines(prev => [
          ...prev,
          ...outputLines.map((line: string) => ({
            type: 'error' as const,
            content: line
          }))
        ]);
      }

      // Notify fileSystemEvents for any affected paths (for Desktop/FileManager sync)
      if (response.data.affectedPaths && response.data.affectedPaths.length > 0) {
        response.data.affectedPaths.forEach((path: string) => {
          fileSystemEvents.notify(path, { action: 'refresh' });
        });
      }
    } catch (error: any) {
      console.error('Command execution error:', error);
      setLines(prev => [
        ...prev,
        { type: 'error', content: error.response?.data?.error || 'Command execution failed' }
      ]);
    } finally {
      // Re-enable input after command finishes
      setIsExecuting(false);
    }

    // Clear input
    setCurrentInput('');
  };

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Block input while executing
    if (isExecuting) return;

    if (e.key === 'Enter') {
      executeCommand(currentInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setCurrentInput(commandHistory[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;

      const newIndex = historyIndex + 1;
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setCurrentInput('');
      } else {
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // TODO: Implement tab completion
    }
  };

  const getPrompt = () => {
    return `${username}@${hostname}:${workingDir}$`;
  };

  return (
    <div
      ref={terminalRef}
      onClick={handleTerminalClick}
      className="h-full bg-black/90 p-3 font-mono text-sm overflow-y-auto cursor-text"
    >
      {/* Terminal output */}
      <div className="space-y-1">
        {lines.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap break-words">
            {line.type === 'input' ? (
              <div className="flex gap-2">
                <span className="text-green-400 flex-shrink-0">{line.prompt}</span>
                <span className="text-gray-100">{line.content}</span>
              </div>
            ) : (
              <span className={line.type === 'error' ? 'text-red-400' : 'text-gray-300'}>
                {line.content}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Current input line - hidden while executing */}
      {!isExecuting && (
        <div className="flex gap-2 items-center mt-1">
          <span className="text-green-400 flex-shrink-0">{getPrompt()}</span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-gray-100 outline-none border-none"
            autoFocus
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
};

export default TerminalContent;
