import { useState, useEffect, useRef, useCallback } from 'react';
import type { NavData } from '../types/navigation';
import type { Lang } from '../logic/stateMessages';

export interface CompanionSpeech {
  main: string;
  sub: string;
}

// The deterministic engine decides WHEN the companion is needed:
// only a debounced, engine-confirmed recovery state wakes the agent,
// and only a stable return to ON_ROUTE closes the episode.
const RECOVERY_DEBOUNCE_MS = 2500;
const RECOVERED_STABLE_MS = 5000;
const TURN_TIMEOUT_MS = 15000;

function getDeviceId(): string {
  const KEY = 'wmt-device-id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function postTurn(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);
  try {
    const res = await fetch('/api/companion/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function useCompanion(navData: NavData | null, lang: Lang = 'zh') {
  const [speech, setSpeech] = useState<CompanionSpeech | null>(null);
  const [thinking, setThinking] = useState(false);
  const [memoryUpdated, setMemoryUpdated] = useState(false);

  const deviceId = useRef<string>('');
  const episodeId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const recoverySince = useRef<number | null>(null);
  const stableOnRouteSince = useRef<number | null>(null);
  const langRef = useRef<Lang>(lang);
  langRef.current = lang;

  useEffect(() => {
    deviceId.current = getDeviceId();
  }, []);

  useEffect(() => {
    if (!navData) return;
    const state = navData.state;
    const now = Date.now();

    if (state === 'WRONG_DIRECTION' || state === 'OFF_ROUTE') {
      stableOnRouteSince.current = null;
      if (recoverySince.current === null) recoverySince.current = now;

      const heldLongEnough = now - recoverySince.current >= RECOVERY_DEBOUNCE_MS;
      if (heldLongEnough && episodeId.current === null && !inFlight.current) {
        inFlight.current = true;
        setThinking(true);
        postTurn({
          deviceId: deviceId.current,
          event: 'recovery_needed',
          navSnapshot: navData,
          lang: langRef.current,
        }).then((res) => {
          inFlight.current = false;
          setThinking(false);
          if (res && typeof res.episodeId === 'string') {
            episodeId.current = res.episodeId;
          }
          if (res && res.source === 'gemini' && res.speech) {
            setSpeech(res.speech as CompanionSpeech);
          }
          // On fallback/null the static state message stays on screen.
        });
      }
    } else if (state === 'ON_ROUTE') {
      recoverySince.current = null;
      if (episodeId.current !== null) {
        if (stableOnRouteSince.current === null) stableOnRouteSince.current = now;
        if (now - stableOnRouteSince.current >= RECOVERED_STABLE_MS) {
          // The deterministic engine — not the model — certifies the recovery.
          postTurn({
            deviceId: deviceId.current,
            event: 'recovered',
            episodeId: episodeId.current,
          });
          episodeId.current = null;
          stableOnRouteSince.current = null;
          setSpeech(null);
          setMemoryUpdated(false);
        }
      }
    } else {
      recoverySince.current = null;
      stableOnRouteSince.current = null;
    }
  }, [navData]);

  const askOwl = useCallback(async (message: string): Promise<CompanionSpeech | null> => {
    setThinking(true);
    const res = await postTurn({
      deviceId: deviceId.current,
      event: 'user_message',
      episodeId: episodeId.current,
      message,
      lang: langRef.current,
    });
    setThinking(false);
    if (res && res.speech) {
      const s = res.speech as CompanionSpeech;
      setSpeech(s);
      if (res.memoryUpdated === true) setMemoryUpdated(true);
      return s;
    }
    return null;
  }, []);

  return { speech, thinking, memoryUpdated, askOwl };
}
