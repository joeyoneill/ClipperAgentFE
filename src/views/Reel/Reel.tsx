// src/views/Reel/Reel.tsx

// Imports
import React, { useCallback, useEffect, useState } from 'react';
import { ReelClipCard } from '../../components/reel/ReelClipCard';
import { useAuth } from '../../context/AuthContext';
import { getUserReelClips } from '../../services/reelService';
import type { FlowMode } from '../../types/flow';
import type { SFVideoResponse } from '../../types/sf_videos';
import styles from './Reel.module.css';

////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////

interface ReelProps {
    onSelectMode: (mode: FlowMode) => void;
}

function formatTimecode(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1).padStart(4, '0');
    return `${String(mins).padStart(2, '0')}:${secs}`;
}

function formatDate(isoString: string): string {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
}

////////////////////////////////////////////////////////////////
// Exportable View Component
////////////////////////////////////////////////////////////////

export const Reel: React.FC<ReelProps> = ({ onSelectMode }) => {
    const { getToken } = useAuth();

    const [clips, setClips] = useState<SFVideoResponse[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Selected clip ID for the Single-Clip Detail / Inspector View
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

    const fetchClips = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('NO AUTH TOKEN AVAILABLE.');
            const data = await getUserReelClips(token);
            setClips(data);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'FAILED TO LOAD REEL VAULT.');
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        void fetchClips();
    }, [fetchClips]);

    const handleClipUpdated = (updated: SFVideoResponse) => {
        setClips((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        );
    };

    const handleClipDeletedFromDetail = (sfId: string) => {
        setClips((prev) => prev.filter((c) => c.id !== sfId));
        setSelectedClipId(null);
    };

    const selectedClip = clips.find((c) => c.id === selectedClipId) || null;

    // ================================================================
    // VIEW 2: SINGLE-CLIP INSPECTOR & DOWNLOAD VIEW
    // ================================================================
    if (selectedClip) {
        return (
            <div className={styles.reelContainer}>
                <ReelClipCard
                    clip={selectedClip}
                    onBack={() => setSelectedClipId(null)}
                    onClipUpdated={handleClipUpdated}
                    onClipDeleted={handleClipDeletedFromDetail}
                />
            </div>
        );
    }

    // ================================================================
    // VIEW 1 (DEFAULT): DIRECTORY TABLE VIEW (Mirrors Vault.tsx)
    // ================================================================
    return (
        <div className={styles.reelContainer}>
            {/* TOP NAVIGATION & ACTIONS */}
            <div className={styles.topBar}>
                <div className={styles.navRow}>
                    <button
                        type="button"
                        className={styles.backBtn}
                        onClick={() => onSelectMode('HOME')}
                    >
                        &lt; MAIN DECK
                    </button>
                    <div className={styles.topActions}>
                        <button
                            type="button"
                            className={styles.refreshBtn}
                            onClick={fetchClips}
                            disabled={loading}
                        >
                            [ {loading ? 'LOADING...' : 'REFRESH'} ]
                        </button>
                        <button
                            type="button"
                            className={styles.studioNavBtn}
                            onClick={() => onSelectMode('CHAT')}
                        >
                            [ + STUDIO ]
                        </button>
                    </div>
                </div>
                <h2 className={styles.heading}>&lt;REEL VAULT&gt;</h2>
            </div>

            {errorMsg && (
                <div className={styles.errorBanner}>
                    <span>! SYSTEM ALERT: {errorMsg}</span>
                </div>
            )}

            {/* LOADING STATE */}
            {loading && clips.length === 0 && (
                <div className={styles.stateBox}>
                    <p>SCANNING REEL VAULT...</p>
                </div>
            )}

            {/* EMPTY STATE */}
            {!loading && clips.length === 0 && !errorMsg && (
                <div className={styles.stateBox}>
                    <p className={styles.emptyTitle}>NO SAVED CLIPS FOUND IN REEL</p>
                    <button
                        type="button"
                        className={styles.studioNavBtn}
                        onClick={() => onSelectMode('CHAT')}
                    >
                        [ + CLIP FIRST SHORT IN STUDIO ]
                    </button>
                </div>
            )}

            {/* REEL TABLE (Mirrors Vault.tsx) */}
            {clips.length > 0 && (
                <div className={styles.tableWrapper}>
                    <table className={styles.reelTable}>
                        <thead>
                            <tr>
                                <th>CLIP TITLE</th>
                                <th>SOURCE TAPE</th>
                                <th>WINDOW / LENGTH</th>
                                <th>SAVED</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clips.map((clip) => {
                                const sfId = clip.id || '';

                                return (
                                    <tr
                                        key={sfId}
                                        className={styles.tableRow}
                                        onClick={() => sfId && setSelectedClipId(sfId)}
                                    >
                                        {/* CLIP TITLE + BADGE */}
                                        <td className={styles.fileCell}>
                                            <div
                                                className={styles.fileMain}
                                                data-fullname={clip.title}
                                            >
                                                <span className={styles.formatBadge}>
                                                    CLIP
                                                </span>
                                                <span
                                                    className={styles.filenameText}
                                                    title={clip.title}
                                                >
                                                    {clip.title}
                                                </span>
                                            </div>
                                        </td>

                                        {/* SOURCE TAPE */}
                                        <td className={styles.sourceCell}>
                                            <span
                                                className={styles.sourceText}
                                                title={clip.source_filename}
                                            >
                                                {clip.source_filename}
                                            </span>
                                        </td>

                                        {/* TIMECODE WINDOW & DURATION */}
                                        <td>
                                            {formatTimecode(clip.start_sec)} -{' '}
                                            {formatTimecode(clip.end_sec)} (
                                            {clip.duration_seconds.toFixed(1)}s)
                                        </td>

                                        {/* CREATED DATE */}
                                        <td>{formatDate(clip.created_at)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};