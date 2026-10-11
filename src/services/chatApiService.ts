// src/services/chatApi.ts
// REST & WebSocket API Helpers for Chat Sessions, Vault Videos, and Reel Clip Saving

// imports
import type {
    ChatSessionDetail,
    ChatSessionSummary,
    CreateChatSessionRequest,
    UpdateChatSessionRequest,
    VaultVideoItem,
} from '../types/chat';
import type {
    SaveClipRequest,
    SFVideo
} from '../types/sf_videos'
import {
    authHeaders,
    handleJsonResponse
} from './apiUtils'

// Get API BASE
const API_BASE = import.meta.env.VITE_BACKEND_BASE_URL

////////////////////////////////////////////////////////////////
// Chat Session CRUD Endpoints (/api/chat/sessions)
////////////////////////////////////////////////////////////////

// GET: '/api/chat/sessions'
export async function fetchChatSessions(
    getToken: () => Promise<string | null>
): Promise<ChatSessionSummary[]> {
    const headers = await authHeaders(getToken);
    const res = await fetch(`${API_BASE}/api/chat/sessions`, {
        method: 'GET',
        headers,
    });
    return handleJsonResponse<ChatSessionSummary[]>(res);
}

// POST: '/api/chat/sessions'
export async function createChatSession(
    getToken: () => Promise<string | null>,
    payload: CreateChatSessionRequest = {}
): Promise<ChatSessionSummary> {
    const headers = await authHeaders(getToken);
    const res = await fetch(`${API_BASE}/api/chat/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    return handleJsonResponse<ChatSessionSummary>(res);
}

// GET: '/api/chat/sessions/{session_id}'
export async function fetchChatSessionDetail(
    getToken: () => Promise<string | null>,
    sessionId: string
): Promise<ChatSessionDetail> {
    const headers = await authHeaders(getToken);
    const res = await fetch(
        `${API_BASE}/api/chat/sessions/${encodeURIComponent(sessionId)}`,
        {
            method: 'GET',
            headers,
        }
    );
    return handleJsonResponse<ChatSessionDetail>(res);
}

// PATCH: '/api/chat/sessions/{session_id}'
export async function updateChatSession(
    getToken: () => Promise<string | null>,
    sessionId: string,
    payload: UpdateChatSessionRequest
): Promise<ChatSessionSummary> {
    const headers = await authHeaders(getToken);
    const res = await fetch(
        `${API_BASE}/api/chat/sessions/${encodeURIComponent(sessionId)}`,
        {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload),
        }
    );
    return handleJsonResponse<ChatSessionSummary>(res);
}

// DELETE: '/api/chat/sessions/{session_id}'
export async function deleteChatSession(
    getToken: () => Promise<string | null>,
    sessionId: string
): Promise<void> {
    const headers = await authHeaders(getToken);
    const res = await fetch(
        `${API_BASE}/api/chat/sessions/${encodeURIComponent(sessionId)}`,
        {
            method: 'DELETE',
            headers,
        }
    );
    if (!res.ok) {
        await handleJsonResponse<unknown>(res);
    }
}

////////////////////////////////////////////////////////////////
// Vault Completed Videos Helper (for Tape Selector)
////////////////////////////////////////////////////////////////

export async function fetchCompletedVaultVideos(
    getToken: () => Promise<string | null>
): Promise<VaultVideoItem[]> {
    const headers = await authHeaders(getToken);
    const res = await fetch(`${API_BASE}/api/lf_videos/list`, {
        method: 'GET',
        headers,
    });
    const allVideos = await handleJsonResponse<VaultVideoItem[]>(res);
    return allVideos.filter((v) => v.status === 'SUCCESSFUL');
}

////////////////////////////////////////////////////////////////
// Human-in-the-Loop Save Clip to Reel (/api/sf_videos/save)
////////////////////////////////////////////////////////////////

export async function saveClipToReel(
    getToken: () => Promise<string | null>,
    payload: SaveClipRequest
): Promise<SFVideo> {
    const headers = await authHeaders(getToken);
    const res = await fetch(`${API_BASE}/api/sf_videos/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    return handleJsonResponse<SFVideo>(res);
}

////////////////////////////////////////////////////////////////
// WebSocket URL Builder (/api/chat/stream?token=...&session_id=...)
////////////////////////////////////////////////////////////////

export function buildChatStreamWsUrl(
    sessionId?: string | null
): string {
    let wsBase: string;
    if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
        wsBase = API_BASE.replace(/^http/, 'ws');
    } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${protocol}//${window.location.host}${API_BASE}`;
    }
    if (sessionId) {
        const params = new URLSearchParams({ session_id: sessionId });
        params.set('session_id', sessionId);
    }
    return `${wsBase}/api/chat/stream`;
}