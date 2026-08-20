import React, { useState } from 'react';
import { Bird, X, ChevronDown, ChevronUp, HelpCircle, CheckCircle2 } from 'lucide-react';
import type { NavData } from '../types/navigation';
import { STATE_MESSAGES, getHumanErrorMessage } from '../logic/stateMessages';
import { DiagnosticDashboard } from './DiagnosticDashboard';

interface Props {
  data: NavData | null;
  error: string | null;
  errorCode: number | null;
}

const CONFUSED_RESPONSES: Record<string, string> = {
  '我現在到底面向哪裡？': '你站著不動時，我不一定能可靠知道面向。先安全地走三到五步；如果裝置提供可信的移動方向，我再幫你判斷。',
  '你說的是哪一個左轉？': '我現在還沒有路網或路口資料，所以不能可靠地指出哪一條左轉。先不要照我猜。',
  '是這個路口嗎？': '我目前不能辨認你是不是在正確路口；現在只能看你和測試路線的相對位置與移動方向。',
  '我覺得我走錯了。': '先停一下。我可以檢查你是否偏離目前路線；如果裝置提供可信的移動方向，也能判斷是否走反。'
};

export const OwlNavigator: React.FC<Props> = ({ data, error, errorCode }) => {
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
      const humanErr = getHumanErrorMessage(errorCode);
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
