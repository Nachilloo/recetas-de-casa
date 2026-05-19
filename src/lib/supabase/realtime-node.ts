import type { RealtimeClientOptions } from '@supabase/supabase-js';
import WebSocket from 'ws';

/** Node < 22: Supabase Realtime necesita `ws` como transporte en el servidor. */
export const nodeRealtime: RealtimeClientOptions = {
  transport: WebSocket as unknown as RealtimeClientOptions['transport'],
};

// Por si algún bundle no pasa `realtime.transport`
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}
