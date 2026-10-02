// src/views/Upload/Upload.tsx
import React, { useRef, useState } from 'react';
import type { FlowMode } from '../../types/flow';
import { useUpload } from '../../context/UploadContext';
import styles from './Upload.module.css';

interface UploadProps {
    onSelectMode: (mode: FlowMode) => void;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
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

export const Upload: React.FC<UploadProps> = ({ onSelectMode }) => {
    const {
        file,
        metadata,
        stage,
        progress,
        videoId,
        errorMsg,
        selectFile,
        startUpload,
        pauseUpload,
        resumeUpload,
        cancelUpload,
        resetUpload,
    } = useUpload();

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (stage === 'IDLE') setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (stage !== 'IDLE') return;

        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            await selectFile(droppedFile);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const pickedFile = e.target.files?.[0];
        if (pickedFile) {
            await selectFile(pickedFile);
        }
        e.target.value = '';
    };

    const isTransferActive =
        stage === 'INITIALIZING' ||
        stage === 'UPLOADING' ||
        stage === 'PAUSED' ||
        stage === 'FINALIZING';

    // 20 discrete arcade LED segments for the progress bar
    const totalSegments = 20;
    const filledSegments = Math.round((progress.percentage / 100) * totalSegments);

    return (
        <div className={styles.uploadContainer}>
            <div className={styles.topBar}>
                <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => onSelectMode('HOME')}
                >
                    &lt; MAIN DECK
                </button>
                <h2 className={styles.heading}>&lt;INSERT LONG-FORM VIDEO&gt;</h2>
            </div>

            {errorMsg && (
                <div className={styles.errorBanner}>
                    <span>! SYSTEM ALERT: {errorMsg}</span>
                </div>
            )}

            {/* STATE 1: NO FILE SELECTED -> DROPZONE */}
            {!file && stage === 'IDLE' && (
                <div
                    className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp4,.webm,.mov,.avi,.mkv,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
                        onChange={handleFileChange}
                        hidden
                    />
                    <div className={styles.dropIcon}>[ ▲ ]</div>
                    <p className={styles.dropTitle}>DROP VIDEO TAPE HERE</p>
                    <p className={styles.dropSub}>OR CLICK TO BROWSE LOCAL DISK</p>
                    <div className={styles.formatBadges}>
                        <span>MP4</span>
                        <span>WEBM</span>
                        <span>MOV</span>
                        <span>AVI</span>
                        <span>MKV</span>
                    </div>
                </div>
            )}

