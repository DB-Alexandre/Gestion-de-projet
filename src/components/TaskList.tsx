import React, { useState } from 'react';
import { Calendar, User2, Pencil, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Task, User, TaskCategory } from '../types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { auth } from '../lib/auth';
import toast from 'react-hot-toast';

interface TaskItemProps {
  task: Task;
  users: User[];
  onStatusChange: (taskId: string, newStatus: Task['status']) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export function TaskItem({ task, users, onStatusChange, onEdit, onDelete }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task>(task);
  const currentUser = auth.getCurrentUser();
  const isOverdue = isPast(new Date(task.deadline)) && task.status !== 'terminé';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignedUser = users.find(u => u.id === task.assignedTo);

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    setEditedTask({ ...task });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!editedTask.title || !editedTask.description || !editedTask.deadline || !editedTask.assignedTo) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    const updatedTask: Task = {
      ...task,
      ...editedTask,
      id: task.id,
      createdAt: task.createdAt,
      createdBy: task.createdBy,
      status: task.status
    };

    onEdit(updatedTask);
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(false);
    setEditedTask(task);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUser?.roles?.includes('admin')) {
      toast.error('Seul un administrateur peut supprimer une tâche');
      return;
    }
    
    onDelete(task.id);
  };

  const categories: TaskCategory[] = ['builder', 'developer', 'designer'];

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white rounded-lg p-4 shadow border border-blue-200"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Titre</label>
            <input
              type="text"
              required
              value={editedTask.title}
              onChange={e => setEditedTask({...editedTask, title: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              required
              value={editedTask.description}
              onChange={e => setEditedTask({...editedTask, description: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Catégorie</label>
            <select
              required
              value={editedTask.category}
              onChange={e => setEditedTask({...editedTask, category: e.target.value as TaskCategory})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date limite</label>
            <input
              type="datetime-local"
              required
              value={editedTask.deadline}
              onChange={e => setEditedTask({...editedTask, deadline: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Assigné à</label>
            <select
              required
              value={editedTask.assignedTo}
              onChange={e => setEditedTask({...editedTask, assignedTo: e.target.value})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Sélectionner un utilisateur</option>
              {users
                .filter(user => 
                  user.roles?.includes(editedTask.category) || 
                  user.roles?.includes('admin')
                )
                .map(user => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              <X size={16} />
              Annuler
            </button>
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Check size={16} />
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow border ${
        isOverdue 
          ? 'border-red-300 bg-red-50' 
          : 'border-gray-200'
      } relative group touch-manipulation`}
      {...attributes}
      {...listeners}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 md:transition-opacity flex gap-2">
        <button
          onClick={handleEdit}
          className="p-1 text-gray-600 hover:text-blue-600 rounded-full hover:bg-blue-50"
          type="button"
        >
          <Pencil size={16} />
        </button>
        {currentUser?.roles?.includes('admin') && (
          <button
            onClick={handleDelete}
            className="p-1 text-gray-600 hover:text-red-600 rounded-full hover:bg-red-50"
            type="button"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <h3 className="font-medium mb-2 pr-16">{task.title}</h3>
      <p className="text-sm text-gray-600 mb-3 break-words">{task.description}</p>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500">
          <div className={`flex items-center ${isOverdue ? 'text-red-600' : ''}`}>
            {isOverdue ? (
              <AlertCircle size={16} className="mr-1 flex-shrink-0" />
            ) : (
              <Calendar size={16} className="mr-1 flex-shrink-0" />
            )}
            <span className="truncate">
              {format(new Date(task.deadline), 'Pp', { locale: fr })}
            </span>
          </div>
          <div className="flex items-center">
            <User2 size={16} className="mr-1 flex-shrink-0" />
            <span className="truncate">{assignedUser?.fullName}</span>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
          task.category === 'builder' ? 'bg-blue-100 text-blue-800' :
          task.category === 'developer' ? 'bg-green-100 text-green-800' :
          'bg-purple-100 text-purple-800'
        }`}>
          {task.category.charAt(0).toUpperCase() + task.category.slice(1)}
        </span>
      </div>
      {isOverdue && (
        <div className="mt-2 text-sm text-red-600 flex items-center">
          <AlertCircle size={14} className="mr-1 flex-shrink-0" />
          Date limite dépassée
        </div>
      )}
    </div>
  );
}