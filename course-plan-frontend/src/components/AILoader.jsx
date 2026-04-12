"use client";

import React, { useState, useEffect } from 'react';

const loadingStatuses = [
  "Firing up neural pathways...",
  "Analyzing your academic profile...",
  "Identifying critical knowledge gaps...",
  "Cross-referencing elite university standards...",
  "Drafting weekly milestones...",
  "Selecting optimal study resources...",
  "Finalizing your masterplan..."
];

const AILoader = () => {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev < loadingStatuses.length - 1 ? prev + 1 : prev));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
      <div className="loader-container">
        <div className="spinner"></div>
        <h3 className="loader-text" style={{ textAlign: 'center', minHeight: '3rem' }}>
          {loadingStatuses[statusIndex]}
        </h3>
        <p style={{ marginTop: '2rem', fontSize: '0.9rem', textAlign: 'center' }}>
          This process requires complex reasoning and may take 15-20 seconds. Please hold tight.
        </p>
      </div>
    </div>
  );
};

export default AILoader;
