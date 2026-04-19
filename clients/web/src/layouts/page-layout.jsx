/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Suspense } from 'react';
import classNames from 'classnames';
import { NavLink } from 'react-router';
import { navItems } from '../routes/config.js';
import { VoiceStatusRail } from '../components/voice/VoiceStatusRail.jsx';

/**
 * PageLayout component provides a consistent layout structure for pages in the application.
 * It includes the navigation component and wraps content in Carbon's Content component.
 *
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render within the layout
 * @param {string} [props.className] - Additional CSS class names to apply to the layout container
 * @param {React.ReactNode} [props.fallback] - Fallback content to display while Suspense is loading
 *
 * @example
 * <PageLayout>
 *   <h1>Page Content</h1>
 * </PageLayout>
 *
 */

export const PageLayout = ({ children, className, fallback }) => {
  const links = navItems.filter((item) => !item.children);
  return (
    <Suspense fallback={fallback}>
      <div className={classNames('cs--page-layout', className)}>
        <header className="bn-shell-header">
          <div className="bn-shell-brand">
            <img src="/brand/globe-64.png" alt="BountyNet globe" />
            <strong>BountyNet</strong>
          </div>
          <nav className="bn-shell-nav" aria-label="Primary">
            {links.map((item) => (
              <NavLink key={item.path} to={item.path}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="cs--content cs--page-layout__content">{children}</main>
        <VoiceStatusRail />
      </div>
    </Suspense>
  );
};
