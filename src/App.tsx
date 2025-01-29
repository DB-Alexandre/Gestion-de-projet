import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast, { Toaster } from 'react-hot-toast';
import { User, Task, TaskCategory, TaskStatus } from './types';
import { AdminPage } from './components/AdminPage';
import { LoginPage } from './components/LoginPage';
import { ProfilePage } from './components/ProfilePage';
import { TaskItem } from './components/TaskList';
import { ThemeToggle } from './components/ThemeToggle';
import { auth } from './lib/auth';
import { storage } from './lib/storage';
import { useTheme } from './lib/theme';
import { socket, subscribeToUpdates } from './lib/socket';
import { logger } from './lib/logger';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  closestCenter,
  UniqueIdentifier,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>('developer');
  const { theme, setTheme } = useTheme();
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    assignedTo: '',
    category: 'developer' as TaskCategory
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const user = auth.getCurrentUser();
    setCurrentUser(user);

    if (user) {
      const loadInitialData = async () => {
        try {
          const [tasksData, usersData] = await Promise.all([
            storage.getTasks(),
            storage.getUsers()
          ]);
          setTasks(tasksData);
          setUsers(usersData);

          const availableCategories = getAvailableCategories(user);
          if (availableCategories.length > 0) {
            setSelectedCategory(availableCategories[0]);
          }
        } catch (error) {
          console.error('Erreur lors du chargement des données:', error);
          toast.error('Erreur lors du chargement des données');
        }
      };

      loadInitialData();

      const unsubscribe = subscribeToUpdates(({ type, data }) => {
        if (type === 'tasks') {
          setTasks(data);
        } else if (type === 'users') {
          setUsers(data);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  const getAvailableCategories = (user: User): TaskCategory[] => {
    if (user.roles?.includes('admin')) {
      return ['builder', 'developer', 'designer'];
    }
    return (user.roles || []).filter(role => 
      ['builder', 'developer', 'designer'].includes(role)
    ) as TaskCategory[];
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!currentUser.roles?.includes(newTask.category) && !currentUser.roles?.includes('admin')) {
      toast.error(`Vous n'avez pas les droits pour créer une tâche de type ${newTask.category}`);
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      ...newTask,
      status: 'à faire',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id,
      order: tasks.length
    };

    try {
      await storage.saveTasks([...tasks, task]);
      setShowNewTaskForm(false);
      setNewTask({
        title: '',
        description: '',
        deadline: '',
        assignedTo: '',
        category: selectedCategory
      });
      toast.success('Tâche créée avec succès');
    } catch (error) {
      logger.error('Erreur lors de la création de la tâche', {
        operation: 'handleCreateTask',
        taskId: task.id
      }, error as Error);
      toast.error('Erreur lors de la création de la tâche');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeTask = tasks.find(t => t.id === activeId);
    const overTask = tasks.find(t => t.id === overId);

    if (!activeTask || !overTask || activeTask.status === overTask.status) {
      return;
    }

    try {
      const updatedTask = { ...activeTask, status: overTask.status };
      const updatedTasks = tasks.map(t => 
        t.id === activeTask.id ? updatedTask : t
      );
      setTasks(updatedTasks);
      storage.saveTasks(updatedTasks);
    } catch (error) {
      logger.error('Erreur lors du changement de statut', {
        operation: 'handleDragOver',
        taskId: activeId,
        newStatus: overTask.status
      }, error as Error);
      toast.error('Erreur lors du changement de statut');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    try {
      const activeTask = tasks.find(t => t.id === active.id);
      const overTask = tasks.find(t => t.id === over.id);

      if (!activeTask || !overTask) return;

      const previousTasks = [...tasks];

      const statusTasks = tasks
        .filter(t => 
          t.status === activeTask.status && 
          t.category === selectedCategory
        )
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      const oldIndex = statusTasks.findIndex(t => t.id === active.id);
      const newIndex = statusTasks.findIndex(t => t.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedTasks = arrayMove(statusTasks, oldIndex, newIndex);

      const updatedTasks = tasks.map(task => {
        const reorderedTask = reorderedTasks.find(t => t.id === task.id);
        if (reorderedTask) {
          return {
            ...task,
            order: reorderedTasks.findIndex(t => t.id === task.id)
          };
        }
        return task;
      });

      setTasks(updatedTasks);

      storage.saveTasks(updatedTasks).catch(error => {
        setTasks(previousTasks);
        logger.error('Erreur lors de la réorganisation des tâches', {
          operation: 'handleDragEnd',
          activeId: active.id,
          overId: over.id
        }, error as Error);
        toast.error('Erreur lors de la réorganisation des tâches');
      });
    } catch (error) {
      logger.error('Erreur lors de la réorganisation des tâches', {
        operation: 'handleDragEnd',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      toast.error('Erreur lors de la réorganisation des tâches');
    }
  };

  const handleLogout = () => {
    auth.logout();
    setCurrentUser(null);
    setTasks([]);
    setUsers([]);
  };

  if (!currentUser) {
    return <LoginPage />;
  }

  const availableCategories = getAvailableCategories(currentUser);
  const filteredTasks = tasks.filter(task => task.category === selectedCategory);

  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    } transition-colors duration-200`}>
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className={`${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } border-b`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <h1 className="text-3xl font-bold">Gestion de Projet</h1>
              <nav className="flex gap-4">
                <button
                  onClick={() => {
                    setShowAdminPage(false);
                    setShowProfilePage(false);
                  }}
                  className={`px-3 py-2 rounded-md ${
                    !showAdminPage && !showProfilePage
                      ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      : 'hover:bg-gray-700'
                  }`}
                >
                  Tâches
                </button>
                {currentUser.roles?.includes('admin') && (
                  <button
                    onClick={() => {
                      setShowAdminPage(true);
                      setShowProfilePage(false);
                    }}
                    className={`px-3 py-2 rounded-md flex items-center gap-2 ${
                      showAdminPage
                        ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        : 'hover:bg-gray-700'
                    }`}
                  >
                    Administration
                  </button>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle theme={theme} setTheme={setTheme} />
              <button
                onClick={() => {
                  setShowProfilePage(true);
                  setShowAdminPage(false);
                }}
                className="flex items-center gap-2 text-sm hover:opacity-80"
              >
                <span>{currentUser.fullName}</span>
                {currentUser.avatarUrl && (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    className="w-10 h-10 rounded-full"
                  />
                )}
              </button>
              <button
                onClick={handleLogout}
                className="text-sm hover:opacity-80"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {showProfilePage ? (
          <ProfilePage user={currentUser} />
        ) : showAdminPage && currentUser.roles?.includes('admin') ? (
          <AdminPage users={users} onUpdateUsers={async (newUsers) => {
            try {
              await storage.saveUsers(newUsers);
            } catch (error) {
              logger.error('Erreur lors de la mise à jour des utilisateurs', {
                operation: 'updateUsers'
              }, error as Error);
              toast.error('Erreur lors de la mise à jour des utilisateurs');
            }
          }} />
        ) : (
          <>
            {/* Sélection de catégorie */}
            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                {availableCategories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-md ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowNewTaskForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={20} />
                Nouvelle Tâche
              </button>
            </div>

            {/* Formulaire Nouvelle Tâche */}
            {showNewTaskForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className={`${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                } rounded-lg p-6 w-full max-w-md`}>
                  <h2 className="text-xl font-bold mb-4">Nouvelle Tâche</h2>
                  <form onSubmit={handleCreateTask}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium">Titre</label>
                        <input
                          type="text"
                          required
                          value={newTask.title}
                          onChange={e => setNewTask({...newTask, title: e.target.value})}
                          className={`mt-1 block w-full rounded-md ${
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600'
                              : 'border-gray-300'
                          } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Description</label>
                        <textarea
                          required
                          value={newTask.description}
                          onChange={e => setNewTask({...newTask, description: e.target.value})}
                          className={`mt-1 block w-full rounded-md ${
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600'
                              : 'border-gray-300'
                          } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Catégorie</label>
                        <select
                          required
                          value={newTask.category}
                          onChange={e => setNewTask({...newTask, category: e.target.value as TaskCategory})}
                          className={`mt-1 block w-full rounded-md ${
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600'
                              : 'border-gray-300'
                          } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                        >
                          {availableCategories.map(category => (
                            <option key={category} value={category}>
                              {category.charAt(0).toUpperCase() + category.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Date limite</label>
                        <input
                          type="datetime-local"
                          required
                          value={newTask.deadline}
                          onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                          className={`mt-1 block w-full rounded-md ${
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600'
                              : 'border-gray-300'
                          } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Assigné à</label>
                        <select
                          required
                          value={newTask.assignedTo}
                          onChange={e => setNewTask({...newTask, assignedTo: e.target.value})}
                          className={`mt-1 block w-full rounded-md ${
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600'
                              : 'border-gray-300'
                          } shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                        >
                          <option value="">Sélectionner un utilisateur</option>
                          {users
                            .filter(user => 
                              user.roles?.includes(newTask.category) || 
                              user.roles?.includes('admin')
                            )
                            .map(user => (
                              <option key={user.id} value={user.id}>
                                {user.fullName}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowNewTaskForm(false)}
                        className={`px-4 py-2 text-sm font-medium rounded-md ${
                          theme === 'dark'
                            ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                      >
                        Créer
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Liste des Tâches */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {(['à faire', 'en cours', 'terminé'] as const).map(status => (
                  <div
                    key={status}
                    id={status}
                    className={`${
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    } rounded-lg shadow-sm border overflow-hidden`}
                  >
                    <div className={`px-4 py-3 ${
                      theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                    } border-b`}>
                      <h2 className="text-sm font-medium capitalize">
                        {status}
                      </h2>
                    </div>
                    <div className="p-4">
                      <SortableContext
                        items={filteredTasks.filter(t => t.status === status).map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {filteredTasks
                            .filter(task => task.status === status)
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map(task => (
                              <TaskItem
                                key={task.id}
                                task={task}
                                users={users}
                                onStatusChange={(taskId, newStatus) => {
                                  const updatedTasks = tasks.map(t =>
                                    t.id === taskId ? { ...t, status: newStatus } : t
                                  );
                                  setTasks(updatedTasks);
                                  storage.saveTasks(updatedTasks).catch(error => {
                                    logger.error('Erreur lors du changement de statut', {
                                      operation: 'onStatusChange',
                                      taskId,
                                      newStatus
                                    }, error as Error);
                                    toast.error('Erreur lors du changement de statut');
                                  });
                                }}
                                onEdit={async (updatedTask) => {
                                  try {
                                    const updatedTasks = tasks.map(t =>
                                      t.id === updatedTask.id ? updatedTask : t
                                    );
                                    await storage.saveTasks(updatedTasks);
                                    setTasks(updatedTasks);
                                    toast.success('Tâche modifiée avec succès');
                                  } catch (error) {
                                    logger.error('Erreur lors de la modification de la tâche', {
                                      operation: 'onEdit',
                                      taskId: updatedTask.id
                                    }, error as Error);
                                    toast.error('Erreur lors de la modification de la tâche');
                                  }
                                }}
                                onDelete={async (taskId) => {
                                  try {
                                    const updatedTasks = tasks.filter(t => t.id !== taskId);
                                    await storage.saveTasks(updatedTasks);
                                    setTasks(updatedTasks);
                                    toast.success('Tâche supprimée avec succès');
                                  } catch (error) {
                                    logger.error('Erreur lors de la suppression de la tâche', {
                                      operation: 'onDelete',
                                      taskId
                                    }, error as Error);
                                    toast.error('Erreur lors de la suppression de la tâche');
                                  }
                                }}
                              />
                            ))}
                        </div>
                      </SortableContext>
                    </div>
                  </div>
                ))}
              </div>
            </DndContext>
          </>
        )}
      </main>
    </div>
  );
}

export default App;