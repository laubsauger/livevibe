import { getAudioAnalysis } from './AudioAnalyzer';

export interface LoopTrack {
    id: number;
    buffer: AudioBuffer | null;
    isRecording: boolean;
    isPlaying: boolean;
    isMuted: boolean;
    volume: number; // 0-1
    duration: number; // in seconds
    overdubs: number; // count of layers
}

export type LoopState = 'idle' | 'recording' | 'playing' | 'overdubbing';

class LoopEngine {
    private context: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private tracks: Map<number, LoopTrack> = new Map();
    private trackNodes: Map<number, { source: AudioBufferSourceNode | null, gain: GainNode }> = new Map();

    // Sync state
    private cycleDuration: number = 0; // seconds
    private nextCycleTime: number = 0;

    // Recorder
    private destNode: MediaStreamAudioDestinationNode | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];

    // Singleton
    private static instance: LoopEngine;

    private constructor() {
        this.reset();
    }

    public static getInstance(): LoopEngine {
        if (!LoopEngine.instance) {
            LoopEngine.instance = new LoopEngine();
        }
        return LoopEngine.instance;
    }

    private reset() {
        // Initialize 4 tracks
        for (let i = 0; i < 4; i++) {
            this.tracks.set(i, {
                id: i,
                buffer: null,
                isRecording: false,
                isPlaying: false,
                isMuted: false,
                volume: 0.8,
                duration: 0,
                overdubs: 0
            });
        }
    }

    public setContext(ctx: AudioContext) {
        if (this.context === ctx) return;
        this.context = ctx;
        this.masterGain = ctx.createGain();
        // Tag our gain to maybe identify it later if needed
        (this.masterGain as any).isLoopEngine = true;
        this.masterGain.connect(ctx.destination);

        // Setup recording sync
        this.destNode = ctx.createMediaStreamDestination();
        console.log('[LoopEngine] Audio context set');
    }

    // Attempt to grab context from where AudioAnalyzer found it
    public tryInitContext() {
        const analyzer = (window as any).livevibeAudioAnalyzer;
        if (analyzer && analyzer.analyser && analyzer.analyser.context) {
            this.setContext(analyzer.analyser.context);
            // Connect analyzer output to our recorder destination
            try {
                // Ensure we don't create multiple connections
                // We rely on analyzer fan-out
                analyzer.analyser.connect(this.destNode!);
                return true;
            } catch (e) {
                console.warn('[LoopEngine] Failed to connect analyzer to recorder', e);
            }
        }
        return false;
    }

    public getTrack(id: number): LoopTrack | undefined {
        return this.tracks.get(id);
    }

    public getAllTracks(): LoopTrack[] {
        return Array.from(this.tracks.values());
    }

    public toggleRecord(trackId: number) {
        if (!this.context) {
            if (!this.tryInitContext()) {
                console.warn('[LoopEngine] No audio context available');
                alert('Audio Engine not ready. Please play some audio first to initialize.');
                return;
            }
        }

        const track = this.tracks.get(trackId);
        if (!track) return;

        if (track.isRecording) {
            this.stopRecording(trackId);
        } else {
            this.startRecording(trackId);
        }
    }

    private startRecording(trackId: number) {
        if (!this.destNode || !this.context) return;

        console.log(`[LoopEngine] Start recording track ${trackId}`);
        const track = this.tracks.get(trackId);
        if (track) track.isRecording = true;

        this.recordedChunks = [];
        // Capture the stream from the connection we made in tryInitContext
        // We record the mixed output from the analyzer
        this.mediaRecorder = new MediaRecorder(this.destNode.stream);

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.recordedChunks.push(e.data);
            }
        };

        this.mediaRecorder.start();
    }

    private stopRecording(trackId: number) {
        if (!this.mediaRecorder || !this.context) return;

        console.log(`[LoopEngine] Stop recording track ${trackId}`);
        const track = this.tracks.get(trackId);
        if (track) track.isRecording = false;

        this.mediaRecorder.onstop = async () => {
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' }); // Chrome/Firefox default
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);

                if (track) {
                    track.buffer = audioBuffer;
                    track.duration = audioBuffer.duration;
                    track.isPlaying = true;
                    this.playTrack(trackId);
                }
            } catch (e) {
                console.error('[LoopEngine] Failed to decode audio', e);
            }
        };

        this.mediaRecorder.stop();
        this.mediaRecorder = null;
    }

    private playTrack(trackId: number) {
        const track = this.tracks.get(trackId);
        if (!track || !track.buffer || !this.context || !this.masterGain) return;
        if (!track.isPlaying) return;

        // Stop existing
        this.stopTrackSource(trackId);

        const source = this.context.createBufferSource();
        source.buffer = track.buffer;
        source.loop = true;

        const gain = this.context.createGain();
        gain.gain.value = track.isMuted ? 0 : track.volume;

        source.connect(gain);
        gain.connect(this.masterGain);

        source.start(0);

        this.trackNodes.set(trackId, { source, gain });
    }

    private stopTrackSource(trackId: number) {
        const nodes = this.trackNodes.get(trackId);
        if (nodes?.source) {
            try { nodes.source.stop(); } catch { }
            try { nodes.source.disconnect(); } catch { }
            try { nodes.gain.disconnect(); } catch { }
            this.trackNodes.delete(trackId);
        }
    }

    public toggleMute(trackId: number) {
        const track = this.tracks.get(trackId);
        if (track) {
            track.isMuted = !track.isMuted;
            this.updateNodeGain(trackId);
        }
    }

    public setVolume(trackId: number, volume: number) {
        const track = this.tracks.get(trackId);
        if (track) {
            track.volume = Math.max(0, Math.min(1, volume));
            this.updateNodeGain(trackId);
        }
    }

    public clearTrack(trackId: number) {
        const track = this.tracks.get(trackId);
        if (track) {
            track.buffer = null;
            track.isRecording = false;
            track.isPlaying = false;
            track.duration = 0;
            track.overdubs = 0;
            this.stopTrackSource(trackId);
        }
    }

    private updateNodeGain(trackId: number) {
        const track = this.tracks.get(trackId);
        const nodes = this.trackNodes.get(trackId);
        if (track && nodes && this.context) {
            const gain = track.isMuted ? 0 : track.volume;
            nodes.gain.gain.setTargetAtTime(gain, this.context.currentTime, 0.05);
        }
    }
}

export const loopEngine = LoopEngine.getInstance();
