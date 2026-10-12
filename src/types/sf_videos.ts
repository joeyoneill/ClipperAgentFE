// src/types/sf_videos.ts

import type { WordTimestamp } from './chat';

export type AspectRatioType = 'original' | '9:16_crop' | '9:16_pad';
export type ResolutionType = '1080p' | '720p';
export type SFVideoStatus = 'PENDING_CUT' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED';

export interface SFVideo {
    id: string | null;
    uid: string;
    source_video_id: string;
    source_filename: string;
    session_id: string | null;
    candidate_id: string | null;

    // Clip Metadata & Word-Level Boundaries
    title: string;
    start_sec: number;
    end_sec: number;
    duration_seconds: number;
    transcript_text: string;
    words: WordTimestamp[];
    rationale: string | null;

    // Core State Machine & Variant Cache
    status: SFVideoStatus;
    is_complete: boolean;
    gcs_uri: string | null;
    rendered_variants?: Record<string, string>;
    error_msg: string | null;

    // Timestamps (ISO strings from FastAPI)
    created_at: string;
    updated_at: string;
}

export interface SFVideoResponse extends SFVideo {
    preview_url: string | null;
}

export interface SaveClipRequest {
    candidate_id?: string | null;
    video_id: string;
    session_id?: string | null;
    title: string;
    start_sec: number;
    end_sec: number;
    transcript_text: string;
    words: WordTimestamp[];
    rationale?: string | null;
}

export interface UpdateSFVideoRequest {
    title: string;
}

export interface DownloadSFVideoRequest {
    aspect_ratio: AspectRatioType;
    resolution: ResolutionType;
    subtitles: boolean;
}

export interface DownloadSFVideoResponse {
    download_url: string;
    filename: string;
    variant_key: string;
    cached: boolean;
}