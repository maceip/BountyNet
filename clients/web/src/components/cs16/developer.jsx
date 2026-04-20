/*
 * cs16 developer-surface components.
 * Ported from the cs16.css showcase and adapted to BountyNet's frost palette.
 */

import { useCallback, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Button, Chip, EmptyState, Panel } from './primitives.jsx';

const cn = (...parts) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------
 * Terminal — titled, scrollable <pre>. Accepts string or any value (JSON-
 * stringified).
 * --------------------------------------------------------------------- */
export const Terminal = ({
  title = 'output',
  content = '',
  language,
  className,
  maxHeight = 288,
  actions,
  empty,
}) => {
  const body =
    typeof content === 'string'
      ? content
      : JSON.stringify(content ?? {}, null, 2);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      /* noop */
    }
  }, [body]);

  const isEmpty = !body || body === '{}' || body === '""';

  return (
    <Panel
      className={className}
      eyebrow={language ? language : 'terminal'}
      title={title}
      actions={
        <>
          {actions}
          <Button size="sm" variant="ghost" icon="copy" onClick={copy}>
            copy
          </Button>
        </>
      }
      bodyClassName="bn-terminal__body"
      inset
    >
      {isEmpty ? (
        <EmptyState
          icon="terminal"
          title={empty?.title || 'No output yet.'}
          description={empty?.description}
        />
      ) : (
        <pre
          style={{
            margin: 0,
            padding: 0,
            maxHeight,
            overflow: 'auto',
            fontFamily: 'var(--bn-font-mono)',
            fontSize: 12,
            lineHeight: 1.55,
            color: 'var(--bn-text)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {body}
        </pre>
      )}
    </Panel>
  );
};

/* -------------------------------------------------------------------------
 * CodeLine — single-line snippet with language chip + filename + copy.
 * --------------------------------------------------------------------- */
export const CodeLine = ({
  lang = 'sh',
  file,
  code,
  onCopy,
  className,
  children,
}) => {
  const snippet = code || (typeof children === 'string' ? children : '');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      onCopy?.(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <div className={cn('bn-code-line', className)}>
      <span className="bn-code-line__lang">{lang}</span>
      <code className="bn-code-line__code">{snippet}</code>
      {file ? <span className="bn-code-line__file">{file}</span> : null}
      <button
        type="button"
        className="bn-code-line__copy"
        onClick={handleCopy}
        aria-label="Copy snippet"
        title="Copy snippet"
      >
        <Icon name={copied ? 'check' : 'copy'} />
      </button>
      <style>{`
        .bn-code-line {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto;
          align-items: stretch;
          min-height: 32px;
          border: 1px solid;
          border-color: var(--bn-border-dark) var(--bn-border-light) var(--bn-border-light) var(--bn-border-dark);
          background-color: var(--bn-inset);
          overflow: hidden;
        }
        .bn-code-line__lang {
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          font-family: var(--bn-font-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--bn-accent);
          background-color: var(--bn-surface-2);
          border-right: 1px solid var(--bn-border-dark);
        }
        .bn-code-line__code {
          display: flex;
          align-items: center;
          padding: 0 12px;
          font-family: var(--bn-font-mono);
          font-size: 12px;
          color: var(--bn-text);
          white-space: nowrap;
          overflow-x: auto;
          overflow-y: hidden;
          min-width: 0;
        }
        .bn-code-line__file {
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          font-family: var(--bn-font-mono);
          font-size: 11px;
          font-style: italic;
          color: var(--bn-text-2);
          border-left: 1px solid var(--bn-border-dark);
        }
        .bn-code-line__copy {
          width: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bn-surface-2);
          color: var(--bn-text);
          border: 0;
          border-left: 1px solid var(--bn-border-dark);
          cursor: pointer;
        }
        .bn-code-line__copy:hover { background-color: var(--bn-surface-3); }
      `}</style>
    </div>
  );
};

/* -------------------------------------------------------------------------
 * RepoCard — GitHub-style repo summary.
 * --------------------------------------------------------------------- */
const LANG_COLORS = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Rust: '#dea584',
  Go: '#00add8',
  Solidity: '#aa6746',
  Shell: '#89e051',
};

