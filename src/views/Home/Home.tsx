import React from 'react';
import type { FlowMode } from '../../types/flow';
import { FlowButton } from '../../components/buttons/FlowButton/FlowButton';
import styles from './Home.module.css';

// Your 4 custom pixel art PNGs
import msgBtn from '../../assets/btns/msg_btn_gbg.png';
import uploadBtn from '../../assets/btns/upload_btn_gbg.png';
import fileBtn from '../../assets/btns/file_btn_gbg.png';
import filmBtn from '../../assets/btns/film_btn_gbg.png';

interface HomeProps {
  onSelectMode: (mode: FlowMode) => void;
}

const BUTTON_CONFIGS = [
  { mode: 'CHAT' as FlowMode, src: msgBtn, alt: 'Agent Chat Studio' },
  { mode: 'UPLOAD' as FlowMode, src: uploadBtn, alt: 'Video Upload' },
  { mode: 'VAULT' as FlowMode, src: fileBtn, alt: 'Media Vault' },
  { mode: 'REEL' as FlowMode, src: filmBtn, alt: 'Saved Clips Reel' },
];

export const Home: React.FC<HomeProps> = ({ onSelectMode }) => {
  return (
    <div className={styles.homeContainer}>
      <h2 className={styles.heading}>&lt;SELECT OPERATIONAL MODE&gt;</h2>

      <div className={styles.buttonGrid}>
        {BUTTON_CONFIGS.map((btn) => (
          <FlowButton
            key={btn.mode}
            mode={btn.mode}
            imageSrc={btn.src}
            altText={btn.alt}
            onClick={onSelectMode}
          />
        ))}
      </div>
    </div>
  );
};