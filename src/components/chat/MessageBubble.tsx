// src/components/chat/MessageBubble.tsx

// imports
import React, { useState } from 'react';
import type { AgentTraceStep, ChatMessageModel } from '../../types/chat';
import type { SFVideo } from '../../types/sf_videos';
import { ClipPreviewCard } from './ClipPreviewCard';
import styles from "../../views/Chat/Chat.module.css";

// Component Props
interface MessageBubbleProps {
    message: ChatMessageModel;
    sessionId: string | null;
    isStreamingThisMessage: boolean;
    savedCandidateIds: Set<string>;
    onCandidateSaved: (candidateId: string, savedClip: SFVideo) => void;
    onOpenReel?: () => void;
}

////////////////////////////////////////////////////////////////
// Helpers (formatting functions)
////////////////////////////////////////////////////////////////

const STEERING_PREFIX = '[USER ADDED CONTEXT / STEERING]:';

function formatTraceStepBadge(step: AgentTraceStep): string {
    if (step.step_type === 'THOUGHT') return '🧠 THOUGHT';
    if (step.step_type === 'TOOL_CALL') return `⚡ CALL: ${step.tool_name || step.title}`;
    return `✓ DONE: ${step.tool_name || step.title}`;
}

////////////////////////////////////////////////////////////////
// Exportable Component Function
////////////////////////////////////////////////////////////////

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    sessionId,
    isStreamingThisMessage,
    savedCandidateIds,
    onCandidateSaved,
    onOpenReel,
}) => {
    const [isTraceOpen, setIsTraceOpen] = useState(false);
    
    // USER MESSAGE BUBBLE
    if (message.role === 'user') {
        const isSteering = message.text.startsWith(STEERING_PREFIX);
        const cleanText = isSteering
            ? message.text.slice(STEERING_PREFIX.length).trim()
            : message.text;
        return (
            <div className={styles.userBubbleWrapper}>
                <div
                    className={`${styles.userBubble} ${
                        isSteering ? styles.userBubbleSteering : ''
                    }`}
                >
                    <div className={styles.bubbleHeader}>
                        <span>&gt; OPERATOR</span>
                        {isSteering && (
                            <span className={styles.steeringBadge}>
                                [ ⚡ LIVE CONTEXT INJECTED ]
                            </span>
                        )}
                    </div>
                    <div className={styles.messageText}>{cleanText}</div>
                </div>
            </div>
        );
    }
    
    // AGENT (MODEL) MESSAGE BUBBLE
    const traceCount = message.trace.length;
    const latestStep = traceCount > 0 ? message.trace[traceCount - 1] : null;
    return (
        <div className={styles.modelBubbleWrapper}>
            <div className={styles.modelBubble}>
                <div className={styles.bubbleHeader}>
                    <span className={styles.agentNameBadge}>&gt; CLIP_AGENT_OS</span>
                    {isStreamingThisMessage && (
                        <span className={styles.livePulseBadge}>● TRANSMITTING</span>
                    )}
                </div>
                
                {/* COLLAPSIBLE AGENT TRACE / TELEMETRY ACCORDION */}
                {traceCount > 0 && (
                    <div className={styles.traceContainer}>
                        <button
                            type="button"
                            className={styles.traceHeaderBtn}
                            onClick={() => setIsTraceOpen((prev) => !prev)}
                        >
                            <span>
                                {isTraceOpen ? '▼' : '▶'}{' '}
                                {isStreamingThisMessage && latestStep
                                    ? `ACTIVE TELEMETRY: ${formatTraceStepBadge(latestStep)}`
                                    : `AGENT TELEMETRY LOG (${traceCount} STEP${
                                          traceCount > 1 ? 'S' : ''
                                      })`}
                            </span>
                            <span className={styles.traceToggleHint}>
                                {isTraceOpen ? '[HIDE]' : '[INSPECT]'}
                            </span>
                        </button>
                        {isTraceOpen && (
                            <div className={styles.traceStepList}>
                                {message.trace.map((step) => (
                                    <div key={step.id} className={styles.traceStepItem}>
                                        <div className={styles.traceStepHeader}>
                                            <span className={styles.traceStepType}>
                                                [{step.step_type}]
                                            </span>
                                            <span className={styles.traceStepTitle}>
                                                {step.title}
                                            </span>
                                        </div>
                                        {step.content && (
                                            <pre className={styles.traceThoughtText}>
                                                {step.content}
                                            </pre>
                                        )}
                                        {step.tool_args &&
                                            Object.keys(step.tool_args).length > 0 && (
                                                <pre className={styles.traceJsonBox}>
                                                    ARGS: {JSON.stringify(step.tool_args)}
                                                </pre>
                                            )}
                                        {step.tool_summary &&
                                            Object.keys(step.tool_summary).length > 0 && (
                                                <pre className={styles.traceJsonBox}>
                                                    RESULT:{' '}
                                                    {JSON.stringify(step.tool_summary)}
                                                </pre>
                                            )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {/* VISIBLE ASSISTANT TEXT */}
                {(message.text || isStreamingThisMessage) && (
                    <div className={styles.messageText}>
                        {message.text}
                        {isStreamingThisMessage && (
                            <span className={styles.cursorBlock}> █</span>
                        )}
                    </div>
                )}
               
                {/* INLINE PROPOSED CLIP CANDIDATE CARDS */}
                {message.clip_candidates.length > 0 && (
                    <div className={styles.candidatesStack}>
                        {message.clip_candidates.map((cand) => (
                            <ClipPreviewCard
                                key={cand.id}
                                candidate={cand}
                                sessionId={sessionId}
                                isSaved={savedCandidateIds.has(cand.id)}
                                onSaveSuccess={onCandidateSaved}
                                onOpenReel={onOpenReel}
                            />
                        ))}
                    </div>
                )}
                
                {/* INTERRUPTED BADGE */}
                {message.interrupted && (
                    <div className={styles.interruptedBanner}>
                        [ ■ TRANSMISSION HALTED BY OPERATOR ]
                    </div>
                )}
            </div>
        </div>
    );
};