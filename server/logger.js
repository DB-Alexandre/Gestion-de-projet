import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ServerLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.errorLogPath = path.join(this.logDir, 'error.log');
    this.maxLogSize = 5 * 1024 * 1024; // 5 MB
    this.initLogDirectory();
  }

  initLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatLogEntry(level, message, context, stack) {
    const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm:ss', { locale: fr });
    let logMessage = `[${timestamp}] ${level}: ${message}`;

    if (context) {
      logMessage += `\nContexte: ${JSON.stringify(context, null, 2)}`;
    }

    if (stack) {
      logMessage += `\nStack: ${stack}`;
    }

    return `${logMessage}\n${'-'.repeat(80)}\n`;
  }

  async rotateLogFileIfNeeded() {
    try {
      const stats = await fs.promises.stat(this.errorLogPath);
      if (stats.size >= this.maxLogSize) {
        const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm-ss');
        const backupPath = path.join(this.logDir, `error-${timestamp}.log`);
        await fs.promises.rename(this.errorLogPath, backupPath);
      }
    } catch (error) {
      // Le fichier n'existe pas encore, pas besoin de rotation
    }
  }

  async log(level, message, context, error) {
    try {
      await this.rotateLogFileIfNeeded();

      const formattedEntry = this.formatLogEntry(
        level,
        message,
        context,
        error?.stack
      );

      await fs.promises.appendFile(this.errorLogPath, formattedEntry);

      // Afficher aussi dans la console du serveur
      console.log(formattedEntry);
    } catch (error) {
      console.error('Erreur lors de l\'écriture dans le fichier de log:', error);
    }
  }

  async info(message, context) {
    await this.log('INFO', message, context);
  }

  async warn(message, context) {
    await this.log('WARN', message, context);
  }

  async error(message, context, error) {
    await this.log('ERROR', message, context, error);
  }

  async fatal(message, context, error) {
    await this.log('FATAL', message, context, error);
  }
}

export const logger = new ServerLogger();