import React, { useState, useEffect, useRef } from 'react';
import { loopEngine, LoopTrack, LoopState } from './LoopEngine';

export const LoopStation: React.FC = () => {
    const [tracks, setTracks] = useState<LoopTrack[]>([]);
    const [engineState, setEngineState] = useState<LoopState>('idle');
    const [showControls, setShowControls] = useState(false);

    // Initial load
    useEffect(() => {
        setTracks(loopEngine.getAllTracks());

        // Poll for updates (temporary until we have events)
        const interval = setInterval(() => {
            setTracks([...loopEngine.getAllTracks()]);
            // Attempt to init context if missing
            loopEngine.tryInitContext();
        }, 100);

        return () => clearInterval(interval);
    }, []);

    const handleRecord = (id: number) => {
        loopEngine.toggleRecord(id);
    };

    const handleClear = (id: number) => {
        if (confirm('Clear track?')) {
            loopEngine.clearTrack(id);
        }
    };

    const handleMute = (id: number) => {
        loopEngine.toggleMute(id);
    };

    const handleVolume = (id: number, val: number) => {
        loopEngine.setVolume(id, val);
    };

    return (
        <div style={{ borderTop: '1px solid #27272a' }}>
            <button
                onClick={() => setShowControls(!showControls)}
                style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: '#18181b',
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
                <span>🔄 Loop Station</span>
                <span>{showControls ? '▲' : '▼'}</span>
            </button>

            {showControls && (
                <div style={{ padding: '12px', background: '#121212', maxHeight: '300px', overflowY: 'auto' }} className="strudel-scrollbar">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {tracks.map(track => (
                            <div key={track.id} style={{
                                background: '#27272a',
                                borderRadius: '6px',
                                padding: '8px',
                                border: track.isRecording ? '1px solid #ef4444' : track.isPlaying ? '1px solid #22c55e' : '1px solid #3f3f46',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#e4e4e7' }}>TRACK {track.id + 1}</span>
                                    <span style={{ fontSize: '9px', color: '#71717a' }}>{track.duration > 0 ? `${track.duration.toFixed(1)}s` : 'EMPTY'}</span>
                                </div>

                                {/* Waveform Placeholder */}
                                <div style={{
                                    height: '32px',
                                    background: '#18181b',
                                    borderRadius: '3px',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden'
                                }}>
                                    {track.isRecording ? (
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                                    ) : track.buffer ? (
                                        <div style={{ width: '100%', height: '100%', background: `linear-gradient(90deg, #22c55e33 ${track.volume * 100}%, transparent 0)` }} />
                                    ) : (
                                        <span style={{ fontSize: '9px', color: '#3f3f46' }}>--</span>
                                    )}
                                </div>

                                {/* Controls */}
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
                                    <button
                                        onClick={() => handleRecord(track.id)}
                                        style={{
                                            flex: 1,
                                            background: track.isRecording ? '#ef4444' : '#3f3f46',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                            height: '24px'
                                        }}
                                    >
                                        {track.isRecording ? '■' : '●'}
                                    </button>

                                    <button
                                        onClick={() => handleMute(track.id)}
                                        style={{
                                            background: track.isMuted ? '#f59e0b' : '#3f3f46',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                            width: '24px'
                                        }}
                                    >
                                        M
                                    </button>

                                    <button
                                        onClick={() => handleClear(track.id)}
                                        style={{
                                            background: '#3f3f46',
                                            color: '#a1a1aa',
                                            border: 'none',
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                            width: '24px'
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                                {/* Volume Slider */}
                                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '8px', color: '#71717a' }}>VOL</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={track.volume}
                                        onChange={(e) => handleVolume(track.id, parseFloat(e.target.value))}
                                        style={{ flex: 1, height: '4px', accentColor: '#22c55e' }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
};
