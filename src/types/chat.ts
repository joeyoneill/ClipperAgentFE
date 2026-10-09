// src/types/chat.ts
// TypeScript interfaces for Chat Sessions, Agent Traces, Clip Candidates, and WebSocket Frames

export interface WordTimestamp {
    word: string;
    start_sec: number;
    end_sec: number;
}

export interface ClipCandidate {
    id: string;
    title: string;
    video_id: string;
    video_filename: string;
    start_sec: number;
    end_sec: number;
    duration_sec: number;
    transcript_text: string;
    words: WordTimestamp[];
    rationale: string;
    preview_url: string | null;
}

export type TraceStepType = 'THOUGHT' | 'TOOL_CALL' | 'TOOL_RESULT';

export interface AgentTraceStep {
    id: string;
    step_type: TraceStepType;
    title: string;
    content?: string | null;
    tool_name?: string | null;
    tool_args?: Record<string, unknown> | null;
    tool_summary?: Record<string, unknown> | null;
    created_at: string;
}

export type ChatRole = 'user' | 'model' | 'system';

export interface ChatMessageModel {
    id: string;
    role: ChatRole;
    text: string;
    trace: AgentTraceStep[];
    clip_candidates: ClipCandidate[];
    interrupted: boolean;
    created_at: string;
}

export interface ChatSessionSummary {
    id: string;
    uid: string;
    title: string;
    selected_video_ids: string[];
    created_at: string;
    updated_at: string;
}

export interface ChatSessionDetail extends ChatSessionSummary {
    messages: ChatMessageModel[];
}

export interface CreateChatSessionRequest {
    title?: string | null;
    selected_video_ids?: string[];
}

export interface UpdateChatSessionRequest {
    title?: string | null;
    selected_video_ids?: string[] | null;
}

// -----------------------------------------------------------------------------
// WebSocket Protocol Frames (/api/chat/stream)
// -----------------------------------------------------------------------------

export type WSClientMessageType = 'USER_MESSAGE' | 'INTERRUPT' | 'ADD_CONTEXT' | 'SET_VIDEOS';

export interface WSClientMessage {
    type: WSClientMessageType;
    text?: string | null;
    selected_video_ids?: string[] | null;
}

export type WSServerMessageType = 'SESSION_INIT' | 'AGENT_THOUGHT' | 'TRACE_STEP' | 'AGENT_TOKEN' | 'CLIP_CANDIDATE' | 'TURN_COMPLETE' | 'TURN_INTERRUPTED' | 'CONTEXT_ADDED' | 'VIDEOS_UPDATED' | 'ERROR';

export interface WSServerMessage {
    type: WSServerMessageType;
    data: {
        session?: ChatSessionSummary;
        session_id?: string;
        delta?: string;
        branch?: string | null;
        step?: AgentTraceStep;
        candidate?: ClipCandidate;
        text?: string;
        selected_video_ids?: string[];
        message?: string;
    };
}

// -----------------------------------------------------------------------------
// Vault Video Item (for Tape Selector in Chat Sidebar)
// -----------------------------------------------------------------------------

export interface VaultVideoItem {
    id: string;
    uid: string;
    filename: string;
    gcs_uri: string;
    status: 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED';
    is_complete: boolean;
    duration_seconds: number | null;
    file_size_bytes: number | null;
    created_at: string;
    updated_at: string;
}