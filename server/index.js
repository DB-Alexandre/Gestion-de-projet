import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const port = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const dataDir = path.join(__dirname, '../src/data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const TASKS_FILE = path.join(dataDir, 'tasks.json');
const USERS_FILE = path.join(dataDir, 'users.json');

const readJsonFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      const defaultContent = filePath === TASKS_FILE ? { tasks: [] } : { users: [] };
      fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
      return defaultContent;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logger.error(`Erreur lors de la lecture du fichier ${filePath}`, {
      filePath,
      operation: 'readJsonFile'
    }, error);
    return filePath === TASKS_FILE ? { tasks: [] } : { users: [] };
  }
};

const writeJsonFile = (filePath, data) => {
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  try {
    // Créer une copie de sauvegarde si le fichier existe
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
    }

    // Écrire d'abord dans un fichier temporaire
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));

    // Vérifier que le fichier temporaire est valide
    const tempContent = fs.readFileSync(tempPath, 'utf8');
    JSON.parse(tempContent); // Vérifie que le JSON est valide

    // Remplacer le fichier original par le fichier temporaire
    fs.renameSync(tempPath, filePath);

    // Supprimer la sauvegarde si tout s'est bien passé
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    return true;
  } catch (error) {
    logger.error(`Erreur lors de l'écriture dans le fichier ${filePath}`, {
      filePath,
      operation: 'writeJsonFile'
    }, error);

    // En cas d'erreur, restaurer la sauvegarde si elle existe
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, filePath);
        fs.unlinkSync(backupPath);
      } catch (restoreError) {
        logger.error('Erreur lors de la restauration de la sauvegarde', {
          filePath,
          operation: 'writeJsonFile-restore'
        }, restoreError);
      }
    }

    // Nettoyer les fichiers temporaires
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        logger.error('Erreur lors du nettoyage des fichiers temporaires', {
          filePath: tempPath,
          operation: 'writeJsonFile-cleanup'
        }, cleanupError);
      }
    }

    return false;
  }
};

const broadcastUpdate = (type, data) => {
  try {
    io.emit('update', { type, data });
  } catch (error) {
    logger.error('Erreur lors de la diffusion des mises à jour', {
      type,
      operation: 'broadcastUpdate'
    }, error);
  }
};

// Middleware pour la validation des données
const validateData = (schema) => (req, res, next) => {
  try {
    if (schema === 'tasks') {
      const { tasks } = req.body;
      if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Les tâches doivent être un tableau' });
      }
      
      const validatedTasks = tasks.map((task, index) => ({
        ...task,
        order: typeof task.order === 'number' ? task.order : index,
        status: task.status || 'à faire',
        createdAt: task.createdAt || new Date().toISOString()
      }));

      req.validatedData = { tasks: validatedTasks };
    } else if (schema === 'users') {
      const { users } = req.body;
      if (!Array.isArray(users)) {
        return res.status(400).json({ error: 'Les utilisateurs doivent être un tableau' });
      }
      req.validatedData = { users };
    }
    next();
  } catch (error) {
    logger.error('Erreur de validation des données', {
      schema,
      operation: 'validateData'
    }, error);
    res.status(400).json({ error: 'Données invalides' });
  }
};

// Routes pour les tâches
app.get('/api/tasks', (req, res) => {
  try {
    const data = readJsonFile(TASKS_FILE);
    res.json(data.tasks);
  } catch (error) {
    logger.error('Erreur lors de la lecture des tâches', {
      operation: 'GET /api/tasks'
    }, error);
    res.status(500).json({ error: 'Erreur lors de la lecture des tâches' });
  }
});

app.put('/api/tasks', validateData('tasks'), (req, res) => {
  try {
    const { tasks } = req.validatedData;
    const success = writeJsonFile(TASKS_FILE, { tasks });
    
    if (!success) {
      return res.status(500).json({ error: 'Erreur lors de l\'écriture des données' });
    }

    broadcastUpdate('tasks', tasks);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour des tâches', {
      operation: 'PUT /api/tasks'
    }, error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des tâches' });
  }
});

// Routes pour les utilisateurs
app.get('/api/users', (req, res) => {
  try {
    const data = readJsonFile(USERS_FILE);
    res.json(data.users);
  } catch (error) {
    logger.error('Erreur lors de la lecture des utilisateurs', {
      operation: 'GET /api/users'
    }, error);
    res.status(500).json({ error: 'Erreur lors de la lecture des utilisateurs' });
  }
});

app.put('/api/users', validateData('users'), (req, res) => {
  try {
    const { users } = req.validatedData;
    const success = writeJsonFile(USERS_FILE, { users });
    
    if (!success) {
      return res.status(500).json({ error: 'Erreur lors de l\'écriture des données' });
    }

    broadcastUpdate('users', users);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour des utilisateurs', {
      operation: 'PUT /api/users'
    }, error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des utilisateurs' });
  }
});

io.on('connection', (socket) => {
  logger.info('Client connecté', { socketId: socket.id });
  
  try {
    const tasks = readJsonFile(TASKS_FILE).tasks;
    const users = readJsonFile(USERS_FILE).users;
    socket.emit('update', { type: 'tasks', data: tasks });
    socket.emit('update', { type: 'users', data: users });
  } catch (error) {
    logger.error('Erreur lors de l\'envoi des données initiales', {
      socketId: socket.id
    }, error);
  }

  socket.on('disconnect', () => {
    logger.info('Client déconnecté', { socketId: socket.id });
  });

  socket.on('error', (error) => {
    logger.error('Erreur WebSocket', {
      socketId: socket.id
    }, error);
  });
});

process.on('uncaughtException', (error) => {
  logger.fatal('Exception non gérée', {
    type: 'uncaughtException'
  }, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Promesse rejetée non gérée', {
    type: 'unhandledRejection',
    reason
  });
});

httpServer.listen(port, () => {
  logger.info(`Serveur démarré sur http://localhost:${port}`);
});
