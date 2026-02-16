/**
 * WebSocket client for live call transcript streaming.
 */

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export interface TranscriptMessage {
  role: "ai" | "patient";
  content_darija: string;
  content_english: string;
  timestamp: string;
  detected_symptoms?: Record<string, unknown>;
}

export class TranscriptSocket {
  private ws: WebSocket | null = null;
  private callId: string;
  private onMessage: (msg: TranscriptMessage) => void;
  private onStatusChange: (status: "connected" | "disconnected" | "error") => void;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(
    callId: string,
    onMessage: (msg: TranscriptMessage) => void,
    onStatusChange: (status: "connected" | "disconnected" | "error") => void
  ) {
    this.callId = callId;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect() {
    this.ws = new WebSocket(`${WS_BASE}/ws/transcript/${this.callId}`);

    this.ws.onopen = () => {
      this.onStatusChange("connected");
      // Keep alive with pings
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send("ping");
        }
      }, 30000);
    };

    this.ws.onmessage = (event) => {
      if (event.data === "pong") return;
      try {
        const msg = JSON.parse(event.data) as TranscriptMessage;
        this.onMessage(msg);
      } catch {}
    };

    this.ws.onclose = () => {
      this.onStatusChange("disconnected");
      this.cleanup();
    };

    this.ws.onerror = () => {
      this.onStatusChange("error");
    };
  }

  disconnect() {
    this.ws?.close();
    this.cleanup();
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
