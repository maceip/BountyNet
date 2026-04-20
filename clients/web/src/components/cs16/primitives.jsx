/*
 * cs16 primitives — low-level building blocks used everywhere.
 * Keep APIs boring: accept className, ...rest; compose with cn().
 */

import { forwardRef } from 'react';
import { Icon } from './icons.jsx';

const cn = (...parts) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------
 * Panel — bordered CS16-style container with optional header/footer.
 * Used for every major section.
 * --------------------------------------------------------------------- */
export const Panel = ({
  as = 'section',
  title,
  eyebrow,
  meta,
  actions,
  footer,
  className,
  bodyClassName,
  inset,
  flush,
  children,
  ...rest
}) => {
  const Tag = as;
  return (
    <Tag
      className={cn(
        'bn-panel',
        inset && 'bn-panel--inset',
        flush && 'bn-panel--flush',
        className,
      )}
      {...rest}
    >
      {title || eyebrow || actions || meta ? (
        <header className="bn-panel__header">
          <div style={{ display: 'grid', gap: 2 }}>
            {eyebrow ? <span className="bn-eyebrow">{eyebrow}</span> : null}
            {title ? <h2 className="bn-panel__title">{title}</h2> : null}
          </div>
          {meta ? <span className="bn-panel__meta">{meta}</span> : null}
          {actions ? (
            <div
              className="bn-row"
              style={{ marginLeft: meta ? 8 : 'auto', gap: 6 }}
            >
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      <div className={cn('bn-panel__body', bodyClassName)}>{children}</div>
      {footer ? <footer className="bn-panel__footer">{footer}</footer> : null}
    </Tag>
  );
};

/* -------------------------------------------------------------------------
 * Button
 * --------------------------------------------------------------------- */
export const Button = forwardRef(
  (
    {
      as = 'button',
      variant = 'default',
      size,
      icon,
      trailingIcon,
      className,
      children,
      type,
      ...rest
    },
    ref,
  ) => {
    const Tag = as;
    const buttonType = Tag === 'button' && !type ? 'button' : type;
    return (
      <Tag
        ref={ref}
        type={buttonType}
        className={cn(
          'bn-btn',
          variant === 'primary' && 'bn-btn--primary',
          variant === 'danger' && 'bn-btn--danger',
          variant === 'ghost' && 'bn-btn--ghost',
          size === 'sm' && 'bn-btn--sm',
          size === 'icon' && 'bn-btn--icon',
          className,
        )}
        {...rest}
      >
        {icon ? <Icon name={icon} /> : null}
        {children}
        {trailingIcon ? <Icon name={trailingIcon} /> : null}
      </Tag>
    );
  },
);
Button.displayName = 'Button';

/* -------------------------------------------------------------------------
 * Field — label + control + optional help text.
 * --------------------------------------------------------------------- */
export const Field = ({
  label,
  htmlFor,
  help,
  error,
  required,
  className,
  children,
}) => (
  <div className={cn('bn-field', className)}>
    {label ? (
      <label htmlFor={htmlFor} className="bn-field__label">
        {label}
        {required ? <span style={{ color: 'var(--bn-red)' }}> *</span> : null}
      </label>
    ) : null}
    {children}
    {error ? (
      <span className="bn-field__help" style={{ color: 'var(--bn-red)' }}>
        {error}
      </span>
    ) : help ? (
      <span className="bn-field__help">{help}</span>
    ) : null}
  </div>
);

/* -------------------------------------------------------------------------
 * Input / Textarea / Select
 * --------------------------------------------------------------------- */
export const Input = forwardRef(({ className, ...rest }, ref) => (
  <input ref={ref} className={cn('bn-input', className)} {...rest} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={cn('bn-textarea', className)} {...rest} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef(({ className, children, ...rest }, ref) => (
  <select ref={ref} className={cn('bn-select', className)} {...rest}>
    {children}
  </select>
));
Select.displayName = 'Select';

/* -------------------------------------------------------------------------
 * Chip / Badge
 * --------------------------------------------------------------------- */
export const Chip = ({ tone, icon, className, children, ...rest }) => (
  <span
    className={cn('bn-chip', tone && `bn-chip--${tone}`, className)}
    {...rest}
  >
    {icon ? <Icon name={icon} /> : null}
    {children}
  </span>
);

export const Badge = Chip;

export const Kbd = ({ children, className }) => (
  <kbd className={cn('bn-kbd', className)}>{children}</kbd>
);

/* -------------------------------------------------------------------------
 * Status dot with optional label.
 * --------------------------------------------------------------------- */
export const StatusDot = ({ tone = 'green', pulse, label, className }) => {
  const dot = (
    <span
      className={cn(
        'bn-status-dot',
        tone && `bn-status-dot--${tone}`,
        pulse && 'bn-status-dot--pulse',
      )}
    />
  );
  if (!label) return dot;
  return (
    <span className={cn('bn-row', className)} style={{ gap: 6 }}>
      {dot}
      <span className="bn-meta" style={{ color: 'var(--bn-text)' }}>
        {label}
      </span>
    </span>
  );
};

/* -------------------------------------------------------------------------
 * Separator / Divider
 * --------------------------------------------------------------------- */
export const Separator = ({ className }) => (
  <hr className={cn('bn-separator', className)} />
);

/* -------------------------------------------------------------------------
 * Empty state
 * --------------------------------------------------------------------- */
export const EmptyState = ({
  title = 'Nothing here yet.',
  description,
  icon = 'dot',
  action,
  className,
}) => (
  <div className={cn('bn-empty', className)}>
    <Icon name={icon} className="bn-empty__glyph" size={18} />
    <strong style={{ color: 'var(--bn-text)', fontWeight: 500 }}>
      {title}
    </strong>
    {description ? <span>{description}</span> : null}
    {action ? <div style={{ marginTop: 4 }}>{action}</div> : null}
  </div>
);

/* -------------------------------------------------------------------------
 * Skeleton
 * --------------------------------------------------------------------- */
export const Skeleton = ({ className, width, height, style }) => (
  <div
    className={cn('bn-skeleton', className)}
    style={{ width, height, ...style }}
  />
);

/* -------------------------------------------------------------------------
 * KeyValue list — for stat grids, metadata blocks.
 * --------------------------------------------------------------------- */
export const KeyValueList = ({ items = [], columns = 2, className }) => (
  <dl
    className={cn(className)}
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: 10,
      margin: 0,
    }}
  >
    {items.map((item, index) => (
      <div
        key={item.key || index}
        style={{ display: 'grid', gap: 2, minWidth: 0 }}
      >
        <dt className="bn-eyebrow">{item.key}</dt>
        <dd
          className="bn-body"
          style={{
            margin: 0,
            color: 'var(--bn-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.value}
        </dd>
      </div>
    ))}
  </dl>
);

/* -------------------------------------------------------------------------
 * Toolbar
 * --------------------------------------------------------------------- */
export const Toolbar = ({ className, children }) => (
  <div className={cn('bn-toolbar', className)}>{children}</div>
);
