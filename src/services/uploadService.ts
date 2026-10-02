// src/services/uploadService.ts
import type {
    LFUploadInitRequest,
    LFUploadInitResponse,
    LFVideo,
    UploadProgress,
    VideoLocalMetadata,
} from '../types/lf_videos/upload';
import { ALLOWED_VIDEO_MIME_TYPES } from '../types/lf_videos/upload';

// Upload Base URL
const UPLOAD_API_BASE = `${import.meta.env.VITE_BACKEND_BASE_URL}/api/lf_videos/upload`

// GCS Transfer Vars
const CHUNK_SIZE = 16 * 1024 * 1024; // 16 MiB (64 * 256 KiB) per chunk
const MAX_CHUNK_RETRIES = 4;

////////////////////////////////////////////////////////////////
// POST: /api/lf_videos/upload/init
////////////////////////////////////////////////////////////////

export async function initVideoUpload(
    token: string,
    payload: LFUploadInitRequest
): Promise<LFUploadInitResponse> {
    // Fetch init endpoint
    const response = await fetch(
        `${UPLOAD_API_BASE}/init`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload)
        }
    );

    // Check response & return
    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.detail || `Failed to initialize upload (HTTP ${response.status})`);
    }
    return response.json();
}

////////////////////////////////////////////////////////////////
// POST: /api/lf_videos/upload/{vid}/complete
////////////////////////////////////////////////////////////////

export async function completeVideoUpload(
    token: string,
    vid: string
): Promise<LFVideo> {
    // Fetch Complete Endpoint
    const response = await fetch(
        `${UPLOAD_API_BASE}/${vid}/complete`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            }
        },
    );

    // Check response & return
    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.detail || `Failed to finalize upload (HTTP ${response.status})`);
    }
    return response.json();
}

////////////////////////////////////////////////////////////////
// POST: /api/lf_videos/upload/{vid}/failed
////////////////////////////////////////////////////////////////

export async function failedVideoUpload(
    token: string,
    vid: string,
    errorMsg: string
): Promise<LFVideo | null> {
    try {
        // Fetch /failed endpoint
        const response = await fetch(
            `${UPLOAD_API_BASE}/${vid}/failed`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({error_msg: errorMsg})
            }
        );

        // check resp & return
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

////////////////////////////////////////////////////////////////
// Video Metadata Extraction
////////////////////////////////////////////////////////////////

export function extractVideoMetadata(file: File): Promise<VideoLocalMetadata> {
    return new Promise((resolve) => {
        const contentType = file.type.toLowerCase();
        const formatLabel = (ALLOWED_VIDEO_MIME_TYPES[contentType] || 'video').toUpperCase();

        // init metadata obj
        const baseMeta: VideoLocalMetadata = {
            filename: file.name,
            contentType,
            formatLabel,
            sizeBytes: file.size,
            durationSeconds: null,
            width: null,
            height: null,
        };

        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        const objectUrl = URL.createObjectURL(file);

        const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            videoEl.removeAttribute('src');
            videoEl.load();
        };

        const timeoutId = window.setTimeout(() => {
            cleanup();
            resolve(baseMeta);
        }, 4000);

        videoEl.onloadedmetadata = () => {
            window.clearTimeout(timeoutId);
            const duration =
                Number.isFinite(videoEl.duration) && videoEl.duration > 0
                ? Math.round(videoEl.duration)
                : null;
            cleanup();
            resolve({
                ...baseMeta,
                durationSeconds: duration,
                width: videoEl.videoWidth || null,
                height: videoEl.videoHeight || null,
            });
        };

        videoEl.onerror = () => {
            window.clearTimeout(timeoutId);
            cleanup();
            resolve(baseMeta);
        };
        videoEl.src = objectUrl
    });
}


////////////////////////////////////////////////////////////////
// Upload: Sending Chunks to GCS
////////////////////////////////////////////////////////////////

/**
 * Sends a single 16 MiB slice to GCS and reports live intra-chunk byte progress.
 */
