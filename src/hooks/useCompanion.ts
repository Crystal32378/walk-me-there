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
const TURN_TIMEOUT_MS = 24000;

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

export function useCompanion(navData: NavData | null, lang: Lang = 'zh', voice = false) {
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
  const navDataRef = useRef<NavData | null>(null);
  navDataRef.current = navData;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Voice is presentation only: it never gates, delays or alters the text.
  const stopSpeaking = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    audioRef.current = null;
    el.pause();
    // Detach the source without assigning '' — that would resolve against the
    // page URL and fire a spurious media error.
    el.removeAttribute('src');
    el.load();
  }, []);

  // Audio arrives seconds after the guidance was requested. By then the walker
  // may already have turned around. Speaking a stale instruction is worse than
  // silence, so the engine state at arrival time decides - the same state the
  // screen is showing, no new judgement of our own.
  const speak = useCallback(
    (audio: unknown, stillValid: () => boolean) => {
      if (!voiceRef.current || typeof audio !== 'string' || !audio) return;
      if (!stillValid()) return;
      stopSpeaking(); // the newest utterance interrupts the previous one
      try {
        const el = new Audio(`data:audio/wav;base64,${audio}`);
        audioRef.current = el;
        // An autoplay refusal or a decode failure stays silent: text carries on.
        void el.play().catch(() => {});
      } catch {
        // no audio support in this browser - text-only, as designed
      }
    },
    [stopSpeaking]
  );

  useEffect(() => {
    if (!voice) stopSpeaking();
  }, [voice, stopSpeaking]);

  useEffect(() => stopSpeaking, [stopSpeaking]);

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
        // Identity of this recovery episode: `recoverySince` is nulled the
        // moment the walker leaves a recovery state, so a later episode can
        // never be mistaken for this one.
        const requestedState = state;
        const requestedSince = recoverySince.current;
        postTurn({
          deviceId: deviceId.current,
          event: 'recovery_needed',
          navSnapshot: navData,
          lang: langRef.current,
          voice: voiceRef.current,
        }).then((res) => {
          inFlight.current = false;
          setThinking(false);
          if (res && typeof res.episodeId === 'string') {
            episodeId.current = res.episodeId;
          }
          if (res && res.source === 'gemini' && res.speech) {
            setSpeech(res.speech as CompanionSpeech);
            speak(
              res.audio,
              () =>
                recoverySince.current === requestedSince &&
                navDataRef.current?.state === requestedState
            );
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
          stopSpeaking();
          setSpeech(null);
          setMemoryUpdated(false);
        }
      }
    } else {
      recoverySince.current = null;
      stableOnRouteSince.current = null;
    }
  }, [navData, speak, stopSpeaking]);

  const askOwl = useCallback(async (message: string): Promise<CompanionSpeech | null> => {
    setThinking(true);
    const res = await postTurn({
      deviceId: deviceId.current,
      event: 'user_message',
      episodeId: episodeId.current,
      message,
      lang: langRef.current,
      // Raw observations — the server recomputes engine facts from these so
      // geographic questions get truthful, engine-grounded answers.
      navSnapshot: navDataRef.current ?? undefined,
      voice: voiceRef.current,
    });
    setThinking(false);
    if (res && res.speech) {
      const s = res.speech as CompanionSpeech;
      setSpeech(s);
      // A direct answer is never stale by navigation state - it answers what
      // the walker just asked. It is dropped only if the voice went off.
      speak(res.audio, () => true);
      if (res.memoryUpdated === true) setMemoryUpdated(true);
      return s;
    }
    return null;
  }, [speak]);

  return { speech, thinking, memoryUpdated, askOwl };
}
