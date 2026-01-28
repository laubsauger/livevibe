import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TransportState, LinkToClientMessage, ClientToLinkMessage } from '@livevibe/protocol';
import { AssistantSidebar } from './AssistantSidebar';
import { injectAudioAnalyzer, getAudioAnalysis } from './AudioAnalyzer';
import { validatePattern, formatValidationResult } from './PatternValidator';
import { savePattern } from './PatternStore';
import { encodeStrudel } from './url';

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
  const [activeContext, setActiveContext] = useState<{
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
  }>();

  const wsRef = useRef<WebSocket | null>(null);

  // Inject audio analyzer on mount
  useEffect(() => {
    injectAudioAnalyzer();
  }, []);

  useEffect(() => {
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    const updateContext = () => {
      // Debounce to prevent excessive updates during typing
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        const ctx = getEditorContext();
        if (ctx) setActiveContext(ctx);
      }, 500); // 500ms debounce
    };

    // Poll for editor existence, then attach listeners
    const pollInterval = setInterval(() => {
      const view = getCodeMirrorView();
      if (view && view.contentDOM) {
        // selectionchange covers most cases; mouseup for drag selections
        document.addEventListener('selectionchange', updateContext);
        view.contentDOM.addEventListener('mouseup', updateContext);

        clearInterval(pollInterval);
      }
    }, 500);

    return () => {
      clearInterval(pollInterval);
      if (debounceTimeout) clearTimeout(debounceTimeout);
      document.removeEventListener('selectionchange', updateContext);

      const view = getCodeMirrorView();
      if (view && view.contentDOM) {
        view.contentDOM.removeEventListener('mouseup', updateContext);
      }
    };
  }, [context]);

  // Global keyboard shortcut: Cmd+Shift+S to save pattern from editor
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+S or Ctrl+Shift+S
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();

        const view = getCodeMirrorView();
        if (!view || !view.state) {
          alert('Editor not available');
          return;
        }

        const state = view.state;
        const selection = state.selection.main;
        const selectedText = state.sliceDoc(selection.from, selection.to);

        // Use selection if available, otherwise entire document
        const codeToSave = selectedText.trim() || state.doc.toString();

        if (!codeToSave) {
          alert('Nothing to save');
          return;
        }

        const name = prompt('Save pattern as:', `Pattern ${Date.now().toString(36)}`);
        if (name) {
          savePattern(name, codeToSave);
          console.log('[PatternStore] Saved:', name);

          // Show brief notification (non-blocking)
          const toast = document.createElement('div');
          toast.textContent = `✅ Saved "${name}"`;
          toast.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;padding:8px 16px;border-radius:4px;z-index:9999;font-size:12px;font-family:monospace;';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2000);
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);


  // Transport Sync Logic
  useEffect(() => {
    let animationFrameId: number;
    let lastStateHash = '';

    const syncTransport = () => {
      const scheduler = (window as any).scheduler;
      const refView = getCodeMirrorView();

      if (scheduler && wsRef.current?.readyState === WebSocket.OPEN) {
        // Strudel uses 'cyclist' internally.
        // scheduler.started -> boolean
        // scheduler.now() -> current cycle (float)
        // scheduler.cps -> cycles per second
        // scheduler.getTime() -> current audio time

        const playing = scheduler.started;
        // scheduler.now might be a getter or a function depending on version
        const nowVal = typeof scheduler.now === 'function' ? scheduler.now() : scheduler.now;
        const step = Math.floor(nowVal || 0); // Convert cycle to step (integer)
        const time = (typeof scheduler.getTime === 'function' ? scheduler.getTime() : 0) || 0;
        const tempo = (scheduler.cps || 0.5) * 60 * 4; // Cycles/sec to BPM (assuming 4 beats/cycle)

        // Create a hash to prevent spamming generic updates if nothing changed
        // But for time/step, we want high refresh rate if playing
        const currentStateHash = `${playing}-${step}-${Math.round(time * 10)}-${tempo}`;

        if (playing || currentStateHash !== lastStateHash) {
          const payload: TransportState = {
            playing,
            step,
            tempo,
            time
          };

          // Update local state for UI
          setTransport(payload);

          // Broadcast to Companion
          sendMessage({ type: 'transport:state', payload });
          lastStateHash = currentStateHash;
        }
      } else if (refView && refView.state && !scheduler) {
        // Fallback if scheduler isn't globally available but we have the editor
        // (Though standard Strudel exposes window.scheduler)
      }

      animationFrameId = requestAnimationFrame(syncTransport);
    };

    // Start polling
    animationFrameId = requestAnimationFrame(syncTransport);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [context, status]); // Re-run if context or connection status changes

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

        // Handle incoming Transport Control from Companion
        if (msg.type === 'transport:play') {
          const scheduler = (window as any).scheduler;
          if (scheduler && !scheduler.started) {
            // Favor context toggle if available to update UI
            if (context?.handleTogglePlay) context.handleTogglePlay();
            else scheduler.start();
          }
        } else if (msg.type === 'transport:stop') {
          const scheduler = (window as any).scheduler;
          if (scheduler && scheduler.started) {
            if (context?.handleTogglePlay) context.handleTogglePlay();
            else scheduler.stop();
          }
        } else if (msg.type === 'transport:tempo') {
          const scheduler = (window as any).scheduler;
          if (scheduler?.setCps) {
            // transport:tempo payload is BPM
            // Strudel CPS = BPM / 60 / 4 (usually)
            scheduler.setCps(msg.payload / 240);
          }
        }

      } catch (err) {
        console.error('Failed to parse message', err);
      }
    };
  }

  function sendMessage(msg: ClientToLinkMessage | LinkToClientMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function togglePlay() {
    // Sync with Strudel
    const scheduler = (window as any).scheduler;

    if (context?.handleTogglePlay) {
      context.handleTogglePlay();
      return;
    }

    // Fallback direct control
    if (transport.playing) {
      if (scheduler?.pause) scheduler.pause();
    } else {
      if (scheduler?.start) scheduler.start();
    }
  }

  function handleTempoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTempo = parseFloat(e.target.value);
    setTransport(prev => ({ ...prev, tempo: newTempo }));

    const scheduler = (window as any).scheduler;
    if (scheduler?.setCps) scheduler.setCps(newTempo / 60 / 4);
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

        // Get audio analysis
        const audio = getAudioAnalysis();

        return {
          selection: selection || undefined,
          currentLine: line.text,
          line: line.number,
          audioFeatures: audio.isConnected ? {
            isPlaying: audio.isPlaying,
            bass: audio.bass,
            mid: audio.mid,
            treble: audio.treble,
            brightness: audio.brightness
          } : undefined
        };
      }
    } catch (e) { console.error('Error getting context', e); }
    return undefined;
  };

  const handleApplyCode = useCallback((code: string, mode: 'insert' | 'replace' = 'replace') => {
    try {
      const view = getCodeMirrorView();
      if (view && view.dispatch) {
        const state = view.state;
        const selection = state.selection.main;

        console.log('[Extension] Applying code:', {
          mode,
          selection: { from: selection.from, to: selection.to, empty: selection.empty }
        });

        // Validate pattern before applying
        const validation = validatePattern(code);
        if (!validation.valid) {
          const errorMsg = formatValidationResult(validation);
          console.warn('[Extension] Validation failed:', errorMsg);
          if (!confirm(`Pattern has errors:\n\n${errorMsg}\n\nApply anyway?`)) {
            return;
          }
        } else if (validation.warnings.length > 0) {
          console.info('[Extension] Validation warnings:', validation.warnings);
        }

        if (mode === 'insert') {
          // INSERT MODE: Always insert on new line below current line
          const line = state.doc.lineAt(selection.from);
          const insertPos = line.to;
          const textToInsert = '\n' + code;

          view.dispatch({
            changes: { from: insertPos, insert: textToInsert },
            selection: { anchor: insertPos + textToInsert.length }
          });
        } else {
          // REPLACE MODE
          if (selection.empty) {
            // No selection -> Replace current line
            const line = state.doc.lineAt(selection.from);
            view.dispatch({
              changes: { from: line.from, to: line.to, insert: code },
              selection: { anchor: line.from + code.length }
            });
          } else {
            // Selection exists -> Replace selection
            view.dispatch({
              changes: { from: selection.from, to: selection.to, insert: code },
              selection: { anchor: selection.from + code.length }
            });
          }
        }

        // Force focus back to editor
        view.focus();
        console.log('Code applied successfully');
      } else {
        console.error('Apply failed: Editor view not found or detached');
        alert('Could not apply code: Editor not connected.');
      }
    } catch (e) {
      console.error('Apply failed', e);
      alert('Error applying code: ' + e);
    }
  }, [context]); // Dependency on context to potentially re-fetch if context changes (though getCodeMirrorView is dynamic)

  const handleJumpToLine = useCallback((line: number) => {
    try {
      const view = getCodeMirrorView();
      if (view && view.dispatch) {
        const state = view.state;
        // Ensure line number is valid
        const safeLine = Math.max(1, Math.min(line, state.doc.lines));
        const lineInfo = state.doc.line(safeLine);

        view.dispatch({
          selection: { anchor: lineInfo.from },
          scrollIntoView: true
        });
        view.focus();
      }
    } catch (e) {
      console.error('Jump failed', e);
    }
  }, [context]);

  return (
    <>
      <AssistantSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ws={wsRef.current}
        activeContext={activeContext}
        onApplyCode={handleApplyCode}
        onTogglePlay={togglePlay}
        onJumpToLine={handleJumpToLine}
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

        {/* Share Button */}
        <button
          onClick={() => {
            const view = getCodeMirrorView();
            if (view && view.state) {
              const code = view.state.doc.toString();
              const url = encodeStrudel(code);
              navigator.clipboard.writeText(url).then(() => {
                const toast = document.createElement('div');
                toast.textContent = `📋 Link copied to clipboard!`;
                toast.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;padding:8px 16px;border-radius:4px;z-index:9999;font-size:12px;font-family:monospace;';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
              });
            } else {
              alert('Could not access editor content');
            }
          }}
          style={buttonStyle}
          className="hover:bg-white/10"
        >
          <span style={{ fontSize: '16px' }}>🔗</span>
          <span>Share</span>
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
