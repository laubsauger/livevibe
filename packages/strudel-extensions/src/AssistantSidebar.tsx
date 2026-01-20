import React, { useState, useRef, useEffect } from 'react';
import { ClientToLinkMessage, LinkToClientMessage } from '@livevibe/protocol';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AssistantSidebarProps {
    open: boolean;
    onClose: () => void;
    ws?: WebSocket | null;
    activeContext?: { selection?: string; currentLine?: string; line?: number };
    onApplyCode?: (code: string) => void;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const AssistantSidebar: React.FC<AssistantSidebarProps> = ({ open, onClose, ws, activeContext, onApplyCode }) => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! I am your Strudel assistant. How can I help you code?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Listen for streaming responses
    useEffect(() => {
        if (!ws) return;

        const handleMessage = (event: MessageEvent) => {
            try {
                const msg = JSON.parse(event.data) as LinkToClientMessage;
                if (msg.type === 'assistant:response') {
                    setIsTyping(!msg.done);
                    setMessages(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.role === 'assistant' && !msg.done) {
                            return [...prev.slice(0, -1), { ...last, content: last.content + msg.text }];
                        }
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

        // Add user message
        setMessages(prev => [...prev, { role: 'user', content: input }]);
        setInput('');
        setIsTyping(true);

        // Send to backend
        const msg: ClientToLinkMessage = {
            type: 'assistant:query',
            text: input,
            context: activeContext
        };
        ws.send(JSON.stringify(msg));
    };

    if (!open) return null;

    return (
        <div
            style={{
                position: 'absolute',
                top: '56px',
                right: 0,
                bottom: '48px', // Above transport bar
                width: '350px',
                backgroundColor: '#18181b', // zinc-900
                borderLeft: '1px solid #27272a',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 90,
                boxShadow: '-4px 0 10px rgba(0,0,0,0.3)'
            }}
        >
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#e4e4e7', fontSize: '14px' }}>Assistant</span>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '95%', // increased width for code blocks
                        width: m.role === 'assistant' ? '100%' : 'auto',
                        backgroundColor: m.role === 'user' ? '#3f3f46' : 'transparent',
                        padding: m.role === 'user' ? '8px 12px' : '0',
                        borderRadius: '8px',
                        color: '#e4e4e7',
                        fontSize: '13px',
                        lineHeight: '1.5'
                    }}>
                        {m.role === 'assistant' && (
                            <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', textTransform: 'uppercase' }}>AI</div>
                        )}
                        {m.role === 'user' ? (
                            <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                        ) : (
                            <ReactMarkdown
                                components={{
                                    code({ node, inline, className, children, ...props }: any) {
                                        const match = /language-(\w+)/.exec(className || '')
                                        const codeString = String(children).replace(/\n$/, '');
                                        return !inline && match ? (
                                            <div style={{ position: 'relative', marginTop: '8px', marginBottom: '8px' }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    zIndex: 10,
                                                    display: 'flex',
                                                    gap: '8px'
                                                }}>
                                                    {onApplyCode && (
                                                        <button
                                                            onClick={() => onApplyCode(codeString)}
                                                            style={{
                                                                fontSize: '10px',
                                                                padding: '4px 8px',
                                                                backgroundColor: '#2563eb', // blue-600
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            Apply
                                                        </button>
                                                    )}
                                                </div>
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus}
                                                    language={match[1]}
                                                    PreTag="div"
                                                    customStyle={{ margin: 0, borderRadius: '6px', fontSize: '12px' }}
                                                    {...props}
                                                >
                                                    {codeString}
                                                </SyntaxHighlighter>
                                            </div>
                                        ) : (
                                            <code className={className} style={{ backgroundColor: '#27272a', padding: '2px 4px', borderRadius: '4px' }} {...props}>
                                                {children}
                                            </code>
                                        )
                                    }
                                }}
                            >
                                {m.content}
                            </ReactMarkdown>
                        )}
                    </div>
                ))}
                {isTyping && <div style={{ fontSize: '12px', color: '#71717a', fontStyle: 'italic' }}>Typing...</div>}
                <div ref={messagesEndRef} />
            </div>

            {/* Context & Input */}
            <div style={{ padding: '12px', borderTop: '1px solid #27272a', backgroundColor: '#18181b' }}>
                {activeContext && (
                    <div style={{
                        fontSize: '11px',
                        color: '#a1a1aa',
                        marginBottom: '8px',
                        padding: '4px 8px',
                        backgroundColor: '#27272a',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}>
                        <span>Line {activeContext.line}</span>
                        {activeContext.selection && <span>Selected: {activeContext.selection.length} chars</span>}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
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
            </div>
        </div>
    );
};
