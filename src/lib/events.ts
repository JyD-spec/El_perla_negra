// src/lib/events.ts

type Callback = (data?: any) => void;

class EventEmitter {
  private events: Record<string, Callback[]> = {};

  on(event: string, callback: Callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  }

  emit(event: string, data?: any) {
    if (this.events[event]) {
      this.events[event].forEach(cb => cb(data));
    }
  }
}

export const globalEvents = new EventEmitter();
