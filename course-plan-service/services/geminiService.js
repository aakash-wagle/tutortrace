const OpenAI = require('openai');

const SYSTEM_INSTRUCTION = `You are an expert academic advisor. Your goal is to generate highly personalized, structured course plans for students based on their specific goals, strengths, weaknesses, and constraints.

You MUST respond ONLY with valid JSON. Do NOT include markdown formatting like \`\`\`json or \`\`\`. Your entire response must be a single correctly formatted JSON object matching the exact schema below. Do not add any conversational preamble or postscript.

JSON Schema:
{
  "title": "string — AI-generated plan title",
  "summary": "string — 2-3 sentence overview",
  "weekly_schedule": [
    {
      "week": "number (e.g. 1, 2, ...)",
      "theme": "string",
      "topics": ["string"],
      "goals": ["string"],
      "resources": ["string"]
    }
  ],
  "sat_module": {
    "included": "boolean",
    "focus_areas": ["string"],
    "recommended_tests": ["string"]
  },
  "act_module": {
    "included": "boolean",
    "focus_areas": ["string"],
    "score_target": "string — inferred from current standing"
  },
  "ap_modules": [
    {
      "course": "string",
      "weekly_hours_suggested": "number",
      "key_topics": ["string"],
      "exam_date_note": "string"
    }
  ],
  "olympiad_prep": {
    "included": "boolean",
    "competitions": ["string"],
    "resources": ["string"]
  },
  "college_application_timeline": {
    "included": "boolean",
    "key_dates": [
      { "milestone": "string", "suggested_month": "string" }
    ],
    "essay_prep_included": "boolean"
  },
  "scholarship_section": {
    "included": "boolean",
    "tips": ["string"],
    "suggested_scholarships_to_research": ["string"]
  },
  "skill_building": [
    {
      "skill": "string",
      "resources": ["string"],
      "weekly_hours": "number"
    }
  ],
  "internship_resources": {
    "included": "boolean",
    "platforms": ["string — e.g. Outreachy, Google STEP, local government programs"],
    "tips": ["string"]
  },
  "learning_accommodations": ["string — only present if learning_challenges non-empty"],
  "milestones": [
    { "month": "number", "goal": "string", "checkpoints": ["string"] }
  ],
  "books": [
    {
      "title": "string",
      "author": "string",
      "reason": "string — why this book is relevant",
      "amazon_search_url": "string — e.g. https://www.amazon.com/s?k=Title+Author"
    }
  ],
  "youtube_resources": [
    {
      "search_query": "string — the query used to find this",
      "youtube_search_url": "string — e.g. https://www.youtube.com/results?search_query=...",
      "description": "string — what to look for in results"
    }
  ],
  "tips": ["string — personalized study tips based on learning style"]
}

Instructions for content:
1. Tailor the plan to the student's specific grade level and career goal.
2. If the user indicates SAT preparation is required (sat_prep: true), embed a dedicated SAT section (sat_module), focus areas, and timeline integration. If false, set included to false.
3. Recommend 3-5 real, well-known books with real authors (do NOT hallucinate titles). Provide pre-built Amazon search URLs.
4. Generate 4-6 YouTube search queries with pre-built search URLs (e.g., https://www.youtube.com/results?search_query=mit+ocw+calculus).
5. Keep weekly schedules realistic for the stated daily study_hours. Cross-reference extracurriculars. A student with varsity sports and a part-time job cannot study 4 hours daily.
6. Personalize all study tips specifically based on their provided learning_style.
7. Only include 'act_module' if the user indicated ACT prep.
8. Only include 'ap_modules' if the user selected AP courses.
9. Omit 'learning_accommodations' entirely if 'learning_challenges' is empty or ['None']. If present (e.g. ADHD, dyslexia), recommend shorter study sessions, Pomodoro, text-to-speech, etc.
10. Do not fabricate scholarship names — only suggest well-known national programs if requested.
11. If Country Exam is set, adapt book and resource recommendations to that exam's syllabus.
12. If Target College Tier is "Ivy League / Top 10", emphasize extracurricular depth, essays, and research projects.
13. If Internship Interest is true, include 'internship_resources'.
14. Use 'current_gpa' and 'prior_test_score' to calibrate difficulty pacing appropriately.`;

const parseJSONRepair = (responseText) => {
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
};

