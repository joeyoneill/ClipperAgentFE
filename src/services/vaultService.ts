// src/services/vaultService.ts
import type { LFVideo } from '../types/lf_videos/upload';

// Base URL for LF Video CRUD endpoints
const LF_VIDEOS_API_BASE = `${import.meta.env.VITE_BACKEND_BASE_URL}/api/lf_videos`;

////////////////////////////////////////////////////////////////
// GET: /api/lf_videos (List all user videos)
////////////////////////////////////////////////////////////////

export async function getUserVideos(token: string): Promise<LFVideo[]> {
    const response = await fetch(`${LF_VIDEOS_API_BASE}/list`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(
            errBody?.detail || `Failed to fetch videos (HTTP ${response.status})`
        );
    }

    return response.json();
}

////////////////////////////////////////////////////////////////
// GET: /api/lf_videos/{vid} (Get single video details)
////////////////////////////////////////////////////////////////

export async function getVideoById(token: string, vid: string): Promise<LFVideo> {
    const response = await fetch(`${LF_VIDEOS_API_BASE}/${vid}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(
            errBody?.detail || `Failed to fetch video '${vid}' (HTTP ${response.status})`
        );
    }

    return response.json();
}

////////////////////////////////////////////////////////////////
// DELETE: /api/lf_videos/{vid} (Delete video from GCS + Firestore)
////////////////////////////////////////////////////////////////

export async function deleteVideoById(token: string, vid: string): Promise<void> {
    const response = await fetch(`${LF_VIDEOS_API_BASE}/${vid}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(
            errBody?.detail || `Failed to delete video '${vid}' (HTTP ${response.status})`
        );
    }
}