export const RepoCard = ({
  owner,
  repo,
  description,
  language,
  languageColor,
  stars,
  forks,
  watchers,
  visibility = 'Public',
  license,
  updated,
  topics = [],
  href,
  extra,
  className,
}) => {
  const langColor =
    languageColor || (language && LANG_COLORS[language]) || 'var(--bn-accent)';
  return (
    <article className={cn('bn-repo-card', className)}>
      <header className="bn-repo-card__head">
        <Icon name="repo" className="bn-repo-card__glyph" />
        {owner ? (
          <>
            <a className="bn-repo-card__owner" href={href || '#'}>
              {owner}
            </a>
            <span className="bn-repo-card__sep">/</span>
          </>
        ) : null}
        <a className="bn-repo-card__name" href={href || '#'}>
          {repo}
        </a>
        {visibility ? (
          <span className="bn-repo-card__visibility">{visibility}</span>
        ) : null}
      </header>
      {description ? <p className="bn-repo-card__desc">{description}</p> : null}
      {topics.length ? (
        <div className="bn-row" style={{ gap: 4 }}>
          {topics.map((topic) => (
            <Chip key={topic} tone="accent">
              {topic}
            </Chip>
          ))}
        </div>
      ) : null}
      <div className="bn-repo-card__stats">
        {language ? (
          <span className="bn-repo-card__stat">
            <span
              className="bn-repo-card__lang-dot"
              style={{ backgroundColor: langColor }}
            />
            {language}
          </span>
        ) : null}
        {typeof stars === 'number' ? (
          <span className="bn-repo-card__stat">
            <Icon name="star" />
            {stars.toLocaleString()}
          </span>
        ) : null}
        {typeof forks === 'number' ? (
          <span className="bn-repo-card__stat">
            <Icon name="fork" />
            {forks.toLocaleString()}
          </span>
        ) : null}
        {typeof watchers === 'number' ? (
          <span className="bn-repo-card__stat">
            <Icon name="eye" />
            {watchers.toLocaleString()}
          </span>
        ) : null}
        {license ? (
          <span className="bn-repo-card__stat">{license} license</span>
        ) : null}
        {updated ? (
          <span className="bn-repo-card__stat bn-repo-card__stat--muted">
            Updated {updated}
          </span>
        ) : null}
      </div>
      {extra ? <div>{extra}</div> : null}
      <style>{`
        .bn-repo-card {
          display: grid;
          gap: 10px;
          padding: 12px;
          background-color: var(--bn-surface-1);
          border: 1px solid;
          border-color: var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light);
        }
        .bn-repo-card__head {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--bn-border-dark);
          box-shadow: 0 1px 0 var(--bn-border-light);
        }
        .bn-repo-card__glyph { color: var(--bn-text-2); }
        .bn-repo-card__owner,
        .bn-repo-card__name {
          color: var(--bn-accent);
          text-decoration: none;
          font-family: var(--bn-font-display);
          font-size: 15px;
        }
        .bn-repo-card__name { color: var(--bn-text); font-weight: 600; }
        .bn-repo-card__owner:hover,
        .bn-repo-card__name:hover { text-decoration: underline; }
        .bn-repo-card__sep { color: var(--bn-text-2); }
        .bn-repo-card__visibility {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          padding: 2px 8px 1px;
          background-color: var(--bn-surface-2);
          color: var(--bn-text-1);
          font-family: var(--bn-font-mono);
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border: 1px solid var(--bn-border);
        }
        .bn-repo-card__desc {
          margin: 0;
          color: var(--bn-text-1);
          font-family: var(--bn-font-mono);
          font-size: 12px;
          line-height: 1.5;
        }
        .bn-repo-card__stats {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          padding-top: 8px;
          border-top: 1px solid var(--bn-border-dark);
          font-family: var(--bn-font-mono);
          font-size: 11px;
        }
        .bn-repo-card__stat {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--bn-text-1);
        }
        .bn-repo-card__stat--muted {
          color: var(--bn-text-2);
          margin-left: auto;
        }
        .bn-repo-card__lang-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 1px solid var(--bn-border-dark);
        }
      `}</style>
    </article>
  );
};

/* -------------------------------------------------------------------------
 * CommitGraph — rail + commit cards.
 * Accepts `commits: [{ hash, message, author, date, parents, refs: [{name,type}] }]`.
 * --------------------------------------------------------------------- */
