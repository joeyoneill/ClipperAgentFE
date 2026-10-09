// src/components/chat/SessionSidebar.tsx

// imports
import React from "react";
import type { ChatSessionSummary, VaultVideoItem } from "../../types/chat";
import styles from "../../views/Chat/Chat.module.css";

// Component Props
interface SessionSidebarProps {
    sessions: ChatSessionSummary[];
    activeSessionId: string | null;
    vaultVideos: VaultVideoItem[];
    selectedVideoIds: string[];
    isLoadingSessions: boolean;
    isStreaming: boolean;
    onSelectSession: (sessionId: string) => void;
    onCreateSession: () => void;
    onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
    onToggleVideoScope: (videoId: string) => void;
    onClearVideoScope: () => void;
}

////////////////////////////////////////////////////////////////
// Helpers (formatting functions)
////////////////////////////////////////////////////////////////

function formatShortDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatLogDate(isoString: string): string {
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString(undefined, {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

////////////////////////////////////////////////////////////////
// Exportable Component Function
////////////////////////////////////////////////////////////////

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
    sessions,
    activeSessionId,
    vaultVideos,
    selectedVideoIds,
    isLoadingSessions,
    isStreaming,
    onSelectSession,
    onCreateSession,
    onDeleteSession,
    onToggleVideoScope,
    onClearVideoScope,
}) => {
    const isAllTapesMode = selectedVideoIds.length === 0;

    return (
        <aside className={styles.sidebar}>
            
            {/* MODULE 1: TAPE SELECTOR (RAG SCOPE) */}
            <div className={styles.sidebarSection}>
                <div className={styles.sectionHeader}>
                    <span>TAPE SELECTOR</span>
                    <span className={styles.scopeCountBadge}>
                        {isAllTapesMode ? 'ALL' : `${selectedVideoIds.length} PINNED`}
                    </span>
                </div>
                
                <button
                    type="button"
                    className={`${styles.allTapesBtn} ${
                        isAllTapesMode ? styles.allTapesBtnActive : ''
                    }`}
                    onClick={onClearVideoScope}
                    disabled={isStreaming}
                >
                    {isAllTapesMode ? '[ ★ ALL VAULT TAPES ]' : '[ USE ALL VAULT TAPES ]'}
                </button>
                
                <div className={styles.tapeList}>
                    {vaultVideos.length === 0 ? (
                        <p className={styles.emptyHint}>
                            NO COMPLETED TAPES IN VAULT YET.
                        </p>
                    ) : (
                        vaultVideos.map((vid) => {
                            const isPinned = selectedVideoIds.includes(vid.id);
                            return (
                                <button
                                    key={vid.id}
                                    type="button"
                                    className={`${styles.tapeItem} ${
                                        isPinned ? styles.tapeItemPinned : ''
                                    }`}
                                    onClick={() => onToggleVideoScope(vid.id)}
                                    disabled={isStreaming}
                                    title={vid.filename}
                                >
                                    <span className={styles.tapeCheck}>
                                        {isPinned ? '[X]' : '[ ]'}
                                    </span>
                                    <span className={styles.tapeFilename}>
                                        {vid.filename}
                                    </span>
                                    <span className={styles.tapeDuration}>
                                        {formatShortDuration(vid.duration_seconds)}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
            
            {/* MODULE 2: COMM LOGS (FIRESTORE SESSIONS) */}
            <div className={styles.sidebarSectionGrow}>
                <div className={styles.sectionHeader}>
                    <span>COMM LOGS</span>
                    <span>{sessions.length}</span>
                </div>
                <button
                    type="button"
                    className={styles.newSessionBtn}
                    onClick={onCreateSession}
                    disabled={isStreaming}
                >
                    [ + NEW CLIPPING LOG ]
                </button>
                <div className={styles.sessionList}>
                    {isLoadingSessions ? (
                        <p className={styles.emptyHint}>LOADING LOGS...</p>
                    ) : sessions.length === 0 ? (
                        <p className={styles.emptyHint}>NO SAVED LOGS YET.</p>
                    ) : (
                        sessions.map((sess) => {
                            const isActive = sess.id === activeSessionId;
                            return (
                                <div
                                    key={sess.id}
                                    className={`${styles.sessionItem} ${
                                        isActive ? styles.sessionItemActive : ''
                                    }`}
                                    onClick={() => {
                                        if (!isStreaming && sess.id !== activeSessionId) {
                                            onSelectSession(sess.id);
                                        }
                                    }}
                                >
                                    <div className={styles.sessionInfo}>
                                        <span
                                            className={styles.sessionTitle}
                                            title={sess.title}
                                        >
                                            &gt; {sess.title}
                                        </span>
                                        <div className={styles.sessionMeta}>
                                            <span>{formatLogDate(sess.updated_at)}</span>
                                            {sess.selected_video_ids.length > 0 && (
                                                <span className={styles.sessionPinBadge}>
                                                    [{sess.selected_video_ids.length} TAPE
                                                    {sess.selected_video_ids.length > 1 ? 'S' : ''}]
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.deleteSessionBtn}
                                        onClick={(e) => onDeleteSession(sess.id, e)}
                                        disabled={isStreaming}
                                        title="Delete Log"
                                    >
                                        X
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </aside>
    );
};