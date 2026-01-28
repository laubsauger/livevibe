import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ClientToLinkMessage, LinkToClientMessage } from '@livevibe/protocol';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { savePattern, getPatterns, deletePattern, SavedPattern } from './PatternStore';
import { LoopStation } from './LoopStation';

const scrollbarStyles = `
  .strudel-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .strudel-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .strudel-scrollbar::-webkit-scrollbar-thumb {
    background: #3f3f46;
    border-radius: 3px;
  }
  .strudel-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #52525b;
  }
`;

const INITIAL_MESSAGES: Message[] = [
    { role: 'assistant', content: '# Strudel Assistant\nI can help you write code. Select lines to provide context.' }
];

interface AssistantSidebarProps {
    open: boolean;
    onClose: () => void;
    ws?: WebSocket | null;
    activeContext?: {
        selection?: string;
        currentLine?: string;
        line?: number;
        audioFeatures?: {
            isPlaying: boolean;
            bass: number;
            mid: number;
            treble: number;
            brightness: 'dark' | 'balanced' | 'bright';
        };
    };
    onApplyCode?: (code: string, mode?: 'insert' | 'replace') => void;
    onTogglePlay?: () => void;
    onJumpToLine?: (line: number) => void;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    context?: {
        selection?: string;
        currentLine?: string;
        line?: number;
        audioFeatures?: {
            isPlaying: boolean;
            bass: number;
            mid: number;
            treble: number;
            brightness: 'dark' | 'balanced' | 'bright';
        };
    };
}

