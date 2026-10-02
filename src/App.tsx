// src/App.tsx
import { useState } from 'react';

import { Header } from './components/header/Header';
import { Home } from './views/Home/Home';
import { Upload } from './views/Upload/Upload';
import { UploadProvider } from './context/UploadContext';
import type { FlowMode } from './types/flow';
import './App.css';

function App() {
  const [currView, setCurrView] = useState<FlowMode>('HOME');

  return (
    <UploadProvider>
      <div className="app-viewport">
        {/* The entire arcade screen/box */}
        <div className="arcade-frame">
          <Header onNavigateHome={() => setCurrView('HOME')} />
          
          {/* Main scrollable view area */}
          <main className="arcade-content">
            {currView === 'HOME' && <Home onSelectMode={setCurrView} />}
            {currView === 'UPLOAD' && <Upload onSelectMode={setCurrView} />}
            {currView !== 'HOME' && currView !== 'UPLOAD' && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>Active Flow: {currView}</p>
                <button onClick={() => setCurrView('HOME')}>&lt; BACK</button>
              </div>
            )}
          </main>
        </div>
      </div>
    </UploadProvider>
  );
}

export default App;
