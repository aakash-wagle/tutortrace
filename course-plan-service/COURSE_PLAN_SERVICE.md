# Course Plan Generation Service

## 1. Overview
This is a standalone, backend-only service integrated into the StudyHub platform. It facilitates the generation of personalized academic course plans by communicating with Google's Gemini LLM. It collects student constraints, strengths, target goals, and study habits, and outputs structured academic milestones, daily/weekly schedules, valid resource suggestions (books and YouTube links), and personalized tips.

## 2. Architecture Diagram

```
+--------------------+           +----------------------+
|                    |   POST    |                      |
|    Client UI       | --------> |    Express.js API    |
| (Not included yet) | <-------- |   (Validator/Routes) |
|                    |   JSON    |                      |
+--------------------+           +----------+-----------+
                                            |
                                  JSON with user context
                                    & System Prompt
                                            |
                                            v
                                 +----------------------+
                                 |                      |
                                 |   Google Gemini LLM  |
                                 |  (gemini-1.5-flash)  |
                                 |                      |
                                 +----------------------+
```

## 3. API Reference

### `POST /api/course-plan/questions`
Returns the structured onboarding questions needed to generate a customized course plan.

**Request:** `POST /api/course-plan/questions` (No body required)

**Response:**
```json
{
  "questions": [
    { "id": "grade", "label": "What grade/standard are you currently in?", "type": "select", "options": ["8th", "9th", "10th", "11th", "12th"] },
    ...
  ]
}
```

### `POST /api/course-plan/generate`
Accepts a payload of student-specific academic logic and returns an AI-generated academic plan.

**Request Body Example:**
```json
{
  "grade": "11th",
  "sat_prep": true,
  "career_goal": "Software Engineer at a top tech company",
  "subjects_strong": ["Math", "Computer Science"],
  "subjects_weak": ["English"],
  "study_hours": "2-4 hours",
  "learning_style": "Problem-solving",
  "timeline": "6 months"
}
```

**Response Example:**
```json
{
  "success": true,
  "course_plan": {
    "title": "Software Engineering Fast-Track",
    "summary": "This 6-month plan focuses heavily on improving your English foundation while leveraging CS and Math strengths.",
    "weekly_schedule": [
      {
        "week": 1,
        "theme": "English Foundations & Math Refresher",
        "topics": ["SAT Reading Strategies", "Algorithmic thinking"],
        "goals": ["Read 3 articles", "Solve 5 LeetCode problems"],
        "resources": ["Khan Academy", "MIT OCW"]
      }
    ],
    "sat_module": { "included": true, "focus_areas": ["Reading"], "recommended_tests": ["Practice Test 1"] },
    "milestones": [],
    "books": [],
    "youtube_resources": [],
    "tips": ["Relate logical arguments in English to coding paradigms"]
  },
  "generated_at": "2026-04-12T00:00:00.000Z"
}
```

## 4. Gemini Integration Summary
- **Model Used**: `gemini-1.5-flash`
- **Strategy**: The service wraps requests inside a strict prompt structure telling Gemini to be an academic advisor and respond **exclusively in valid schema JSON**. 
- **Retry Mechanism**: If Gemini fails to provide uncorrupted JSON on the first try, a `try/catch` handler captures the failure and requests a corrected payload one more time.

## 5. Environment Setup
1. Create an API key in Google Cloud Console / AI Studio
2. Rename `.env.example` to `.env` or create a new `.env` file
3. Set your variable `GOOGLE_API_KEY=AIzaSy...`

## 6. How to Run
```bash
npm install
npm run dev
# or
npm start
```
The application will operate by default on `http://localhost:3001` or any arbitrary `PORT` defined in `.env`.

## 7. Extending the Service
- **Persistence**: Easily attach Prisma or Mongoose controllers inside `routes/coursePlan.js` after generation to keep a historical log of user plans.
- **Frontend**: Attach standard React/Next components leveraging fetching to the explicit output paths.
- **Caching**: Implement Redis to hold outputs caching common payload matches to avoid redundant processing/API fees.

## 8. Known Limitations
- The provided YouTube Links direct to `https://www.youtube.com/results?search_query=...`. This prevents dead links when navigating UI.
- The books provided are highly probabilistic hallucination mitigations but are not strictly vetted through a formal API (like OpenLibrary/Goodreads).

## 9. Expansion v2 — Extended Profiling
The internal engine was expanded to dynamically incorporate up to 13 new conditionally triggered profiling fields to output a massively enriched JSON structure.

### New Question Groups
1. **Exams & Certifications**: Triggers dedicated preparation modules (`act_module`, `ap_modules`, `olympiad_prep`) based on targets.
2. **College & Applications**: Alters pacing and outputs (`target_college_tier`, `gap_year`) and introduces `scholarship_section` and `college_application_timeline`.
3. **Academic Standing**: Calibrates generative pacing using heuristics like `current_gpa` and injects specific `learning_accommodations` logic (for ADHD, Dyslexia) if supplied.
4. **Resources & Environment**: Prevents the AI from assigning inaccessible textbooks or unrealistic hours relative to `extracurriculars`.
5. **Goals Beyond Academics**: Integrates `skill_building` loops or `internship_resources` outside normal academic boundaries.

### Conditional Inclusion
All v2 generative objects (`ap_modules`, `learning_accommodations`, etc.) are mapped conditionally based on the user's explicit selections. The `validator.js` enforces strict compliance for Core Fields (v1 schema) while accepting V2 queries as purely optional overrides — guaranteeing backward compatibility with legacy endpoints.
