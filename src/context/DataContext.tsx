import React, { createContext, useState, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Panel, Template } from '../types';

interface DataContextType {
  panels: Panel[];
  templates: Template[];
  currentPanel: Panel | null;
  savePanel: (panel: Panel) => Promise<void>;
  loadPanels: () => Promise<void>;
  setCurrentPanel: (panel: Panel | null) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentPanel, setCurrentPanel] = useState<Panel | null>(null);

  const savePanel = async (panel: Panel) => {
    try {
      const updatedPanels = [...panels, panel];
      await AsyncStorage.setItem('panels', JSON.stringify(updatedPanels));
      setPanels(updatedPanels);
    } catch (error) {
      console.error('Error saving panel:', error);
      throw error;
    }
  };

  const loadPanels = async () => {
    try {
      const storedPanels = await AsyncStorage.getItem('panels');
      if (storedPanels) {
        setPanels(JSON.parse(storedPanels));
      }
    } catch (error) {
      console.error('Error loading panels:', error);
      throw error;
    }
  };

  return (
    <DataContext.Provider
      value={{
        panels,
        templates,
        currentPanel,
        savePanel,
        loadPanels,
        setCurrentPanel,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
