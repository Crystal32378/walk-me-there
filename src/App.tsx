import './App.css';
import { useNavigator } from './hooks/useNavigator';
import { OwlNavigator } from './components/OwlNavigator';

function App() {
  const { navData, error } = useNavigator();

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="brand-title">Walk Me There</h1>
        <p className="brand-subtitle">Your little owl knows the way.</p>
      </header>

      <main className="app-main">
        <OwlNavigator data={navData} error={error} />
      </main>
    </div>
  );
}

export default App;

