export type UserRole = 'admin' | 'builder' | 'developer' | 'designer';

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  isAdmin: boolean;
  roles: UserRole[];
  password: string;
}

export type TaskCategory = 'builder' | 'developer' | 'designer';
export type TaskStatus = 'à faire' | 'en cours' | 'terminé';

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string;
  category: TaskCategory;
  status: TaskStatus;
  createdAt: string;
  assignedTo: string;
  createdBy: string;
  order?: number; // Ajout du champ order pour gérer l'ordre des tâches
}