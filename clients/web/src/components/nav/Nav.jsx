/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { useState } from 'react';
import {
  Header,
  HeaderMenu,
  HeaderMenuButton,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
  HeaderSideNavItems,
  SideNav,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  SkipToContent,
} from '@carbon/react';
import { NavLink, useLocation } from 'react-router';
import { navItems } from '../../routes/config.js';

const renderHeaderItem = (item, pathname) => {
  if (item.children) {
    return (
      <HeaderMenu key={item.label} menuLinkName={item.label}>
        {item.children.map((child) => (
          <HeaderMenuItem
            key={child.path}
            as={NavLink}
            to={child.path}
            isActive={pathname === child.path}
          >
            {child.label}
          </HeaderMenuItem>
        ))}
      </HeaderMenu>
    );
  }

  return (
    <HeaderMenuItem
      key={item.path}
      as={NavLink}
      to={item.path}
      isActive={pathname === item.path}
    >
      {item.label}
    </HeaderMenuItem>
  );
};

const renderSideNavItem = (item, pathname) => {
  if (item.children) {
    return (
      <SideNavMenu key={item.label} title={item.label} defaultExpanded>
        {item.children.map((child) => (
          <SideNavMenuItem
            key={child.path}
            as={NavLink}
            to={child.path}
            isActive={pathname === child.path}
          >
            {child.label}
          </SideNavMenuItem>
        ))}
      </SideNavMenu>
    );
  }

  return (
    <SideNavLink
      key={item.path}
      as={NavLink}
      to={item.path}
      isActive={pathname === item.path}
    >
      {item.label}
    </SideNavLink>
  );
};

export const Nav = () => {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  return (
    <>
      <Header aria-label="BountyNet primary site">
        <SkipToContent />
        <HeaderMenuButton
          aria-label={expanded ? 'Close menu' : 'Open menu'}
          isActive={expanded}
          isCollapsible
          onClick={() => setExpanded((value) => !value)}
        />
        <HeaderName as={NavLink} prefix="">
          <span className="bn-brandmark">
            <img
              src="/brand/globe-64.png"
              alt="BountyNet globe"
              className="bn-brandmark__icon"
            />
            <img
              src="/brand/text-strip.png"
              alt="BountyNet"
              className="bn-brandmark__wordmark"
            />
          </span>
        </HeaderName>
        <HeaderNavigation aria-label="BountyNet primary navigation">
          {navItems.map((item) => renderHeaderItem(item, location.pathname))}
        </HeaderNavigation>
      </Header>
      <SideNav
        aria-label="BountyNet side navigation"
        expanded={expanded}
        isPersistent={false}
      >
        <SideNavItems>
          <HeaderSideNavItems>
            {navItems.map((item) => renderSideNavItem(item, location.pathname))}
          </HeaderSideNavItems>
        </SideNavItems>
      </SideNav>
    </>
  );
};
