import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ClientToLinkMessage, LinkToClientMessage } from '@livevibe/protocol';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AssistantSidebarProps {
    open: boolean;
    onClose: () => void;
    ws?: WebSocket | null;
    activeContext?: { selection?: string; currentLine?: string; line?: number };
    onApplyCode?: (code: string) => void;
    onTogglePlay?: () => void;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    context?: { selection?: string; currentLine?: string; line?: number };
}

// Memoized Message Bubble to prevent re-rendering of previous messages
const MessageBubble = React.memo(({ message, appliedCodes, onApplyCode }: { message: Message, appliedCodes: Set<string>, onApplyCode?: (code: string) => void }) => {
    const components = React.useMemo(() => ({
        code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '');
            const isApplied = appliedCodes.has(codeString);

            if (inline || !match) {
                return (
                    <code className={className} style={{ backgroundColor: '#27272a', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace' }} {...props}>
                        {children}
                    </code>
                );
            }

            return (
                <div style={{ marginTop: '8px', marginBottom: '8px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #3f3f46' }}>
                    {/* Code Toolbar */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 8px',
                        backgroundColor: '#27272a',
                        borderBottom: '1px solid #3f3f46'
                    }}>
                        <span style={{ fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase' }}>{match[1]}</span>
                        {onApplyCode && (
                            <button
                                onClick={() => onApplyCode(codeString)}
                                style={{
                                    fontSize: '10px',
                                    padding: '2px 8px',
                                    backgroundColor: isApplied ? '#22c55e' : '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                {isApplied ? 'Applied ✓' : 'Apply'}
                            </button>
                        )}
                    </div>
                    <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{ margin: 0, padding: '12px', fontSize: '12px' }}
                        {...props}
                    >
                        {codeString}
                    </SyntaxHighlighter>
                </div>
            );
        }
    }), [appliedCodes, onApplyCode]);

    return (
        <div style={{
            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '95%',
            width: message.role === 'assistant' ? '100%' : 'auto',
            backgroundColor: message.role === 'user' ? '#3f3f46' : 'transparent',
            padding: message.role === 'user' ? '8px 12px' : '0',
            borderRadius: '8px',
            color: '#e4e4e7',
            fontSize: '13px',
            lineHeight: '1.5'
        }}>
            {message.role === 'assistant' && (
                <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', textTransform: 'uppercase' }}>AI</div>
            )}

            {/* Render Context within User Message */}
            {message.role === 'user' && message.context && (
                <div style={{
                    marginBottom: '8px',
                    borderRadius: '4px',
                    border: '1px solid #3f3f46',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        color: '#a1a1aa',
                        backgroundColor: '#27272a',
                        borderBottom: '1px solid #3f3f46',
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}>
                        <span>Context (Line {message.context.line})</span>
                        <span>{message.context.selection ? 'Selection' : 'Line'}</span>
                    </div>
                    <SyntaxHighlighter
                        style={oneDark}
                        language="javascript"
                        PreTag="div"
                        customStyle={{ margin: 0, padding: '8px', fontSize: '11px' }}
                    >
                        {message.context.selection || message.context.currentLine || ''}
                    </SyntaxHighlighter>
                </div>
            )}

            {message.role === 'user' ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
            ) : (
                <ReactMarkdown components={components}>
                    {message.content}
                </ReactMarkdown>
            )}
        </div>
    );
});

export const AssistantSidebar: React.FC<AssistantSidebarProps> = ({ open, onClose, ws, activeContext, onApplyCode, onTogglePlay }) => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: '# Strudel Assistant\nI can help you write code. Select lines to provide context.' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [appliedCodes, setAppliedCodes] = useState<Set<string>>(new Set());
    const [stats, setStats] = useState<{
        provider?: string;
        model?: string;
        usage?: { inputTokens: number; outputTokens: number; totalTokens: number; costEstimate: number };
    }>({ provider: 'Anthropic', model: 'claude-3-5-sonnet' });

    // --- Resizable Logic ---
    const [width, setWidth] = useState(350);
    const isResizingRef = useRef(false);

    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const startX = mouseDownEvent.clientX;
        const startWidth = width;

        const doDrag = (moveEvent: MouseEvent) => {
            if (!isResizingRef.current) return;
            // Calculate new width (dragging LEFT increases width)
            // e.g. startX = 1000, currentX = 990 -> delta = 10 -> width increases by 10
            const delta = startX - moveEvent.clientX;
            const newWidth = Math.max(250, Math.min(800, startWidth + delta));
            setWidth(newWidth);
        };

        const stopDrag = () => {
            isResizingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
        };

        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
    }, [width]);
    // -----------------------

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Auto-focus input on open
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    // Listen for streaming responses
    useEffect(() => {
        if (!ws) return;

        const handleMessage = (event: MessageEvent) => {
            try {
                const msg = JSON.parse(event.data) as LinkToClientMessage;
                if (msg.type === 'assistant:response') {
                    setIsTyping(!msg.done);
                    if (msg.metadata) {
                        setStats(prev => ({
                            ...prev,
                            provider: msg.metadata?.provider || prev.provider,
                            model: msg.metadata?.model || prev.model,
                            usage: msg.metadata?.usage
                        }));
                    }

                    setMessages(prev => {
                        const last = prev[prev.length - 1];
                        // If appending to last message
                        if (last && last.role === 'assistant' && !msg.done) {
                            return [...prev.slice(0, -1), { ...last, content: last.content + msg.text }];
                        }
                        // If new message
                        if (last.role === 'user' && !msg.done) {
                            return [...prev, { role: 'assistant', content: msg.text }];
                        }
                        return prev;
                    });
                }
            } catch (err) { }
        };

        ws.addEventListener('message', handleMessage);
        return () => ws.removeEventListener('message', handleMessage);
    }, [ws]);

    const handleSend = () => {
        if (!input.trim() || !ws) return;

        setMessages(prev => [...prev, {
            role: 'user',
            content: input,
            context: activeContext
        }]);
        setInput('');
        setIsTyping(true);

        const msg: ClientToLinkMessage = {
            type: 'assistant:query',
            text: input,
            context: activeContext
        };
        ws.send(JSON.stringify(msg));
    };

    const handleApply = useCallback((code: string) => {
        if (onApplyCode) {
            onApplyCode(code);
            setAppliedCodes(prev => new Set(prev).add(code));
            setTimeout(() => {
                setAppliedCodes(prev => {
                    const next = new Set(prev);
                    next.delete(code);
                    return next;
                });
            }, 2000);
        }
    }, [onApplyCode]);

    // Key Pass-through
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
            return;
        }

        // Pass-through global shortcuts
        if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onTogglePlay?.();
        }
    };

    const getContextLabel = (ctx: NonNullable<AssistantSidebarProps['activeContext']>) => {
        if (!ctx.line) return '';

        if (ctx.selection) {
            const lineCount = (ctx.selection.match(/\n/g) || []).length + 1;
            if (lineCount > 1) {
                return `Lines ${ctx.line}-${ctx.line + lineCount - 1} (${ctx.selection.length} chars)`;
            } else {
                return `Line ${ctx.line}: Selected ${ctx.selection.length} chars`;
            }
        }
        return `Line ${ctx.line}`;
    };


    if (!open) return null;

    return (
        <div
            style={{
                position: 'absolute',
                top: '56px',
                right: 0,
                bottom: '48px', // Above transport bar
                width: `${width}px`,
                backgroundColor: '#18181b', // zinc-900
                borderLeft: '1px solid #27272a',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 90,
                boxShadow: '-4px 0 10px rgba(0,0,0,0.3)'
            }}
        >
            {/* Drag Handle */}
            <div
                onMouseDown={startResizing}
                style={{
                    position: 'absolute',
                    left: '-4px', // Extend slightly outside
                    top: 0,
                    bottom: 0,
                    width: '6px', // Hit area
                    cursor: 'col-resize',
                    zIndex: 100,
                    backgroundColor: 'transparent',
                }}
            />

            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#e4e4e7', fontSize: '14px' }}>Assistant</span>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.map((m, i) => (
                    <MessageBubble
                        key={i}
                        message={m}
                        appliedCodes={appliedCodes}
                        onApplyCode={m.role === 'assistant' ? handleApply : undefined}
                    />
                ))}
                {isTyping && <div style={{ fontSize: '12px', color: '#71717a', fontStyle: 'italic' }}>Typing...</div>}
                <div ref={messagesEndRef} />
            </div>

            {/* Context & Input */}
            <div style={{ padding: '12px', borderTop: '1px solid #27272a', backgroundColor: '#18181b' }}>
                <div style={{ marginBottom: '8px' }}>
                    {activeContext && (
                        <div style={{
                            fontSize: '11px',
                            color: '#a1a1aa',
                            marginBottom: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontWeight: 600, color: '#d4d4d8' }}>Context</span>
                            <span>{getContextLabel(activeContext)}</span>
                        </div>
                    )}

                    {/* LIVE PREVIEW OF CONTEXT */}
                    {activeContext && (
                        <div style={{
                            maxHeight: '100px',
                            overflowY: 'auto',
                            borderRadius: '4px',
                            border: '1px solid #3f3f46',
                            backgroundColor: '#1e1e1e' // Force dark bg
                        }}>
                            <SyntaxHighlighter
                                style={oneDark}
                                language="javascript"
                                PreTag="div"
                                customStyle={{ margin: 0, padding: '8px', fontSize: '10px' }}
                                showLineNumbers={true}
                                startingLineNumber={activeContext.line}
                            >
                                {activeContext.selection || activeContext.currentLine || ' '}
                            </SyntaxHighlighter>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask for code..."
                        style={{
                            flex: 1,
                            backgroundColor: '#09090b',
                            border: '1px solid #3f3f46',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            color: 'white',
                            fontSize: '13px',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        style={{
                            backgroundColor: '#27272a',
                            border: '1px solid #3f3f46',
                            borderRadius: '4px',
                            padding: '0 12px',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        ➤
                    </button>
                </div>

                {/* Dynamic Stats Indicator */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10px',
                    color: '#52525b',
                    padding: '0 2px',
                    gap: '8px',
                    width: '100%',
                    overflow: 'hidden'
                }}>
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                        flex: 1
                    }} title={`${stats.provider} / ${stats.model}`}>
                        {stats.model?.replace(/-(\d{8})$/, '') /* Strip date suffix for display */}
                    </span>
                    {stats.usage && (
                        <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }} title={`In: ${stats.usage.inputTokens} | Out: ${stats.usage.outputTokens} | Total: ${stats.usage.totalTokens}`}>
                            ${stats.usage.costEstimate.toFixed(4)} ({stats.usage.totalTokens})
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
