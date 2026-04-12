const express = require('express');
const router = express.Router();

const { getQuestions } = require('../services/questionService');
const { validateGenerateRequest } = require('../utils/validator');
const { generateCoursePlan } = require('../services/geminiService');

/**
 * POST /api/course-plan/questions
 * Returns the list of onboarding questions to display to the user.
 */
router.post('/questions', (req, res) => {
  const questions = getQuestions();
  res.json({ questions });
});

/**
 * POST /api/course-plan/generate
 * Accepts user answers and returns the full AI-generated course plan.
 */
router.post('/generate', async (req, res) => {
  // 1. Validate input
  const validationError = validateGenerateRequest(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  // 2. Wrap Gemini call in try/catch
  try {
    const coursePlan = await generateCoursePlan(req.body);
    
    res.json({
      success: true,
      course_plan: coursePlan,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Gemini API Error:`, error.message);
    
    // Status 503 if LLM call fails generally, 500 if malformed retries fail
    const status = error.message.includes('malformed') ? 500 : 503;
    res.status(status).json({ 
      success: false, 
      message: 'Failed to generate course plan from AI.',
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
