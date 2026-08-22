import React, { useState } from 'react';
import { Bird, X, ChevronDown, ChevronUp, HelpCircle, Feather } from 'lucide-react';
import type { NavData } from '../types/navigation';
import { STATE_MESSAGES, getHumanErrorMessage } from '../logic/stateMessages';
import { DiagnosticDashboard } from './DiagnosticDashboard';
import type { CompanionSpeech } from '../hooks/useCompanion';

interface Companion {
  speech: CompanionSpeech | null;
  thinking: boolean;
  memoryUpdated: boolean;
  askOwl: (message: string) => Promise<CompanionSpeech | null>;
}

interface Props {
  data: NavData | null;
  error: string | null;
  companion: Companion;
}

// Quick-tap openers for the dialogue — the answers come from the agent, not a table.
const CONFUSED_PROMPTS = [
  '我現在到底面向哪裡？',
  '你說的是哪一個左轉？',
  '是這個路口嗎？',
  '我分不清東西南北。',
];

export const OwlNavigator: React.FC<Props> = ({ data, error, companion }) => {
  const [showConfusedMenu, setShowConfusedMenu] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [sending, setSending] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [imgError, setImgError] = useState(false);

  const getInstructions = () => {
    // The companion's live guidance takes over the dialogue when present;
    // the engine's static state message is always the fallback.
    if (companion.speech && data && !error) {
      const staticMsg = STATE_MESSAGES[data.state];
      return {
        main: companion.speech.main,
        sub: companion.speech.sub,
        glowClass: staticMsg.glowClass,
      };
    }

    if (error) {
      if (data) {
        return {
          main: '我暫時看不清楚你的位置，再等我一下。',
          sub: '訊號有點弱，我們正在重新抓取。',
          glowClass: 'glow-uncertain'
        };
      }
      const humanErr = getHumanErrorMessage(error);
      return {
        main: humanErr.main,
        sub: humanErr.sub,
        glowClass: 'glow-uncertain'
      };
    }

    if (!data) {
      return {
        main: '正在尋找你的位置...',
        sub: '小貓頭鷹正在睜開眼睛看路。',
        glowClass: 'glow-uncertain'
      };
    }

    return STATE_MESSAGES[data.state];
  };

  const { main, sub, glowClass } = getInstructions();

  const sendToOwl = async (message: string) => {
    if (!message.trim() || sending) return;
    setSending(true);
    await companion.askOwl(message.trim());
    setSending(false);
    setFreeText('');
    setShowConfusedMenu(false);
  };

  return (
    <div className="owl-companion-stage">
      {/* Ambient Companion Backlight Aura */}
      <div className={`companion-aura ${glowClass}`} />

      {/* Living Owl Companion Presence (No Circle Box Frame) */}
      <div className={`companion-character ${glowClass}`}>
        {!imgError ? (
          <img
            src="/owl.png"
            alt="Owl Companion"
            className="companion-image"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="companion-fallback">
            <Bird size={120} strokeWidth={1.2} className="text-amber-300" />
          </div>
        )}
      </div>

      {/* Direct Companion Speech / Instruction (No Card Container) */}
      <div className="companion-dialogue">
        <h2 className="main-instruction">
          {companion.thinking || sending ? '小貓頭鷹想了一下⋯' : main}
        </h2>
        <p className="sub-instruction">{companion.thinking || sending ? '' : sub}</p>
        {companion.memoryUpdated && (
          <p className="memory-badge" aria-live="polite">
            <Feather size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
            {' '}小貓頭鷹記住了你理解方向的方式
          </p>
        )}
      </div>

      {/* Main Action: I'm confused */}
      <button
        className="confused-action-btn"
        onClick={() => setShowConfusedMenu(true)}
        aria-label="I am confused"
      >
        <HelpCircle size={20} className="mr-2" />
        <span>I'm confused</span>
      </button>

      {/* Confused Modal / Bottom Sheet — a real dialogue with the companion */}
      {showConfusedMenu && (
        <>
          <div className="modal-backdrop" onClick={() => setShowConfusedMenu(false)} />
          <div className="bottom-sheet">
            <div className="sheet-header">
              <h3 className="sheet-title">小貓頭鷹聽你說</h3>
              <button className="sheet-close-btn" onClick={() => setShowConfusedMenu(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="confused-options-grid">
              {CONFUSED_PROMPTS.map((option) => (
                <button
                  key={option}
                  className="confused-option-card"
                  onClick={() => sendToOwl(option)}
                  disabled={sending}
                >
                  {option}
                </button>
              ))}
            </div>

            <form
              className="owl-free-text-row"
              onSubmit={(e) => {
                e.preventDefault();
                sendToOwl(freeText);
              }}
            >
              <input
                className="owl-free-text-input"
                type="text"
                value={freeText}
                placeholder="或者，直接跟牠說⋯"
                onChange={(e) => setFreeText(e.target.value)}
                disabled={sending}
                maxLength={200}
              />
              <button className="response-confirm-btn" type="submit" disabled={sending || !freeText.trim()}>
                {sending ? '⋯' : '說'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Deeply Collapsed Developer Diagnostics */}
      <div className="quiet-developer-trigger">
        <button
          className="quiet-toggle-btn"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          aria-expanded={showDiagnostics}
        >
          {showDiagnostics ? (
            <><ChevronUp size={14} /> Close Diagnostics</>
          ) : (
            <><ChevronDown size={14} /> Diagnostics</>
          )}
        </button>

        {showDiagnostics && (
          <div className="diagnostics-drawer-body">
            {error && (
              <div className="raw-error-banner">
                <span className="font-semibold">Raw Error:</span> {error}
              </div>
            )}
            {data ? (
              <DiagnosticDashboard data={data} />
            ) : (
              <p className="no-data-notice">Waiting for GPS stream...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
