import { io } from 'socket.io-client';
import { logger } from './logger';

const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  timeout: 10000,
  autoConnect: true
});

socket.on('connect', () => {
  logger.info('Connecté au serveur WebSocket');
});

socket.on('connect_error', (error) => {
  logger.error('Erreur de connexion WebSocket', {
    type: 'connect_error'
  }, error);
});

socket.on('disconnect', (reason) => {
  logger.warn('Déconnecté du serveur WebSocket', {
    reason
  });
});

socket.on('error', (error) => {
  logger.error('Erreur WebSocket', {
    type: 'socket_error'
  }, error);
});

socket.on('reconnect', (attemptNumber) => {
  logger.info('Reconnecté au serveur WebSocket', {
    attemptNumber
  });
});

socket.on('reconnect_attempt', (attemptNumber) => {
  logger.info('Tentative de reconnexion WebSocket', {
    attemptNumber
  });
});

socket.on('reconnect_error', (error) => {
  logger.error('Erreur de reconnexion WebSocket', {
    type: 'reconnect_error'
  }, error);
});

socket.on('reconnect_failed', () => {
  logger.error('Échec de la reconnexion WebSocket', {
    type: 'reconnect_failed'
  });
});

let reconnectTimeout: NodeJS.Timeout;

const handleReconnect = () => {
  if (!socket.connected) {
    logger.info('Tentative de reconnexion manuelle');
    socket.connect();
  }
};

socket.on('disconnect', () => {
  clearTimeout(reconnectTimeout);
  reconnectTimeout = setTimeout(handleReconnect, 5000);
});

export const subscribeToUpdates = (callback: (update: { type: string; data: any }) => void) => {
  const wrappedCallback = (update: { type: string; data: any }) => {
    try {
      callback(update);
    } catch (error) {
      logger.error('Erreur dans le callback de mise à jour', {
        updateType: update.type
      }, error as Error);
    }
  };

  socket.on('update', wrappedCallback);

  return () => {
    socket.off('update', wrappedCallback);
  };
};

export { socket };