// FileSystem Events Service
// Permite que múltiples ventanas del File Manager se sincronicen

type EventCallback = (data: any) => void;

class FileSystemEvents {
  private listeners: Map<string, Set<EventCallback>>;

  constructor() {
    this.listeners = new Map();
  }

  // Suscribirse a cambios en un directorio específico
  subscribe(path: string, callback: EventCallback): () => void {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }

    this.listeners.get(path)!.add(callback);

    // Retorna función para desuscribirse
    return () => {
      const callbacks = this.listeners.get(path);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }

  // Notificar cambios en un directorio
  notify(path: string, data?: any) {
    const callbacks = this.listeners.get(path);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Obtener número de suscriptores para un path
  getSubscriberCount(path: string): number {
    return this.listeners.get(path)?.size || 0;
  }
}

// Singleton
const fileSystemEvents = new FileSystemEvents();

export default fileSystemEvents;