export const CommitGraph = ({
  commits = [],
  activeHash,
  onSelect,
  className,
}) => {
  const total = commits.length;
  if (!total) {
    return (
      <EmptyState
        icon="commit"
        title="No commits yet."
        description="Commits land here once the repo is registered."
      />
    );
  }
  const activeIndex = Math.max(
    0,
    commits.findIndex((commit) => commit.hash === activeHash),
  );
  return (
    <div className={cn('bn-commit-graph', className)}>
      {commits.map((commit, index) => {
        const isFirst = index === 0;
        const isLast = index === total - 1;
        const isActive = activeHash
          ? commit.hash === activeHash
          : index === activeIndex;
        return (
          <button
            key={commit.hash}
            type="button"
            className={cn('bn-commit-graph__row', isActive && 'is-active')}
            onClick={() => onSelect?.(commit)}
          >
            <span
              className={cn(
                'bn-commit-graph__rail',
                isFirst && 'is-first',
                isLast && 'is-last',
              )}
              aria-hidden="true"
            >
              <span className="bn-commit-graph__line" />
              <span className="bn-commit-graph__dot" />
            </span>
            <div className="bn-commit-graph__card">
              <div className="bn-commit-graph__header">
                <code className="bn-commit-graph__hash">
                  {commit.hash.slice(0, 7)}
                </code>
                {commit.refs?.length ? (
                  <div className="bn-commit-graph__refs">
                    {commit.refs.map((commitRef) => (
                      <CommitRef
                        key={`${commit.hash}-${commitRef.name}`}
                        reference={commitRef}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="bn-commit-graph__message">{commit.message}</p>
              <p className="bn-commit-graph__meta">
                <span className="bn-commit-graph__author">{commit.author}</span>
                <span className="bn-commit-graph__sep">·</span>
                <span>committed {commit.date}</span>
                {commit.parents?.length ? (
                  <>
                    <span className="bn-commit-graph__sep">·</span>
                    <span>parent {commit.parents[0].slice(0, 7)}</span>
                  </>
                ) : null}
              </p>
            </div>
          </button>
        );
      })}
      <style>{`
        .bn-commit-graph {
          display: grid;
          gap: 0;
          padding: 4px 0;
          border: 1px solid;
          border-color: var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light);
          background-color: var(--bn-surface-1);
        }
        .bn-commit-graph__row {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr);
          gap: 10px;
          padding: 10px 12px 10px 0;
          width: 100%;
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--bn-border-dark);
          color: inherit;
          text-align: left;
          cursor: pointer;
          font: inherit;
        }
        .bn-commit-graph__row:last-child { border-bottom: 0; }
        .bn-commit-graph__row:hover { background-color: var(--bn-surface-2); }
        .bn-commit-graph__row.is-active .bn-commit-graph__dot {
          background-color: var(--bn-accent);
          border-color: var(--bn-accent-dim);
        }
        .bn-commit-graph__rail {
          position: relative;
          min-height: 44px;
        }
        .bn-commit-graph__line {
          position: absolute;
          top: 0; bottom: 0;
          left: 50%;
          width: 2px;
          margin-left: -1px;
          background-color: var(--bn-border-light);
        }
        .bn-commit-graph__rail.is-first .bn-commit-graph__line { top: 14px; }
        .bn-commit-graph__rail.is-last .bn-commit-graph__line { bottom: calc(100% - 14px); }
        .bn-commit-graph__dot {
          position: absolute;
          top: 10px; left: 50%;
          width: 10px; height: 10px;
          margin-left: -5px;
          background-color: var(--bn-surface-1);
          border: 2px solid var(--bn-border-light);
          box-shadow: 0 0 0 1px var(--bn-border-dark);
          z-index: 1;
        }
        .bn-commit-graph__card {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .bn-commit-graph__header {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .bn-commit-graph__hash {
          padding: 2px 6px 1px;
          background-color: var(--bn-inset);
          color: var(--bn-accent);
          font-family: var(--bn-font-mono);
          font-size: 11px;
          border: 1px solid var(--bn-border);
        }
        .bn-commit-graph__refs {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-left: auto;
        }
        .bn-commit-graph__ref {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px 1px;
          background-color: var(--bn-surface-2);
          font-family: var(--bn-font-mono);
          font-size: 11px;
          border: 1px solid;
          border-color: var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light);
          color: var(--bn-text-1);
        }
        .bn-commit-graph__ref--branch { color: var(--bn-accent); }
        .bn-commit-graph__ref--tag { color: var(--bn-yellow); }
        .bn-commit-graph__ref--head {
          background-color: var(--bn-inset);
          color: var(--bn-accent);
          font-weight: 600;
        }
        .bn-commit-graph__message {
          margin: 0;
          color: var(--bn-text);
          font-family: var(--bn-font-display);
          font-size: 13px;
          line-height: 1.3;
        }
        .bn-commit-graph__meta {
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          color: var(--bn-text-2);
          font-family: var(--bn-font-mono);
          font-size: 11px;
        }
        .bn-commit-graph__author { color: var(--bn-text-1); }
        .bn-commit-graph__sep { color: var(--bn-text-3); }
      `}</style>
    </div>
  );
};

const CommitRef = ({ reference }) => {
  const iconName =
    reference.type === 'tag'
      ? 'tag'
      : reference.type === 'head'
        ? 'commit'
        : 'branch';
  return (
    <span
      className={cn(
        'bn-commit-graph__ref',
        `bn-commit-graph__ref--${reference.type || 'branch'}`,
      )}
    >
      <Icon name={iconName} />
      {reference.name}
    </span>
  );
};

/* -------------------------------------------------------------------------
 * FileTree — collapsible tree with chevrons and indent guides.
 * Accepts: nodes: [{ name, children?, size?, active? }]
 * --------------------------------------------------------------------- */
export const FileTree = ({
  nodes = [],
  defaultExpanded,
  onSelectFile,
  actions,
  className,
}) => {
  const [expanded, setExpanded] = useState(
    () => new Set(defaultExpanded || collectTopFolders(nodes)),
  );

  const toggle = (path) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(collectAllFolders(nodes)));
  const collapseAll = () => setExpanded(new Set());

  const { folders, files } = useMemo(() => countNodes(nodes), [nodes]);

  return (
    <div className={cn('bn-file-tree', className)}>
      <header className="bn-file-tree__head">
        <span className="bn-file-tree__summary">
          {folders} folders · {files} files
        </span>
        <div className="bn-row" style={{ gap: 6 }}>
          {actions}
          <Button size="sm" variant="ghost" onClick={expandAll}>
            Expand
          </Button>
          <Button size="sm" variant="ghost" onClick={collapseAll}>
            Collapse
          </Button>
        </div>
      </header>
      <ul className="bn-file-tree__list bn-file-tree__list--root" role="tree">
        {nodes.map((node) => (
          <FileTreeNode
            key={node.name}
            node={node}
            parentPath=""
            expanded={expanded}
            onToggle={toggle}
            onSelectFile={onSelectFile}
          />
        ))}
      </ul>
      <style>{`
        .bn-file-tree {
          background-color: var(--bn-surface-1);
          border: 1px solid;
          border-color: var(--bn-border-light) var(--bn-border-dark) var(--bn-border-dark) var(--bn-border-light);
        }
        .bn-file-tree__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 12px;
          background-color: var(--bn-surface-2);
          border-bottom: 1px solid var(--bn-border-dark);
          box-shadow: 0 1px 0 var(--bn-border-light);
        }
        .bn-file-tree__summary {
          color: var(--bn-text-1);
          font-family: var(--bn-font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .bn-file-tree__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 0;
        }
        .bn-file-tree__list--root { padding: 4px 0; }
        .bn-file-tree__list--nested {
          position: relative;
          margin-left: 17px;
        }
        .bn-file-tree__list--nested::before {
          content: "";
          position: absolute;
          top: 2px; bottom: 2px;
          left: 0;
          width: 1px;
          background-color: var(--bn-border-dark);
          opacity: 0.75;
        }
        .bn-file-tree__row {
          display: grid;
          grid-template-columns: 14px 16px minmax(0, 1fr) auto;
          gap: 6px;
          align-items: center;
          width: 100%;
          min-height: 26px;
          padding: 3px 12px;
          background: transparent;
          border: 0;
          color: var(--bn-text-1);
          font-family: var(--bn-font-mono);
          font-size: 12px;
          text-align: left;
          cursor: default;
        }
        .bn-file-tree__row--folder { cursor: pointer; color: var(--bn-text); }
        .bn-file-tree__row:hover { background-color: var(--bn-surface-2); }
        .bn-file-tree__row--file.is-active {
          background-color: var(--bn-inset);
          color: var(--bn-accent);
          box-shadow: inset 2px 0 0 var(--bn-accent);
        }
        .bn-file-tree__chevron {
          color: var(--bn-text-2);
          transition: transform 80ms linear;
        }
        .bn-file-tree__chevron.is-open { transform: rotate(90deg); color: var(--bn-text); }
        .bn-file-tree__icon--folder { color: var(--bn-accent); }
        .bn-file-tree__icon--file { color: var(--bn-text-2); }
        .bn-file-tree__icon--ext-ts,
        .bn-file-tree__icon--ext-tsx { color: #7ab2ff; }
        .bn-file-tree__icon--ext-json { color: var(--bn-yellow); }
        .bn-file-tree__icon--ext-md { color: var(--bn-text-1); }
        .bn-file-tree__name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bn-file-tree__meta {
          color: var(--bn-text-3);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
};

const FileTreeNode = ({
  node,
  parentPath,
  expanded,
  onToggle,
  onSelectFile,
}) => {
  const path = parentPath ? `${parentPath}/${node.name}` : node.name;
  const isFolder = Array.isArray(node.children);
  const isOpen = expanded.has(path);
  const ext = isFolder ? '' : fileExtension(node.name);
  const rowClass = cn(
    'bn-file-tree__row',
    isFolder ? 'bn-file-tree__row--folder' : 'bn-file-tree__row--file',
    node.active && 'is-active',
  );

  const rowChildren = (
    <>
      {isFolder ? (
        <Icon
          name="chevron"
          className={cn('bn-file-tree__chevron', isOpen && 'is-open')}
        />
      ) : (
        <span className="bn-file-tree__chevron" />
      )}
      <Icon
        name={isFolder ? (isOpen ? 'folder-open' : 'folder') : 'file'}
        className={cn(
          'bn-file-tree__icon',
          isFolder ? 'bn-file-tree__icon--folder' : 'bn-file-tree__icon--file',
          !isFolder && ext && `bn-file-tree__icon--ext-${ext}`,
        )}
      />
      <span className="bn-file-tree__name">{node.name}</span>
      {node.size ? (
        <span className="bn-file-tree__meta">{node.size}</span>
      ) : null}
    </>
  );

  return (
    <li
      role="treeitem"
      aria-expanded={isFolder ? isOpen : undefined}
      aria-selected={node.active ? 'true' : 'false'}
    >
      {isFolder ? (
        <button
          type="button"
          className={rowClass}
          onClick={() => onToggle(path)}
        >
          {rowChildren}
        </button>
      ) : (
        <button
          type="button"
          className={rowClass}
          onClick={() => onSelectFile?.(node, path)}
        >
          {rowChildren}
        </button>
      )}
      {isFolder && isOpen ? (
        <ul
          className="bn-file-tree__list bn-file-tree__list--nested"
          role="group"
        >
          {node.children.map((child) => (
            <FileTreeNode
              key={child.name}
              node={child}
              parentPath={path}
              expanded={expanded}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

const fileExtension = (name) => {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : '';
};

const countNodes = (nodes) => {
  let folders = 0;
  let files = 0;
  const walk = (list) => {
    for (const node of list) {
      if (Array.isArray(node.children)) {
        folders += 1;
        walk(node.children);
      } else {
        files += 1;
      }
    }
  };
  walk(nodes);
  return { folders, files };
};

const collectAllFolders = (nodes, prefix = '') => {
  const out = [];
  for (const node of nodes) {
    if (Array.isArray(node.children)) {
      const path = prefix ? `${prefix}/${node.name}` : node.name;
      out.push(path);
      out.push(...collectAllFolders(node.children, path));
    }
  }
  return out;
};

const collectTopFolders = (nodes) =>
  nodes.filter((node) => Array.isArray(node.children)).map((node) => node.name);
