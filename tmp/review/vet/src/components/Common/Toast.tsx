import React from 'react';
import { useToast } from '../../context/ToastContext';
import { Icon } from './Icon';
import './Toast.css';

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-content">
            {toast.type === 'success' && (
              <Icon name="check" size="sm" className="toast-icon" />
            )}
            {toast.type === 'error' && (
              <Icon name="warning" size="sm" className="toast-icon" />
            )}
            {toast.type === 'warning' && (
              <Icon name="warning" size="sm" className="toast-icon" />
            )}
            {toast.type === 'info' && (
              <Icon name="notifications" size="sm" className="toast-icon" />
            )}
            <span className="toast-message">{toast.message}</span>
          </div>
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Close notification"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      ))}
    </div>
  );
};
