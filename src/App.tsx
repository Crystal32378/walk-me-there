import { useState } from 'react';
import './App.css';
import { useNavigator } from './hooks/useNavigator';
import { useCompanion } from './hooks/useCompanion';
import { OwlNavigator } from './components/OwlNavigator';
import { isSimMode } from './hooks/simulatedWalk';
import { UI_TEXT } from './logic/stateMessages';
import type { Lang } from './logic/stateMessages';

function loadLang(): Lang {
  return localStorage.getItem('wmt-lang') === 'en' ? 'en' : 'zh';
}

function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const { navData, error } = useNavigator();
  const companion = useCompanion(navData, lang);

  const toggleLang = () => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('wmt-lang', next);
    setLang(next);
  };

  return (
    <div className="app-container">
      {isSimMode() && (
        <div className="sim-banner">
          Reproducible GPS replay — Gemini, Cloud Run and Firestore are live.
        </div>
      )}

      <header className="app-header">
        <h1 className="brand-title">Walk Me There</h1>
        <p className="brand-subtitle">{UI_TEXT[lang].brandSubtitle}</p>
        <button
          className="lang-toggle-btn"
          onClick={toggleLang}
          aria-label="Switch language"
        >
          {lang === 'zh' ? 'English' : '中文'}
        </button>
      </header>

      <main className="app-main">
        <OwlNavigator data={navData} error={error} companion={companion} lang={lang} />
      </main>
    </div>
  );
}

export default App;
