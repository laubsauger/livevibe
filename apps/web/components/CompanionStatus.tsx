"use client";

import { useEffect, useState } from "react";

export function CompanionStatus() {
    const [status, setStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");

    useEffect(() => {
        let ws: WebSocket | null = null;
        let items: NodeJS.Timeout | null = null;

        function connect() {
            setStatus("connecting");
            ws = new WebSocket("ws://localhost:8787");

            ws.onopen = () => {
                setStatus("connected");
            };

            ws.onclose = () => {
                setStatus("disconnected");
                items = setTimeout(connect, 2000);
            };

            ws.onerror = () => {
                ws?.close();
            };
        }

        connect();

        return () => {
            ws?.close();
            if (items) clearTimeout(items);
        };
    }, []);

    const color = {
        connected: "bg-green-500",
        connecting: "bg-yellow-500",
        disconnected: "bg-red-500",
    }[status];

    return (
        <div className="flex items-center gap-2 font-mono">
            <span>Companion:</span>
            <div className={`h-2 w-2 rounded-full ${color}`} />
            <span className="capitalize">{status}</span>
        </div>
    );
}
