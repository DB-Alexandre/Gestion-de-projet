import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { UserPlus, Trash2, Edit2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../lib/auth';
import { storage } from '../lib/storage';

interface AdminPageProps {
  users: User[];
  onUpdateUsers: (users: User[]) => void;
}

export function AdminPage({ users, onUpdateUsers }: AdminPageProps) {
  const [newUser, setNewUser] = useState({
    email: '',
    fullName: '',
    avatarUrl: '',
    roles: [] as UserRole[],
    password: ''
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (newUser.password.length < 6) {
        toast.error('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }

      if (users.some(user => user.email === newUser.email)) {
        toast.error('Cet email est déjà utilisé');
        return;
      }

      const hashedPassword = await auth.hashPassword(newUser.password);

      const user: User = {
        id: Date.now().toString(),
        ...newUser,
        password: hashedPassword,
        isAdmin: newUser.roles.includes('admin'),
        roles: newUser.roles
      };

      const updatedUsers = [...users, user];
      await storage.saveUsers(updatedUsers);
      onUpdateUsers(updatedUsers);
      
      setNewUser({ email: '', fullName: '', avatarUrl: '', roles: [], password: '' });
      toast.success('Utilisateur ajouté avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'utilisateur:', error);
      toast.error('Erreur lors de l\'ajout de l\'utilisateur');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updatedUsers = await Promise.all(users.map(async user => {
        if (user.id === editingUser.id) {
          const password = editingUser.password
            ? await auth.hashPassword(editingUser.password)
            : user.password;

          const updatedUser = {
            ...editingUser,
            password,
            isAdmin: editingUser.roles?.includes('admin') || false,
            roles: editingUser.roles || []
          };

          return updatedUser;
        }
        return user;
      }));

      await storage.saveUsers(updatedUsers);
      onUpdateUsers(updatedUsers);
      setEditingUser(null);
      toast.success('Utilisateur modifié avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
      toast.error('Erreur lors de la mise à jour de l\'utilisateur');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const updatedUsers = users.filter(user => user.id !== userId);
      await storage.saveUsers(updatedUsers);
      onUpdateUsers(updatedUsers);
      toast.success('Utilisateur supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error);
      toast.error('Erreur lors de la suppression de l\'utilisateur');
    }
  };

  const handleRoleToggle = (role: UserRole, isEditing: boolean = false) => {
    if (isEditing && editingUser) {
      const currentRoles = editingUser.roles || [];
      setEditingUser(prev => ({
        ...prev,
        roles: currentRoles.includes(role)
          ? currentRoles.filter(r => r !== role)
          : [...currentRoles, role]
      }));
    } else {
      const currentRoles = newUser.roles || [];
      setNewUser(prev => ({
        ...prev,
        roles: currentRoles.includes(role)
          ? currentRoles.filter(r => r !== role)
          : [...currentRoles, role]
      }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Administration des Utilisateurs</h2>
      
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">
          {editingUser ? 'Modifier un utilisateur' : 'Ajouter un utilisateur'}
        </h3>
        <form onSubmit={editingUser ? handleUpdateUser : handleAddUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={editingUser ? editingUser.email : newUser.email}
                onChange={e => editingUser 
                  ? setEditingUser({...editingUser, email: e.target.value})
                  : setNewUser({...newUser, email: e.target.value})
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nom complet</label>
              <input
                type="text"
                required
                value={editingUser ? editingUser.fullName : newUser.fullName}
                onChange={e => editingUser
                  ? setEditingUser({...editingUser, fullName: e.target.value})
                  : setNewUser({...newUser, fullName: e.target.value})
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {editingUser ? 'Nouveau mot de passe (laisser vide pour ne pas modifier)' : 'Mot de passe'}
            </label>
            <input
              type="password"
              required={!editingUser}
              value={editingUser ? editingUser.password : newUser.password}
              onChange={e => editingUser
                ? setEditingUser({...editingUser, password: e.target.value})
                : setNewUser({...newUser, password: e.target.value})
              }
              minLength={6}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Le mot de passe doit contenir au moins 6 caractères
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">URL de l'avatar</label>
            <input
              type="url"
              value={editingUser ? editingUser.avatarUrl : newUser.avatarUrl}
              onChange={e => editingUser
                ? setEditingUser({...editingUser, avatarUrl: e.target.value})
                : setNewUser({...newUser, avatarUrl: e.target.value})
              }
              placeholder="https://example.com/avatar.jpg"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôles</label>
            <div className="flex gap-4">
              {(['admin', 'builder', 'developer', 'designer'] as const).map(role => (
                <label key={role} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingUser 
                      ? editingUser.roles?.includes(role) || false
                      : newUser.roles?.includes(role) || false
                    }
                    onChange={() => handleRoleToggle(role, !!editingUser)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingUser && (
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <X size={20} />
                Annuler
              </button>
            )}
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {editingUser ? <Edit2 size={20} /> : <UserPlus size={20} />}
              {editingUser ? 'Mettre à jour' : 'Ajouter l\'utilisateur'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Utilisateurs existants</h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {users.map(user => (
            <li key={user.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img
                  src={user.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'}
                  alt={user.fullName}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <p className="font-medium">{user.fullName}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <p className="text-xs text-gray-500">
                    Rôles: {user.roles?.join(', ') || 'Aucun rôle'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingUser({...user, password: ''})}
                  className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50"
                >
                  <Edit2 size={20} />
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}