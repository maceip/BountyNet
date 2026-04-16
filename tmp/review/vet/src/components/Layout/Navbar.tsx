import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../Common/Logo';
import { Icon } from '../Common/Icon';
import { Button } from '../Common/Button';
import { AccountButton } from '../GoogleAccount/AccountButton';
import { useSettings } from '../../context/SettingsContext';
import './Layout.css';

interface NavbarProps {
  onHamburgerClick: () => void;
}

const AVAILABLE_MODELS = [
  'Gemini 3 Flash',
  'Gemini 2.0',
  'Claude 3 Opus',
];

export const Navbar: React.FC<NavbarProps> = ({ onHamburgerClick }) => {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const handleModelSelect = (model: string) => {
    updateSettings({ selectedModel: model });
    setIsModelDropdownOpen(false);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button
          className="navbar-hamburger"
          onClick={onHamburgerClick}
          title="Toggle sidebar"
        >
          <Icon name="close" size="sm" />
        </button>
        <div className="navbar-logo">
          <Logo />
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-dropdown-wrapper">
          <button
            className="navbar-model-selector"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          >
            <span>{settings.selectedModel}</span>
            <Icon name="expand_more" size="sm" />
          </button>
          {isModelDropdownOpen && (
            <div className="navbar-dropdown">
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model}
                  className="navbar-dropdown-item"
                  onClick={() => handleModelSelect(model)}
                >
                  {model}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button variant="ghost" title="Toggle dark mode">
          <Icon name="light_mode" size="md" />
        </Button>

        <Button variant="ghost" title="Features">
          <Icon name="gifts" size="md" />
        </Button>

        <Button variant="ghost" title="Feedback">
          <Icon name="chat" size="md" />
        </Button>

        <Button
          variant="ghost"
          onClick={handleSettingsClick}
          title="Settings"
        >
          <Icon name="settings" size="md" />
        </Button>

        <AccountButton />
      </div>
    </nav>
  );
};