            {/* STATE 2: FILE SELECTED -> TAPE DECK INSPECTOR & PROGRESS */}
            {file && metadata && (
                <div className={styles.deckCard}>
                    <div className={styles.deckHeader}>
                        <span className={styles.badge}>{metadata.formatLabel}</span>
                        <span className={styles.filename} title={metadata.filename}>
                            {metadata.filename}
                        </span>
                    </div>

                    <div className={styles.telemetryGrid}>
                        <div className={styles.telemetryItem}>
                            <span className={styles.telemetryLabel}>FILE SIZE</span>
                            <span className={styles.telemetryValue}>
                                {formatBytes(metadata.sizeBytes)}
                            </span>
                        </div>
                        <div className={styles.telemetryItem}>
                            <span className={styles.telemetryLabel}>DURATION</span>
                            <span className={styles.telemetryValue}>
                                {formatDuration(metadata.durationSeconds)}
                            </span>
                        </div>
                        <div className={styles.telemetryItem}>
                            <span className={styles.telemetryLabel}>RESOLUTION</span>
                            <span className={styles.telemetryValue}>
                                {metadata.width && metadata.height
                                    ? `${metadata.width}x${metadata.height}`
                                    : 'N/A'}
                            </span>
                        </div>
                        <div className={styles.telemetryItem}>
                            <span className={styles.telemetryLabel}>STATUS</span>
                            <span className={styles.telemetryStatus}>{stage}</span>
                        </div>
                    </div>

                    {/* PROGRESS MONITOR */}
                    {(isTransferActive || stage === 'SUCCESS' || stage === 'ERROR') && (
                        <div className={styles.progressSection}>
                            <div className={styles.segmentedBar}>
                                {Array.from({ length: totalSegments }).map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`${styles.segment} ${
                                            idx < filledSegments ? styles.segmentFilled : ''
                                        } ${stage === 'PAUSED' ? styles.segmentPaused : ''}`}
                                    />
                                ))}
                            </div>

                            <div className={styles.progressStats}>
                                <span>
                                    {progress.percentage.toFixed(1)}% (
                                    {formatBytes(progress.bytesUploaded)} /{' '}
                                    {formatBytes(progress.totalBytes)})
                                </span>
                                {stage === 'UPLOADING' && (
                                    <span>
                                        {formatBytes(progress.speedBytesPerSec)}/s | ETA:{' '}
                                        {formatDuration(progress.etaSeconds)}
                                    </span>
                                )}
                                {stage === 'PAUSED' && <span>[ TRANSFER PAUSED ]</span>}
                                {stage === 'FINALIZING' && <span>[ VERIFYING CLOUD BLOB... ]</span>}
                            </div>
                        </div>
                    )}

                    {/* BUTTONS: READY TO START */}
                    {stage === 'IDLE' && (
                        <div className={styles.actionRow}>
                            <button
                                type="button"
                                className={styles.primaryBtn}
                                onClick={startUpload}
                            >
                                [ START UPLOAD ]
                            </button>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={resetUpload}
                            >
                                [ EJECT TAPE ]
                            </button>
                        </div>
                    )}

                    {/* BUTTONS: ACTIVE TRANSFER */}
                    {isTransferActive && (
                        <div className={styles.actionRow}>
                            {stage === 'UPLOADING' && (
                                <button
                                    type="button"
                                    className={styles.warningBtn}
                                    onClick={pauseUpload}
                                >
                                    [ || PAUSE ]
                                </button>
                            )}
                            {stage === 'PAUSED' && (
                                <button
                                    type="button"
                                    className={styles.primaryBtn}
                                    onClick={resumeUpload}
                                >
                                    [ &gt; RESUME ]
                                </button>
                            )}
                            <button
                                type="button"
                                className={styles.dangerBtn}
                                onClick={cancelUpload}
                                disabled={stage === 'FINALIZING'}
                            >
                                [ X ABORT ]
                            </button>
                        </div>
                    )}

                    {/* BUTTONS: ERROR */}
                    {stage === 'ERROR' && (
                        <div className={styles.actionRow}>
                            <button
                                type="button"
                                className={styles.primaryBtn}
                                onClick={
                                    progress.bytesUploaded > 0 ? resumeUpload : startUpload
                                }
                            >
                                [ RETRY TRANSFER ]
                            </button>
                            <button
                                type="button"
                                className={styles.dangerBtn}
                                onClick={cancelUpload}
                            >
                                [ CLEAR ]
                            </button>
                        </div>
                    )}

                    {/* BUTTONS: COMPLETE */}
                    {stage === 'SUCCESS' && (
                        <div className={styles.successBox}>
                            <p className={styles.successTitle}>
                                ★ STAGE CLEAR: VIDEO UPLOADED TO VAULT ★
                            </p>
                            {videoId && <p className={styles.videoIdText}>TAPE ID: {videoId}</p>}
                            <div className={styles.actionRow}>
                                <button
                                    type="button"
                                    className={styles.primaryBtn}
                                    onClick={() => onSelectMode('VAULT')}
                                >
                                    [ OPEN VAULT ]
                                </button>
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={() => onSelectMode('CHAT')}
                                >
                                    [ CLIPPING STUDIO ]
                                </button>
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={resetUpload}
                                >
                                    [ + UPLOAD ANOTHER ]
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};