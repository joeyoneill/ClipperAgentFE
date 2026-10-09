// src/types/sf_videos.ts
// Short-Form Video (Reel) Save Models

import type { WordTimestamp } from "./chat";

export type SFVideoStatus = 'PENDING_CUT' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED';

export interface SFVideo {
    id: string;
    uid: string;
    source_video_id: string;
    source_filename: string;
    session_id?: string | null;
    candidate_id?: string | null;
    title: string;
    start_sec: number;
    end_sec: number;
    duration_seconds: number;
    transcript_text: string;
    words: WordTimestamp[];
    rationale?: string | null;
    status: SFVideoStatus;
    is_complete: boolean;
    gcs_uri?: string | null;
    error_msg?: string | null;
    created_at: string;
    updated_at: string;
}

export interface SaveClipRequest {
    candidate_id: string;
    video_id: string;
    session_id?: string | null;
    title: string;
    start_sec: number;
    end_sec: number;
    transcript_text: string;
    words: WordTimestamp[];
    rationale?: string | null;
}