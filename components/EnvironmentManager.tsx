
import React, { useState, useEffect } from 'react';
import { Environment } from '../types';
import { Modal } from './Modal';
import { generateId } from '../utils';

interface EnvironmentManagerProps {
    isOpen: boolean;
    onClose: () => void;
    environments: Environment[];
    onSave: (envs: Environment[]) => void;
}

export const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({ isOpen, onClose, environments, onSave }) => {
    const [localEnvs, setLocalEnvs] = useState<Environment[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Deep copy to not affect parent state until save
            setLocalEnvs(JSON.parse(JSON.stringify(environments)));
            if (environments.length > 0 && !editingId) {
                // setEditingId(environments[0].id); // Optional: Auto-select first
            }
        }
    }, [isOpen, environments]);

    const handleAdd = () => {
        const newEnv: Environment = {
            id: generateId(),
            name: 'New Environment',
            baseUrl: '',
            variables: []
        };
        setLocalEnvs([...localEnvs, newEnv]);
        setEditingId(newEnv.id);
    };

    const handleDelete = (id: string) => {
        setLocalEnvs(localEnvs.filter(e => e.id !== id));
        if (editingId === id) setEditingId(null);
    };

    const handleUpdate = (id: string, updates: Partial<Environment>) => {
        setLocalEnvs(localEnvs.map(e => e.id === id ? { ...e, ...updates } : e));
    };

    const handleSave = () => {
        onSave(localEnvs);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Environment Management" onConfirm={handleSave} confirmText="Save" confirmDisabled={false}>
            <div className="flex h-[400px]">
                {/* Sidebar List */}
                <div className="w-1/3 border-r border-gray-200 pr-2">
                    <div className="mb-2 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase">Environments</span>
                        <button onClick={handleAdd} className="text-green-600 hover:text-green-700 text-xs font-bold px-2 py-1 bg-green-50 rounded hover:bg-green-100 transition-colors">+ New</button>
                    </div>
                    <div className="space-y-1 overflow-y-auto h-[360px] pr-1">
                        {localEnvs.map(env => (
                            <div
                                key={env.id}
                                className={`px-2 py-2 cursor-pointer rounded flex justify-between items-center group transition-colors ${editingId === env.id ? 'bg-blue-50 border-l-2 border-blue-500 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
                                onClick={() => setEditingId(env.id)}
                            >
                                <span className="truncate text-sm font-medium">{env.name}</span>
                                <button className="hidden group-hover:block text-gray-400 hover:text-red-500 px-1" onClick={(e) => { e.stopPropagation(); handleDelete(env.id); }} title="Delete">×</button>
                            </div>
                        ))}
                        {localEnvs.length === 0 && <div className="text-xs text-center text-gray-400 mt-10">No environments created.</div>}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="w-2/3 pl-4 flex flex-col">
                    {editingId ? (
                        (() => {
                            const env = localEnvs.find(e => e.id === editingId);
                            if (!env) return null;
                            return (
                                <div className="space-y-6 mt-2">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Environment Name</label>
                                        <input
                                            type="text"
                                            value={env.name}
                                            onChange={(e) => handleUpdate(env.id, { name: e.target.value })}
                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                            placeholder="e.g. Development, Production"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Base URL (Prepend)</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={env.baseUrl}
                                                onChange={(e) => handleUpdate(env.id, { baseUrl: e.target.value })}
                                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                                placeholder="https://api.example.com"
                                            />
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                                            This Base URL will be automatically prepended to request URLs that start with <code className="bg-gray-100 px-1 rounded text-gray-600">/</code> (e.g., <code className="bg-gray-100 px-1 rounded text-gray-600">/users</code> → <code className="bg-gray-100 px-1 rounded text-gray-600">https://api.example.com/users</code>).
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            <span className="text-sm">Select an environment to edit</span>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
