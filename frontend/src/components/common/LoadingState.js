import React from 'react';

const LoadingState = ({ message = 'Loading...' }) => {
  return (
    <div className="dashboard-loading" role="status" aria-live="polite">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default LoadingState;
