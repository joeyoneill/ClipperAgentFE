// src/views/Vault/Vault.tsx
import React, { useCallback, useEffect, useState } from 'react';
import type { FlowMode } from '../../types/flow';
import type { LFVideo } from '../../types/lf_videos/upload';
import { ALLOWED_VIDEO_MIME_TYPES } from '../../types/lf_videos/upload';
import { useAuth } from '../../context/AuthContext';
import { deleteVideoById, getUserVideos } from '../../services/vaultService';
import styles from './Vault.module.css';

////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////

interface VaultProps {
    onSelectMode: (mode: FlowMode) => void;
}

function formatBytes(bytes: number | null): string {
    if (bytes === null || bytes <= 0) return '--';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i >= 2 ? 2 : 0)} ${sizes[i]}`;
}

function formatDuration(seconds: number | null): string {
    if (seconds === null || seconds <= 0) return '--:--:--';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
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

function getFormatBadge(contentType: string | null): string {
    if (!contentType) return 'VID';
    return (ALLOWED_VIDEO_MIME_TYPES[contentType.toLowerCase()] || 'VID').toUpperCase();
}

////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////

export const Vault: React.FC<VaultProps> = ({ onSelectMode }) => {
    const { getToken } = useAuth();

    const [videos, setVideos] = useState<LFVideo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Tracks which video row is asking "Are you sure?" and which is actively deleting
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchVideos = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('NO AUTH TOKEN AVAILABLE.');
            const data = await getUserVideos(token);
            setVideos(data);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'FAILED TO LOAD VAULT.');
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    useEffect(() => {
        void fetchVideos();
    }, [fetchVideos]);

    const handleDelete = async (vid: string) => {
        setDeletingId(vid);
        setErrorMsg(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('NO AUTH TOKEN AVAILABLE.');
            await deleteVideoById(token, vid);
            // Remove from table state immediately
            setVideos((prev) => prev.filter((v) => v.id !== vid));
            setConfirmId(null);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'FAILED TO DELETE VIDEO.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className={styles.vaultContainer}>
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
                            onClick={fetchVideos}
                            disabled={loading}
                        >
                            [ {loading ? 'LOADING...' : 'REFRESH'} ]
                        </button>
                        <button
                            type="button"
                            className={styles.uploadNavBtn}
                            onClick={() => onSelectMode('UPLOAD')}
                        >
                            [ + UPLOAD ]
                        </button>
                    </div>
                </div>
                <h2 className={styles.heading}>&lt;MEDIA VAULT&gt;</h2>
            </div>

            {errorMsg && (
                <div className={styles.errorBanner}>
                    <span>! SYSTEM ALERT: {errorMsg}</span>
                </div>
            )}

            {/* LOADING STATE */}
            {loading && videos.length === 0 && (
                <div className={styles.stateBox}>
                    <p>SCANNING CLOUD VAULT...</p>
                </div>
            )}

            {/* EMPTY STATE */}
            {!loading && videos.length === 0 && !errorMsg && (
                <div className={styles.stateBox}>
                    <p className={styles.emptyTitle}>NO VIDEO TAPES FOUND IN VAULT</p>
                    <button
                        type="button"
                        className={styles.uploadNavBtn}
                        onClick={() => onSelectMode('UPLOAD')}
                    >
                        [ + INSERT FIRST VIDEO ]
                    </button>
                </div>
            )}

            {/* VAULT TABLE */}
            {videos.length > 0 && (
                <div className={styles.tableWrapper}>
                    <table className={styles.vaultTable}>
                        <thead>
                            <tr>
                                <th>TAPE / FILENAME</th>
                                <th>STATUS</th>
                                <th>DURATION</th>
                                <th>SIZE</th>
                                <th>UPLOADED</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {videos.map((video) => {
                                const vid = video.id || '';
                                const isConfirming = confirmId === vid;
                                const isDeleting = deletingId === vid;

                                return (
                                    <tr key={vid} className={styles.tableRow}>
                                        {/* FILENAME + FORMAT BADGE */}
                                        <td className={styles.fileCell}>
                                            <div 
                                                className={styles.fileMain}
                                                data-fullname={video.filename}
                                            >
                                                <span className={styles.formatBadge}>
                                                    {getFormatBadge(video.content_type)}
                                                </span>
                                                <span
                                                    className={styles.filenameText}
                                                    title={video.filename}
                                                >
                                                    {video.filename}
                                                </span>
                                            </div>
                                            {video.error_msg && (
                                                <div className={styles.rowError}>
                                                    ! {video.error_msg}
                                                </div>
                                            )}
                                        </td>

                                        {/* STATUS BADGE */}
                                        <td>
                                            <span
                                                className={`${styles.statusBadge} ${
                                                    styles[`status_${video.status}`] || ''
                                                }`}
                                            >
                                                {video.status}
                                            </span>
                                        </td>

                                        {/* DURATION, SIZE, DATE */}
                                        <td>{formatDuration(video.duration_seconds)}</td>
                                        <td>{formatBytes(video.file_size_bytes)}</td>
                                        <td>{formatDate(video.created_at)}</td>

                                        {/* DELETE / CONFIRM CONTROLS */}
                                        <td className={styles.actionCell}>
                                            {isDeleting ? (
                                                <button
                                                    type="button"
                                                    className={styles.deleteBtn}
                                                    disabled
                                                >
                                                    [ DELETING... ]
                                                </button>
                                            ) : isConfirming ? (
                                                <div className={styles.confirmGroup}>
                                                    <button
                                                        type="button"
                                                        className={styles.confirmYesBtn}
                                                        onClick={() => handleDelete(vid)}
                                                    >
                                                        [ SURE? ]
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.confirmNoBtn}
                                                        onClick={() => setConfirmId(null)}
                                                    >
                                                        [ NO ]
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={styles.deleteBtn}
                                                    onClick={() => setConfirmId(vid)}
                                                    disabled={!vid}
                                                >
                                                    [ DELETE ]
                                                </button>
                                            )}
                                        </td>
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