import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, ListTodo, Plus, Search, Trash2, Edit2, Check, X } from 'lucide-react';
import type { Note, Todo } from '../../shared/types';

interface NotesTodosPanelProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'sidebar';
}

type ActiveTab = 'notes' | 'todos';
type TodoFilter = 'all' | 'active' | 'completed';

export function NotesTodosPanel({ isOpen, onClose, variant = 'modal' }: NotesTodosPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('notes');

  // ---------- Notes state ----------
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- Todos state ----------
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('all');
  const [newTodoText, setNewTodoText] = useState('');

  // ---------- Load data when panel opens ----------
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'notes') {
        loadNotes();
      } else {
        loadTodos();
      }
    }
  }, [isOpen, activeTab]);

  // ---------- Notes helpers ----------
  const loadNotes = useCallback(async () => {
    try {
      setNotesLoading(true);
      const data = await window.electronAPI.notesList();
      setNotes(data);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(async () => {
      if (value.trim()) {
        try {
          setNotesLoading(true);
          const results = await window.electronAPI.notesSearch({ query: value.trim(), limit: 20 });
          setNotes(results);
        } catch (error) {
          console.error('Failed to search notes:', error);
        } finally {
          setNotesLoading(false);
        }
      } else {
        loadNotes();
      }
    }, 300);
  }, [loadNotes]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const handleCreateNote = async () => {
    try {
      const newNote = await window.electronAPI.notesCreate({ title: 'Untitled Note', content: '' });
      setNotes(prev => [newNote, ...prev]);
      setExpandedNoteId(newNote.id);
      setEditingNoteId(newNote.id);
      setEditTitle(newNote.title);
      setEditContent(newNote.content);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const handleSaveNote = async () => {
    if (!editingNoteId) return;
    try {
      const updated = await window.electronAPI.notesUpdate({
        id: editingNoteId,
        title: editTitle,
        content: editContent,
      });
      if (updated) {
        setNotes(prev => prev.map(n => (n.id === editingNoteId ? updated : n)));
      }
      setEditingNoteId(null);
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditTitle('');
    setEditContent('');
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await window.electronAPI.notesDelete(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      if (expandedNoteId === id) setExpandedNoteId(null);
      if (editingNoteId === id) setEditingNoteId(null);
      setDeletingNoteId(null);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleNoteClick = (noteId: string) => {
    if (editingNoteId === noteId) return;
    setExpandedNoteId(prev => (prev === noteId ? null : noteId));
  };

  // ---------- Todos helpers ----------
  const loadTodos = useCallback(async () => {
    try {
      setTodosLoading(true);
      const data = await window.electronAPI.todosList(todoFilter);
      setTodos(data);
    } catch (error) {
      console.error('Failed to load todos:', error);
    } finally {
      setTodosLoading(false);
    }
  }, [todoFilter]);

  useEffect(() => {
    if (isOpen && activeTab === 'todos') {
      loadTodos();
    }
  }, [todoFilter, isOpen, activeTab, loadTodos]);

  const handleAddTodo = async () => {
    const text = newTodoText.trim();
    if (!text) return;
    try {
      await window.electronAPI.todosCreate(text);
      setNewTodoText('');
      // Reload list to respect current filter
      await loadTodos();
    } catch (error) {
      console.error('Failed to create todo:', error);
    }
  };

  const handleToggleTodo = async (id: string) => {
    try {
      await window.electronAPI.todosComplete(id);
      await loadTodos();
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await window.electronAPI.todosDelete(id);
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const handleTodoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTodo();
    }
  };

  // ---------- Render guard ----------
  if (!isOpen) return null;

  // ---------- Shared sub-renders ----------

  const tabBar = (
    <div className="flex border-b border-[color:var(--app-border)]">
      <button
        onClick={() => setActiveTab('notes')}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
          activeTab === 'notes'
            ? 'border-b-2 border-[color:var(--app-accent)] text-[color:var(--app-accent)]'
            : 'text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]'
        }`}
      >
        <FileText size={16} />
        Notes
      </button>
      <button
        onClick={() => setActiveTab('todos')}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
          activeTab === 'todos'
            ? 'border-b-2 border-[color:var(--app-accent)] text-[color:var(--app-accent)]'
            : 'text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]'
        }`}
      >
        <ListTodo size={16} />
        Todos
      </button>
    </div>
  );

  const notesContent = (
    <div className="flex flex-col h-full">
      {/* Notes header */}
      <div className="p-4 space-y-3 border-b border-[color:var(--app-border)]">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[color:var(--app-text)]">Notes</h3>
          <button
            onClick={handleCreateNote}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-[color:var(--app-accent)] text-[color:var(--app-accent-contrast)] hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            New Note
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--app-text-muted)]" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-[color:var(--app-accent)]"
          />
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-4">
        {notesLoading ? (
          <div className="text-center py-8 text-[color:var(--app-text-muted)]">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-[color:var(--app-text-muted)]">
            No notes yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map(note => {
              const isExpanded = expandedNoteId === note.id;
              const isEditing = editingNoteId === note.id;
              const isDeleting = deletingNoteId === note.id;

              return (
                <div
                  key={note.id}
                  className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] overflow-hidden"
                >
                  {/* Note card header / preview */}
                  <div
                    onClick={() => handleNoteClick(note.id)}
                    className="p-3 cursor-pointer hover:bg-[color:var(--app-surface)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-[color:var(--app-text)] truncate">
                          {note.title || 'Untitled'}
                        </h4>
                        {!isExpanded && (
                          <p className="text-xs text-[color:var(--app-text-muted)] mt-1 line-clamp-2">
                            {note.content ? note.content.slice(0, 100) + (note.content.length > 100 ? '...' : '') : 'No content'}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isEditing && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleEditNote(note);
                              setExpandedNoteId(note.id);
                            }}
                            className="p-1 rounded hover:bg-[color:var(--app-surface)] text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] transition-colors"
                            title="Edit note"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setDeletingNoteId(isDeleting ? null : note.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/10 text-[color:var(--app-text-muted)] hover:text-red-500 transition-colors"
                          title="Delete note"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[color:var(--app-text-muted)] mt-1.5">
                      {new Date(note.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Delete confirmation */}
                  {isDeleting && (
                    <div className="px-3 py-2 border-t border-[color:var(--app-border)] bg-red-500/5 flex items-center justify-between">
                      <span className="text-xs text-red-500">Delete this note?</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeletingNoteId(null)}
                          className="px-2 py-1 text-xs rounded border border-[color:var(--app-border)] text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded view */}
                  {isExpanded && !isEditing && !isDeleting && (
                    <div className="px-3 pb-3 border-t border-[color:var(--app-border)]">
                      <p className="text-sm text-[color:var(--app-text)] whitespace-pre-wrap pt-3">
                        {note.content || 'No content'}
                      </p>
                    </div>
                  )}

                  {/* Edit mode */}
                  {isEditing && (
                    <div className="px-3 pb-3 border-t border-[color:var(--app-border)] space-y-2 pt-3">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        placeholder="Note title"
                        className="w-full px-2 py-1.5 text-sm rounded border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-[color:var(--app-accent)]"
                      />
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        placeholder="Write your note here..."
                        rows={6}
                        className="w-full px-2 py-1.5 text-sm rounded border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-muted)] resize-y focus:outline-none focus:ring-1 focus:ring-[color:var(--app-accent)]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-[color:var(--app-border)] text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] transition-colors"
                        >
                          <X size={12} />
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveNote}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-[color:var(--app-accent)] text-[color:var(--app-accent-contrast)] hover:opacity-90 transition-opacity"
                        >
                          <Check size={12} />
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const todosContent = (
    <div className="flex flex-col h-full">
      {/* Todos header */}
      <div className="p-4 space-y-3 border-b border-[color:var(--app-border)]">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[color:var(--app-text)]">Todos</h3>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1">
          {(['all', 'active', 'completed'] as TodoFilter[]).map(filter => (
            <button
              key={filter}
              onClick={() => setTodoFilter(filter)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                todoFilter === filter
                  ? 'bg-[color:var(--app-accent)] text-[color:var(--app-accent-contrast)]'
                  : 'bg-[color:var(--app-surface-2)] text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Add todo input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add a new todo..."
            value={newTodoText}
            onChange={e => setNewTodoText(e.target.value)}
            onKeyDown={handleTodoKeyDown}
            className="flex-1 px-3 py-2 text-sm rounded-md border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-muted)] focus:outline-none focus:ring-1 focus:ring-[color:var(--app-accent)]"
          />
          <button
            onClick={handleAddTodo}
            disabled={!newTodoText.trim()}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-[color:var(--app-accent)] text-[color:var(--app-accent-contrast)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Todos list */}
      <div className="flex-1 overflow-y-auto p-4">
        {todosLoading ? (
          <div className="text-center py-8 text-[color:var(--app-text-muted)]">Loading todos...</div>
        ) : todos.length === 0 ? (
          <div className="text-center py-8 text-[color:var(--app-text-muted)]">
            No todos. Add one above.
          </div>
        ) : (
          <div className="space-y-1">
            {todos.map(todo => (
              <div
                key={todo.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] hover:bg-[color:var(--app-surface)] transition-colors group"
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleTodo(todo.id)}
                  className={`flex items-center justify-center w-5 h-5 rounded border-2 shrink-0 transition-colors ${
                    todo.completed
                      ? 'bg-[color:var(--app-accent)] border-[color:var(--app-accent)]'
                      : 'border-[color:var(--app-border)] hover:border-[color:var(--app-accent)]'
                  }`}
                >
                  {todo.completed && <Check size={12} className="text-[color:var(--app-accent-contrast)]" />}
                </button>

                {/* Text */}
                <span
                  className={`flex-1 text-sm ${
                    todo.completed
                      ? 'line-through text-[color:var(--app-text-muted)]'
                      : 'text-[color:var(--app-text)]'
                  }`}
                >
                  {todo.text}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteTodo(todo.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[color:var(--app-text-muted)] hover:text-red-500 transition-all"
                  title="Delete todo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const panelBody = (
    <>
      {tabBar}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'notes' ? notesContent : todosContent}
      </div>
    </>
  );

  // ---------- Sidebar variant ----------
  if (variant === 'sidebar') {
    return (
      <div className="h-full w-[420px] bg-[color:var(--app-surface)] border-l border-[color:var(--app-border)] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--app-border)]">
          <h2 className="text-lg font-semibold text-[color:var(--app-text)]">Notes & Todos</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] text-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {panelBody}
      </div>
    );
  }

  // ---------- Modal variant (default) ----------
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[color:var(--app-surface)] rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border border-[color:var(--app-border)]">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--app-border)]">
          <h2 className="text-lg font-semibold text-[color:var(--app-text)]">Notes & Todos</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] text-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {panelBody}
      </div>
    </div>
  );
}
