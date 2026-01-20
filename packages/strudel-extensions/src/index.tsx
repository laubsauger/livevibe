import React, { useState, useEffect, useRef } from 'react';
import { TransportState, LinkToClientMessage } from '@livevibe/protocol';

export function initExtensions(context: any) {
  console.log('[LiveVibe] Extensions loaded');
  return {};
}

type ConnectState = 'connected' | 'disconnected' | 'connecting';

const WS_URL = 'ws://localhost:8787';

export function ExtensionPanel({ context }: { context: any }) {
  const [status, setStatus] = useState<ConnectState>('disconnected');
  const [transport, setTransport] = useState<TransportState>({
    playing: false,
    step: 0,
    tempo: 120,
    time: 0
  });

  const wsRef = useRef<WebSocket | null>(null);

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

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-400';
      case 'connecting': return 'bg-yellow-400';
      case 'disconnected': return 'bg-red-500';
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 h-10 bg-zinc-900 border-t border-zinc-700 text-gray-200 text-xs font-mono absolute bottom-0 left-0 right-0 z-50">
      <div className="flex items-center gap-1.5" title={status}>
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span>Companion</span>
      </div>
      <div className="w-px h-4 bg-zinc-700" />
      <div className="min-w-[40px]">
        {transport.playing ? 'PLAY' : 'STOP'}
      </div>
      <div className="min-w-[60px]">
        {transport.tempo.toFixed(1)} BPM
      </div>
      <div className="min-w-[80px]">
        STEP {transport.step.toString().padStart(4, '0')}
      </div>
      <div className="min-w-[80px]">
        TIME {transport.time.toFixed(2)}s
      </div>
    </div>
  );
}
