/**
 * AudioAnalyzer - Hooks into Strudel's Web Audio to extract real-time features
 */

export interface AudioFeatures {
    isConnected: boolean;
    isPlaying: boolean;
    isSilent: boolean;
    peak: number;
    average: number;
    bass: number;
    mid: number;
    treble: number;
    brightness: 'dark' | 'balanced' | 'bright';
}

const DEFAULT_FEATURES: AudioFeatures = {
    isConnected: false,
    isPlaying: false,
    isSilent: true,
    peak: 0,
    average: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    brightness: 'dark'
};

/**
 * Injects an audio analyzer into the global audio context
 * Call this once after Strudel is loaded
 */
export function injectAudioAnalyzer(): void {
    if (typeof window === 'undefined') return;
    if ((window as any).livevibeAudioAnalyzer) return; // Already injected

    (window as any).livevibeAudioAnalyzer = {
        analyser: null as AnalyserNode | null,
        dataArray: null as Uint8Array | null,
        isConnected: false,

        connect() {
            // Intercept GainNode.connect to tap into the audio graph
            const originalGainConnect = GainNode.prototype.connect as any;
            let intercepted = false;

            (GainNode.prototype as any).connect = function (this: GainNode, destination: AudioNode | AudioParam, ...rest: any[]) {
                if (!intercepted && destination && (destination as any).context) {
                    intercepted = true;
                    const ctx = (destination as any).context as AudioContext;

                    const analyzer = (window as any).livevibeAudioAnalyzer;
                    analyzer.analyser = ctx.createAnalyser();
                    analyzer.analyser.fftSize = 256; // Small for performance
                    analyzer.analyser.smoothingTimeConstant = 0.8;
                    analyzer.dataArray = new Uint8Array(analyzer.analyser.frequencyBinCount);

                    const result = originalGainConnect.call(this, destination, ...rest);
                    originalGainConnect.call(this, analyzer.analyser);
                    analyzer.isConnected = true;

                    console.log('[AudioAnalyzer] Connected to audio graph');
                    return result;
                }
                return originalGainConnect.call(this, destination, ...rest);
            };
        },

        analyze(): AudioFeatures {
            if (!this.analyser || !this.isConnected) {
                return { ...DEFAULT_FEATURES };
            }

            this.analyser.getByteFrequencyData(this.dataArray);
            const data = this.dataArray;
            const len = data.length;

            let sum = 0, peak = 0;
            let bassSum = 0, midSum = 0, trebleSum = 0;

            for (let i = 0; i < len; i++) {
                const val = data[i];
                sum += val;
                if (val > peak) peak = val;

                // Frequency bands (for 256 FFT: 128 bins, ~172Hz per bin at 44100Hz)
                if (i < 4) bassSum += val;           // 0-700Hz
                else if (i < 32) midSum += val;      // 700-5500Hz
                else trebleSum += val;               // 5500Hz+
            }

            const average = sum / len;
            const bass = bassSum / 4;
            const mid = midSum / 28;
            const treble = trebleSum / (len - 32);

            const centroid = sum > 0 ? (treble / (bass + 0.1)) : 0;

            return {
                isConnected: true,
                isPlaying: average > 5,
                isSilent: average < 1,
                peak: Math.round(peak),
                average: Math.round(average),
                bass: Math.round(bass),
                mid: Math.round(mid),
                treble: Math.round(treble),
                brightness: centroid > 1.5 ? 'bright' : centroid > 0.5 ? 'balanced' : 'dark'
            };
        }
    };

    // Auto-connect
    (window as any).livevibeAudioAnalyzer.connect();
}

/**
 * Get current audio analysis features
 */
export function getAudioAnalysis(): AudioFeatures {
    if (typeof window === 'undefined') return DEFAULT_FEATURES;
    const analyzer = (window as any).livevibeAudioAnalyzer;
    if (!analyzer) return DEFAULT_FEATURES;
    return analyzer.analyze();
}
