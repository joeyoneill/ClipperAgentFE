// src/components/reel/ReelClipCard.tsx

// Imports
import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    deleteReelClipById,
    downloadReelClip,
    updateReelClipTitle,
} from '../../services/reelService';
import type {
    AspectRatioType,
    ResolutionType,
    SFVideoResponse,
} from '../../types/sf_videos';
import styles from '../../views/Reel/Reel.module.css';

// Component Props
interface ReelClipCardProps {
    clip: SFVideoResponse;
    onBack: () => void;
    onClipUpdated: (updated: SFVideoResponse) => void;
    onClipDeleted: (sfId: string) => void;
}

////////////////////////////////////////////////////////////////
// Helpers (formatting functions)
////////////////////////////////////////////////////////////////

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
// Exportable Component Function (Single-Clip Detail View)
////////////////////////////////////////////////////////////////

export const ReelClipCard: React.FC<ReelClipCardProps> = ({
    clip,
    onBack,
    onClipUpdated,
    onClipDeleted,
}) => {
    const { getToken } = useAuth();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const clipId = clip.id || '';

    // Video Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(clip.start_sec);
    const [showCaptions, setShowCaptions] = useState(true);

    // Inline Title Rename State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState(clip.title);
    const [isSavingTitle, setIsSavingTitle] = useState(false);

    // Export / Download Configuration State
    const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('original');
    const [resolution, setResolution] = useState<ResolutionType>('1080p');
    const [subtitles, setSubtitles] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Delete Confirmation State
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Error Banner State
    const [cardError, setCardError] = useState<string | null>(null);

    const duration = Math.max(0.1, clip.end_sec - clip.start_sec);
    const clampedElapsed = Math.max(0, Math.min(duration, currentTime - clip.start_sec));
    const progressPct = (clampedElapsed / duration) * 100;

    // 20 discrete arcade LED segments
    const totalSegments = 20;
    const filledSegments = Math.round((progressPct / 100) * totalSegments);

    // Check if the currently selected export combination is already cached in GCS
    const activeVariantKey = `${aspectRatio}__${resolution}__${
        subtitles ? 'subs_on' : 'subs_off'
    }`;
    const isVariantCached = Boolean(clip.rendered_variants?.[activeVariantKey]);

    // Compute live rolling 5-word caption window around currentTime
    const activeCaptionWindow = useMemo(() => {
        if (!showCaptions || !clip.words || clip.words.length === 0) {
            return null;
        }
        const activeIdx = clip.words.findIndex(
            (w) => currentTime >= w.start_sec - 0.08 && currentTime <= w.end_sec + 0.12
        );
        if (activeIdx === -1) return null;
        const windowStart = Math.floor(activeIdx / 5) * 5;
        const chunk = clip.words.slice(windowStart, windowStart + 5);
        return { chunk, activeIdx: activeIdx - windowStart };
    }, [clip.words, currentTime, showCaptions]);

    ////////////////////////////////////////////////////////////////
    // Video Player Handlers
    ////////////////////////////////////////////////////////////////

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            videoRef.current.currentTime = clip.start_sec;
            setCurrentTime(clip.start_sec);
        }
    };

    const handleTimeUpdate = () => {
        const vid = videoRef.current;
        if (!vid) return;
        if (vid.currentTime < clip.start_sec - 0.25) {
            vid.currentTime = clip.start_sec;
        }
        if (vid.currentTime >= clip.end_sec) {
            vid.pause();
            vid.currentTime = clip.start_sec;
            setIsPlaying(false);
            setCurrentTime(clip.start_sec);
            return;
        }
        setCurrentTime(vid.currentTime);
    };

    const togglePlay = () => {
        const vid = videoRef.current;
        if (!vid) return;
        if (vid.paused) {
            if (vid.currentTime < clip.start_sec || vid.currentTime >= clip.end_sec) {
                vid.currentTime = clip.start_sec;
            }
            vid.play().catch(() => setIsPlaying(false));
            setIsPlaying(true);
        } else {
            vid.pause();
            setIsPlaying(false);
        }
    };

    const handleReplay = () => {
        const vid = videoRef.current;
        if (!vid) return;
        vid.currentTime = clip.start_sec;
        setCurrentTime(clip.start_sec);
        vid.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
    };

    const handleScrubBar = (e: React.MouseEvent<HTMLDivElement>) => {
        const vid = videoRef.current;
        if (!vid) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetTime = Math.min(
            clip.end_sec - 0.05,
            clip.start_sec + clickRatio * duration
        );
        vid.currentTime = targetTime;
        setCurrentTime(targetTime);
    };

    ////////////////////////////////////////////////////////////////
    // Rename, Download, & Delete Handlers
    ////////////////////////////////////////////////////////////////

    const handleSaveTitle = async () => {
        const trimmed = titleDraft.trim();
        if (!trimmed || !clipId) return;
        if (trimmed === clip.title) {
            setIsEditingTitle(false);
            return;
        }
        setIsSavingTitle(true);
        setCardError(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('NO AUTH TOKEN AVAILABLE.');
            const updated = await updateReelClipTitle(token, clipId, { title: trimmed });
            onClipUpdated(updated);
            setIsEditingTitle(false);
        } catch (err) {
            setCardError(err instanceof Error ? err.message : 'FAILED TO RENAME CLIP.');
        } finally {
            setIsSavingTitle(false);
        }
    };

    const handleDownload = async () => {
        if (!clipId || isDownloading) return;
        setIsDownloading(true);
        setCardError(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('NO AUTH TOKEN AVAILABLE.');
            const res = await downloadReelClip(token, clipId, {
                aspect_ratio: aspectRatio,
                resolution,
                subtitles,
            });

            onClipUpdated({
                ...clip,
                status: 'SUCCESSFUL',
                is_complete: true,
                rendered_variants: {
                    ...(clip.rendered_variants || {}),
                    [res.variant_key]: 'cached',
                },
            });

            const link = document.createElement('a');
            link.href = res.download_url;
            link.setAttribute('download', res.filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            setCardError(err instanceof Error ? err.message : 'FAILED TO DOWNLOAD CLIP.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDelete = async () => {
        if (!clipId || isDeleting) return;
        setIsDeleting(true);
        setCardError(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('NO AUTH TOKEN AVAILABLE.');
            await deleteReelClipById(token, clipId);
            onClipDeleted(clipId);
        } catch (err) {
            setCardError(err instanceof Error ? err.message : 'FAILED TO DELETE CLIP.');
            setIsDeleting(false);
            setIsConfirmingDelete(false);
        }
    };

    return (
        <>
            {/* TOP BAR: BACK TO REEL LIST + DELETE */}
            <div className={styles.topBar}>
                <div className={styles.navRow}>
                    <button
                        type="button"
                        className={styles.backBtn}
                        onClick={onBack}
                    >
                        &lt; REEL LIST
                    </button>

                    <div className={styles.topActions}>
                        {isDeleting ? (
                            <button type="button" className={styles.deleteBtn} disabled>
                                [ DELETING... ]
                            </button>
                        ) : isConfirmingDelete ? (
                            <div className={styles.confirmGroup}>
                                <button
                                    type="button"
                                    className={styles.confirmYesBtn}
                                    onClick={handleDelete}
                                >
                                    [ SURE? ]
                                </button>
                                <button
                                    type="button"
                                    className={styles.confirmNoBtn}
                                    onClick={() => setIsConfirmingDelete(false)}
                                >
                                    [ NO ]
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className={styles.deleteBtn}
                                onClick={() => setIsConfirmingDelete(true)}
                                disabled={isDownloading || !clipId}
                            >
                                [ DELETE CLIP ]
                            </button>
                        )}
                    </div>
                </div>
                <h2 className={styles.heading}>&lt;CLIP INSPECTOR&gt;</h2>
            </div>

            {cardError && (
                <div className={styles.errorBanner}>
                    <span>! SYSTEM ALERT: {cardError}</span>
                </div>
            )}

            {/* MAIN INSPECTOR DECK */}
            <div className={styles.inspectorWrapper}>
                {/* HEADER BAR: TITLE + RENAME + TIMECODES */}
                <div className={styles.inspectorHeader}>
                    <div className={styles.clipTitleGroup}>
                        <span className={styles.formatBadge}>CLIP</span>
                        {isEditingTitle ? (
                            <div className={styles.titleEditRow}>
                                <input
                                    type="text"
                                    className={styles.titleInput}
                                    value={titleDraft}
                                    onChange={(e) => setTitleDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') void handleSaveTitle();
                                        if (e.key === 'Escape') {
                                            setTitleDraft(clip.title);
                                            setIsEditingTitle(false);
                                        }
                                    }}
                                    disabled={isSavingTitle}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className={styles.titleSaveBtn}
                                    onClick={handleSaveTitle}
                                    disabled={isSavingTitle || !titleDraft.trim()}
                                >
                                    [ {isSavingTitle ? '...' : 'SAVE'} ]
                                </button>
                                <button
                                    type="button"
                                    className={styles.titleCancelBtn}
                                    onClick={() => {
                                        setTitleDraft(clip.title);
                                        setIsEditingTitle(false);
                                    }}
                                    disabled={isSavingTitle}
                                >
                                    [ X ]
                                </button>
                            </div>
                        ) : (
                            <>
                                <span className={styles.inspectorTitle}>{clip.title}</span>
                                <button
                                    type="button"
                                    className={styles.renameBtn}
                                    onClick={() => {
                                        setTitleDraft(clip.title);
                                        setIsEditingTitle(true);
                                    }}
                                >
                                    [ RENAME ]
                                </button>
                            </>
                        )}
                    </div>

                    <div className={styles.headerMetaGroup}>
                        <span className={styles.clipTimeBadge}>
                            {formatTimecode(clip.start_sec)} - {formatTimecode(clip.end_sec)} (
                            {clip.duration_seconds.toFixed(1)}s)
                        </span>
                        <span className={styles.dateBadge}>{formatDate(clip.created_at)}</span>
                    </div>
                </div>

                {/* 2-COLUMN BODY: VIDEO PLAYER (LEFT) + INFO & EXPORT (RIGHT) */}
                <div className={styles.inspectorBody}>
                    {/* LEFT COLUMN: VIDEO PLAYER + CC OVERLAY + LED SCRUB BAR */}
                    <div className={styles.playerColumn}>
                        {clip.preview_url ? (
                            <div className={styles.videoStage}>
                                <div className={styles.videoViewport}>
                                    <video
                                        ref={videoRef}
                                        className={styles.videoElement}
                                        src={`${clip.preview_url}#t=${clip.start_sec},${clip.end_sec}`}
                                        onLoadedMetadata={handleLoadedMetadata}
                                        onTimeUpdate={handleTimeUpdate}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onClick={togglePlay}
                                        playsInline
                                    />
                                    {activeCaptionWindow && (
                                        <div className={styles.captionOverlay}>
                                            {activeCaptionWindow.chunk.map((w, idx) => (
                                                <span
                                                    key={`${w.start_sec}-${idx}`}
                                                    className={
                                                        idx === activeCaptionWindow.activeIdx
                                                            ? styles.captionWordActive
                                                            : styles.captionWord
                                                    }
                                                >
                                                    {w.word}{' '}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 20-SEGMENT ARCADE LED SCRUB BAR */}
                                <div
                                    className={styles.clipLedBar}
                                    onClick={handleScrubBar}
                                    onMouseMove={(e) => {
                                        if (e.buttons === 1) handleScrubBar(e);
                                    }}
                                    title="Click or drag to seek within clip"
                                >
                                    {Array.from({ length: totalSegments }).map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`${styles.clipLedSegment} ${
                                                idx < filledSegments ? styles.clipLedFilled : ''
                                            }`}
                                        />
                                    ))}
                                </div>

                                {/* TRANSPORT CONTROLS */}
                                <div className={styles.transportRow}>
                                    <button
                                        type="button"
                                        className={styles.transportBtn}
                                        onClick={togglePlay}
                                    >
                                        {isPlaying ? '[ || PAUSE ]' : '[ > PLAY CLIP ]'}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.transportBtn}
                                        onClick={handleReplay}
                                    >
                                        [ |&lt; REPLAY ]
                                    </button>
                                    {clip.words && clip.words.length > 0 && (
                                        <button
                                            type="button"
                                            className={styles.transportBtn}
                                            onClick={() => setShowCaptions((prev) => !prev)}
                                        >
                                            {showCaptions ? '[ CC: ON ]' : '[ CC: OFF ]'}
                                        </button>
                                    )}
                                    <span className={styles.playheadReadout}>
                                        {formatTimecode(currentTime)} /{' '}
                                        {formatTimecode(clip.end_sec)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.noPreviewBanner}>
                                ! PREVIEW STREAM UNAVAILABLE (SOURCE TAPE MAY BE DELETED)
                            </div>
                        )}

                        {/* METADATA, RATIONALE & TRANSCRIPT */}
                        <div className={styles.infoPanel}>
                            <div className={styles.sourceRow}>
                                <strong>SOURCE TAPE:</strong> {clip.source_filename}
                            </div>
                            {clip.rationale && (
                                <div className={styles.clipRationale}>
                                    <strong>EDITOR RATIONALE:</strong> {clip.rationale}
                                </div>
                            )}
                            {clip.transcript_text && (
                                <div className={styles.transcriptSection}>
                                    <span className={styles.optionLabel}>SLICED TRANSCRIPT:</span>
                                    <div className={styles.transcriptBox}>
                                        &ldquo;{clip.transcript_text}&rdquo;
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: EXPORT & DOWNLOAD SETTINGS */}
                    <div className={styles.exportDeck}>
                        <div className={styles.exportDeckHeader}>
                            <span className={styles.exportDeckTitle}>
                                &lt;DOWNLOAD OPTIONS&gt;
                            </span>
                            {isVariantCached && (
                                <span className={styles.cachedBadge}>
                                    [ ⚡ CACHED ]
                                </span>
                            )}
                        </div>

                        {/* 1. ASPECT RATIO / DIMENSIONS */}
                        <div className={styles.optionGroup}>
                            <span className={styles.optionLabel}>1. DIMENSIONS:</span>
                            <div className={styles.optionBtnColumn}>
                                <button
                                    type="button"
                                    className={`${styles.optionBtn} ${
                                        aspectRatio === 'original' ? styles.optionBtnActive : ''
                                    }`}
                                    onClick={() => setAspectRatio('original')}
                                    disabled={isDownloading}
                                >
                                    [ 16:9 ORIGINAL DIMENSIONS ]
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.optionBtn} ${
                                        aspectRatio === '9:16_crop' ? styles.optionBtnActive : ''
                                    }`}
                                    onClick={() => setAspectRatio('9:16_crop')}
                                    disabled={isDownloading}
                                >
                                    [ 9:16 VERTICAL CENTER CROP ]
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.optionBtn} ${
                                        aspectRatio === '9:16_pad' ? styles.optionBtnActive : ''
                                    }`}
                                    onClick={() => setAspectRatio('9:16_pad')}
                                    disabled={isDownloading}
                                >
                                    [ 9:16 VERTICAL BLUR PAD ]
                                </button>
                            </div>
                        </div>

                        {/* 2. QUALITY / RENDER SPEED */}
                        <div className={styles.optionGroup}>
                            <span className={styles.optionLabel}>2. QUALITY / SPEED:</span>
                            <div className={styles.optionBtnRow}>
                                <button
                                    type="button"
                                    className={`${styles.optionBtn} ${
                                        resolution === '1080p' ? styles.optionBtnActive : ''
                                    }`}
                                    onClick={() => setResolution('1080p')}
                                    disabled={isDownloading}
                                >
                                    [ 1080P FULL HD ]
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.optionBtn} ${
                                        resolution === '720p' ? styles.optionBtnActive : ''
                                    }`}
                                    onClick={() => setResolution('720p')}
                                    disabled={isDownloading}
                                >
                                    [ 720P FAST ]
                                </button>
                            </div>
                        </div>

                        {/* 3. BURNED-IN SUBTITLES */}
                        <div className={styles.optionGroup}>
                            <span className={styles.optionLabel}>3. SUBTITLE OVERLAY:</span>
                            <button
                                type="button"
                                className={`${styles.optionBtn} ${
                                    subtitles ? styles.optionBtnActive : ''
                                }`}
                                onClick={() => setSubtitles((prev) => !prev)}
                                disabled={
                                    isDownloading || !clip.words || clip.words.length === 0
                                }
                            >
                                {subtitles
                                    ? '[ SUBTITLES: ON ]'
                                    : '[ SUBTITLES: OFF ]'}
                            </button>
                        </div>

                        <button
                            type="button"
                            className={styles.downloadBtn}
                            onClick={handleDownload}
                            disabled={isDownloading || isDeleting || !clipId}
                        >
                            {isDownloading
                                ? isVariantCached
                                    ? '[ ⚡ FETCHING MP4... ]'
                                    : '[ ⚙ RENDERING MP4... ]'
                                : '[ ▼ DOWNLOAD MP4 ]'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};