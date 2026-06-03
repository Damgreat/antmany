import React, { createContext, useContext, useState } from 'react';
import { PanelTemplate, PanelData } from '../types';

interface PanelContextType {
  currentPanel: PanelTemplate | null;
  panelData: PanelData[];
  setCurrentPanel: (panel: PanelTemplate) => void;
  updatePanelData: (data: PanelData[]) => void;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export const PanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPanel, setCurrentPanel] = useState<PanelTemplate | null>(null);
  const [panelData, setPanelData] = useState<PanelData[]>([]);

  return (
    <PanelContext.Provider
      value={{
        currentPanel,
        panelData,
        setCurrentPanel,
        updatePanelData: setPanelData,
      }}
    >
      {children}
    </PanelContext.Provider>
  );
};

export const usePanel = () => {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanel must be used within a PanelProvider');
  }
  return context;
};
