export interface TransportState {
    playing: boolean;
    step: number; // Current step index
    tempo: number; // BPM
    time: number; // Transport time in seconds
}

export type LinkToClientMessage =
    | { type: 'transport:state'; payload: TransportState }
    | { type: 'observability:event'; payload: any }
    | { type: 'assistant:response'; text: string; done: boolean };

export type ClientToLinkMessage =
    | { type: 'transport:play' }
    | { type: 'transport:stop' }
    | { type: 'transport:tempo'; payload: number }
    | { type: 'plan:apply'; payload: any }
    | { type: 'assistant:query'; text: string; context?: { selection?: string; currentLine?: string; line?: number } };
