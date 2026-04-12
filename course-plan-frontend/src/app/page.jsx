"use client";

import { useState } from 'react'
import '../index.css'
import OnboardingForm from '../components/OnboardingForm'
import AILoader from '../components/AILoader'
import CourseDashboard from '../components/CourseDashboard'

export default function Page() {
  const [appState, setAppState] = useState('onboarding') // onboarding, loading, dashboard
  const [coursePlan, setCoursePlan] = useState(null)
  const [error, setError] = useState(null)

  const handleGeneratePlan = async (formData) => {
    setAppState('loading');
    setError(null);
    
    try {
      const response = await fetch('/api/course-plan/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      // Safely parse response — proxy may return plain text on crash
      let data;
      const rawText = await response.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(rawText || `Server error (${response.status})`);
      }
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'An error occurred while generating the plan');
      }
      
      setCoursePlan(data.course_plan);
      setAppState('dashboard');
      
    } catch (err) {
      console.error("Generation Error:", err);
      setError(err.message);
      setAppState('onboarding');
    }
  };

  const handleReset = () => {
    setCoursePlan(null);
    setAppState('onboarding');
    window.scrollTo(0, 0);
  }

  return (
    <div className="app-container">
      {appState === 'onboarding' && (
        <OnboardingForm onSubmit={handleGeneratePlan} error={error} />
      )}
      
      {appState === 'loading' && (
        <AILoader />
      )}
      
      {appState === 'dashboard' && coursePlan && (
        <CourseDashboard plan={coursePlan} onReset={handleReset} />
      )}
    </div>
  )
}
