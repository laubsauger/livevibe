import React, { useState, useEffect, useRef } from 'react';
import { TransportState, LinkToClientMessage, ClientToLinkMessage } from '@livevibe/protocol';
import { AssistantSidebar } from './AssistantSidebar';

export function initExtensions(context: any) {
  console.log('[LiveVibe] Extensions loaded');
  return {};
}

type ConnectState = 'connected' | 'disconnected' | 'connecting';

const WS_URL = 'ws://localhost:8787';

export function ExtensionPanel({ context }: { context: any }) {
  // No changes here, just stabilizing
  const [status, setStatus] = useState<ConnectState>('disconnected');
  const [transport, setTransport] = useState<TransportState>({
    playing: false,
    step: 0,
    tempo: 120,
    time: 0
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<{ selection?: string; currentLine?: string; line?: number }>();

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const updateContext = () => {
      const ctx = getEditorContext();
      if (ctx) setActiveContext(ctx);
    };

    // Poll for editor existence, then attach listeners
    const pollInterval = setInterval(() => {
      const view = getCodeMirrorView();
      if (view && view.contentDOM) {
        view.contentDOM.addEventListener('mouseup', updateContext);
        view.contentDOM.addEventListener('keyup', updateContext);
        view.contentDOM.addEventListener('click', updateContext);
        view.contentDOM.addEventListener('focus', updateContext);
        clearInterval(pollInterval);
      }
    }, 500);

    return () => {
      clearInterval(pollInterval);
      const view = getCodeMirrorView();
      if (view && view.contentDOM) {
        view.contentDOM.removeEventListener('mouseup', updateContext);
        view.contentDOM.removeEventListener('keyup', updateContext);
        view.contentDOM.removeEventListener('click', updateContext);
        view.contentDOM.removeEventListener('focus', updateContext);
      }
    };
  }, [context]);


  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  function connect() {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setTimeout(connect, 2000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as LinkToClientMessage;
        if (msg.type === 'transport:state') {
          setTransport(msg.payload);
        }
      } catch (err) {
        console.error('Failed to parse message', err);
      }
    };
  }

  function sendMessage(msg: ClientToLinkMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function togglePlay() {
    if (transport.playing) {
      sendMessage({ type: 'transport:stop' });
    } else {
      sendMessage({ type: 'transport:play' });
    }
  }

  function handleTempoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTempo = parseFloat(e.target.value);
    setTransport(prev => ({ ...prev, tempo: newTempo }));
    sendMessage({ type: 'transport:tempo', payload: newTempo });
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#4ade80'; // green-400
      case 'connecting': return '#facc15'; // yellow-400
      case 'disconnected': return '#ef4444'; // red-500
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '0 16px',
    height: '48px',
    fontFamily: 'monospace',
    fontSize: '12px',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#09090b', // zinc-950
    borderTop: '1px solid #27272a', // zinc-800
    color: '#e4e4e7', // zinc-200
    boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    borderRadius: '4px',
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: '1px solid #3f3f46',
    borderRadius: '4px',
    padding: '2px 8px',
    width: '64px',
    textAlign: 'center',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    outline: 'none',
  };

  // Extract context from editor
  // Robustly try to find the editor instance
  const getCodeMirrorView = () => {
    // 1. Try context ref (unstable in current setup)
    const refView = context?.editorRef?.current?.editor;
    if (refView && refView.state) return refView;

    // 2. Try window global (Strudel legacy/debug hook)
    if ((window as any).strudelMirror?.editor) {
      return (window as any).strudelMirror.editor;
    }
    return undefined;
  };

  const getEditorContext = () => {
    try {
      const view = getCodeMirrorView();
      if (view && view.state) {
        const state = view.state;
        const selectionRange = state.selection.main;
        const selection = state.sliceDoc(selectionRange.from, selectionRange.to);
        const line = state.doc.lineAt(selectionRange.head);

        return {
          selection: selection || undefined,
          currentLine: line.text,
          line: line.number
        };
      }
    } catch (e) { console.error('Error getting context', e); }
    return undefined;
  };

  const handleApplyCode = (code: string) => {
    try {
      const view = getCodeMirrorView();
      if (view && view.dispatch) {
        const state = view.state;
        // Simple logic: insert at cursor or replace selection
        view.dispatch({
          changes: { from: state.selection.main.from, to: state.selection.main.to, insert: code }
        });
        console.log('Code applied successfully');
      } else {
        console.error('Apply failed: Editor view not found');
        alert('Could not apply code: Editor not connected.');
      }
    } catch (e) {
      console.error('Apply failed', e);
      alert('Error applying code: ' + e);
    }
  };

  return (
    <>
      <AssistantSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ws={wsRef.current}
        activeContext={activeContext}
        onApplyCode={handleApplyCode}
      />
      <div style={containerStyle}>
        {/* Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} title={status}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor() }} />
          <span style={{ fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#71717a' }}>Companion</span>
        </div>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#27272a', margin: '0 8px' }} />

        {/* Transport Controls */}
        <button
          onClick={togglePlay}
          style={buttonStyle}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>
            {transport.playing ? '⏸' : '▶'}
          </span>
          <span style={{ fontWeight: 'bold' }}>{transport.playing ? 'STOP' : 'PLAY'}</span>
        </button>

        {/* Tempo Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BPM</label>
          <input
            type="number"
            value={Math.round(transport.tempo)}
            onChange={handleTempoChange}
            style={inputStyle}
            className="hover:border-zinc-500 focus:border-white" // Keep some classes if they work, but fallbacks are safer
          />
        </div>

        <div style={{ flexGrow: 1 }} />

        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ ...buttonStyle, color: sidebarOpen ? 'white' : '#a1a1aa' }}
        >
          <span style={{ fontSize: '16px' }}>💬</span>
          <span>Assistant</span>
        </button>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#27272a', margin: '0 8px' }} />

        {/* Clock Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontVariantNumeric: 'tabular-nums', color: '#a1a1aa' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
            <span style={{ fontSize: '10px', color: '#52525b', textTransform: 'uppercase' }}>Step</span>
            <span style={{ fontSize: '18px', color: 'white', fontWeight: 500 }}>{transport.step.toString().padStart(4, '0')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
            <span style={{ fontSize: '10px', color: '#52525b', textTransform: 'uppercase' }}>Time</span>
            <span style={{ fontSize: '18px', color: 'white', fontWeight: 500 }}>{transport.time.toFixed(2)}s</span>
          </div>
        </div>
      </div>
    </>
  );
}
