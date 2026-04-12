"use client";

import React from 'react';

const CourseDashboard = ({ plan, onReset }) => {
  if (!plan) return null;

  return (
    <div style={{ paddingBottom: '4rem', animation: 'fadeIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
      <button onClick={onReset} className="btn-ghost">
        ← Start Over
      </button>

      <div className="glass-panel dashboard-header">
        <h1 className="gradient-text">{plan.title || "Your Master Plan"}</h1>
        <p style={{ fontSize: '1.05rem', maxWidth: '800px', margin: '1rem auto 0' }}>
          {plan.summary}
        </p>

        {plan.weakness && plan.weakness.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h4 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Primary Focus Areas</h4>
            <div className="chip-container" style={{ justifyContent: 'center' }}>
              {plan.weakness.map((w, index) => (
                <span key={index} className="chip weakness">{w}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3.5rem', marginTop: '3rem' }}>
        
        {/* Timeline Section */}
        <section>
          <h2 className="module-title">Weekly Timeline</h2>
          <div className="timeline">
            {plan.weekly_schedule && plan.weekly_schedule.map((week, index) => (
              <div key={index} className="timeline-card">
                <span className="week-badge">Week {week.week}</span>
                <h3 style={{ marginBottom: '1rem' }}>{week.theme}</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  <div>
                    <strong style={{ color: 'var(--accent)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Topics</strong>
                    <ul className="topics-list">
                      {week.topics?.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ color: '#b8860b', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Goals</strong>
                    <ul className="topics-list">
                      {week.goals?.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Milestones Section */}
        {plan.milestones && plan.milestones.length > 0 && (
          <section>
            <h2 className="module-title">Monthly Milestones</h2>
            <div className="resources-grid">
              {plan.milestones.map((m, index) => (
                <div key={index} className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>Month {m.month}</h3>
                  <p style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: '1rem' }}>{m.goal}</p>
                  <ul className="topics-list">
                    {m.checkpoints?.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Resources Library */}
        <section>
          <h2 className="module-title">Recommended Library</h2>

          {/* Books */}
          {plan.books && plan.books.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Core Texts</h3>
              <div className="resources-grid">
                {plan.books.map((b, index) => (
                  <a key={index} href={b.amazon_search_url || '#'} target="_blank" rel="noreferrer" className="resource-card">
                    <h4>{b.title}</h4>
                    <p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '0.5rem' }}>By {b.author}</p>
                    <p>{b.reason}</p>
                    <span className="resource-link">View Details →</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* YouTube */}
          {plan.youtube_resources && plan.youtube_resources.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Video Resources</h3>
              <div className="resources-grid">
                {plan.youtube_resources.map((y, index) => (
                  <a key={index} href={y.youtube_search_url || '#'} target="_blank" rel="noreferrer" className="resource-card">
                    <h4>{y.search_query}</h4>
                    <p>{y.description}</p>
                    <span className="resource-link" style={{ color: 'var(--destructive)' }}>Search YouTube →</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* General Tips */}
        {plan.tips && plan.tips.length > 0 && (
          <section>
            <h2 className="module-title">Success Protocol</h2>
            <div className="glass-panel">
              <ul className="topics-list" style={{ marginTop: 0 }}>
                {plan.tips.map((tip, index) => <li key={index} style={{ marginBottom: '1rem', lineHeight: '1.6' }}>{tip}</li>)}
              </ul>
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

export default CourseDashboard;
