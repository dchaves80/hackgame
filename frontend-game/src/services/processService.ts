import api from './api';

export interface ProcessInfo {
  pid: number;
  processId?: string;
  name: string;
  user?: string;
  cpu?: number;
  mem?: number;
  status?: string;
  type?: string;
}

/**
 * Create a new process (for windows/applications)
 */
export const createProcess = async (name: string, type: string = 'user'): Promise<ProcessInfo> => {
  const response = await api.post('/api/processes', { name, type });
  return response.data;
};

/**
 * Delete/kill a process by PID
 */
export const deleteProcess = async (pid: number): Promise<void> => {
  await api.delete(`/api/processes/${pid}`);
};

/**
 * List all processes for current computer
 */
export const listProcesses = async (): Promise<ProcessInfo[]> => {
  const response = await api.get('/api/processes');
  return response.data.processes;
};

export default {
  createProcess,
  deleteProcess,
  listProcesses
};
