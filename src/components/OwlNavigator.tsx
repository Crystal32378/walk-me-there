import React, { useState } from 'react';
import { Bird, X, ChevronDown, ChevronUp, HelpCircle, CheckCircle2 } from 'lucide-react';
import type { NavData } from '../types/navigation';
import { STATE_MESSAGES, getHumanErrorMessage } from '../logic/stateMessages';
import { DiagnosticDashboard } from './DiagnosticDashboard';

interface Props {
  data: NavData | null;
  error: string | null;
}

const CONFUSED_RESPONSES: Record<string, string> = {
  '我現在到底面向哪裡？': '不用擔心！順著你的雙腳往前踏出三到五步，我就能為你抓準面向的角度。',
  '你說的是哪一個左轉？': '請先站在路口，看看前面有沒有最明顯的路標或轉角。我們要轉的是順著路網走的那一條。',
  '是這個路口嗎？': '如果是對的路口，順著路線走幾步後，我會告訴你「對，就是這個方向」。',
  '我覺得我走錯了。': '沒關係，請先停下腳步！如果真的走反或走偏，我會立刻提醒你並帶你折返。'
};

export const OwlNavigator: React.FC<Props> = ({ data, error }) => {
  const [showConfusedMenu, setShowConfusedMenu] = useState(false);
  const [activeResponse, setActiveResponse] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [imgError, setImgError] = useState(false);

  const getInstructions = () => {
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

  const handleConfusedOptionClick = (optionText: string) => {
    setActiveResponse(CONFUSED_RESPONSES[optionText] || '沒關係，先停下腳步，我陪你一起確認。');
  };

  const closeConfusedModal = () => {
    setShowConfusedMenu(false);
    setActiveResponse(null);
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
        <h2 className="main-instruction">{main}</h2>
        <p className="sub-instruction">{sub}</p>
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

      {/* Confused Modal / Bottom Sheet */}
      {showConfusedMenu && (
        <>
          <div className="modal-backdrop" onClick={closeConfusedModal} />
          <div className="bottom-sheet">
            <div className="sheet-header">
              <h3 className="sheet-title">小貓頭鷹聽你說</h3>
              <button className="sheet-close-btn" onClick={closeConfusedModal} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {!activeResponse ? (
              <div className="confused-options-grid">
                {Object.keys(CONFUSED_RESPONSES).map((option) => (
                  <button 
                    key={option}
                    className="confused-option-card"
                    onClick={() => handleConfusedOptionClick(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className="confused-response-box">
                <div className="response-icon-wrapper">
                  <CheckCircle2 size={32} className="text-amber-400" />
                </div>
                <p className="response-text">{activeResponse}</p>
                <button className="response-confirm-btn" onClick={closeConfusedModal}>
                  知道了
                </button>
              </div>
            )}
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
