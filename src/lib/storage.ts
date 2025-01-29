import { Task, User } from '../types';
import { logger } from './logger';

const API_URL = 'http://localhost:3000/api';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
  }
  return response.json();
};

const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 500,
  maxDelay: number = 5000
): Promise<T> => {
  let lastError: Error;
  let currentDelay = initialDelay;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Tentative ${attempt}/${maxRetries} échouée`, {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        attempt,
        maxRetries,
        delay: currentDelay
      });
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay = Math.min(currentDelay * 2, maxDelay);
      }
    }
  }
  
  throw lastError!;
};

class TaskQueue {
  private queue: Task[][] = [];
  private processing = false;
  private retryCount = 0;
  private maxRetries = 3;

  async add(tasks: Task[]): Promise<void> {
    this.queue.push(tasks);
    if (!this.processing) {
      await this.process();
    }
  }

  private async process(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const tasks = this.queue[this.queue.length - 1];

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({ 
          tasks: tasks.map((task, index) => ({
            ...task,
            order: typeof task.order === 'number' ? task.order : index
          }))
        })
      });

      const result = await handleResponse(response);
      if (!result.success) {
        throw new Error('Échec de la sauvegarde des tâches');
      }

      this.queue = [];
      this.retryCount = 0;
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde des tâches', {
        operation: 'TaskQueue.process',
        queueLength: this.queue.length,
        retryCount: this.retryCount
      }, error as Error);

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, this.retryCount), 5000)));
        await this.process();
      } else {
        this.queue = [];
        this.retryCount = 0;
        throw error;
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        await this.process();
      }
    }
  }
}

const taskQueue = new TaskQueue();

export const storage = {
  getTasks: async (): Promise<Task[]> => {
    return retryOperation(async () => {
      try {
        const response = await fetch(`${API_URL}/tasks`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        const data = await handleResponse(response);
        
        return (data || []).map((task: Task, index: number) => ({
          ...task,
          order: typeof task.order === 'number' ? task.order : index,
          status: task.status || 'à faire',
          createdAt: task.createdAt || new Date().toISOString()
        }));
      } catch (error) {
        logger.error('Erreur lors de la récupération des tâches', {
          operation: 'getTasks'
        }, error as Error);
        throw error;
      }
    });
  },

  saveTasks: async (tasks: Task[]): Promise<void> => {
    try {
      await taskQueue.add(tasks);
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde des tâches', {
        operation: 'saveTasks',
        tasksCount: tasks.length
      }, error as Error);
      throw error;
    }
  },

  getUsers: async (): Promise<User[]> => {
    return retryOperation(async () => {
      try {
        const response = await fetch(`${API_URL}/users`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        const data = await handleResponse(response);
        return data || [];
      } catch (error) {
        logger.error('Erreur lors de la récupération des utilisateurs', {
          operation: 'getUsers'
        }, error as Error);
        throw error;
      }
    });
  },

  saveUsers: async (users: User[]): Promise<void> => {
    return retryOperation(async () => {
      try {
        const response = await fetch(`${API_URL}/users`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify({ users })
        });

        const result = await handleResponse(response);
        if (!result.success) {
          throw new Error('Échec de la sauvegarde des utilisateurs');
        }

        return result;
      } catch (error) {
        logger.error('Erreur lors de la sauvegarde des utilisateurs', {
          operation: 'saveUsers',
          usersCount: users.length
        }, error as Error);
        throw error;
      }
    });
  }
};