const callLiteLLM = async (prompt, isRetry = false) => {
  const apiKey = process.env.LITELLM_API_KEY || "sk-placeholder";
  const baseURL = process.env.LITELLM_BASE_URL || "http://localhost:4000/v1";
  
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const finalPrompt = isRetry 
    ? `The previous response failed to parse as JSON. Please ensure your response is absolutely valid JSON, and contains no raw text or unescaped characters. The JSON must match the exact schema requested previously. Remember, NO preamble or markdown blocks.\n\nHere is the original prompt again:\n${prompt}`
    : prompt;

  const response = await openai.chat.completions.create({
    model: process.env.LITELLM_MODEL_NAME || "gemini/gemini-2.5-flash",
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: finalPrompt }
    ]
  });

  if (!response.choices || response.choices.length === 0) {
    throw new Error("No candidates returned from LiteLLM");
  }

  return response.choices[0].message.content;
};

const generateCoursePlan = async (userData) => {
  // Construct dynamic prompt based on provided basic and optional fields
  let userPrompt = `Student Details:\n`;
  userPrompt += `- Grade/Standard: ${userData.grade}\n`;
  userPrompt += `- Preparing for SAT: ${userData.sat_prep}\n`;
  userPrompt += `- Career Goal: ${userData.career_goal}\n`;
  userPrompt += `- Strong Subjects: ${userData.subjects_strong.join(', ')}\n`;
  userPrompt += `- Weak Subjects: ${userData.subjects_weak.join(', ')}\n`;
  userPrompt += `- Study Hours Dedicated: ${userData.study_hours} per day\n`;
  userPrompt += `- Learning Style: ${userData.learning_style}\n`;
  userPrompt += `- Target Timeline: ${userData.timeline}\n`;

  // Extended fields parsing
  if (userData.act_prep !== undefined) userPrompt += `- Preparing for ACT: ${userData.act_prep}\n`;
  if (userData.ap_courses && userData.ap_courses.length > 0) userPrompt += `- Target AP Courses: ${userData.ap_courses.join(', ')}\n`;
  if (userData.olympiad_interest && userData.olympiad_interest.length > 0) userPrompt += `- Olympiad Interests: ${userData.olympiad_interest.join(', ')}\n`;
  if (userData.country_exam && userData.country_exam.length > 0) userPrompt += `- Country Exams: ${userData.country_exam.join(', ')}\n`;
  
  if (userData.target_college_tier) userPrompt += `- Target College Tier: ${userData.target_college_tier}\n`;
  if (userData.intended_major) userPrompt += `- Intended Major: ${userData.intended_major}\n`;
  if (userData.scholarship_interest !== undefined) userPrompt += `- Applying for Scholarships: ${userData.scholarship_interest}\n`;
  if (userData.gap_year) userPrompt += `- Post-High School Plan: ${userData.gap_year}\n`;

  if (userData.current_gpa) userPrompt += `- Current Academic Standing: ${userData.current_gpa}\n`;
  if (userData.prior_test_score) userPrompt += `- Prior SAT/ACT Scores: ${userData.prior_test_score}\n`;
  if (userData.learning_challenges && userData.learning_challenges.length > 0) userPrompt += `- Learning Challenges: ${userData.learning_challenges.join(', ')}\n`;

  if (userData.study_mode) userPrompt += `- Primary Study Mode: ${userData.study_mode}\n`;
  if (userData.resource_access && userData.resource_access.length > 0) userPrompt += `- Resources Available: ${userData.resource_access.join(', ')}\n`;
  if (userData.extracurriculars && userData.extracurriculars.length > 0) userPrompt += `- Extracurriculars: ${userData.extracurriculars.join(', ')}\n`;

  if (userData.skill_goals && userData.skill_goals.length > 0) userPrompt += `- Desired Skills to Build: ${userData.skill_goals.join(', ')}\\n`;
  if (userData.internship_interest !== undefined) userPrompt += `- Interested in Internships: ${userData.internship_interest}\n`;

  userPrompt += `\nPlease generate the course plan matching the requested JSON Schema immediately.`;

  try {
    const rawResponse = await callLiteLLM(userPrompt);
    return parseJSONRepair(rawResponse);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn('Initial JSON parsing failed. Retrying with explicit JSON correction prompt...');
      const retryResponse = await callLiteLLM(userPrompt, true);
      try {
        return parseJSONRepair(retryResponse);
      } catch (retryErr) {
        throw new Error('malformed JSON response from LiteLLM after retry');
      }
    }
    throw err;
  }
};

module.exports = {
  generateCoursePlan
};
