import React, { useState } from 'react';
import { User } from '../types';
import { Mail, User2, Shield, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { storage } from '../lib/storage';
import { auth } from '../lib/auth';
import bcrypt from 'bcryptjs';

interface ProfilePageProps {
  user: User;
}

export function ProfilePage({ user }: ProfilePageProps) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'builder':
        return 'bg-blue-100 text-blue-800';
      case 'developer':
        return 'bg-green-100 text-green-800';
      case 'designer':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Récupérer l'utilisateur complet avec le mot de passe chiffré
      const users = await storage.getUsers();
      const currentUser = users.find(u => u.id === user.id);
      
      if (!currentUser) {
        toast.error('Utilisateur non trouvé');
        return;
      }

      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await bcrypt.compare(passwords.current, currentUser.password);
      if (!isCurrentPasswordValid) {
        toast.error('Le mot de passe actuel est incorrect');
        return;
      }

      // Vérifier que le nouveau mot de passe est assez long
      if (passwords.new.length < 6) {
        toast.error('Le nouveau mot de passe doit contenir au moins 6 caractères');
        return;
      }

      // Vérifier que les nouveaux mots de passe correspondent
      if (passwords.new !== passwords.confirm) {
        toast.error('Les nouveaux mots de passe ne correspondent pas');
        return;
      }

      // Chiffrer le nouveau mot de passe
      const hashedPassword = await auth.hashPassword(passwords.new);

      // Mettre à jour le mot de passe
      const updatedUser = { ...currentUser, password: hashedPassword };
      await storage.updateUser(user.id, updatedUser);

      // Réinitialiser le formulaire
      setPasswords({ current: '', new: '', confirm: '' });
      setShowPasswordForm(false);
      toast.success('Mot de passe modifié avec succès');
    } catch (error) {
      console.error('Erreur lors de la modification du mot de passe:', error);
      toast.error('Erreur lors de la modification du mot de passe');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* En-tête du profil */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8">
          <div className="flex items-center">
            <img
              src={user.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'}
              alt={user.fullName}
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
            />
            <div className="ml-6">
              <h1 className="text-2xl font-bold text-white">{user.fullName}</h1>
              <div className="flex items-center mt-2 text-blue-100">
                <Mail size={16} className="mr-2" />
                {user.email}
              </div>
            </div>
          </div>
        </div>

        {/* Informations du profil */}
        <div className="px-6 py-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Shield size={20} className="mr-2" />
              Rôles et Permissions
            </h2>
            <div className="flex flex-wrap gap-2">
              {user.roles && user.roles.map(role => (
                <span
                  key={role}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(role)}`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Lock size={20} className="mr-2" />
              Sécurité
            </h2>
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Changer le mot de passe
              </button>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Mot de passe actuel
                  </label>
                  <input
                    type="password"
                    required
                    value={passwords.current}
                    onChange={e => setPasswords({...passwords, current: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwords.new}
                    onChange={e => setPasswords({...passwords, new: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    required
                    value={passwords.confirm}
                    onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswords({ current: '', new: '', confirm: '' });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Mettre à jour le mot de passe
                  </button>
                </div>
              </form>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <User2 size={20} className="mr-2" />
              Accès aux Fonctionnalités
            </h2>
            <ul className="space-y-3">
              {user.roles && user.roles.includes('admin') && (
                <li className="flex items-center text-gray-700">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Accès à l'administration des utilisateurs
                </li>
              )}
              {user.roles && user.roles.includes('builder') && (
                <li className="flex items-center text-gray-700">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Gestion des tâches de construction
                </li>
              )}
              {user.roles && user.roles.includes('developer') && (
                <li className="flex items-center text-gray-700">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Gestion des tâches de développement
                </li>
              )}
              {user.roles && user.roles.includes('designer') && (
                <li className="flex items-center text-gray-700">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Gestion des tâches de design
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}