import { useState, useEffect, useRef, useCallback } from 'react';

const HOST = import.meta.env.VITE_SIGNALK_HOST || 'localhost';
const SK_PORT = import.meta.env.VITE_SIGNALK_PORT || 3000;
const BRIDGE_PORT = import.meta.env.VITE_NMEA_BRIDGE_PORT || 3001;
const SIGNALK_WS = `ws://${HOST}:${SK_PORT}/signalk/v1/stream?subscribe=all`;
const BRIDGE_WS = `ws://${HOST}:${BRIDGE_PORT}`;
const MAX_SIGNALK_FAILURES = 3;
const RECONNECT_MS = 3000;

/**
 * Fallback: if Signal K is not running, use simulator/nmea-bridge.js — it parses NMEA
 * from TCP :10110 and broadcasts JSON on ws://host:3001. Port 3001 is Signal K HTTP
 * admin when signalk-server is up, so run bridge OR Signal K, not both.
 */
export function useSignalK() {
  const [position, setPosition] = useState(null);
  const [sog, setSog] = useState(null);
  const [cog, setCog] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [usingBridge, setUsingBridge] = useState(false);

  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const signalkFailures = useRef(0);
  const useBridge = useRef(false);
  const hadOpen = useRef(false);
  const connectRef = useRef(null);

  const clearReconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    clearReconnect();
    reconnectTimer.current = setTimeout(() => connectRef.current?.(), RECONNECT_MS);
  }, [clearReconnect]);

  const applyBridgePayload = useCallback((data) => {
    if (data.lat != null && data.lng != null) {
      setPosition({ lat: data.lat, lng: data.lng });
      setLastUpdate(new Date(data.ts || Date.now()));
    }
    if (data.sog != null) setSog(Number(data.sog).toFixed(1));
    if (data.cog != null) setCog(Math.round(data.cog));
  }, []);

  const handleSignalKMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data);
      if (!msg.updates) return;

      msg.updates.forEach((update) => {
        update.values?.forEach(({ path, value }) => {
          if (path === 'navigation.position') {
            setPosition({ lat: value.latitude, lng: value.longitude });
            setLastUpdate(new Date());
          }
          if (path === 'navigation.speedOverGround') {
            setSog((value * 1.94384).toFixed(1));
          }
          if (path === 'navigation.courseOverGroundTrue') {
            setCog(Math.round((value * 180) / Math.PI));
          }
        });
      });
    } catch {
      // ignore malformed deltas
    }
  }, []);

  const connect = useCallback(() => {
    clearReconnect();
    hadOpen.current = false;
    const bridgeMode = useBridge.current;

    try {
      ws.current = new WebSocket(bridgeMode ? BRIDGE_WS : SIGNALK_WS);

      ws.current.onopen = () => {
        hadOpen.current = true;
        setConnected(true);
        setUsingBridge(bridgeMode);

        if (bridgeMode) {
          console.log('[NMEA Bridge] Connected (fallback mode)');
          return;
        }

        signalkFailures.current = 0;
        console.log('[SignalK] Connected');
        ws.current.send(
          JSON.stringify({
            context: 'vessels.self',
            subscribe: [
              { path: 'navigation.position', period: 1000 },
              { path: 'navigation.speedOverGround', period: 1000 },
              { path: 'navigation.courseOverGroundTrue', period: 1000 },
            ],
          }),
        );
      };

      ws.current.onmessage = bridgeMode
        ? (event) => {
            try {
              applyBridgePayload(JSON.parse(event.data));
            } catch {
              // ignore parse errors
            }
          }
        : handleSignalKMessage;

      ws.current.onclose = () => {
        setConnected(false);

        if (!bridgeMode) {
          if (!hadOpen.current) {
            signalkFailures.current += 1;
          }
          if (
            signalkFailures.current >= MAX_SIGNALK_FAILURES &&
            !useBridge.current
          ) {
            useBridge.current = true;
            console.log(
              `[SignalK] Unavailable after ${MAX_SIGNALK_FAILURES} attempts — switching to NMEA bridge on :${BRIDGE_PORT}`,
            );
            ws.current = null;
            connectRef.current?.();
            return;
          }
          console.log('[SignalK] Disconnected, retrying in 3s...');
        } else {
          console.log('[NMEA Bridge] Disconnected, retrying in 3s...');
        }

        scheduleReconnect();
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    } catch {
      if (!bridgeMode) {
        signalkFailures.current += 1;
        if (
          signalkFailures.current >= MAX_SIGNALK_FAILURES &&
          !useBridge.current
        ) {
          useBridge.current = true;
          connectRef.current?.();
          return;
        }
      }
      scheduleReconnect();
    }
  }, [
    applyBridgePayload,
    clearReconnect,
    handleSignalKMessage,
    scheduleReconnect,
  ]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      clearReconnect();
      ws.current?.close();
      ws.current = null;
    };
  }, [connect, clearReconnect]);

  return { position, sog, cog, connected, lastUpdate, usingBridge };
}
