import { useState } from 'react';
import './App.css';
import { useNavigator } from './hooks/useNavigator';
import { useCompanion } from './hooks/useCompanion';
import { OwlNavigator } from './components/OwlNavigator';
import { showReplayBanner } from './hooks/simulatedWalk';
import { UI_TEXT } from './logic/stateMessages';
import type { Lang } from './logic/stateMessages';

function loadLang(): Lang {
  return localStorage.getItem('wmt-lang') === 'en' ? 'en' : 'zh';
}

// Voice is off until the user asks for it. That is both a courtesy (nobody
// wants a phone talking unprompted) and the browser's own requirement: the
// tap that turns it on is the user gesture that unlocks audio playback.
function loadVoice(): boolean {
  return localStorage.getItem('wmt-voice') === 'on';
}

function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const [voice, setVoice] = useState<boolean>(loadVoice);
  const { navData, error } = useNavigator();
  const companion = useCompanion(navData, lang, voice);

  const toggleLang = () => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('wmt-lang', next);
    setLang(next);
  };

  const toggleVoice = () => {
    const next = !voice;
    localStorage.setItem('wmt-voice', next ? 'on' : 'off');
    setVoice(next);
  };

  return (
    <div className="app-container">
      {showReplayBanner() && (
        <div className="sim-banner">
          Reproducible GPS replay — Gemini, Cloud Run and Firestore are live.
        </div>
      )}

      <header className="app-header">
        <h1 className="brand-title">Walk Me There</h1>
        <p className="brand-subtitle">{UI_TEXT[lang].brandSubtitle}</p>
        <div className="header-toggles">
          <button
            className={`voice-toggle-btn${voice ? ' is-on' : ''}`}
            onClick={toggleVoice}
            aria-label={voice ? 'Mute the owl' : 'Let the owl speak'}
            aria-pressed={voice}
          >
            {voice ? '🔊' : '🔇'}
          </button>
          <button
            className="lang-toggle-btn"
            onClick={toggleLang}
            aria-label="Switch language"
          >
            {lang === 'zh' ? 'English' : '中文'}
          </button>
        </div>
      </header>

      <main className="app-main">
        <OwlNavigator data={navData} error={error} companion={companion} lang={lang} />
      </main>
    </div>
  );
}

export default App;
