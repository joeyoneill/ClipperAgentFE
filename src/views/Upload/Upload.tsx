// src/views/Upload/Upload.tsx
import React from 'react';
import type { FlowMode } from '../../types/flow';
import { useUpload } from '../../context/UploadContext';

interface UploadProps {
    onSelectMode: (mode: FlowMode) => void;
}

export const Upload: React.FC<UploadProps> = ({ onSelectMode }) => {
    // 1. Pull state and action functions from UploadContext
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

    // 2. When user picks a file from disk, validate & extract metadata
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const pickedFile = e.target.files?.[0];
        if (pickedFile) {
            await selectFile(pickedFile);
        }
        e.target.value = ''; // Reset input so picking the same file again still triggers onChange
    };

    return (
        <div>
            {/* Navigation back to HOME */}
            <button type="button" onClick={() => onSelectMode('HOME')}>
                &lt; BACK
            </button>

            <h2>Video Upload</h2>

            {/* Error display if validation or upload fails */}
            {errorMsg && <p style={{ color: 'red' }}>Error: {errorMsg}</p>}

            {/* STEP 1: Pick a file (only shown when no file is loaded) */}
            {!file && stage === 'IDLE' && (
                <div>
                    <input
                        type="file"
                        accept=".mp4,.webm,.mov,.avi,.mkv,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
                        onChange={handleFileChange}
                    />
                </div>
            )}

            {/* STEP 2: File is loaded -> Show extracted metadata & upload controls */}
            {file && metadata && (
                <div>
                    <p>Filename: {metadata.filename}</p>
                    <p>Format: {metadata.formatLabel}</p>
                    <p>Size: {metadata.sizeBytes} bytes</p>
                    <p>Duration: {metadata.durationSeconds ?? 'Unknown'} seconds</p>
                    <p>Status: {stage}</p>

                    {/* Progress readout once upload starts */}
                    {stage !== 'IDLE' && (
                        <div>
                            <progress value={progress.percentage} max={100} />
                            <p>
                                {progress.percentage.toFixed(1)}% ({progress.bytesUploaded} /{' '}
                                {progress.totalBytes} bytes) — Chunk {progress.currentChunk}/
                                {progress.totalChunks}
                            </p>
                        </div>
                    )}

                    {/* Controls when file is selected but upload hasn't started */}
                    {stage === 'IDLE' && (
                        <div>
                            <button type="button" onClick={startUpload}>
                                Start Upload
                            </button>
                            <button type="button" onClick={resetUpload}>
                                Remove File
                            </button>
                        </div>
                    )}

                    {/* Controls while uploading or paused */}
                    {(stage === 'INITIALIZING' ||
                        stage === 'UPLOADING' ||
                        stage === 'PAUSED' ||
                        stage === 'FINALIZING') && (
                        <div>
                            {stage === 'UPLOADING' && (
                                <button type="button" onClick={pauseUpload}>
                                    Pause
                                </button>
                            )}
                            {stage === 'PAUSED' && (
                                <button type="button" onClick={resumeUpload}>
                                    Resume
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={cancelUpload}
                                disabled={stage === 'FINALIZING'}
                            >
                                Cancel Upload
                            </button>
                        </div>
                    )}

                    {/* Controls if an error occurred */}
                    {stage === 'ERROR' && (
                        <div>
                            <button
                                type="button"
                                onClick={
                                    progress.bytesUploaded > 0 ? resumeUpload : startUpload
                                }
                            >
                                Retry
                            </button>
                            <button type="button" onClick={cancelUpload}>
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Controls when upload finishes */}
                    {stage === 'SUCCESS' && (
                        <div>
                            <p>Upload Complete! Video ID: {videoId}</p>
                            <button type="button" onClick={resetUpload}>
                                Upload Another Video
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};