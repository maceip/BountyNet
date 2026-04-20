/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AppShell } from '../components/cs16/index.js';
import { navItems } from '../routes/config.js';
import { pushVoiceTranscript } from '../utils/voiceInbox.js';

const BRAND = {
  kicker: 'marketplace',
  title: 'BountyNet',
  logoSrc: '/brand/globe-64.png',
};

const NAV_WITH_ICONS = navItems.map((item) => ({
  ...item,
  icon:
    item.label === 'Home'
      ? 'globe'
      : item.label.toLowerCase().includes('marketplace')
        ? 'bolt'
        : item.label.toLowerCase().includes('inventory')
          ? 'graph'
          : item.label.toLowerCase().includes('bob')
            ? 'shield'
            : item.label.toLowerCase().includes('alice')
              ? 'cpu'
              : item.label.toLowerCase().includes('diagnostics')
                ? 'terminal'
                : item.label.toLowerCase().includes('control')
                  ? 'cpu'
                  : item.label.toLowerCase().includes('reputation')
                    ? 'star'
                    : item.label.toLowerCase().includes('simulator')
                      ? 'bolt'
                      : item.label.toLowerCase().includes('agent track')
                        ? 'mic'
                        : 'arrow',
}));

/**
 * Global page layout. Wraps every route with:
 *   - Sticky app header (brand + primary nav + command palette trigger)
 *   - Command palette (⌘/Ctrl+K)
 *   - Voice-enabled status rail
 *   - Suspense boundary for lazy routes
 */
export const PageLayout = ({ children, className, fallback, persona }) => {
  return (
    <AppShell
      brand={BRAND}
      navItems={NAV_WITH_ICONS}
      persona={persona}
      fallback={fallback}
      className={className}
      onTranscript={(text) => {
        window.dispatchEvent(
          new CustomEvent('smui:status-rail-transcript', { detail: { text } }),
        );
        pushVoiceTranscript(text, 'status-rail');
      }}
    >
      {children}
    </AppShell>
  );
};