function sendChunkWithXHR(
    uploadUrl: string,
    chunkBlob: Blob,
    startByte: number,
    endByteInclusive: number,
    totalBytes: number,
    contentType: string,
    onChunkProgress: (chunkBytesLoaded: number) => void,
    registerAbort: (abortFn: () => void) => void
): Promise<{ status: number; rangeHeader: string | null }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', contentType);
        // Example: "bytes 0-16777215/50000000"
        xhr.setRequestHeader(
            'Content-Range',
            `bytes ${startByte}-${endByteInclusive}/${totalBytes}`
        );

        // Expose xhr.abort() so pause/cancel can stop the active chunk immediately
        registerAbort(() => xhr.abort());

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onChunkProgress(event.loaded);
            }
        };

        xhr.onload = () => {
            // 308 = intermediate chunk saved; 200/201 = final chunk saved
            if (xhr.status === 308 || xhr.status === 200 || xhr.status === 201) {
                let rangeHeader: string | null = null;
                try {
                    rangeHeader = xhr.getResponseHeader('Range');
                } catch {
                    rangeHeader = null;
                }
                resolve({ status: xhr.status, rangeHeader });
            } else {
                reject(new Error(`GCS chunk upload failed with HTTP ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during chunk transfer'));
        xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));

        xhr.send(chunkBlob);
    });
}

/**
 * If a chunk fails due to a Wi-Fi blip, this asks GCS:
 * "How many bytes have you actually saved so far?" using Content-Range: bytes * / totalBytes
 * GCS responds with 308 and header "Range: bytes=0-33554431", so we know to resume at byte 33554432.
 */
async function queryGCSCommittedOffset(uploadUrl: string, totalBytes: number): Promise<number> {
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Range': `bytes */${totalBytes}`,
        },
    });

    if (response.status === 200 || response.status === 201) {
        return totalBytes;
    }

    if (response.status === 308) {
        const rangeHeader = response.headers.get('Range');
        if (!rangeHeader) return 0; // 0 bytes committed so far
        const match = rangeHeader.match(/bytes=0-(\d+)/);
        if (match && match[1]) {
            return parseInt(match[1], 10) + 1;
        }
    }

    throw new Error(`Unable to recover upload session (HTTP ${response.status})`);
}

////////////////////////////////////////////////////////////////
// Upload: Main Chunked GCS Uploader Controller
////////////////////////////////////////////////////////////////

export interface ChunkedUploaderController {
    startOrResume: () => Promise<void>;
    pause: () => void;
    cancel: () => void;
}

/**
 * Orchestrates the chunked upload loop using sendChunkWithXHR
 * and recovers from network blips using queryGCSCommittedOffset.
 */
export function createChunkedGCSUploader(
    file: File,
    uploadUrl: string,
    onProgress: (progress: UploadProgress) => void
): ChunkedUploaderController {
    const totalBytes = file.size;
    const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));

    let offset = 0;
    let isPaused = false;
    let isCancelled = false;
    let currentXhrAbort: (() => void) | null = null;

    // Used to calculate transfer speed (MB/s) and ETA
    let sessionStartTime = performance.now();
    let sessionStartBytes = 0;

    const emitProgress = (bytesUploaded: number) => {
        const clampedBytes = Math.min(totalBytes, Math.max(0, bytesUploaded));
        const percentage = totalBytes > 0 ? (clampedBytes / totalBytes) * 100 : 0;

        const elapsedSec = Math.max(0.1, (performance.now() - sessionStartTime) / 1000);
        const bytesDelta = Math.max(0, clampedBytes - sessionStartBytes);
        const speedBytesPerSec = bytesDelta / elapsedSec;

        const remainingBytes = totalBytes - clampedBytes;
        const etaSeconds =
            speedBytesPerSec > 1024 ? Math.ceil(remainingBytes / speedBytesPerSec) : null;

        const currentChunk = Math.min(totalChunks, Math.floor(clampedBytes / CHUNK_SIZE) + 1);

        onProgress({
            bytesUploaded: clampedBytes,
            totalBytes,
            percentage,
            speedBytesPerSec,
            etaSeconds,
            currentChunk,
            totalChunks,
        });
    };

    const startOrResume = async (): Promise<void> => {
        isPaused = false;
        sessionStartTime = performance.now();
        sessionStartBytes = offset;

        while (offset < totalBytes) {
            if (isCancelled) {
                throw new DOMException('Upload cancelled', 'AbortError');
            }
            if (isPaused) {
                return;
            }

            // Slice the next 16 MiB chunk from disk
            const chunkEndExclusive = Math.min(offset + CHUNK_SIZE, totalBytes);
            const chunkBlob = file.slice(offset, chunkEndExclusive);
            const endByteInclusive = chunkEndExclusive - 1;

            let attempt = 0;
            let chunkDone = false;

            while (!chunkDone) {
                try {
                    const { status, rangeHeader } = await sendChunkWithXHR(
                        uploadUrl,
                        chunkBlob,
                        offset,
                        endByteInclusive,
                        totalBytes,
                        file.type || 'application/octet-stream',
                        (chunkLoaded) => emitProgress(offset + chunkLoaded),
                        (abortFn) => {
                            currentXhrAbort = abortFn;
                        }
                    );

                    // Advance offset based on GCS response
                    if (status === 200 || status === 201) {
                        offset = totalBytes;
                    } else if (rangeHeader) {
                        const match = rangeHeader.match(/bytes=0-(\d+)/);
                        offset = match && match[1] ? parseInt(match[1], 10) + 1 : chunkEndExclusive;
                    } else {
                        offset = chunkEndExclusive;
                    }

                    emitProgress(offset);
                    chunkDone = true;
                } catch (err) {
                    if (isCancelled) {
                        throw new DOMException('Upload cancelled', 'AbortError');
                    }
                    if (isPaused) {
                        return;
                    }

                    attempt += 1;
                    if (attempt > MAX_CHUNK_RETRIES) {
                        throw err;
                    }

                    // Wait 1s, 2s, 4s, 8s before asking GCS where to resume
                    const backoffMs = Math.min(8000, 1000 * Math.pow(2, attempt - 1));
                    await new Promise((r) => setTimeout(r, backoffMs));

                    try {
                        const recoveredOffset = await queryGCSCommittedOffset(uploadUrl, totalBytes);
                        offset = recoveredOffset;
                        sessionStartTime = performance.now();
                        sessionStartBytes = offset;
                    } catch {
                        // Keep existing offset and retry the chunk
                    }
                }
            }
        }
    };

    const pause = () => {
        isPaused = true;
        if (currentXhrAbort) {
            currentXhrAbort();
            currentXhrAbort = null;
        }
    };

    const cancel = () => {
        isCancelled = true;
        isPaused = false;
        if (currentXhrAbort) {
            currentXhrAbort();
            currentXhrAbort = null;
        }
    };

    return { startOrResume, pause, cancel };
}