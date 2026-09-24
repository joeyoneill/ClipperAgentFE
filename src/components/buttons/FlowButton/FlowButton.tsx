import React from 'react';
import type { FlowMode } from '../../../types/flow';
import styles from './FlowButton.module.css';

interface FlowButtonProps {
  mode: FlowMode;
  imageSrc: string;
  altText: string;
  onClick: (mode: FlowMode) => void;
}

export const FlowButton: React.FC<FlowButtonProps> = ({
  mode,
  imageSrc,
  altText,
  onClick,
}) => {
  return (
    <button 
      type="button" 
      className={styles.flowButton} 
      onClick={() => onClick(mode)}
    >
      <img src={imageSrc} alt={altText} className={styles.pixelImg} />
    </button>
  );
};
