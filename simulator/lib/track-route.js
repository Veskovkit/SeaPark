'use strict';

const fs = require('fs');

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLng = toRad(lng2 - lng1);
  const y = Math.sin(deltaLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function haversineNm(lat1, lng1, lat2, lng2) {
  return haversineM(lat1, lng1, lat2, lng2) / 1852;
}

function densifyRoute(waypoints, maxLegKm = 0.35) {
  const out = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const legKm = haversineM(a.lat, a.lng, b.lat, b.lng) / 1000;
    const steps = Math.max(1, Math.ceil(legKm / maxLegKm));
    for (let k = 0; k < steps; k += 1) {
      const t = (k + 1) / steps;
      const isFirst = i === 0 && k === 0;
      const isLast = k === steps - 1;
      out.push({
        name: isFirst ? a.name : isLast ? b.name : `${a.name} -> ${b.name}`,
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        durationSeconds: Math.max(2, Math.round(a.durationSeconds / steps)),
        ...(isFirst && a.note ? { note: a.note } : {}),
        ...(isLast && b.note ? { note: b.note } : {}),
      });
    }
  }
  return out;
}

function normalizeCoord(c) {
  if (c.lat != null && c.lng != null) return { lat: c.lat, lng: c.lng };
  if (Array.isArray(c)) return { lat: c[0], lng: c[1] };
  throw new Error('Invalid coordinate');
}

function loadRoute(routePath) {
  const data = JSON.parse(fs.readFileSync(routePath, 'utf8'));

  if (data.coordinates && Array.isArray(data.coordinates)) {
    const points = data.coordinates.map(normalizeCoord);
    if (points.length < 2) {
      throw new Error('Track must have at least 2 coordinates');
    }
    return {
      mode: 'track',
      points,
      sogKnots: data.sogKnots ?? 4.5,
      dwells: data.dwells ?? [],
      turnaround: data.turnaround ?? null,
      label: data.name ?? 'demo track',
    };
  }

  if (Array.isArray(data) && data.length >= 2) {
    return {
      mode: 'legacy',
      waypoints: densifyRoute(data),
      label: 'legacy waypoints',
    };
  }

  throw new Error('Route file must be a track object or waypoint array');
}

function buildCumulativeDistances(points) {
  const cumDist = [0];
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i - 1];
    const c = points[i];
    cumDist.push(cumDist[i - 1] + haversineM(p.lat, p.lng, c.lat, c.lng));
  }
  return cumDist;
}

