// src/views/Chat/Chat.tsx

// imports
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { SessionSidebar } from '../../components/chat/SessionSidebar';
import { useAuth } from '../../context/AuthContext';
import {
    buildChatStreamWsUrl,
    createChatSession,
    deleteChatSession,
    fetchChatSessionDetail,
    fetchChatSessions,
    fetchCompletedVaultVideos,
    updateChatSession,
} from '../../services/chatApiService';
import type {
    AgentTraceStep,
    ChatMessageModel,
    ChatSessionSummary,
    VaultVideoItem,
    WSClientMessage,
    WSServerMessage,
} from '../../types/chat';
import type { FlowMode } from '../../types/flow';
import type { SFVideo } from '../../types/sf_videos';
import styles from './Chat.module.css';

// Component/View Props
interface ChatProps {
    onSelectMode: (mode: FlowMode) => void;
}

////////////////////////////////////////////////////////////////
// Exportable View Component Function
////////////////////////////////////////////////////////////////

export const Chat: React.FC<ChatProps> = ({ onSelectMode }) => {
    const { getToken } = useAuth();

    // Sidebar & Session State
    const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [vaultVideos, setVaultVideos] = useState<VaultVideoItem[]>([]);
    const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // Active Thread Messages & Streaming State
    const [messages, setMessages] = useState<ChatMessageModel[]>([]);
    const [inputText, setInputText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [savedCandidateIds, setSavedCandidateIds] = useState<Set<string>>(
        new Set()
    );

    // Refs for WebSocket & Active Streaming Message Bubble
    const wsRef = useRef<WebSocket | null>(null);
    const streamingMsgIdRef = useRef<string | null>(null);
    const feedEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = useCallback(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isStreaming, scrollToBottom]);

    // Helper to send a typed frame over the active WebSocket
    const sendWsFrame = useCallback((frame: WSClientMessage): boolean => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(frame));
            return true;
        }
        return false;
    }, []);

    // ==== WEBSOCKET HANDLER ====
    // Connect WebSocket for a specific sessionId
    const connectWebSocket = useCallback(
        async (sessionId: string) => {
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
            }
            setWsConnected(false);
            const token = await getToken();
            if (!token) {
                setErrorMsg('Authentication token missing. Please refresh.');
                return;
            }
            const wsUrl = buildChatStreamWsUrl(token, sessionId);
            const socket = new WebSocket(wsUrl);
            wsRef.current = socket;
            socket.onopen = () => {
                setWsConnected(true);
                setErrorMsg(null);
            };
            socket.onclose = () => {
                setWsConnected(false);
                setIsStreaming(false);
                streamingMsgIdRef.current = null;
            };
            socket.onerror = () => {
                setErrorMsg('WebSocket link interrupted. Re-select log to reconnect.');
                setIsStreaming(false);
            };
            socket.onmessage = (event) => {
                try {
                    const frame = JSON.parse(event.data) as WSServerMessage;
                    const { type, data } = frame;
                    if (type === 'SESSION_INIT' && data.session) {
                        const sess = data.session;
                        setSelectedVideoIds(sess.selected_video_ids || []);
                        setSessions((prev) => {
                            const exists = prev.some((s) => s.id === sess.id);
                            if (!exists) return [sess, ...prev];
                            return prev.map((s) => (s.id === sess.id ? sess : s));
                        });
                        return;
                    }
                    if (type === 'AGENT_THOUGHT' && data.delta) {
                        const targetId = streamingMsgIdRef.current;
                        if (!targetId) return;
                        setMessages((prev) =>
                            prev.map((m) => {
                                if (m.id !== targetId) return m;
                                const trace = [...m.trace];
                                const lastStep = trace[trace.length - 1];
                                if (lastStep && lastStep.step_type === 'THOUGHT') {
                                    trace[trace.length - 1] = {
                                        ...lastStep,
                                        content: (lastStep.content || '') + data.delta,
                                    };
                                } else {
                                    trace.push({
                                        id: `thought-${Date.now()}`,
                                        step_type: 'THOUGHT',
                                        title: 'AGENT REASONING',
                                        content: data.delta,
                                        created_at: new Date().toISOString(),
                                    });
                                }
                                return { ...m, trace };
                            })
                        );
                        return;
                    }
                    if (type === 'TRACE_STEP' && data.step) {
                        const targetId = streamingMsgIdRef.current;
                        if (!targetId) return;
                        const incomingStep: AgentTraceStep = data.step;
                        setMessages((prev) =>
                            prev.map((m) => {
                                if (m.id !== targetId) return m;
                                const trace = [...m.trace];
                                // If finalizing a streamed THOUGHT step, replace the live thought step
                                if (
                                    incomingStep.step_type === 'THOUGHT' &&
                                    trace.length > 0 &&
                                    trace[trace.length - 1].step_type === 'THOUGHT'
                                ) {
                                    trace[trace.length - 1] = incomingStep;
                                } else {
                                    trace.push(incomingStep);
                                }
                                return { ...m, trace };
                            })
                        );
                        return;
                    }
                    if (type === 'CLIP_CANDIDATE' && data.candidate) {
                        const targetId = streamingMsgIdRef.current;
                        if (!targetId) return;
                        const cand = data.candidate;
                        setMessages((prev) =>
                            prev.map((m) => {
                                if (m.id !== targetId) return m;
                                const alreadyAdded = m.clip_candidates.some(
                                    (c) => c.id === cand.id
                                );
                                if (alreadyAdded) return m;
                                return {
                                    ...m,
                                    clip_candidates: [...m.clip_candidates, cand],
                                };
                            })
                        );
                        return;
                    }
                    if (type === 'AGENT_TOKEN' && data.delta) {
                        const targetId = streamingMsgIdRef.current;
                        if (!targetId) return;
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === targetId
                                    ? { ...m, text: m.text + data.delta }
                                    : m
                            )
                        );
                        return;
                    }
                    if (type === 'TURN_COMPLETE') {
                        setIsStreaming(false);
                        streamingMsgIdRef.current = null;
                        if (data.session) {
                            const updatedSess = data.session;
                            setSessions((prev) =>
                                prev.map((s) =>
                                    s.id === updatedSess.id ? updatedSess : s
                                )
                            );
                        }
                        return;
                    }
                    if (type === 'TURN_INTERRUPTED') {
                        const targetId = streamingMsgIdRef.current;
                        setIsStreaming(false);
                        streamingMsgIdRef.current = null;
                        if (targetId) {
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === targetId ? { ...m, interrupted: true } : m
                                )
                            );
                        }
                        return;
                    }
                    if (type === 'CONTEXT_ADDED') {
                        const oldTargetId = streamingMsgIdRef.current;
                        const newModelMsgId = `model-${Date.now()}`;
                        streamingMsgIdRef.current = newModelMsgId;
                        setIsStreaming(true);
                        const steeringUserMsg: ChatMessageModel = {
                            id: `user-steer-${Date.now()}`,
                            role: 'user',
                            text: `[USER ADDED CONTEXT / STEERING]: ${data.text || ''}`,
                            trace: [],
                            clip_candidates: [],
                            interrupted: false,
                            created_at: new Date().toISOString(),
                        };
                        const pivotedModelMsg: ChatMessageModel = {
                            id: newModelMsgId,
                            role: 'model',
                            text: '',
                            trace: [],
                            clip_candidates: [],
                            interrupted: false,
                            created_at: new Date().toISOString(),
                        };
                        setMessages((prev) => [
                            ...prev.map((m) =>
                                m.id === oldTargetId ? { ...m, interrupted: true } : m
                            ),
                            steeringUserMsg,
                            pivotedModelMsg,
                        ]);
                        return;
                    }
                    if (type === 'VIDEOS_UPDATED' && data.selected_video_ids) {
                        const vids = data.selected_video_ids;
                        setSelectedVideoIds(vids);
                        setSessions((prev) =>
                            prev.map((s) =>
                                s.id === sessionId
                                    ? { ...s, selected_video_ids: vids }
                                    : s
                            )
                        );
                        return;
                    }
                    if (type === 'ERROR') {
                        setErrorMsg(data.message || 'An error occurred in the studio.');
                        setIsStreaming(false);
                        streamingMsgIdRef.current = null;
                    }
                } catch (err) {
                    console.error('Failed to parse WebSocket frame:', err);
                }
            };
        },
        [getToken]
    );

    // Load a specific session's message history & open its WebSocket
    const loadAndActivateSession = useCallback(
        async (sessionId: string) => {
            setActiveSessionId(sessionId);
            setIsLoadingMessages(true);
            setErrorMsg(null);
            setIsStreaming(false);
            streamingMsgIdRef.current = null;
            try {
                const detail = await fetchChatSessionDetail(getToken, sessionId);
                setMessages(detail.messages || []);
                setSelectedVideoIds(detail.selected_video_ids || []);
                await connectWebSocket(sessionId);
            } catch (err) {
                setErrorMsg(
                    err instanceof Error
                        ? err.message
                        : 'Failed to load chat session history.'
                );
            } finally {
                setIsLoadingMessages(false);
            }
        },
        [connectWebSocket, getToken]
    );

    // Initial Bootstrap: Fetch Vault Videos & Chat Sessions
    useEffect(() => {
        let isMounted = true;
        async function bootstrapStudio() {
            setIsLoadingSessions(true);
            try {
                const [vids, existingSessions] = await Promise.all([
                    fetchCompletedVaultVideos(getToken),
                    fetchChatSessions(getToken),
                ]);
                if (!isMounted) return;
                setVaultVideos(vids);
                if (existingSessions.length > 0) {
                    setSessions(existingSessions);
                    await loadAndActivateSession(existingSessions[0].id);
                } else {
                    const created = await createChatSession(getToken, {
                        title: 'NEW CLIPPING LOG',
                        selected_video_ids: [],
                    });
                    if (!isMounted) return;
                    setSessions([created]);
                    setActiveSessionId(created.id);
                    setMessages([]);
                    setSelectedVideoIds([]);
                    await connectWebSocket(created.id);
                }
            } catch (err) {
                if (!isMounted) return;
                setErrorMsg(
                    err instanceof Error
                        ? err.message
                        : 'Failed to initialize Clipping Studio.'
                );
            } finally {
                if (isMounted) setIsLoadingSessions(false);
            }
        }
        bootstrapStudio();
        return () => {
            isMounted = false;
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
        };
    }, [connectWebSocket, getToken, loadAndActivateSession]);

    // Create a New Session Log
    const handleCreateSession = async () => {
        if (isStreaming) return;
        setErrorMsg(null);
        try {
            const created = await createChatSession(getToken, {
                title: 'NEW CLIPPING LOG',
                selected_video_ids: selectedVideoIds,
            });
            setSessions((prev) => [created, ...prev]);
            setActiveSessionId(created.id);
            setMessages([]);
            await connectWebSocket(created.id);
        } catch (err) {
            setErrorMsg(
                err instanceof Error ? err.message : 'Failed to create new log.'
            );
        }
    };

    // Delete a Session Log
    const handleDeleteSession = async (
        sessionId: string,
        e: React.MouseEvent
    ) => {
        e.stopPropagation();
        if (isStreaming) return;
        try {
            await deleteChatSession(getToken, sessionId);
            const remaining = sessions.filter((s) => s.id !== sessionId);
            setSessions(remaining);
            if (activeSessionId === sessionId) {
                if (remaining.length > 0) {
                    await loadAndActivateSession(remaining[0].id);
                } else {
                    await handleCreateSession();
                }
            }
        } catch (err) {
            setErrorMsg(
                err instanceof Error ? err.message : 'Failed to delete session.'
            );
        }
    };

    // Toggle Pinned Video in Tape Selector
    const handleToggleVideoScope = async (videoId: string) => {
        const nextIds = selectedVideoIds.includes(videoId)
            ? selectedVideoIds.filter((id) => id !== videoId)
            : [...selectedVideoIds, videoId];
        setSelectedVideoIds(nextIds);
        const sentOverWs = sendWsFrame({
            type: 'SET_VIDEOS',
            selected_video_ids: nextIds,
        });
        if (!sentOverWs && activeSessionId) {
            try {
                await updateChatSession(getToken, activeSessionId, {
                    selected_video_ids: nextIds,
                });
            } catch (err) {
                console.error('Failed to update video scope:', err);
            }
        }
    };

    const handleClearVideoScope = async () => {
        if (selectedVideoIds.length === 0) return;
        setSelectedVideoIds([]);
        const sentOverWs = sendWsFrame({
            type: 'SET_VIDEOS',
            selected_video_ids: [],
        });
        if (!sentOverWs && activeSessionId) {
            try {
                await updateChatSession(getToken, activeSessionId, {
                    selected_video_ids: [],
                });
            } catch (err) {
                console.error('Failed to clear video scope:', err);
            }
        }
    };

    // Transmit a New User Prompt
    const handleSendMessage = () => {
        const trimmed = inputText.trim();
        if (!trimmed || isStreaming) return;
        if (!wsConnected) {
            setErrorMsg('WebSocket is not connected. Reconnecting...');
            if (activeSessionId) connectWebSocket(activeSessionId);
            return;
        }
        const userMsg: ChatMessageModel = {
            id: `user-${Date.now()}`,
            role: 'user',
            text: trimmed,
            trace: [],
            clip_candidates: [],
            interrupted: false,
            created_at: new Date().toISOString(),
        };
        const modelPlaceholderId = `model-${Date.now() + 1}`;
        const modelPlaceholder: ChatMessageModel = {
            id: modelPlaceholderId,
            role: 'model',
            text: '',
            trace: [],
            clip_candidates: [],
            interrupted: false,
            created_at: new Date().toISOString(),
        };
        streamingMsgIdRef.current = modelPlaceholderId;
        setIsStreaming(true);
        setInputText('');
        setErrorMsg(null);
        setMessages((prev) => [...prev, userMsg, modelPlaceholder]);
        sendWsFrame({
            type: 'USER_MESSAGE',
            text: trimmed,
            selected_video_ids: selectedVideoIds,
        });
    };

    // Interrupt In-Flight Turn
    const handleInterrupt = () => {
        if (!isStreaming) return;
        sendWsFrame({ type: 'INTERRUPT' });
    };

    // Inject Steering Context While Agent is Streaming
    const handleInjectContext = () => {
        const trimmed = inputText.trim();
        if (!trimmed || !isStreaming) return;
        setInputText('');
        sendWsFrame({
            type: 'ADD_CONTEXT',
            text: trimmed,
        });
    };

    // chat submission with enter button
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isStreaming) {
                if (inputText.trim()) handleInjectContext();
            } else {
                handleSendMessage();
            }
        }
    };

    // SF Candidate Save Handler Function
    const handleCandidateSaved = (candidateId: string, _savedClip: SFVideo) => {
        setSavedCandidateIds((prev) => {
            const next = new Set(prev);
            next.add(candidateId);
            return next;
        });
    };

    return (
        <div className={styles.studioContainer}>
            {/* TOP BAR */}
            <div className={styles.topBar}>
                <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => onSelectMode('HOME')}
                >
                    &lt; MAIN DECK
                </button>
                <h2 className={styles.heading}>&lt;CLIPPING STUDIO // RAG AGENT&gt;</h2>
                <div className={styles.connectionIndicator}>
                    <span
                        className={
                            wsConnected ? styles.statusDotOnline : styles.statusDotOffline
                        }
                    />
                    <span>{wsConnected ? 'LINK ONLINE' : 'LINK OFFLINE'}</span>
                </div>
            </div>
            {errorMsg && (
                <div className={styles.errorBanner}>
                    <span>! SYSTEM ALERT: {errorMsg}</span>
                    <button
                        type="button"
                        className={styles.dismissBtn}
                        onClick={() => setErrorMsg(null)}
                    >
                        [X]
                    </button>
                </div>
            )}
            
            {/* MAIN 2-COLUMN STUDIO DECK */}
            <div className={styles.studioWorkspace}>
                <SessionSidebar
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    vaultVideos={vaultVideos}
                    selectedVideoIds={selectedVideoIds}
                    isLoadingSessions={isLoadingSessions}
                    isStreaming={isStreaming}
                    onSelectSession={loadAndActivateSession}
                    onCreateSession={handleCreateSession}
                    onDeleteSession={handleDeleteSession}
                    onToggleVideoScope={handleToggleVideoScope}
                    onClearVideoScope={handleClearVideoScope}
                />
                
                {/* RIGHT CONSOLE: TERMINAL FEED + BIDI INPUT */}
                <section className={styles.consoleSection}>
                    <div className={styles.messageFeed}>
                        {isLoadingMessages ? (
                            <div className={styles.emptyFeedState}>
                                <p className={styles.emptyFeedTitle}>
                                    [ LOADING COMM LOG... ]
                                </p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className={styles.emptyFeedState}>
                                <p className={styles.emptyFeedTitle}>
                                    ★ CLIP_AGENT_OS READY FOR COMMANDS ★
                                </p>
                                <p className={styles.emptyFeedSub}>
                                    Ask questions about your Vault videos or instruct the
                                    agent to cut a short-form clip (e.g., &ldquo;Find the
                                    funniest moment and make a 30s clip&rdquo;).
                                </p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    sessionId={activeSessionId}
                                    isStreamingThisMessage={
                                        isStreaming &&
                                        msg.id === streamingMsgIdRef.current
                                    }
                                    savedCandidateIds={savedCandidateIds}
                                    onCandidateSaved={handleCandidateSaved}
                                    onOpenReel={() => onSelectMode('REEL')}
                                />
                            ))
                        )}
                        <div ref={feedEndRef} />
                    </div>
                    
                    {/* BIDIRECTIONAL INPUT BAR */}
                    <div className={styles.inputConsole}>
                        <textarea
                            className={styles.promptTextarea}
                            rows={2}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                isStreaming
                                    ? 'AGENT IS TRANSMITTING — TYPE HERE TO INJECT CONTEXT / STEER MID-TURN...'
                                    : 'ENTER QUERY OR CLIPPING INSTRUCTION (ENTER TO TRANSMIT, SHIFT+ENTER FOR NEWLINE)...'
                            }
                        />
                        <div className={styles.consoleButtonCol}>
                            {!isStreaming ? (
                                <button
                                    type="button"
                                    className={styles.transmitBtn}
                                    onClick={handleSendMessage}
                                    disabled={!inputText.trim() || !wsConnected}
                                >
                                    [ TRANSMIT &gt; ]
                                </button>
                            ) : (
                                <>
                                    {inputText.trim().length > 0 && (
                                        <button
                                            type="button"
                                            className={styles.injectContextBtn}
                                            onClick={handleInjectContext}
                                        >
                                            [ ⚡ INJECT CONTEXT ]
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.interruptBtn}
                                        onClick={handleInterrupt}
                                    >
                                        [ ■ INTERRUPT ]
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};