// Memoized Message Bubble to prevent re-rendering of previous messages
const MessageBubble = React.memo(({ message, appliedCodes, onApplyCode, hasSelection }: {
    message: Message,
    appliedCodes: Set<string>,
    onApplyCode?: (code: string, mode?: 'insert' | 'replace') => void,
    hasSelection?: boolean
}) => {
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

            const buttonStyle = {
                fontSize: '10px',
                padding: '2px 8px',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'background-color 0.2s'
            } as React.CSSProperties;

            return (
                <div style={{ marginTop: '8px', marginBottom: '8px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #3f3f46', position: 'relative' }}>
                    {/* Code Content with max height */}
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }} className="strudel-scrollbar">
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
                    {/* Code Toolbar - Sticky at bottom */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 8px',
                        backgroundColor: '#27272a',
                        borderTop: '1px solid #3f3f46',
                        position: 'sticky',
                        bottom: 0
                    }}>
                        <span style={{ fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase' }}>{match[1]}</span>
                        {onApplyCode && (
                            isApplied ? (
                                <span style={{ ...buttonStyle, backgroundColor: '#22c55e', cursor: 'default' }}>Applied ✓</span>
                            ) : (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={() => {
                                            const name = prompt('Save pattern as:', `Pattern ${Date.now().toString(36)}`);
                                            if (name) {
                                                savePattern(name, codeString);
                                                alert(`Saved "${name}"!`);
                                            }
                                        }}
                                        title="Save to favorites"
                                        style={{ ...buttonStyle, backgroundColor: '#eab308' }}
                                    >
                                        ⭐
                                    </button>
                                    <button
                                        onClick={() => onApplyCode(codeString, 'insert')}
                                        title="Insert code on a new line below cursor"
                                        style={{ ...buttonStyle, backgroundColor: '#2563eb' }}
                                    >
                                        + Add
                                    </button>
                                    <button
                                        onClick={() => onApplyCode(codeString, 'replace')}
                                        title="Replace current line or selection"
                                        style={{ ...buttonStyle, backgroundColor: '#52525b' }}
                                    >
                                        ⟳ Replace
                                    </button>
                                </div>
                            )
                        )}
                    </div>
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
            lineHeight: '1.5',
            overflowWrap: 'break-word', // prevent overflow
            wordBreak: 'break-word',
            minWidth: 0 // flexbox overflow fix
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

// Memoized Context Preview to prevent re-rendering when other props change
const ContextPreview = React.memo(({ context }: { context: NonNullable<AssistantSidebarProps['activeContext']> }) => {
    return (
        <div className="strudel-scrollbar" style={{
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
                className="strudel-scrollbar"
                customStyle={{ margin: 0, padding: '8px', fontSize: '10px' }}
                showLineNumbers={true}
                startingLineNumber={context.line}
            >
                {context.selection || context.currentLine || ' '}
            </SyntaxHighlighter>
        </div>
    );
});

export const AssistantSidebar: React.FC<AssistantSidebarProps> = ({ open, onClose, ws, activeContext, onApplyCode, onTogglePlay }) => {
    // --- State with Persistence ---
    const [messages, setMessages] = useState<Message[]>(() => {
        if (typeof window === 'undefined') return [{ role: 'assistant', content: '# Strudel Assistant\nI can help you write code. Select lines to provide context.' }];
        try {
            const saved = localStorage.getItem('strudel-assistant-history');
            return saved ? JSON.parse(saved) : [{ role: 'assistant', content: '# Strudel Assistant\nI can help you write code. Select lines to provide context.' }];
        } catch {
            return [{ role: 'assistant', content: '# \nI can help you write code. Select lines to provide context.' }];
        }
    });

    const [selectedModel, setSelectedModel] = useState(() => {
        if (typeof window === 'undefined') return 'gemini-2.5-flash';
        return localStorage.getItem('strudel-assistant-model') || 'gemini-2.5-flash';
    });

    // Save to local storage
    useEffect(() => {
        localStorage.setItem('strudel-assistant-history', JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('strudel-assistant-model', selectedModel);
        setStats(prev => ({ ...prev, model: selectedModel }));
    }, [selectedModel]);

    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [appliedCodes, setAppliedCodes] = useState<Set<string>>(new Set());
    const [showPatterns, setShowPatterns] = useState(false);
    const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([]);

    // Stats
    const [stats, setStats] = useState<{
        provider?: string;
        model?: string;
        usage?: { inputTokens: number; outputTokens: number; totalTokens: number; costEstimate: number };
    }>({ provider: 'Google', model: selectedModel }); // Init with selected

    // --- Resizable & Docking Logic ---
    const [width, setWidth] = useState(350);
    const [dockSide, setDockSide] = useState<'left' | 'right'>('left'); // Default to left
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

            let delta = 0;
            if (dockSide === 'left') {
                delta = moveEvent.clientX - startX; // Dragging right increases width
            } else {
                delta = startX - moveEvent.clientX; // Dragging left increases width
            }

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
    }, [width, dockSide]);
    // -----------------------

    // --- Content Push Logic ---
    useEffect(() => {
        // Find the main code container (div.grow inside the Repl layout)
        // We look for a div with the 'grow' class which is standard in ReplEditor.jsx
        const codeContainer = document.querySelector('.grow.flex.relative.overflow-hidden') as HTMLElement;

        // Also grab root to cleanup any mess we made previously
        const root = document.getElementById('root');
        if (root) {
            root.style.marginLeft = '';
            root.style.marginRight = '';
            root.style.width = '';
        }

        if (!codeContainer) return;

        if (!open) {
            codeContainer.style.marginLeft = '';
            codeContainer.style.marginRight = '';
            codeContainer.style.width = '';
            return;
        }

        if (dockSide === 'left') {
            codeContainer.style.marginLeft = `${width}px`;
            codeContainer.style.marginRight = '';
            // No need to set width, flex box handles it if we just add margin?
            // Actually .grow fills space. If we add margin, it might overflow if we don't constrain?
            // But flex item with margin should just shrink its content box.
        } else {
            codeContainer.style.marginLeft = '';
            codeContainer.style.marginRight = `${width}px`;
        }

        return () => {
            if (codeContainer) {
                codeContainer.style.marginLeft = '';
                codeContainer.style.marginRight = '';
            }
        };
    }, [open, dockSide, width]);
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
            model: selectedModel,
            context: activeContext
        };
        ws.send(JSON.stringify(msg));
    };

    const handleClearHistory = () => {
        if (confirm('Clear chat history?')) {
            setMessages(INITIAL_MESSAGES);
            localStorage.setItem('strudel-assistant-history', JSON.stringify(INITIAL_MESSAGES));
        }
    };

    const handleApply = useCallback((code: string, mode?: 'insert' | 'replace') => {
        if (onApplyCode) {
            onApplyCode(code, mode);
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
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleSend();
            return;
        }

        // Pass Ctrl+Enter / Cmd+Enter to Strudel (evaluate code)
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            // Dispatch to the editor
            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                bubbles: true
            });
            document.querySelector('.cm-content')?.dispatchEvent(event);
            return;
        }

        // Pass-through global shortcuts (Ctrl/Cmd+. for play/stop)
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
                [dockSide]: 0, // Dynamic left/right
                bottom: '48px',
                width: `${width}px`,
                backgroundColor: '#18181b', // zinc-900
                borderLeft: dockSide === 'right' ? '1px solid #27272a' : 'none',
                borderRight: dockSide === 'left' ? '1px solid #27272a' : 'none',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 90,
                boxShadow: dockSide === 'right' ? '-4px 0 10px rgba(0,0,0,0.3)' : '4px 0 10px rgba(0,0,0,0.3)'
            }}
        >
            <style>{scrollbarStyles}</style>
            {/* Drag Handle */}
            <div
                onMouseDown={startResizing}
                style={{
                    position: 'absolute',
                    [dockSide === 'right' ? 'left' : 'right']: '-4px', // Opposite side
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={() => setDockSide(prev => prev === 'left' ? 'right' : 'left')}
                        title={`Dock to ${dockSide === 'left' ? 'Right' : 'Left'}`}
                        style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '12px' }}
                    >
                        {dockSide === 'left' ? '⇥' : '⇤'}
                    </button>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        style={{
                            backgroundColor: '#27272a',
                            color: '#e4e4e7',
                            border: '1px solid #3f3f46',
                            borderRadius: '4px',
                            fontSize: '11px',
                            padding: '2px 4px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-flash-lite-preview-09-2025">Gemini 2.5 Flash Lite</option>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                        <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                    </select>
                    <button onClick={handleClearHistory} title="Clear Context" style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>✕</button>
                </div>
            </div>

            {/* Patterns Library Toggle */}
            <div style={{ borderBottom: '1px solid #27272a' }}>
                <button
                    onClick={() => {
                        setShowPatterns(!showPatterns);
                        if (!showPatterns) setSavedPatterns(getPatterns());
                    }}
                    style={{
                        width: '100%',
                        padding: '8px 16px',
                        background: 'none',
                        border: 'none',
                        color: '#a1a1aa',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <span>📁 Patterns Library</span>
                    <span>{showPatterns ? '▲' : '▼'}</span>
                </button>
                {showPatterns && (
                    <div style={{ position: 'relative' }}>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '8px' }} className="strudel-scrollbar">
                            {savedPatterns.length === 0 ? (
                                <div style={{ fontSize: '11px', color: '#71717a', textAlign: 'center', padding: '8px' }}>
                                    No saved patterns yet. Use ⭐ or Cmd+Shift+S to save.
                                </div>
                            ) : (
                                savedPatterns.map((p, idx) => (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            // Select this pattern
                                            const pattern = savedPatterns.find(sp => sp.id === p.id);
                                            if (pattern) {
                                                // Show quick preview and actions
                                                const action = confirm(`"${p.name}"\n\n${p.content.substring(0, 200)}${p.content.length > 200 ? '...' : ''}\n\nApply to editor?`);
                                                if (action) {
                                                    onApplyCode?.(p.content, 'replace');
                                                }
                                            }
                                        }}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '6px 10px',
                                            borderRadius: '4px',
                                            marginBottom: '4px',
                                            backgroundColor: '#27272a',
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                                    >
                                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <div style={{ fontWeight: 600, color: '#e4e4e7' }}>{p.name}</div>
                                            <div style={{ fontSize: '9px', color: '#71717a' }}>{new Date(p.timestamp).toLocaleDateString()}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => onApplyCode?.(p.content, 'replace')}
                                                title="Apply pattern"
                                                style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}
                                            >
                                                ▶
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Delete "${p.name}"?`)) {
                                                        deletePattern(p.id);
                                                        setSavedPatterns(getPatterns());
                                                    }
                                                }}
                                                title="Delete pattern"
                                                style={{ background: '#52525b', color: 'white', border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px' }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Loop Station */}
            <LoopStation />

            {/* Messages */}

            {/* Messages */}
            <div className="strudel-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Show collapsed indicator for older messages */}
                {messages.length > 20 && (
                    <button
                        onClick={() => {
                            // Clear history older than 20 messages to prevent memory issues
                            const trimmedMessages = messages.slice(-20);
                            setMessages(trimmedMessages);
                            localStorage.setItem('strudel-assistant-history', JSON.stringify(trimmedMessages));
                        }}
                        style={{
                            background: '#27272a',
                            border: '1px solid #3f3f46',
                            color: '#a1a1aa',
                            padding: '8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            textAlign: 'center'
                        }}
                    >
                        {messages.length - 20} older messages hidden • Click to trim history
                    </button>
                )}
                {/* Only render last 20 messages for performance */}
                {messages.slice(-20).map((m, i) => (
                    <MessageBubble
                        key={messages.length - 20 + i}
                        message={m}
                        appliedCodes={appliedCodes}
                        onApplyCode={m.role === 'assistant' ? handleApply : undefined}
                        hasSelection={!!activeContext?.selection}
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
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span>{getContextLabel(activeContext)}</span>
                                <button
                                    onClick={() => {
                                        const code = activeContext.selection || activeContext.currentLine;
                                        if (!code) return;
                                        const name = prompt('Save this context as pattern:', `Context ${Date.now().toString(36)}`);
                                        if (name) {
                                            savePattern(name, code);
                                            // Refresh tokens if needed
                                            if (showPatterns) setSavedPatterns(getPatterns());
                                            alert(`Saved "${name}" to library!`);
                                        }
                                    }}
                                    title="Save context to library"
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        padding: '0 4px'
                                    }}
                                >
                                    ⭐
                                </button>
                            </div>
                        </div>
                    )}

                    {/* LIVE PREVIEW OF CONTEXT */}
                    {activeContext && (
                        <ContextPreview context={activeContext} />
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
