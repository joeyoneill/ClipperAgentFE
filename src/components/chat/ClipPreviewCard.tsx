// src/components/chat/ClipPreviewCard.tsx

// imports
import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { saveClipToReel } from '../../services/chatApiService';
import type { ClipCandidate } from '../../types/chat';
import type { SFVideo } from '../../types/sf_videos';
import styles from "../../views/Chat/Chat.module.css";

// Component Props
interface ClipPreviewCardProps {
    candidate: ClipCandidate;
    sessionId: string | null;
    isSaved: boolean;
    onSaveSuccess: (candidateId: string, savedClip: SFVideo) => void;
    onOpenReel?: () => void;
}

////////////////////////////////////////////////////////////////
// Helpers (formatting functions)
////////////////////////////////////////////////////////////////

function formatTimecode(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1).padStart(4, '0');
    return `${String(mins).padStart(2, '0')}:${secs}`;
}

////////////////////////////////////////////////////////////////
// Exportable Component Function
////////////////////////////////////////////////////////////////

export const ClipPreviewCard: React.FC<ClipPreviewCardProps> = ({
    candidate,
    sessionId,
    isSaved,
    onSaveSuccess,
    onOpenReel,
}) => {
    const { getToken } = useAuth();
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // State Vars
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(candidate.start_sec);
    const [showCaptions, setShowCaptions] = useState(true);
    const [showTranscript, setShowTranscript] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const duration = Math.max(0.1, candidate.end_sec - candidate.start_sec);
    const clampedElapsed = Math.max(0, Math.min(duration, currentTime - candidate.start_sec));
    const progressPct = (clampedElapsed / duration) * 100;
    
    // 20 discrete arcade LED segments (matching Upload.tsx)
    const totalSegments = 20;
    const filledSegments = Math.round((progressPct / 100) * totalSegments);

    
    // Compute live rolling 5-word caption window around currentTime
    const activeCaptionWindow = useMemo(() => {
        if (!showCaptions || !candidate.words || candidate.words.length === 0) {
            return null;
        }
        const activeIdx = candidate.words.findIndex(
            (w) => currentTime >= w.start_sec - 0.08 && currentTime <= w.end_sec + 0.12
        );
        if (activeIdx === -1) return null;
        const windowStart = Math.floor(activeIdx / 5) * 5;
        const chunk = candidate.words.slice(windowStart, windowStart + 5);
        return { chunk, activeIdx: activeIdx - windowStart };
    }, [candidate.words, currentTime, showCaptions]);

    
    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            videoRef.current.currentTime = candidate.start_sec;
            setCurrentTime(candidate.start_sec);
        }
    };


    const handleTimeUpdate = () => {
        const vid = videoRef.current;
        if (!vid) return;
        if (vid.currentTime < candidate.start_sec - 0.25) {
            vid.currentTime = candidate.start_sec;
        }
        if (vid.currentTime >= candidate.end_sec) {
            vid.pause();
            vid.currentTime = candidate.start_sec;
            setIsPlaying(false);
            setCurrentTime(candidate.start_sec);
            return;
        }
        setCurrentTime(vid.currentTime);
    };


    const togglePlay = () => {
        const vid = videoRef.current;
        if (!vid) return;
        if (vid.paused) {
            if (
                vid.currentTime < candidate.start_sec ||
                vid.currentTime >= candidate.end_sec
            ) {
                vid.currentTime = candidate.start_sec;
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
        vid.currentTime = candidate.start_sec;
        setCurrentTime(candidate.start_sec);
        vid.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
    };


    const handleSaveToReel = async () => {
        if (isSaved || isSaving) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            const saved = await saveClipToReel(getToken, {
                candidate_id: candidate.id,
                video_id: candidate.video_id,
                session_id: sessionId,
                title: candidate.title,
                start_sec: candidate.start_sec,
                end_sec: candidate.end_sec,
                transcript_text: candidate.transcript_text,
                words: candidate.words,
                rationale: candidate.rationale,
            });
            onSaveSuccess(candidate.id, saved);
        } catch (err) {
            setSaveError(
                err instanceof Error ? err.message : 'Failed to save clip to Reel.'
            );
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className={styles.clipCard}>
            {/* HEADER */}
            <div className={styles.clipHeader}>
                <div className={styles.clipTitleGroup}>
                    <span className={styles.clipBadge}>PROPOSED SHORT</span>
                    <span className={styles.clipTitle}>{candidate.title}</span>
                </div>
                <span className={styles.clipTimeBadge}>
                    {formatTimecode(candidate.start_sec)} -{' '}
                    {formatTimecode(candidate.end_sec)} ({candidate.duration_sec.toFixed(1)}s)
                </span>
            </div>
            <div className={styles.clipSourceRow}>
                <span>SOURCE TAPE: {candidate.video_filename}</span>
            </div>
            
            {/* VIDEO PLAYER + LIVE SUBTITLE OVERLAY */}
            {candidate.preview_url ? (
                <div className={styles.videoStage}>
                    <div className={styles.videoViewport}>
                        <video
                            ref={videoRef}
                            className={styles.videoElement}
                            src={`${candidate.preview_url}#t=${candidate.start_sec},${candidate.end_sec}`}
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
                    
                    {/* 20-SEGMENT ARCADE LED BAR */}
                    <div className={styles.clipLedBar}>
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
                        {candidate.words.length > 0 && (
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
                            {formatTimecode(candidate.end_sec)}
                        </span>
                    </div>
                </div>
            ) : (
                <div className={styles.noPreviewBanner}>
                    ! PREVIEW STREAM UNAVAILABLE FOR THIS TAPE
                </div>
            )}
            {/* RATIONALE & COLLAPSIBLE TRANSCRIPT */}
            <div className={styles.clipRationale}>
                <strong>EDITOR RATIONALE:</strong> {candidate.rationale}
            </div>
            {candidate.transcript_text && (
                <div>
                    <button
                        type="button"
                        className={styles.transcriptToggleBtn}
                        onClick={() => setShowTranscript((prev) => !prev)}
                    >
                        {showTranscript
                            ? '▼ HIDE SLICED TRANSCRIPT'
                            : '▶ VIEW SLICED TRANSCRIPT'}
                    </button>
                    {showTranscript && (
                        <div className={styles.transcriptBox}>
                            &ldquo;{candidate.transcript_text}&rdquo;
                        </div>
                    )}
                </div>
            )}
            {saveError && (
                <div className={styles.clipErrorText}>! ALERT: {saveError}</div>
            )}
            
            {/* HUMAN-IN-THE-LOOP APPROVAL ROW */}
            <div className={styles.clipActionRow}>
                <button
                    type="button"
                    className={isSaved ? styles.savedBtn : styles.saveReelBtn}
                    onClick={handleSaveToReel}
                    disabled={isSaved || isSaving}
                >
                    {isSaved
                        ? '[ ✓ SAVED TO REEL ]'
                        : isSaving
                        ? '[ SAVING TO REEL... ]'
                        : '[ ★ SAVE TO REEL ]'}
                </button>
                {isSaved && onOpenReel && (
                    <button
                        type="button"
                        className={styles.openReelBtn}
                        onClick={onOpenReel}
                    >
                        [ OPEN REEL &gt; ]
                    </button>
                )}
            </div>
        </div>
    );
};