function interpolateAt(points, cumDist, distanceM) {
  const total = cumDist[cumDist.length - 1];
  const d = Math.max(0, Math.min(distanceM, total));
  let i = 0;
  while (i < cumDist.length - 2 && cumDist[i + 1] < d) i += 1;
  const segLen = cumDist[i + 1] - cumDist[i];
  const t = segLen > 0 ? (d - cumDist[i]) / segLen : 0;
  const a = points[i];
  const b = points[i + 1];
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

function clampAngleDelta(deg) {
  let d = ((deg + 540) % 360) - 180;
  return d;
}

function applyTurnRate(rawCog, lastCog, maxDegPerTick) {
  const delta = clampAngleDelta(rawCog - lastCog);
  const limited = Math.max(-maxDegPerTick, Math.min(maxDegPerTick, delta));
  return (lastCog + limited + 360) % 360;
}

function closestDistanceOnTrack(points, cumDist, lat, lng) {
  let bestSep = Infinity;
  let bestDistM = 0;
  for (let i = 0; i < points.length; i += 1) {
    const sep = haversineM(lat, lng, points[i].lat, points[i].lng);
    if (sep < bestSep) {
      bestSep = sep;
      bestDistM = cumDist[i];
    }
  }
  return { distanceM: bestDistM, separationM: bestSep };
}

function metersPerDegLat() {
  return 111000;
}

function metersPerDegLng(lat) {
  return 111000 * Math.cos((lat * Math.PI) / 180);
}

function offsetMeters(lat, lng, northM, eastM) {
  return {
    lat: lat + northM / metersPerDegLat(),
    lng: lng + eastM / metersPerDegLng(lat),
  };
}

function moveAlongCog(lat, lng, cogDeg, distanceM) {
  const cogRad = (cogDeg * Math.PI) / 180;
  return offsetMeters(
    lat,
    lng,
    Math.cos(cogRad) * distanceM,
    Math.sin(cogRad) * distanceM,
  );
}

function createTrackFollower(track, callbacks = {}) {
  const { points, sogKnots, dwells, turnaround } = track;
  const cumDist = buildCumulativeDistances(points);
  const totalM = cumDist[cumDist.length - 1];
  const turnaroundDistM = turnaround
    ? closestDistanceOnTrack(points, cumDist, turnaround.lat, turnaround.lng)
        .distanceM
    : null;

  let distanceM = 0;
  let direction = 1;
  let dwellUntil = 0;
  const dwellTriggered = new Set();
  let lastCog = null;
  let phase = turnaround ? 'forward' : 'forward';
  let turnDistM = turnaroundDistM;
  let southEnd = null;
  let southProgressM = 0;
  let turnPos = null;
  let uturnRotDeg = 0;
  let offPos = null;

  function speedMps(speedMult, scale = 1) {
    return ((sogKnots * 0.514444) / 1000) * speedMult * scale;
  }

  function beginSouthLeg(pos) {
    phase = 'south';
    southEnd = { lat: pos.lat, lng: pos.lng };
    southProgressM = 0;
    turnPos = null;
    uturnRotDeg = 0;
    offPos = { lat: pos.lat, lng: pos.lng };
    lastCog = 180;
    callbacks.onTurn?.('south');
  }

  function trackTangentCog(dist, dir, speedMult, deltaMs) {
    const tangentM = 30;
    const pos = interpolateAt(points, cumDist, dist);
    const behind = interpolateAt(
      points,
      cumDist,
      Math.max(0, Math.min(totalM, dist - dir * tangentM)),
    );
    const ahead = interpolateAt(
      points,
      cumDist,
      Math.max(0, Math.min(totalM, dist + dir * tangentM)),
    );
    const rawCog = bearingDeg(behind.lat, behind.lng, ahead.lat, ahead.lng);
    const dtSec = deltaMs / 1000;
    let maxTurn = 22 * dtSec * speedMult;
    if (lastCog != null) {
      const lag = Math.abs(clampAngleDelta(rawCog - lastCog));
      if (lag > 45) maxTurn = Math.max(maxTurn, lag * 0.35);
    }
    if (lastCog == null) lastCog = rawCog;
    else lastCog = applyTurnRate(rawCog, lastCog, Math.max(6, maxTurn));
    return { pos, cog: lastCog };
  }

  function step(deltaMs, speedMult = 1) {
    if (phase === 'stopped') {
      const start = points[0];
      return {
        lat: start.lat,
        lng: start.lng,
        sog: 0,
        cog: lastCog ?? 0,
        phase,
      };
    }

    if (phase === 'south' || phase === 'uturn') {
      const southM = turnaround.southM ?? 250;
      const turnRateMult = Math.min(Math.sqrt(speedMult) * 2.2, 14);
      const turnRate =
        (turnaround.turnRateDegPerSec ?? 4) *
        (deltaMs / 1000) *
        turnRateMult;
      const uturnDegrees = turnaround.uturnDegrees ?? 275;
      const turnSog =
        sogKnots * speedMult * (turnaround.turnSpeedRatio ?? 0.45);

      if (phase === 'south') {
        const stepM = speedMps(speedMult) * deltaMs;
        southProgressM = Math.min(southM, southProgressM + stepM);
        offPos = offsetMeters(southEnd.lat, southEnd.lng, -southProgressM, 0);
        lastCog = 180;
        if (southProgressM >= southM) {
          phase = 'uturn';
          turnPos = { lat: offPos.lat, lng: offPos.lng };
          uturnRotDeg = 0;
          lastCog = 180;
          callbacks.onTurn?.('uturn');
        }
        return {
          lat: offPos.lat,
          lng: offPos.lng,
          sog: sogKnots * speedMult * 0.8,
          cog: lastCog,
          phase,
        };
      }

      const stepM = (turnSog * 0.514444 * deltaMs) / 1000;
      uturnRotDeg = Math.min(uturnDegrees, uturnRotDeg + turnRate);
      lastCog = (180 + uturnRotDeg) % 360;
      turnPos = moveAlongCog(turnPos.lat, turnPos.lng, lastCog, stepM);
      offPos = turnPos;

      if (uturnRotDeg >= uturnDegrees - 2) {
        phase = 'reverse';
        direction = -1;
        distanceM = turnDistM;
        turnPos = null;
        callbacks.onTurn?.('reverse');
        const pos = interpolateAt(points, cumDist, distanceM);
        return {
          lat: pos.lat,
          lng: pos.lng,
          sog: sogKnots * speedMult,
          cog: lastCog,
          phase,
        };
      }

      return {
        lat: offPos.lat,
        lng: offPos.lng,
        sog: turnSog,
        cog: lastCog,
        phase,
      };
    }

    const atDist = interpolateAt(points, cumDist, distanceM);

    if (dwellUntil > Date.now()) {
      return {
        lat: atDist.lat,
        lng: atDist.lng,
        sog: 0,
        cog: lastCog ?? 0,
        phase,
      };
    }

    if (phase === 'forward') {
      for (const d of dwells) {
        const key = d.name ?? `${d.lat},${d.lng}`;
        if (dwellTriggered.has(key)) continue;
        if (
          haversineM(atDist.lat, atDist.lng, d.lat, d.lng) <= (d.radiusM ?? 100)
        ) {
          dwellTriggered.add(key);
          dwellUntil = Date.now() + (d.seconds ?? 30) * 1000;
          callbacks.onDwell?.(d);
          return {
            lat: atDist.lat,
            lng: atDist.lng,
            sog: 0,
            cog: lastCog ?? 0,
            phase,
          };
        }
      }
    }

    distanceM += direction * speedMps(speedMult) * deltaMs;

    if (turnaround && phase === 'forward' && distanceM >= turnDistM) {
      distanceM = turnDistM;
      const pos = interpolateAt(points, cumDist, distanceM);
      beginSouthLeg(pos);
      return {
        lat: pos.lat,
        lng: pos.lng,
        sog: sogKnots * speedMult,
        cog: lastCog,
        phase: 'south',
      };
    }

    if (turnaround && phase === 'reverse') {
      if (distanceM <= 0) {
        distanceM = 0;
        phase = 'stopped';
        const start = points[0];
        callbacks.onTurn?.('stopped');
        return {
          lat: start.lat,
          lng: start.lng,
          sog: 0,
          cog: lastCog ?? 0,
          phase,
        };
      }
    } else if (!turnaround) {
      if (distanceM >= totalM) {
        distanceM = totalM;
        direction = -1;
        dwellTriggered.clear();
        callbacks.onTurn?.('reverse');
      } else if (distanceM <= 0) {
        distanceM = 0;
        direction = 1;
        dwellTriggered.clear();
        callbacks.onTurn?.('forward');
      }
    }

    const { pos, cog } = trackTangentCog(
      distanceM,
      direction,
      speedMult,
      deltaMs,
    );
    lastCog = cog;

    return {
      lat: pos.lat,
      lng: pos.lng,
      sog: sogKnots * speedMult,
      cog: lastCog,
      phase,
    };
  }

  return {
    step,
    pointCount: points.length,
    totalKm: totalM / 1000,
    hasTurnaround: Boolean(turnaround),
  };
}

function createLegacyFollower(waypoints) {
  let segmentIndex = 0;
  let segmentDirection = 1;
  let segmentElapsedMs = 0;

  function step(deltaMs, speedMult = 1) {
    const toIndex = segmentIndex + segmentDirection;
    const from = waypoints[segmentIndex];
    const to = waypoints[toIndex];
    const durationMs = from.durationSeconds * 1000;
    segmentElapsedMs += deltaMs * speedMult;
    const t = Math.min(segmentElapsedMs / durationMs, 1);

    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;

    if (t >= 1) {
      segmentIndex = toIndex;
      segmentElapsedMs = 0;
      if (segmentDirection === 1 && segmentIndex >= waypoints.length - 1) {
        segmentDirection = -1;
      } else if (segmentDirection === -1 && segmentIndex <= 0) {
        segmentDirection = 1;
      }
    }

    const distNm = haversineNm(from.lat, from.lng, to.lat, to.lng);
    const sog =
      from.durationSeconds > 0 ? distNm / (from.durationSeconds / 3600) : 0;

    return { lat, lng, sog, cog: bearingDeg(lat, lng, to.lat, to.lng) };
  }

  return { step, pointCount: waypoints.length };
}

module.exports = {
  loadRoute,
  createTrackFollower,
  createLegacyFollower,
};
