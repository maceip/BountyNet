import React, { createContext, useContext, useState, useEffect } from 'react';

interface Settings {
  selectedModel: string;
  notificationsEnabled: boolean;
  researchOptIn: boolean;
  marketingOptIn: boolean;
  proactivityOptIn: boolean;
  dataOptIn: boolean;
  exportAsPr: boolean;
  commitAuthoring: string;
  prReactiveMode: boolean;
  prOpenAsDraft: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  selectedModel: 'Gemini 3.1 Pro',
  notificationsEnabled: true,
  researchOptIn: true,
  marketingOptIn: true,
  proactivityOptIn: true,
  dataOptIn: true,
  exportAsPr: false,
  commitAuthoring: 'User only',
  prReactiveMode: false,
  prOpenAsDraft: false,
};

const STORAGE_KEY = 'bountynet-settings';

interface SettingsContextType {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }, [settings, isLoaded]);

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
