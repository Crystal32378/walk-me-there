import React, { useState } from 'react';
import { Bird, X, ChevronDown, ChevronUp, HelpCircle, Feather } from 'lucide-react';
import type { NavData } from '../types/navigation';
import { getStateMessage, getHumanErrorMessage, UI_TEXT } from '../logic/stateMessages';
import type { Lang } from '../logic/stateMessages';
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
  lang: Lang;
}

export const OwlNavigator: React.FC<Props> = ({ data, error, companion, lang }) => {
  const [showConfusedMenu, setShowConfusedMenu] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [sending, setSending] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [imgError, setImgError] = useState(false);

  const t = UI_TEXT[lang];

  const getInstructions = () => {
    // The companion's live guidance takes over the dialogue when present;
    // the engine's static state message is always the fallback.
    if (companion.speech && data && !error) {
      const staticMsg = getStateMessage(data.state, lang);
      return {
        main: companion.speech.main,
        sub: companion.speech.sub,
        glowClass: staticMsg.glowClass,
      };
    }

    if (error) {
      if (data) {
        return {
          main: t.weakSignalMain,
          sub: t.weakSignalSub,
          glowClass: 'glow-uncertain'
        };
      }
      const humanErr = getHumanErrorMessage(error, lang);
      return {
        main: humanErr.main,
        sub: humanErr.sub,
        glowClass: 'glow-uncertain'
      };
    }

    if (!data) {
      return {
        main: t.acquiringMain,
        sub: t.acquiringSub,
        glowClass: 'glow-uncertain'
      };
    }

    return getStateMessage(data.state, lang);
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
          {companion.thinking || sending ? t.thinking : main}
        </h2>
        <p className="sub-instruction">{companion.thinking || sending ? '' : sub}</p>
        {companion.memoryUpdated && (
          <p className="memory-badge" aria-live="polite">
            <Feather size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
            {' '}{t.memoryBadge}
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
              <h3 className="sheet-title">{t.sheetTitle}</h3>
              <button className="sheet-close-btn" onClick={() => setShowConfusedMenu(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="confused-options-grid">
              {t.confusedPrompts.map((option) => (
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
                placeholder={t.freeTextPlaceholder}
                onChange={(e) => setFreeText(e.target.value)}
                disabled={sending}
                maxLength={200}
              />
              <button className="response-confirm-btn" type="submit" disabled={sending || !freeText.trim()}>
                {sending ? '⋯' : t.sendButton}
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
