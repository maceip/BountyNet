import React, { useState, type ReactNode } from 'react';
import { Navbar } from './Navbar';
import { SupplySidebar } from './SupplySidebar';
import './Layout.css';

interface SupplyRootProps {
  children: ReactNode;
}

export const SupplyRoot: React.FC<SupplyRootProps> = ({ children }) => {
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
        <SupplySidebar isOpen={isSidebarOpen} onClose={handleSidebarClose} />
      </div>
      <div className="layout-main">
        <Navbar onHamburgerClick={handleToggleSidebar} />
        <div className="layout-content">{children}</div>
      </div>
    </div>
  );
};
