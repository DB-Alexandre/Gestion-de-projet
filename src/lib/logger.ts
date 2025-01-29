import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

class Logger {
  private static formatLogEntry(entry: LogEntry): string {
    const timestamp = format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr });
    let logMessage = `[${timestamp}] ${entry.level}: ${entry.message}`;

    if (entry.context) {
      logMessage += `\nContexte: ${JSON.stringify(entry.context, null, 2)}`;
    }

    if (entry.stack) {
      logMessage += `\nStack: ${entry.stack}`;
    }

    return logMessage;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack: error?.stack
    };

    const formattedEntry = Logger.formatLogEntry(entry);

    // Stocker les logs dans le localStorage
    try {
      const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
      logs.push(entry);
      
      // Garder seulement les 1000 derniers logs
      while (logs.length > 1000) {
        logs.shift();
      }
      
      localStorage.setItem('app_logs', JSON.stringify(logs));
    } catch (error) {
      console.error('Erreur lors du stockage des logs:', error);
    }

    // Afficher dans la console avec la couleur appropriée
    switch (level) {
      case 'INFO':
        console.log('%c' + formattedEntry, 'color: #0ea5e9');
        break;
      case 'WARN':
        console.warn(formattedEntry);
        break;
      case 'ERROR':
        console.error(formattedEntry);
        break;
      case 'FATAL':
        console.error('%c' + formattedEntry, 'color: #dc2626; font-weight: bold');
        break;
    }
  }

  info(message: string, context?: Record<string, any>) {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('WARN', message, context);
  }

  error(message: string, context?: Record<string, any>, error?: Error) {
    this.log('ERROR', message, context, error);
  }

  fatal(message: string, context?: Record<string, any>, error?: Error) {
    this.log('FATAL', message, context, error);
  }

  // Méthode utilitaire pour récupérer les logs
  getLogs(): LogEntry[] {
    try {
      return JSON.parse(localStorage.getItem('app_logs') || '[]');
    } catch {
      return [];
    }
  }

  // Méthode pour effacer les logs
  clearLogs() {
    localStorage.removeItem('app_logs');
  }
}

export const logger = new Logger();