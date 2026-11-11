import React from 'react';

interface ErrorBannerProps {
  message: string | null;
  onDismiss?: () => void;
  title?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onDismiss,
  title = 'System Notice',
}) => {
  if (!message) return null;

  return (
    <div className="error-banner animate-fade-in" role="alert">
      <div className="error-banner-content">
        <span className="material-symbols-outlined error-icon">error</span>
        <div className="error-text-block">
          <strong className="error-title">{title}:</strong>
          <span className="error-message">{message}</span>
        </div>
      </div>
      {onDismiss && (
        <button
          className="btn-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error notification"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      )}
    </div>
  );
};
