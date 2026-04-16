import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import './Layout.css';

interface RootProps {
  children: ReactNode;
}

export const Root: React.FC<RootProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="layout-root">
      <div className="layout-sidebar-container">
        <Sidebar isOpen={isSidebarOpen} onClose={handleSidebarClose} />
      </div>
      <div className="layout-main">
        <Navbar onHamburgerClick={handleToggleSidebar} />
        <div className="layout-content">{children}</div>
      </div>
    </div>
  );
};
