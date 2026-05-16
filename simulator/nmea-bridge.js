#!/usr/bin/env node
'use strict';

/**
 * Fallback when Signal K is not running: TCP client on NMEA :10110,
 * WebSocket JSON broadcast on :3001 for useSignalK bridge mode.
 * Do not run alongside signalk-server (port 3001 may be in use in older configs).
 */
const net = require('net');
const { WebSocketServer } = require('ws');

const TCP_HOST = process.env.NMEA_HOST || 'localhost';
const TCP_PORT = Number(process.env.NMEA_PORT || 10110);
const WS_PORT = Number(process.env.BRIDGE_PORT || 3001);

const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

wss.on('listening', () => {
  console.log('🌉  SeaPark NMEA Bridge (fallback)');
  console.log(`   TCP: ${TCP_HOST}:${TCP_PORT} (NMEA simulator)`);
  console.log(`   WebSocket: ws://localhost:${WS_PORT}`);
  console.log('   Dashboard useSignalK connects here when Signal K is unavailable');
  console.log('');
  connectTcp();
});

function parseNMEA(value, dir) {
  const deg = Math.floor(parseFloat(value) / 100);
  const min = parseFloat(value) - deg * 100;
  const decimal = deg + min / 60;
  return dir === 'S' || dir === 'W' ? -decimal : decimal;
}

function parseGPRMC(sentence) {
  const parts = sentence.split(',');
  if (parts[0] !== '$GPRMC' || parts[2] !== 'A') return null;
  const lat = parseNMEA(parts[3], parts[4]);
  const lng = parseNMEA(parts[5], parts[6]);
  const sog = parseFloat(parts[7]) || 0;
  const cog = parseFloat(parts[8]) || 0;
  return { lat, lng, sog, cog, ts: Date.now() };
}

function broadcast(pos) {
  const payload = JSON.stringify(pos);
  for (const client of clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

function connectTcp() {
  const tcp = net.createConnection(TCP_PORT, TCP_HOST);

  tcp.on('connect', () => {
    console.log(`   Connected to NMEA simulator on ${TCP_HOST}:${TCP_PORT}`);
  });

  tcp.on('data', (data) => {
    data
      .toString()
      .split(/\r?\n/)
      .forEach((line) => {
        if (!line.startsWith('$GPRMC')) return;
        const pos = parseGPRMC(line);
        if (pos) broadcast(pos);
      });
  });

  tcp.on('close', () => {
    console.log('   NMEA TCP closed — reconnecting in 3s...');
    setTimeout(connectTcp, 3000);
  });

  tcp.on('error', (err) => {
    console.log(`   NMEA TCP error: ${err.message} — retry in 3s...`);
    tcp.destroy();
    setTimeout(connectTcp, 3000);
  });
}
