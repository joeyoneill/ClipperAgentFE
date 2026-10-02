// src/types/upload.ts

export const ALLOWED_VIDEO_MIME_TYPES: Record<string, string> = {
  'video/mp4': 'MP4',
  'video/webm': 'WEBM',
  'video/quicktime': 'MOV',
  'video/x-msvideo': 'AVI',
  'video/x-matroska': 'MKV',
};

export type LFVideoStatus =
  | 'PENDING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'SUCCESSFUL'
  | 'FAILED';

// Mirrors backend LFVideo model in models/lf_videos.py
export interface LFVideo {
  id: string | null;
  uid: string;
  filename: string;
  gcs_uri: string;
  status: LFVideoStatus;
  is_complete: boolean;
  error_msg: string | null;
  content_type: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  transcript: string | null;
  created_at: string;
  updated_at: string;
}

// Mirrors backend LFUploadRequest
export interface LFUploadInitRequest {
  filename: string;
  content_type: string;
  file_size_bytes: number;
  duration_seconds: number | null;
}

// Mirrors backend LFUploadResponse
export interface LFUploadInitResponse {
  video_id: string;
  upload_url: string;
  gcs_uri: string;
  blob_path: string;
}

// Frontend UI state machine for the upload deck
export type UploadStage =
  | 'IDLE'
  | 'INITIALIZING'
  | 'UPLOADING'
  | 'PAUSED'
  | 'FINALIZING'
  | 'SUCCESS'
  | 'ERROR';

export interface VideoLocalMetadata {
  filename: string;
  contentType: string;
  formatLabel: string;
  sizeBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec: number;
  etaSeconds: number | null;
  currentChunk: number;
  totalChunks: number;
}