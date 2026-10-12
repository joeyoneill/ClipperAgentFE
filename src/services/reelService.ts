// src/services/reelService.ts

import type {
    DownloadSFVideoRequest,
    DownloadSFVideoResponse,
    SFVideoResponse,
    UpdateSFVideoRequest,
} from '../types/sf_videos';

const API_BASE = import.meta.env.VITE_BACKEND_BASE_URL

async function parseErrorDetail(res: Response, fallbackMsg: string): Promise<string> {
    try {
        const body = await res.json();
        if (typeof body?.detail === 'string') return body.detail;
        if (Array.isArray(body?.detail)) {
            return body.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(', ');
        }
    } catch {
        // Ignore JSON parse errors on empty/non-JSON responses
    }
    return `${fallbackMsg} (HTTP ${res.status})`;
}

/**
 * GET /api/sf_videos/list
 * Lists all saved short-form clips for the authenticated user (newest first).
 */
export async function getUserReelClips(token: string): Promise<SFVideoResponse[]> {
    const res = await fetch(`${API_BASE}/api/sf_videos/list`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error(await parseErrorDetail(res, 'FAILED TO LOAD REEL CLIPS.'));
    }

    return (await res.json()) as SFVideoResponse[];
}

/**
 * PATCH /api/sf_videos/{sf_id}
 * Renames the title of a saved short-form clip.
 */
export async function updateReelClipTitle(
    token: string,
    sfId: string,
    payload: UpdateSFVideoRequest
): Promise<SFVideoResponse> {
    const res = await fetch(`${API_BASE}/api/sf_videos/${encodeURIComponent(sfId)}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(await parseErrorDetail(res, 'FAILED TO RENAME CLIP.'));
    }

    return (await res.json()) as SFVideoResponse;
}

/**
 * DELETE /api/sf_videos/{sf_id}
 * Deletes a saved short-form clip and all cached GCS rendered variants.
 */
export async function deleteReelClipById(token: string, sfId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/sf_videos/${encodeURIComponent(sfId)}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error(await parseErrorDetail(res, 'FAILED TO DELETE CLIP.'));
    }
}

/**
 * POST /api/sf_videos/{sf_id}/download
 * Renders (or fetches from GCS cache) the requested aspect_ratio + resolution + subtitles
 * variant and returns a signed attachment download URL.
 */
export async function downloadReelClip(
    token: string,
    sfId: string,
    payload: DownloadSFVideoRequest
): Promise<DownloadSFVideoResponse> {
    const res = await fetch(
        `${API_BASE}/api/sf_videos/${encodeURIComponent(sfId)}/download`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        }
    );

    if (!res.ok) {
        throw new Error(await parseErrorDetail(res, 'FAILED TO RENDER CLIP DOWNLOAD.'));
    }

    return (await res.json()) as DownloadSFVideoResponse;
}