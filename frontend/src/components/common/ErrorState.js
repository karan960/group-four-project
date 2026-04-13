import React from 'react';

const ErrorState = ({ message, onRetry, retryLabel = 'Retry' }) => {
  if (!message) return null;

  return (
    <div className="alert alert-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry} style={{ marginLeft: '0.75rem' }}>
          {retryLabel}
        </button>
      )}
    </div>
  );
};

export default ErrorState;
