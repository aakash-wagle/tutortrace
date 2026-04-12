const validateGenerateRequest = (body) => {
  const {
    grade,
    sat_prep,
    career_goal,
    subjects_strong,
    subjects_weak,
    study_hours,
    learning_style,
    timeline
  } = body;

  if (!grade || typeof grade !== 'string') return "Missing or invalid 'grade'";
  if (sat_prep === undefined || typeof sat_prep !== 'boolean') return "Missing or invalid 'sat_prep' (must be a boolean)";
  if (!career_goal || typeof career_goal !== 'string') return "Missing or invalid 'career_goal'";
  
  if (!Array.isArray(subjects_strong)) return "Missing or invalid 'subjects_strong' (must be an array)";
  if (!Array.isArray(subjects_weak)) return "Missing or invalid 'subjects_weak' (must be an array)";
  
  if (!study_hours || typeof study_hours !== 'string') return "Missing or invalid 'study_hours'";
  if (!learning_style || typeof learning_style !== 'string') return "Missing or invalid 'learning_style'";
  if (!timeline || typeof timeline !== 'string') return "Missing or invalid 'timeline'";

  // Optional validation for new fields (Backward Compatibility)
  if (body.act_prep !== undefined && typeof body.act_prep !== 'boolean') return "Invalid 'act_prep' (must be a boolean)";
  if (body.ap_courses !== undefined && !Array.isArray(body.ap_courses)) return "Invalid 'ap_courses' (must be an array)";
  if (body.olympiad_interest !== undefined && !Array.isArray(body.olympiad_interest)) return "Invalid 'olympiad_interest' (must be an array)";
  if (body.country_exam !== undefined && !Array.isArray(body.country_exam)) return "Invalid 'country_exam' (must be an array)";
  if (body.target_college_tier !== undefined && typeof body.target_college_tier !== 'string') return "Invalid 'target_college_tier'";
  if (body.intended_major !== undefined && typeof body.intended_major !== 'string') return "Invalid 'intended_major'";
  if (body.scholarship_interest !== undefined && typeof body.scholarship_interest !== 'boolean') return "Invalid 'scholarship_interest' (must be a boolean)";
  if (body.gap_year !== undefined && typeof body.gap_year !== 'string') return "Invalid 'gap_year'";
  if (body.current_gpa !== undefined && typeof body.current_gpa !== 'string') return "Invalid 'current_gpa'";
  if (body.prior_test_score !== undefined && typeof body.prior_test_score !== 'string') return "Invalid 'prior_test_score'";
  if (body.learning_challenges !== undefined && !Array.isArray(body.learning_challenges)) return "Invalid 'learning_challenges' (must be an array)";
  if (body.study_mode !== undefined && typeof body.study_mode !== 'string') return "Invalid 'study_mode'";
  if (body.resource_access !== undefined && !Array.isArray(body.resource_access)) return "Invalid 'resource_access' (must be an array)";
  if (body.extracurriculars !== undefined && !Array.isArray(body.extracurriculars)) return "Invalid 'extracurriculars' (must be an array)";
  if (body.skill_goals !== undefined && !Array.isArray(body.skill_goals)) return "Invalid 'skill_goals' (must be an array)";
  if (body.internship_interest !== undefined && typeof body.internship_interest !== 'boolean') return "Invalid 'internship_interest' (must be a boolean)";

  return null; // Passes validation
};

module.exports = {
  validateGenerateRequest
};
