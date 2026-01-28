export interface TransportState {
    playing: boolean;
    step: number; // Current step index
    tempo: number; // BPM
    time: number; // Transport time in seconds
}

export type LinkToClientMessage =
    | { type: 'transport:state'; payload: TransportState }
    | { type: 'observability:event'; payload: any }
    | {
        type: 'assistant:response';
        text: string;
        done: boolean;
        metadata?: {
            model: string;
            provider: string;
            usage?: {
                inputTokens: number;
                outputTokens: number;
                totalTokens: number;
                costEstimate: number;
            }
        }
    }
    | { type: 'transport:play' }
    | { type: 'transport:stop' }
    | { type: 'transport:tempo'; payload: number };

export type ClientToLinkMessage =
    | { type: 'transport:play' }
    | { type: 'transport:stop' }
    | { type: 'transport:tempo'; payload: number }
    | { type: 'plan:apply'; payload: any }
    | { type: 'assistant:query'; text: string; model?: string; context?: { selection?: string; currentLine?: string; line?: number } };
