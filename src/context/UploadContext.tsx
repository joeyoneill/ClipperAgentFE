// src/context/UploadContext.tsx
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type {
    UploadProgress,
    UploadStage,
    VideoLocalMetadata,
} from '../types/lf_videos/upload';
import { ALLOWED_VIDEO_MIME_TYPES } from '../types/lf_videos/upload';
import {
    completeVideoUpload,
    createChunkedGCSUploader,
    extractVideoMetadata,
    failedVideoUpload,
    initVideoUpload,
} from '../services/uploadService';
import type { ChunkedUploaderController } from '../services/uploadService';

interface UploadContextType {
    file: File | null;
    metadata: VideoLocalMetadata | null;
    stage: UploadStage;
    progress: UploadProgress;
    videoId: string | null;
    errorMsg: string | null;
    selectFile: (selectedFile: File) => Promise<void>;
    startUpload: () => Promise<void>;
    pauseUpload: () => void;
    resumeUpload: () => Promise<void>;
    cancelUpload: () => Promise<void>;
    resetUpload: () => void;
}

const INITIAL_PROGRESS: UploadProgress = {
    bytesUploaded: 0,
    totalBytes: 0,
    percentage: 0,
    speedBytesPerSec: 0,
    etaSeconds: null,
    currentChunk: 0,
    totalChunks: 0,
};

const UploadContext = createContext<UploadContextType | null>(null);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { getToken } = useAuth();

    const [file, setFile] = useState<File | null>(null);
    const [metadata, setMetadata] = useState<VideoLocalMetadata | null>(null);
    const [stage, setStage] = useState<UploadStage>('IDLE');
    const [progress, setProgress] = useState<UploadProgress>(INITIAL_PROGRESS);
    const [videoId, setVideoId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Refs persist across re-renders without triggering extra renders
    const uploaderRef = useRef<ChunkedUploaderController | null>(null);
    const activeVideoIdRef = useRef<string | null>(null);
    const pausedRef = useRef<boolean>(false);

    ////////////////////////////////////////////////////////////////
    // 1. Validate & Extract Local File Metadata
    ////////////////////////////////////////////////////////////////
    const selectFile = useCallback(async (selectedFile: File) => {
        setErrorMsg(null);
        const mime = selectedFile.type.toLowerCase();

        if (!ALLOWED_VIDEO_MIME_TYPES[mime]) {
            setErrorMsg(
                `INVALID TAPE FORMAT (${selectedFile.type || 'UNKNOWN'}). ALLOWED: MP4, WEBM, MOV, AVI, MKV.`
            );
            return;
        }

        const extracted = await extractVideoMetadata(selectedFile);
        setFile(selectedFile);
        setMetadata(extracted);
        setStage('IDLE');
        setProgress({
            ...INITIAL_PROGRESS,
            totalBytes: selectedFile.size,
        });
    }, []);

    ////////////////////////////////////////////////////////////////
    // 2. Finalize Upload on Backend (/complete)
    ////////////////////////////////////////////////////////////////
    const finalizeUpload = useCallback(
        async (vid: string) => {
            setStage('FINALIZING');
            const token = await getToken();
            if (!token) throw new Error('Authentication token expired.');
            await completeVideoUpload(token, vid);
            setStage('SUCCESS');
        },
        [getToken]
    );

    ////////////////////////////////////////////////////////////////
    // 3. Start Upload (/init -> GCS Chunks -> /complete)
    ////////////////////////////////////////////////////////////////
    const startUpload = useCallback(async () => {
        if (!file || !metadata) return;

        setErrorMsg(null);
        pausedRef.current = false;
        setStage('INITIALIZING');

        try {
            const token = await getToken();
            if (!token) {
                throw new Error('NO AUTH TOKEN AVAILABLE. PLEASE RE-AUTHENTICATE.');
            }

            // Step A: Create PENDING Firestore record & get GCS resumable URL
            const initRes = await initVideoUpload(token, {
                filename: metadata.filename,
                content_type: metadata.contentType,
                file_size_bytes: metadata.sizeBytes,
                duration_seconds: metadata.durationSeconds,
            });

            setVideoId(initRes.video_id);
            activeVideoIdRef.current = initRes.video_id;
            setStage('UPLOADING');

            // Step B: Stream 16 MiB chunks to GCS
            const controller = createChunkedGCSUploader(file, initRes.upload_url, (prog) => {
                setProgress(prog);
            });
            uploaderRef.current = controller;

            await controller.startOrResume();

            // If user paused, startOrResume exits early—don't finalize yet
            if (pausedRef.current) return;

            // Step C: Mark upload as SUCCESSFUL in Firestore
            await finalizeUpload(initRes.video_id);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return;
            }
            const msg = err instanceof Error ? err.message : 'UPLOAD FAILED.';
            setStage('ERROR');
            setErrorMsg(msg);
        }
    }, [file, metadata, getToken, finalizeUpload]);

    ////////////////////////////////////////////////////////////////
    // 4. Pause & Resume Upload
    ////////////////////////////////////////////////////////////////
    const pauseUpload = useCallback(() => {
        if (uploaderRef.current && stage === 'UPLOADING') {
            pausedRef.current = true;
            uploaderRef.current.pause();
            setStage('PAUSED');
        }
    }, [stage]);

    const resumeUpload = useCallback(async () => {
        const vid = activeVideoIdRef.current;
        if (!uploaderRef.current || !vid) return;

        setErrorMsg(null);
        pausedRef.current = false;
        setStage('UPLOADING');

        try {
            await uploaderRef.current.startOrResume();
            if (pausedRef.current) return;
            await finalizeUpload(vid);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            const msg = err instanceof Error ? err.message : 'UPLOAD INTERRUPTED.';
            setStage('ERROR');
            setErrorMsg(msg);
        }
    }, [finalizeUpload]);

    ////////////////////////////////////////////////////////////////
    // 5. Cancel / Fail Upload (/failed) & Reset
    ////////////////////////////////////////////////////////////////
    const cancelUpload = useCallback(async () => {
        pausedRef.current = false;
        if (uploaderRef.current) {
            uploaderRef.current.cancel();
            uploaderRef.current = null;
        }

        const vidToFail = activeVideoIdRef.current;
        activeVideoIdRef.current = null;

        if (vidToFail) {
            const token = await getToken();
            if (token) {
                await failedVideoUpload(
                    token,
                    vidToFail,
                    errorMsg || 'Upload cancelled by user.'
                );
            }
        }

        setFile(null);
        setMetadata(null);
        setVideoId(null);
        setStage('IDLE');
        setProgress(INITIAL_PROGRESS);
        setErrorMsg(null);
    }, [getToken, errorMsg]);

    const resetUpload = useCallback(() => {
        pausedRef.current = false;
        uploaderRef.current = null;
        activeVideoIdRef.current = null;
        setFile(null);
        setMetadata(null);
        setVideoId(null);
        setStage('IDLE');
        setProgress(INITIAL_PROGRESS);
        setErrorMsg(null);
    }, []);

    return (
        <UploadContext.Provider
            value={{
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
            }}
        >
            {children}
        </UploadContext.Provider>
    );
};

export const useUpload = () => {
    const ctx = useContext(UploadContext);
    if (!ctx) throw new Error('useUpload must be used within an UploadProvider');
    return ctx;
};