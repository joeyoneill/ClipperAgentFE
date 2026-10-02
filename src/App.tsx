// src/App.tsx
import { useState } from 'react';

import { Header } from './components/header/Header';
import { Home } from './views/Home/Home';
import { Upload } from './views/Upload/Upload';
import { UploadProvider, useUpload } from './context/UploadContext';
import type { FlowMode } from './types/flow';
import './App.css';

function ArcadeShell() {
    const [currView, setCurrView] = useState<FlowMode>('HOME');
    const { stage, progress, metadata } = useUpload();

    const showBackgroundBanner =
        currView !== 'UPLOAD' &&
        (stage === 'INITIALIZING' ||
            stage === 'UPLOADING' ||
            stage === 'PAUSED' ||
            stage === 'FINALIZING');

    return (
        <div className="app-viewport">
            {/* The entire arcade screen/box */}
            <div className="arcade-frame">
                <Header onNavigateHome={() => setCurrView('HOME')} />

                {/* Clickable status ticker when uploading in background */}
                {showBackgroundBanner && (
                    <div
                        onClick={() => setCurrView('UPLOAD')}
                        style={{
                            background: '#1c1b1b',
                            borderBottom: '2px solid var(--google-green)',
                            padding: '0.5rem 1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            fontFamily: "'PixelLife', monospace",
                            color: 'var(--subtitle-yellow)',
                            fontSize: '0.95rem',
                        }}
                    >
                        <span>
                            ▲ BG TRANSFER [{stage}]: {metadata?.filename}
                        </span>
                        <span>{progress.percentage.toFixed(1)}% — [CLICK TO INSPECT]</span>
                    </div>
                )}

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
    );
}

function App() {
    return (
        <UploadProvider>
            <ArcadeShell />
        </UploadProvider>
    );
}

export default App;