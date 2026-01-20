
import React, { useState, useRef, useEffect } from 'react';
import { HttpRequest, HttpMethod, Environment } from '../types';
import { getMethodColor } from '../utils';

interface RequestHeaderProps {
    request: HttpRequest;
    onRequestChange: (req: HttpRequest) => void;
    onSend: () => void;
    isSending: boolean;
    environments: Environment[];
    activeEnvId: string | null;
    onEnvChange: (id: string) => void;
    onManageEnvironments: () => void;
    useBrowserCookies: boolean;
    onToggleBrowserCookies: () => void;
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

export const RequestHeader: React.FC<RequestHeaderProps> = ({
    request, onRequestChange, onSend, isSending,
    environments, activeEnvId, onEnvChange, onManageEnvironments,
    useBrowserCookies, onToggleBrowserCookies
}) => {
    const [isMethodOpen, setIsMethodOpen] = useState(false);
    const [isEnvOpen, setIsEnvOpen] = useState(false);
    const methodRef = useRef<HTMLDivElement>(null);
    const envRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (methodRef.current && !methodRef.current.contains(event.target as Node)) {
                setIsMethodOpen(false);
            }
            if (envRef.current && !envRef.current.contains(event.target as Node)) {
                setIsEnvOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMethodSelect = (m: HttpMethod) => {
        onRequestChange({ ...request, method: m });
        setIsMethodOpen(false);
    };

    const activeEnv = environments.find(e => e.id === activeEnvId);

    return (
        <div className="border-b border-gray-200 bg-white p-2">
            <div className="flex space-x-0 shadow-sm rounded-md w-full relative">

                {/* Environment Selector */}
                <div className="relative" ref={envRef}>
                    <button
                        onClick={() => setIsEnvOpen(!isEnvOpen)}
                        className="rounded-l-md border border-gray-300 border-r-0 px-3 py-2 text-xs font-bold bg-gray-50 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 w-28 text-gray-700 flex items-center justify-between h-full transition-colors"
                        title="Select Environment"
                    >
                        <span className={`truncate ${!activeEnvId ? 'text-gray-400' : 'text-blue-600'}`}>
                            {activeEnv ? activeEnv.name : 'No Env'}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {isEnvOpen && (
                        <div className="absolute top-full left-0 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 py-1 mt-1 animate-fadeIn">
                            <div className="max-h-60 overflow-y-auto">
                                <div
                                    className={`px-3 py-2 text-xs font-bold cursor-pointer hover:bg-gray-50 flex items-center justify-between ${!activeEnvId ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
                                    onClick={() => { onEnvChange(''); setIsEnvOpen(false); }}
                                >
                                    <span>No Environment</span>
                                    {!activeEnvId && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                {environments.map(env => (
                                    <div
                                        key={env.id}
                                        onClick={() => { onEnvChange(env.id); setIsEnvOpen(false); }}
                                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 border-t border-gray-50 ${activeEnvId === env.id ? 'bg-blue-50' : ''}`}
                                    >
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className={`font-bold ${activeEnvId === env.id ? 'text-blue-600' : 'text-gray-700'}`}>{env.name}</span>
                                            {activeEnvId === env.id && <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <div className="text-[10px] text-gray-400 truncate font-mono bg-gray-50 px-1 rounded">{env.baseUrl || 'No Base URL'}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-gray-200 mt-1 pt-1 bg-gray-50">
                                <div
                                    onClick={() => { onManageEnvironments(); setIsEnvOpen(false); }}
                                    className="px-3 py-2 text-xs text-blue-600 font-bold cursor-pointer hover:bg-gray-100 flex items-center justify-center transition-colors"
                                >
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    Manage Environments
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Custom Method Selector */}
                <div className="relative" ref={methodRef}>
                    <button
                        onClick={() => setIsMethodOpen(!isMethodOpen)}
                        className="border border-gray-300 border-r-0 px-3 py-2 text-sm font-bold bg-white hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 w-24 text-gray-700 flex items-center justify-between h-full transition-colors"
                    >
                        <span className={getMethodColor(request.method)}>{request.method}</span>
                        <svg className="w-4 h-4 text-gray-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {isMethodOpen && (
                        <div className="absolute top-full left-0 w-28 bg-white border border-gray-200 shadow-lg rounded-md z-50 py-1 mt-1 animate-fadeIn">
                            {METHODS.map(m => (
                                <div
                                    key={m}
                                    onClick={() => handleMethodSelect(m)}
                                    className="px-3 py-2 text-xs font-bold cursor-pointer hover:bg-gray-50 flex items-center justify-between transition-colors"
                                >
                                    <span className={getMethodColor(m)}>{m}</span>
                                    {request.method === m && <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* URL Input */}
                <input
                    type="text"
                    value={request.url}
                    onChange={(e) => onRequestChange({ ...request, url: e.target.value })}
                    placeholder="Enter URL or /path"
                    className="flex-1 bg-gray-50 hover:bg-white focus:bg-white border border-gray-300 border-r-0 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 z-0 focus:z-10 font-mono text-gray-700 min-w-0 transition-all placeholder-gray-400"
                />

                {/* Cookie Toggle */}
                <button
                    onClick={onToggleBrowserCookies}
                    className={`border border-gray-300 border-r-0 px-2 flex items-center justify-center hover:bg-gray-100 transition-colors ${useBrowserCookies ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}
                    title={useBrowserCookies ? "Browser Cookies Auto-Fill Enabled" : "Enable Browser Cookies Auto-Fill"}
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                        <path d="M2 12h20"></path>
                    </svg>
                    {/* Using a generic globe/web icon for 'Browser Context' since cookie icon is complex */}
                </button>

                {/* Send Button */}
                <button
                    onClick={onSend}
                    disabled={isSending}
                    className={`rounded-r-md px-6 py-2 text-sm font-bold text-white transition-all flex items-center flex-shrink-0 shadow-sm border border-transparent ${isSending ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:shadow active:bg-green-800'}`}
                >
                    {isSending ? 'Sending...' : 'SEND'}
                </button>
            </div>
        </div>
    );
};
