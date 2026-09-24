import React from 'react';
import styles from './Header.module.css';

// Exact Google sequence: Blue, Red, Yellow, Blue, Green, Red
const GOOGLE_COLOR_SEQUENCE = [
  'var(--google-blue)',
  'var(--google-red)',
  'var(--google-yellow)',
  'var(--google-blue)',
  'var(--google-green)',
  'var(--google-red)',
] as const;

interface GoogleColoredTextProps {
  text: string;
}

export const GoogleColoredText: React.FC<GoogleColoredTextProps> = ({ text }) => {
  let colorIndex = 0;

  return (
    <span className={styles.coloredWrapper}>
      {Array.from(text).map((char, i) => {
        if (char === ' ') {
          // Preserve spaces without advancing the color sequence
          return <span key={i}>&nbsp;</span>;
        }

        const color = GOOGLE_COLOR_SEQUENCE[colorIndex % GOOGLE_COLOR_SEQUENCE.length];
        colorIndex++;

        return (
          <span key={i} style={{ color }}>
            {char}
          </span>
        );
      })}
    </span>
  );
};

export interface HeaderProps{
  onNavigateHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigateHome }) => {
  return (
    <header className={styles.header}>
      <div 
        className={styles.logoContainer}
        onClick={onNavigateHome}
      >
        <span className={styles.logoText}>
          <GoogleColoredText text="Clipper Agent" />
        </span>
      </div>
      <div className={styles.actionsContainer}>
      </div>
    </header>
  );
};