import React, { useState } from 'react';
import { CheckSquare, Square, Trash2, Plus } from 'lucide-react';
import EVENTS from '../socketEvents';

const SharedTodo = ({ roomState, socket }) => {
    const [newTodo, setNewTodo] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newTodo.trim()) return;
        socket.emit(EVENTS.ADD_TODO, { roomId: roomState.id, todo: { text: newTodo } });
        setNewTodo('');
    };

    const handleToggle = (todoId) => {
        socket.emit(EVENTS.TOGGLE_TODO, { roomId: roomState.id, todoId });
    };

    const handleDelete = (todoId) => {
        socket.emit(EVENTS.DELETE_TODO, { roomId: roomState.id, todoId });
    };

    const todos = roomState?.state?.todos || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Shared Checklist</h4>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {todos.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '20px' }}>
                        No items yet. Add one below!
                    </div>
                )}
                {todos.map(todo => (
                    <div
                        key={todo.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '8px',
                            borderRadius: '6px',
                            opacity: todo.completed ? 0.6 : 1
                        }}
                    >
                        <button
                            className="btn-ghost"
                            style={{ padding: '4px', borderRadius: '4px' }}
                            onClick={() => handleToggle(todo.id)}
                        >
                            {todo.completed ? <CheckSquare size={16} color="var(--accent-primary)" /> : <Square size={16} color="var(--text-muted)" />}
                        </button>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <span style={{
                                fontSize: '0.85rem',
                                textDecoration: todo.completed ? 'line-through' : 'none',
                                color: todo.completed ? 'var(--text-muted)' : 'var(--text-main)',
                                wordBreak: 'break-word'
                            }}>
                                {todo.text}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Added by {todo.author}</span>
                        </div>

                        <button
                            className="btn-ghost alert"
                            style={{ padding: '4px', borderRadius: '4px', opacity: 0.5 }}
                            onClick={() => handleDelete(todo.id)}
                            title="Delete Item"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <input
                    type="text"
                    className="input-primary"
                    placeholder="Add an item..."
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
                />
                <button type="submit" className="btn-primary" style={{ padding: '8px' }} disabled={!newTodo.trim()}>
                    <Plus size={16} />
                </button>
            </form>
        </div>
    );
};

export default SharedTodo;
