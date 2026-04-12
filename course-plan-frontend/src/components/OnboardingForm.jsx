"use client";

import React, { useState, useEffect } from 'react';

const OnboardingForm = ({ onSubmit, error }) => {
  const [schema, setSchema] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the dynamic questions schema from backend
    const fetchQuestions = async () => {
      try {
        const response = await fetch('/api/course-plan/questions', { method: 'POST' });
        const data = await response.json();
        setSchema(data.questions);
        
        // Initialize form data
        const initial = {};
        data.questions.forEach(q => {
          if (q.type === 'multiselect') initial[q.id] = [];
          else if (q.type === 'boolean') initial[q.id] = false;
          else initial[q.id] = '';
        });
        setFormData(initial);
      } catch (err) {
        console.error("Failed to fetch questions:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  const handleChange = (id, value) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleMultiSelect = (id, option) => {
    setFormData(prev => {
      const current = prev[id] || [];
      if (current.includes(option)) {
        return { ...prev, [id]: current.filter(item => item !== option) };
      } else {
        return { ...prev, [id]: [...current, option] };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
        <h2 style={{ animation: 'pulse 1.5s infinite' }}>Loading Preferences...</h2>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 className="gradient-text">Design Your Future</h1>
        <p style={{ marginTop: '0.75rem', fontSize: '1.05rem' }}>
          Tell us about your goals and current skills. Our AI will draft a highly personalized, 
          week-by-week actionable masterplan designed exclusively for you.
        </p>
      </div>

      {error && (
        <div className="error-box">
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {schema.map(q => (
          <div key={q.id} className="form-group">
            <label>{q.label}</label>

            {q.type === 'text' && (
              <input 
                type="text" 
                required
                placeholder="e.g. Software Engineer, Doctor..."
                value={formData[q.id]}
                onChange={(e) => handleChange(q.id, e.target.value)}
              />
            )}

            {q.type === 'select' && (
              <select 
                required 
                value={formData[q.id]} 
                onChange={(e) => handleChange(q.id, e.target.value)}
              >
                <option value="" disabled>Select an option</option>
                {q.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {q.type === 'boolean' && (
              <div className="checkbox-group">
                <label className="checkbox-label" style={{ padding: '0.7rem 1.25rem' }}>
                  <input 
                    type="checkbox" 
                    style={{ marginRight: '10px', transform: 'scale(1.2)', accentColor: 'var(--accent)' }}
                    checked={formData[q.id]} 
                    onChange={(e) => handleChange(q.id, e.target.checked)} 
                  />
                  <span>Yes</span>
                </label>
              </div>
            )}

            {q.type === 'multiselect' && (
              <div className="checkbox-group">
                {q.options.map(opt => (
                  <label key={opt} className="checkbox-label">
                    <input 
                      type="checkbox" 
                      style={{ display: 'none' }}
                      checked={(formData[q.id] || []).includes(opt)}
                      onChange={() => handleMultiSelect(q.id, opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: '2.5rem' }}>
          <button type="submit" className="btn-primary">
            Generate Plan 
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default OnboardingForm;
