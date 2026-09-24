// src/App.tsx
import { useState } from 'react';

import { Header } from './components/header/Header';
import { Home } from './views/Home/Home';
import type { FlowMode } from './types/flow';
import './App.css';

function App() {
  const [currView, setCurrView] = useState<FlowMode>('HOME');

  return (
    <div className="app-viewport">
      {/* The entire arcade screen/box */}
      <div className="arcade-frame">
        <Header onNavigateHome={() => setCurrView('HOME')} />
        
        {/* Main scrollable view area */}
        <main className="arcade-content">
          {currView === 'HOME' && <Home onSelectMode={setCurrView} />}
          {currView !== 'HOME' && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Active Flow: {currView}</p>
              <button onClick={() => setCurrView('HOME')}>&lt; BACK</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
