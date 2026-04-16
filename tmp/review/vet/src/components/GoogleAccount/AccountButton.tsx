import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '../Common/Icon';
import '../Common/Common.css';

interface AccountButtonProps {
  avatarUrl?: string;
  userName?: string;
  userEmail?: string;
}

export const AccountButton: React.FC<AccountButtonProps> = ({
  avatarUrl = 'https://lh3.google.com/u/0/ogw/AF2bZyhuWNABpxg578fXLEAx9urkVBqbMRpGpG32TzR_gvNIfg=s64-c-mo',
  userName = 'Rex',
  userEmail = 'rex@stare.network',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSupplySide = location.pathname.startsWith('/supply');

  const handleToggleMode = () => {
    if (isSupplySide) {
      navigate('/');
    } else {
      navigate('/supply');
    }
    setIsMenuOpen(false);
  };

  const handleMenuItemClick = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  return (
    <div className="account-dropdown-wrapper">
      <button
        className="account-btn"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        title={`${userName} (${userEmail})`}
      >
        <img
          src={avatarUrl}
          alt={userName}
          className="account-avatar"
        />
      </button>
      {isMenuOpen && (
        <div className="account-dropdown-menu">
          <div className="account-dropdown-header">
            <div className="account-dropdown-user">
              <img src={avatarUrl} alt={userName} className="account-dropdown-avatar" />
              <div>
                <div className="account-dropdown-name">{userName}</div>
                <div className="account-dropdown-email">{userEmail}</div>
              </div>
            </div>
          </div>

          <div className="account-dropdown-divider" />

          <div className="account-dropdown-section">
            <div className="account-dropdown-label">Mode</div>
            <button className="account-dropdown-item" onClick={handleToggleMode}>
              <Icon name={isSupplySide ? 'download' : 'edit_note'} size="sm" />
              <div className="account-dropdown-item-content">
                <div>{isSupplySide ? 'Switch to Demand' : 'Switch to Supply'}</div>
                <div className="account-dropdown-item-desc">
                  {isSupplySide ? 'Use agents' : 'Manage agents'}
                </div>
              </div>
            </button>
          </div>

          <div className="account-dropdown-divider" />

          <div className="account-dropdown-section">
            <button className="account-dropdown-item" onClick={() => handleMenuItemClick('/settings')}>
              <Icon name="settings" size="sm" />
              <div className="account-dropdown-item-content">
                <div>Settings</div>
              </div>
            </button>
          </div>

          <div className="account-dropdown-divider" />

          <button className="account-dropdown-item account-dropdown-logout">
            <Icon name="close" size="sm" />
            <div className="account-dropdown-item-content">
              <div>Sign out</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
