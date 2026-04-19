/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Suspense } from 'react';
import classNames from 'classnames';
import { CommandPalette, StatusRail, openCommandPalette } from '../components/smui/index.jsx';
import { pushVoiceTranscript } from '../utils/voiceInbox.js';

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
  return (
    <Suspense fallback={fallback}>
      <div className={classNames('min-h-screen bg-background text-foreground', className)}>
        <header className="sticky top-0 z-20 border-b border-border bg-card">
          <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-3 py-3 fold:px-6 desktop:px-8">
            <div className="inline-flex items-center gap-2 text-foreground">
            <img src="/brand/globe-64.png" alt="BountyNet globe" />
            <strong>BountyNet</strong>
          </div>
            <nav aria-label="Primary">
              <button
                type="button"
                className="border border-border bg-secondary px-3 py-2 text-label"
                onClick={() => openCommandPalette()}
              >
              open command palette
            </button>
          </nav>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[90rem] px-3 pt-4 pb-28 fold:px-6 fold:pt-6 fold:pb-28 desktop:px-8">
          {children}
        </main>
        <CommandPalette />
        <StatusRail
          onTranscript={(text) => {
            window.dispatchEvent(new CustomEvent('smui:status-rail-transcript', { detail: { text } }));
            pushVoiceTranscript(text, 'status-rail');
          }}
        />
      </div>
    </Suspense>
  );
};
