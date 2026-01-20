
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { RequestHeader } from './components/RequestHeader';
import { RequestEditor } from './components/RequestEditor';
import { ResponseViewer } from './components/ResponseViewer';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Modal } from './components/Modal';
import { EnvironmentManager } from './components/EnvironmentManager';
import { TabBar } from './components/TabBar';
import { HttpRequest, HttpResponse, LoggedRequest, SidebarTab, CollectionItem, KeyValue, TabItem, Environment } from './types';
import { generateId, queryStringToParams, parseCurl, parseSwagger, SwaggerParseResult, TagGroup } from './utils';
// 浏览器禁止通过 fetch 接口设置的请求头列表
const FORBIDDEN_HEADERS = [
    'cookie', 'cookie2', 'origin', 'referer', 'host', 'connection', 'content-length',
    'date', 'expect', 'keep-alive', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via'
];

const createNewRequest = (collectionId?: string): HttpRequest => ({
    id: generateId(),
    collectionId,
    name: 'New Request',
    url: '',
    method: 'GET',
    headers: [],
    params: [],
    bodyType: 'none',
    bodyRaw: '',
    bodyForm: []
});

const convertLogToRequest = (log: LoggedRequest): HttpRequest => {
    const headers: KeyValue[] = [];
    if (log.requestHeaders) {
        Object.entries(log.requestHeaders).forEach(([k, v]) => {
            headers.push({ id: generateId(), key: k, value: v, enabled: true });
        });
    }
    let bodyType: HttpRequest['bodyType'] = 'none';
    let bodyRaw = '';
    let bodyForm: KeyValue[] = [];
    if (log.requestBody) {
        if (typeof log.requestBody === 'string') { bodyType = 'raw'; bodyRaw = log.requestBody; }
        else if (typeof log.requestBody === 'object') {
            bodyType = 'form-data';
            Object.entries(log.requestBody).forEach(([k, v]) => {
                const val = Array.isArray(v) ? v[0] : v;
                bodyForm.push({ id: generateId(), key: k, value: val, enabled: true, type: 'text' });
            });
        }
    }
    let smartName = log.url;
    try {
        const urlObj = new URL(log.url);
        smartName = urlObj.pathname === '/' ? urlObj.origin : urlObj.pathname;
    } catch (e) { }
    return { ...createNewRequest(), id: log.id, url: log.url, method: log.method as any, name: smartName, params: queryStringToParams(log.url.split('?')[1] || ''), headers, bodyType, bodyRaw, bodyForm };
};
const App: React.FC = () => {
    const [tabs, setTabs] = useState<TabItem[]>([{ id: 'welcome', type: 'welcome', title: 'Welcome' }]);
    const [activeTabId, setActiveTabId] = useState<string>('welcome');
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('history');
    const [history, setHistory] = useState<LoggedRequest[]>([]);
    const [collections, setCollections] = useState<CollectionItem[]>([]);
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
    const [isEnvManagerOpen, setIsEnvManagerOpen] = useState(false);
    const [useBrowserCookies, setUseBrowserCookies] = useState(true);
    const [rootRequests, setRootRequests] = useState<HttpRequest[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);
    const [isSwaggerModalOpen, setIsSwaggerModalOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [curlInput, setCurlInput] = useState('');
    const [swaggerInput, setSwaggerInput] = useState('');
    const initializedRef = useRef(false);
    const lastUndoPushRef = useRef<Record<string, number>>({});

    const activeTab = tabs.find(t => t.id === activeTabId);
    const activeRequest = activeTab?.data || null;
    const activeResponse = activeTab?.response || null;
    const activeError = activeTab?.error || null;
    const activeIsLoading = activeTab?.isLoading || false;

    useEffect(() => {
        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['collections', 'logs', 'savedTabs', 'savedActiveTabId', 'isRecording', 'rootRequests', 'environments', 'activeEnvId', 'useBrowserCookies'], (result) => {
                if (result.collections) setCollections(result.collections);
                if (result.rootRequests) setRootRequests(result.rootRequests);
                if (result.environments) setEnvironments(result.environments);
                if (result.activeEnvId) setActiveEnvId(result.activeEnvId);
                // default true if undefined
                if (result.useBrowserCookies !== undefined) setUseBrowserCookies(result.useBrowserCookies);

                setIsRecording(!!result.isRecording);

                const logs = result.logs || [];
                setHistory(logs);

                if (result.savedTabs && result.savedTabs.length > 0) {
                    setTabs(result.savedTabs);
                    if (result.savedActiveTabId) setActiveTabId(result.savedActiveTabId);
                }

                const params = new URLSearchParams(window.location.search);
                const logId = params.get('logId');
                if (logId) {
                    const found = logs.find((l: LoggedRequest) => l.id === logId);
                    if (found) {
                        handleImportLoggedRequest(found);
                        setSidebarTab('history');
                    }
                }
                initializedRef.current = true;
            });

            const listener = (changes: any) => {
                if (changes.logs) setHistory(changes.logs.newValue || []);
                if (changes.collections) setCollections(changes.collections.newValue || []);
                if (changes.rootRequests) setRootRequests(changes.rootRequests.newValue || []);
                if (changes.isRecording) setIsRecording(changes.isRecording.newValue);
            };
            chrome.storage.onChanged.addListener(listener);

            // --- NEW: DevTools Network Capture ---
            const handleRequestFinished = async (request: any) => {
                // Only capture if recording is enabled
                if (!initializedRef.current) return;
                // We need to check internal state or storage. Since this is an event listener, 
                // accessing state directly might be stale if not careful, but ref or fresh storage get is safer.
                // For simplicity/perf, let's check storage or rely on a ref if we sync it.
                // Let's allow capturing and filtering at save time or check a global mutable ref for 'isRecording'.
            };

            // To properly track isRecording in the event listener without re-binding:
            // We will use a ref that tracks isRecording state.

            return () => {
                chrome.storage.onChanged.removeListener(listener);
            };
        }
    }, []);

    // Ref to track recording state for the network listener
    const isRecordingRef = useRef(false);
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

    useEffect(() => {
        if (chrome && chrome.devtools && chrome.devtools.network) {
            const handleRequestFinished = (harEntry: any) => {
                if (!isRecordingRef.current) return;

                const request = harEntry.request;
                const response = harEntry.response;
                const url = request.url;
                if (url.startsWith('chrome-extension:') || url.startsWith('blob:') || url.startsWith('data:')) return;

                const reqHeaders: Record<string, string> = {};
                request.headers.forEach((h: any) => reqHeaders[h.name] = h.value);

                const resHeaders: Record<string, string> = {};
                response.headers.forEach((h: any) => resHeaders[h.name] = h.value);

                let postData: any = undefined;
                if (request.postData) {
                    if (request.postData.text) postData = request.postData.text;
                    // HAR object structure for params usually available if parsed
                }

                // Get Response Body
                harEntry.getContent((content: string) => {
                    const logId = generateId();
                    const newLog: LoggedRequest = {
                        id: logId,
                        url: url,
                        method: request.method,
                        status: response.status,
                        timestamp: new Date(harEntry.startedDateTime).getTime(),
                        type: response.content.mimeType || 'unknown',
                        requestHeaders: reqHeaders,
                        requestBody: postData,
                        responseHeaders: resHeaders,
                        responseBody: content, // The body!
                        size: response.bodySize,
                        errorMessage: response.status >= 400 ? response.statusText : undefined
                    };

                    // Save to storage (append to logs)
                    chrome.storage.local.get(['logs'], (result) => {
                        const logs = result.logs || [];
                        const nextLogs = [newLog, ...logs].slice(0, 100);
                        chrome.storage.local.set({ logs: nextLogs });
                    });
                });
            };

            chrome.devtools.network.onRequestFinished.addListener(handleRequestFinished);
            return () => {
                chrome.devtools.network.onRequestFinished.removeListener(handleRequestFinished);
            }
        }
    }, []); // Run once on mount to attach listener

    useEffect(() => {
        if (initializedRef.current && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                savedTabs: tabs,
                savedActiveTabId: activeTabId
            });
        }
    }, [tabs, activeTabId]);

    const openRequestInTab = (req: HttpRequest) => {
        const existing = tabs.find(t => t.id === req.id);
        if (existing) { setActiveTabId(req.id); return; }
        const newTab: TabItem = { id: req.id, type: 'request', title: req.name, method: req.method, data: req, isLoading: false, response: null, error: null };
        setTabs(prev => prev[0]?.type === 'welcome' ? [newTab] : [...prev, newTab]);
        setActiveTabId(req.id);
    };

    const handleTabClose = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newTabs = tabs.filter(t => t.id !== id);
        if (newTabs.length === 0) {
            setTabs([{ id: 'welcome', type: 'welcome', title: 'Welcome' }]);
            setActiveTabId('welcome');
        } else {
            setTabs(newTabs);
            if (activeTabId === id) setActiveTabId(newTabs[newTabs.length - 1].id);
        }
    };

    const handleTabClick = (id: string) => setActiveTabId(id);

    const handleUndo = useCallback(() => {
        if (!activeRequest || !activeTab) return;
        const stack = activeTab.undoStack || [];
        if (stack.length === 0) return;

        const previous = stack[stack.length - 1];
        const newStack = stack.slice(0, -1);
        const newRedo = [...(activeTab.redoStack || []), activeRequest];

        const updatedTab = { ...activeTab, data: previous, undoStack: newStack, redoStack: newRedo, title: previous.name, method: previous.method };

        setTabs(prev => prev.map(t => t.id === activeTab.id ? updatedTab : t));

        const updatedReq = previous;
        const nextRoots = rootRequests.map(r => r.id === updatedReq.id ? updatedReq : r);
        const nextCols = collections.map(c => ({
            ...c,
            requests: c.requests.map(r => r.id === updatedReq.id ? updatedReq : r)
        }));
        setRootRequests(nextRoots);
        setCollections(nextCols);
        chrome.storage.local.set({ rootRequests: nextRoots, collections: nextCols });
    }, [activeTab, activeRequest, rootRequests, collections]);

    const handleRedo = useCallback(() => {
        if (!activeRequest || !activeTab) return;
        const stack = activeTab.redoStack || [];
        if (stack.length === 0) return;

        const next = stack[stack.length - 1];
        const newRedo = stack.slice(0, -1);
        const newUndo = [...(activeTab.undoStack || []), activeRequest];

        const updatedTab = { ...activeTab, data: next, undoStack: newUndo, redoStack: newRedo, title: next.name, method: next.method };

        setTabs(prev => prev.map(t => t.id === activeTab.id ? updatedTab : t));

        const updatedReq = next;
        const nextRoots = rootRequests.map(r => r.id === updatedReq.id ? updatedReq : r);
        const nextCols = collections.map(c => ({
            ...c,
            requests: c.requests.map(r => r.id === updatedReq.id ? updatedReq : r)
        }));
        setRootRequests(nextRoots);
        setCollections(nextCols);
        chrome.storage.local.set({ rootRequests: nextRoots, collections: nextCols });
    }, [activeTab, activeRequest, rootRequests, collections]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo(); else handleUndo();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    const updateActiveRequest = (updatedReq: HttpRequest) => {
        setTabs(prev => prev.map(t => {
            if (t.id === updatedReq.id) {
                const now = Date.now();
                const lastPush = lastUndoPushRef.current[t.id] || 0;
                let newUndoStack = t.undoStack || [];
                let newRedoStack = t.redoStack || [];

                if (t.data && (now - lastPush > 800)) {
                    newUndoStack = [...newUndoStack, t.data];
                    if (newUndoStack.length > 50) newUndoStack = newUndoStack.slice(newUndoStack.length - 50);
                    lastUndoPushRef.current[t.id] = now;
                    newRedoStack = [];
                }
                return { ...t, data: updatedReq, title: updatedReq.name, method: updatedReq.method, undoStack: newUndoStack, redoStack: newRedoStack };
            }
            return t;
        }));
        const nextRoots = rootRequests.map(r => r.id === updatedReq.id ? updatedReq : r);
        const nextCols = collections.map(c => ({
            ...c,
            requests: c.requests.map(r => r.id === updatedReq.id ? updatedReq : r)
        }));
        setRootRequests(nextRoots);
        setCollections(nextCols);
        chrome.storage.local.set({ rootRequests: nextRoots, collections: nextCols });
    };

    const handleSaveToCollection = (reqId: string, colId: string | null) => {
        let reqToMove: HttpRequest | undefined;
        reqToMove = rootRequests.find(r => r.id === reqId);
        if (!reqToMove) {
            for (const col of collections) {
                const r = col.requests.find(x => x.id === reqId);
                if (r) { reqToMove = r; break; }
            }
        }
        if (!reqToMove) {
            const log = history.find(h => h.id === reqId);
            if (log) reqToMove = convertLogToRequest(log);
        }
        if (!reqToMove) return;

        const updatedReq = { ...reqToMove, collectionId: colId || undefined };
        const nextRoots = rootRequests.filter(r => r.id !== reqId);
        const nextCols = collections.map(c => ({
            ...c,
            requests: c.requests.filter(r => r.id !== reqId)
        }));

        if (colId) {
            const target = nextCols.find(c => c.id === colId);
            if (target) { target.requests.push(updatedReq); target.collapsed = false; }
        } else {
            nextRoots.push(updatedReq);
        }

        setRootRequests(nextRoots);
        setCollections(nextCols);
        setTabs(prev => prev.map(t => t.id === reqId ? { ...t, data: updatedReq } : t));
        chrome.storage.local.set({ rootRequests: nextRoots, collections: nextCols });
    };

    const handleImportLoggedRequest = (log: LoggedRequest) => {
        const req = convertLogToRequest(log);

        // Create pre-filled response if available
        let initialResponse: HttpResponse | null = null;
        if (log.status) {
            initialResponse = {
                status: log.status,
                statusText: log.errorMessage || 'OK', // Basic fallback
                headers: log.responseHeaders || {},
                body: log.responseBody || '',
                time: 0, // Time info might be lost in basic HAR capture if not carefully calc'd
                size: log.size || 0
            };
        }

        // Open tab with response
        const existing = tabs.find(t => t.id === req.id);
        if (existing) {
            setActiveTabId(req.id);
        } else {
            const newTab: TabItem = {
                id: req.id,
                type: 'request',
                title: req.name,
                method: req.method,
                data: req,
                isLoading: false,
                response: initialResponse,
                error: null
            };
            setTabs(prev => prev[0]?.type === 'welcome' ? [newTab] : [...prev, newTab]);
            setActiveTabId(req.id);
        }
    };

    const handleCreateRequest = () => {
        const newReq = createNewRequest();
        const nextRoots = [...rootRequests, newReq];
        setRootRequests(nextRoots);
        chrome.storage.local.set({ rootRequests: nextRoots });
        openRequestInTab(newReq);
    };

    const handleRenameRequest = (reqId: string, newName: string) => {
        const nextRoots = rootRequests.map(r => r.id === reqId ? { ...r, name: newName } : r);
        const nextCols = collections.map(c => ({
            ...c,
            // Fixed: Use reqId and newName instead of undefined updatedReq
            requests: c.requests.map(r => r.id === reqId ? { ...r, name: newName } : r)
        }));
        setRootRequests(nextRoots);
        setCollections(nextCols);
        setTabs(prev => prev.map(t => t.id === reqId ? { ...t, title: newName, data: t.data ? { ...t.data, name: newName } : undefined } : t));
        chrome.storage.local.set({ rootRequests: nextRoots, collections: nextCols });
    };

    const handleTabRename = (id: string, newName: string) => handleRenameRequest(id, newName);

    const handleSaveEnvironments = (envs: Environment[]) => {
        setEnvironments(envs);
        chrome.storage.local.set({ environments: envs });
        if (activeEnvId && !envs.find(e => e.id === activeEnvId)) {
            setActiveEnvId(null);
            chrome.storage.local.set({ activeEnvId: null });
        }
    };



    const handleSendRequest = async () => {
        if (!activeRequest) return;
        setTabs(prev => prev.map(t => t.id === activeRequest.id ? { ...t, isLoading: true, error: null, response: null } : t));
        const startTime = Date.now();
        try {
            // 1. Resolve Environment Base URL
            let finalUrl = activeRequest.url;
            if (activeRequest.url.startsWith('/')) {
                const activeEnv = environments.find(e => e.id === activeEnvId);
                // Only prepend if active env has base URL
                if (activeEnv && activeEnv.baseUrl) {
                    const base = activeEnv.baseUrl.replace(/\/$/, '');
                    const path = activeRequest.url.replace(/^\//, '');
                    finalUrl = `${base}/${path}`;
                }
            }

            // 2. Prepare Headers
            const enabledHeaders = activeRequest.headers.filter(h => h.enabled && h.key && !h.key.startsWith(':'));
            const safeHeaderObj: Record<string, string> = {};
            enabledHeaders.forEach(h => {
                const lowerKey = h.key.toLowerCase();
                if (!FORBIDDEN_HEADERS.includes(lowerKey) && !lowerKey.startsWith('sec-') && !lowerKey.startsWith('proxy-')) {
                    safeHeaderObj[h.key] = h.value;
                }
            });

            // 3. Prepare DNR Rules (Headers + Cookie Injection)
            const headersForDNR = enabledHeaders.map(h => ({ key: h.key, value: h.value }));

            // 3.1 Cookie Auto-Injection
            if (useBrowserCookies) {
                try {
                    // Check if URL is valid for cookie lookup
                    if (finalUrl.startsWith('http')) {
                        const cookies = await chrome.cookies.getAll({ url: finalUrl });
                        if (cookies && cookies.length > 0) {
                            const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                            // Only inject if User hasn't set a Cookie header manually
                            if (!headersForDNR.find(h => h.key.toLowerCase() === 'cookie')) {
                                headersForDNR.push({ key: 'Cookie', value: cookieStr });
                            }
                        }
                    }
                } catch (e) {
                    console.error('Cookie injection error:', e);
                }
            }

            // 3.2 Update Rules
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        type: 'SET_REQUEST_HEADERS',
                        url: finalUrl,
                        headers: headersForDNR
                    }, resolve);
                });
            }

            let body: any = undefined;
            if (activeRequest.method !== 'GET' && activeRequest.method !== 'HEAD') {
                if (activeRequest.bodyType === 'raw') {
                    body = activeRequest.bodyRaw;
                } else if (activeRequest.bodyType === 'x-www-form-urlencoded') {
                    const params = new URLSearchParams();
                    activeRequest.bodyForm.filter(f => f.enabled && f.key).forEach(f => {
                        params.append(f.key, f.value);
                    });
                    body = params.toString();
                    if (!safeHeaderObj['Content-Type']) safeHeaderObj['Content-Type'] = 'application/x-www-form-urlencoded';
                } else if (activeRequest.bodyType === 'form-data') {
                    const formData = new FormData();
                    activeRequest.bodyForm.filter(f => f.enabled && f.key).forEach(f => {
                        if (f.type === 'file' && f.file) { formData.append(f.key, f.file); }
                        else { formData.append(f.key, f.value); }
                    });
                    body = formData;
                }
            }

            // 4. Fetch
            const response = await fetch(finalUrl, {
                method: activeRequest.method,
                headers: safeHeaderObj,
                body,
                credentials: 'include'
            });

            const responseBody = await response.text();
            const endTime = Date.now();
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((v, k) => responseHeaders[k] = v);

            const httpResponse: HttpResponse = {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body: responseBody,
                time: endTime - startTime,
                size: new Blob([responseBody]).size
            };

            setTabs(prev => prev.map(t => t.id === activeRequest.id ? {
                ...t,
                isLoading: false,
                response: httpResponse
            } : t));

            // clear rules
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'CLEAR_REQUEST_HEADERS' });
            }
        } catch (err: any) {
            setTabs(prev => prev.map(t => t.id === activeRequest.id ? {
                ...t,
                isLoading: false,
                error: err.message || 'Network Error'
            } : t));
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'CLEAR_REQUEST_HEADERS' });
            }
        }
    };

    const handleImportCurlConfirm = () => {
        const parsed = parseCurl(curlInput);
        if (parsed) {
            let smartName = 'Imported Request';
            if (parsed.url) {
                try {
                    const urlObj = new URL(parsed.url);
                    smartName = urlObj.pathname === '/' ? urlObj.origin : urlObj.pathname;
                } catch (e) { }
            }
            const newReq: HttpRequest = { ...createNewRequest(), ...parsed, id: generateId(), name: smartName };
            const nextRoots = [...rootRequests, newReq];
            setRootRequests(nextRoots);
            chrome.storage.local.set({ rootRequests: nextRoots });
            openRequestInTab(newReq);
            setIsCurlModalOpen(false);
            setCurlInput('');
        } else { alert('Invalid cURL command'); }
    };

    const handleImportSwaggerConfirm = () => {
        const result = parseSwagger(swaggerInput);
        if (!result || result.tagGroups.length === 0) {
            alert('Failed to parse Swagger JSON or no requests found.');
            return;
        }

        const swaggerColName = result.apiTitle;

        // Create sub-collections from tag groups
        const subCollections: CollectionItem[] = result.tagGroups.map(tag => ({
            id: generateId(),
            name: tag.name,
            description: tag.description,
            requests: tag.requests,
            collapsed: true
        }));

        // Count total requests
        const totalRequests = result.tagGroups.reduce((acc, tag) => acc + tag.requests.length, 0);

        // Find existing Swagger root collection with same name (for upsert)
        const existingIdx = collections.findIndex(c => c.name === swaggerColName && c.isSwaggerRoot);

        let nextCols: CollectionItem[];
        if (existingIdx >= 0) {
            // Upsert: Replace existing collection's subCollections
            nextCols = [...collections];
            nextCols[existingIdx] = {
                ...nextCols[existingIdx],
                subCollections,
                collapsed: true
            };
        } else {
            // Create new root collection with nested sub-collections
            const newCol: CollectionItem = {
                id: generateId(),
                name: swaggerColName,
                isSwaggerRoot: true,
                subCollections,
                requests: [], // Root has no direct requests
                collapsed: true
            };
            nextCols = [...collections, newCol];
        }

        setCollections(nextCols);
        chrome.storage.local.set({ collections: nextCols });
        setSidebarTab('collections');
        setIsSwaggerModalOpen(false);
        setSwaggerInput('');

        const action = existingIdx >= 0 ? 'Updated' : 'Imported';
        alert(`${action} ${totalRequests} requests in ${result.tagGroups.length} groups.`);
    };

    const handleClearAllData = () => {
        if (confirm('Are you sure you want to delete all collections, requests and history? This cannot be undone.')) {
            chrome.storage.local.clear(() => {
                setCollections([]);
                setHistory([]);
                setRootRequests([]);
                setTabs([{ id: 'welcome', type: 'welcome', title: 'Welcome' }]);
                setActiveTabId('welcome');
                window.location.reload();
            });
        }
    };

    const handleCollapseAll = () => {
        const toggle = (cols: CollectionItem[], isCollapsed: boolean): CollectionItem[] => {
            return cols.map(c => ({
                ...c,
                collapsed: isCollapsed,
                subCollections: c.subCollections ? toggle(c.subCollections, isCollapsed) : undefined
            }));
        };
        const next = toggle(collections, true);
        setCollections(next);
        chrome.storage.local.set({ collections: next });
    };

    const handleExpandAll = () => {
        const toggle = (cols: CollectionItem[], isCollapsed: boolean): CollectionItem[] => {
            return cols.map(c => ({
                ...c,
                collapsed: isCollapsed,
                subCollections: c.subCollections ? toggle(c.subCollections, isCollapsed) : undefined
            }));
        };
        const next = toggle(collections, false);
        setCollections(next);
        chrome.storage.local.set({ collections: next });
    };

    const handleLocateCurrent = () => {
        if (!activeRequest || !activeRequest.id) return;

        let foundColId: string | null = null;
        let foundSubColId: string | null = null;

        // Search collections
        for (const col of collections) {
            // Direct request
            if (col.requests.some(r => r.id === activeRequest.id)) {
                foundColId = col.id;
                break;
            }
            // Sub-collections
            if (col.subCollections) {
                for (const sub of col.subCollections) {
                    if (sub.requests.some(r => r.id === activeRequest.id)) {
                        foundColId = col.id;
                        foundSubColId = sub.id;
                        break;
                    }
                }
                if (foundColId) break;
            }
        }

        if (foundColId) {
            const next = collections.map(c => {
                if (c.id === foundColId) {
                    let nextCol = { ...c, collapsed: false };
                    if (foundSubColId && nextCol.subCollections) {
                        nextCol.subCollections = nextCol.subCollections.map(sub =>
                            sub.id === foundSubColId ? { ...sub, collapsed: false } : sub
                        );
                    }
                    return nextCol;
                }
                return c;
            });
            setCollections(next);
            chrome.storage.local.set({ collections: next });
            setSidebarTab('collections');
        } else {
            // Maybe in rootRequests?
            if (rootRequests.some(r => r.id === activeRequest.id)) {
                setSidebarTab('collections');
            }
        }
    };

    return (
        <div className="flex h-screen w-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
            {!isSidebarCollapsed && (
                <Sidebar
                    activeTab={sidebarTab}
                    onTabChange={setSidebarTab}
                    history={history}
                    onImportLoggedRequest={handleImportLoggedRequest}
                    collections={collections}
                    rootRequests={rootRequests}
                    tabs={tabs}
                    activeRequestId={activeRequest?.id}
                    onSelectRequest={openRequestInTab}
                    onCreateCollection={() => { const newCol = { id: generateId(), name: 'New Collection', requests: [], collapsed: false }; const next = [...collections, newCol]; setCollections(next); chrome.storage.local.set({ collections: next }); setSidebarTab('collections'); }}
                    onCreateRequest={handleCreateRequest}
                    onImportCurl={() => { setCurlInput(''); setIsCurlModalOpen(true); }}
                    onImportSwagger={() => { setSwaggerInput(''); setIsSwaggerModalOpen(true); }}
                    onClearHistory={() => { setHistory([]); chrome.storage.local.set({ logs: [] }); }}
                    onDeleteLog={(id) => { const next = history.filter(h => h.id !== id); setHistory(next); chrome.storage.local.set({ logs: next }); handleTabClose(id); }}
                    onRenameCollection={(id, name) => { const next = collections.map(c => c.id === id ? { ...c, name } : c); setCollections(next); chrome.storage.local.set({ collections: next }); }}
                    onRenameRequest={handleRenameRequest}
                    onDeleteCollection={(id) => {
                        const colToDelete = collections.find(c => c.id === id);
                        if (!colToDelete) return;

                        // Close tabs for all requests in this collection (including subCollections)
                        const requestIdsToClose: string[] = [...colToDelete.requests.map(r => r.id)];
                        if (colToDelete.subCollections) {
                            colToDelete.subCollections.forEach(sub => {
                                sub.requests.forEach(r => requestIdsToClose.push(r.id));
                            });
                        }
                        requestIdsToClose.forEach(reqId => handleTabClose(reqId));

                        const next = collections.filter(c => c.id !== id);
                        setCollections(next);
                        chrome.storage.local.set({ collections: next });
                    }}
                    onDeleteRequest={(req) => { const nextRoots = rootRequests.filter(r => r.id !== req.id); const nextCols = collections.map(c => ({ ...c, requests: c.requests.filter(r => r.id !== req.id) })); setRootRequests(nextRoots); setCollections(nextCols); chrome.storage.local.set({ rootRequests: nextRoots, collections: nextCols }); handleTabClose(req.id); }}
                    onDuplicateRequest={(reqId) => {
                        let found = rootRequests.find(r => r.id === reqId) || collections.flatMap(c => c.requests).find(r => r.id === reqId);
                        if (found) {
                            const newReq = { ...found, id: generateId(), name: `${found.name} Copy` };
                            if (newReq.collectionId) {
                                const nextCols = collections.map(c => c.id === newReq.collectionId ? { ...c, requests: [...c.requests, newReq] } : c);
                                setCollections(nextCols); chrome.storage.local.set({ collections: nextCols });
                            } else {
                                const nextRoots = [...rootRequests, newReq];
                                setRootRequests(nextRoots); chrome.storage.local.set({ rootRequests: nextRoots });
                            }
                        }
                    }}
                    onToggleCollapse={(id) => {
                        setCollections(collections.map(c => {
                            // Check if it's the top-level collection
                            if (c.id === id) {
                                return { ...c, collapsed: !c.collapsed };
                            }
                            // Check if it's a subCollection
                            if (c.subCollections) {
                                return {
                                    ...c,
                                    subCollections: c.subCollections.map(sub =>
                                        sub.id === id ? { ...sub, collapsed: !sub.collapsed } : sub
                                    )
                                };
                            }
                            return c;
                        }));
                    }}
                    onCollapseAll={handleCollapseAll}
                    onExpandAll={handleExpandAll}
                    onLocateCurrent={handleLocateCurrent}
                    onMoveRequest={handleSaveToCollection}
                    isRecording={isRecording}
                    onToggleRecording={() => { setIsRecording(!isRecording); chrome.storage.local.set({ isRecording: !isRecording }); }}
                    onCollapseSidebar={() => setIsSidebarCollapsed(true)}
                    onResetAllData={handleClearAllData}
                />
            )}
            <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                {isSidebarCollapsed && (
                    <button
                        onClick={() => setIsSidebarCollapsed(false)}
                        className="absolute left-0 top-1.5 z-[60] p-1 bg-white border border-l-0 border-gray-200 rounded-r shadow-sm hover:bg-gray-50 transition-colors"
                        title="Expand Sidebar"
                    >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 5l7 7-7 7M5 5l7 7-7 7" strokeWidth={2} /></svg>
                    </button>
                )}
                <TabBar tabs={tabs} activeTabId={activeTabId} onTabClick={handleTabClick} onTabClose={handleTabClose} onTabReorder={(f, t) => { const next = [...tabs]; const [m] = next.splice(f, 1); next.splice(t, 0, m); setTabs(next); }} onTabRename={handleTabRename} onTabAction={(a, tid) => { const idx = tabs.findIndex(t => t.id === tid); let next: TabItem[] = []; switch (a) { case 'close-others': next = tabs.filter(t => t.id === tid); break; case 'close-right': next = tabs.filter((_, i) => i <= idx); break; case 'close-left': next = tabs.filter((_, i) => i >= idx); break; case 'close-all': next = []; break; } setTabs(next.length === 0 ? [{ id: 'welcome', type: 'welcome', title: 'Welcome' }] : next); if (!next.find(t => t.id === activeTabId)) setActiveTabId(next[next.length - 1]?.id || 'welcome'); }} collections={collections} onSaveToCollection={handleSaveToCollection} />
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    {!activeRequest || activeTabId === 'welcome' ? (
                        <WelcomeScreen onCreateRequest={handleCreateRequest} onCreateCollection={() => { }} onImportCurl={() => setIsCurlModalOpen(true)} onImportSwagger={() => setIsSwaggerModalOpen(true)} />
                    ) : (
                        <>
                            <RequestHeader
                                request={activeRequest}
                                onRequestChange={updateActiveRequest}
                                onSend={handleSendRequest}
                                isSending={activeIsLoading}
                                environments={environments}
                                activeEnvId={activeEnvId}
                                onEnvChange={(id) => { setActiveEnvId(id); chrome.storage.local.set({ activeEnvId: id }); }}
                                onManageEnvironments={() => setIsEnvManagerOpen(true)}
                                useBrowserCookies={useBrowserCookies}
                                onToggleBrowserCookies={() => { setUseBrowserCookies(!useBrowserCookies); chrome.storage.local.set({ useBrowserCookies: !useBrowserCookies }); }}
                            />
                            <div className="flex-1 flex h-full overflow-hidden">
                                <div className="w-1/2 min-w-[400px] h-full overflow-hidden border-r border-gray-100">
                                    <RequestEditor request={activeRequest} onRequestChange={updateActiveRequest} />
                                </div>
                                <div className="w-1/2 min-w-[400px] h-full overflow-hidden">
                                    <ResponseViewer response={activeResponse} error={activeError} expectedResponse={activeRequest?.expectedResponse} />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Modal isOpen={isCurlModalOpen} onClose={() => setIsCurlModalOpen(false)} title="Import cURL" onConfirm={handleImportCurlConfirm} confirmText="Import" confirmDisabled={!curlInput.trim()}>
                <textarea value={curlInput} onChange={(e) => setCurlInput(e.target.value)} className="w-full h-40 border border-gray-300 rounded p-3 font-mono text-xs focus:outline-none focus:border-green-500 bg-gray-50" placeholder="curl 'https://api.example.com' ..." />
            </Modal>
            <Modal isOpen={isSwaggerModalOpen} onClose={() => setIsSwaggerModalOpen(false)} title="Import Swagger/OpenAPI" onConfirm={handleImportSwaggerConfirm} confirmText="Import" confirmDisabled={!swaggerInput.trim()}>
                <textarea value={swaggerInput} onChange={(e) => setSwaggerInput(e.target.value)} className="w-full h-40 border border-gray-300 rounded p-3 font-mono text-xs focus:outline-none focus:border-green-500 bg-gray-50" placeholder='Paste Swagger/OpenAPI JSON here...' />
            </Modal>
            <EnvironmentManager
                isOpen={isEnvManagerOpen}
                onClose={() => setIsEnvManagerOpen(false)}
                environments={environments}
                onSave={handleSaveEnvironments}
            />
        </div>
    );
};

export default App;
