import { User } from '../types';
import bcrypt from 'bcryptjs';

// Utilisateurs par défaut avec mot de passe chiffré
const DEFAULT_USERS: User[] = [
  {
    id: '1',
    email: 'admin@example.com',
    fullName: 'Admin',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    isAdmin: true,
    roles: ['admin', 'builder', 'developer', 'designer'],
    password: '$2a$10$zGv/qjgkcrJYVDv2z1HXEOQfu.kQcJEpGXmJJjKJwEJsE.0/hxlPi' // "admin" chiffré
  }
];

// Initialisation du localStorage avec le mot de passe chiffré
if (!localStorage.getItem('users')) {
  localStorage.setItem('users', JSON.stringify(DEFAULT_USERS));
}

export const auth = {
  login: async (email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find((u: User) => u.email === email);
    
    if (user) {
      // Vérifier le mot de passe
      const isValid = await bcrypt.compare(password, user.password);
      
      if (isValid) {
        // S'assurer que l'utilisateur a toujours un tableau de rôles
        if (!Array.isArray(user.roles)) {
          user.roles = [];
        }
        
        // Ne pas stocker le mot de passe dans la session
        const { password: _, ...userWithoutPassword } = user;
        localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        return { user: userWithoutPassword, error: null };
      }
    }
    return { user: null, error: 'Invalid credentials' };
  },

  logout: () => {
    localStorage.removeItem('currentUser');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    
    try {
      const user = JSON.parse(userStr);
      // S'assurer que l'utilisateur a toujours un tableau de rôles
      if (!Array.isArray(user.roles)) {
        user.roles = [];
        // Mettre à jour l'utilisateur dans le localStorage
        localStorage.setItem('currentUser', JSON.stringify(user));
      }
      return user;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      return null;
    }
  },

  // Fonction utilitaire pour chiffrer un mot de passe
  hashPassword: async (password: string): Promise<string> => {
    return bcrypt.hash(password, 10);
  }
};