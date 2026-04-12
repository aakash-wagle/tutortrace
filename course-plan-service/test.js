const { validateGenerateRequest } = require('./utils/validator.js');
const validLegacy = {
  grade: "11th",
  sat_prep: true,
  career_goal: "SE",
  subjects_strong: ["Math"],
  subjects_weak: ["English"],
  study_hours: "2",
  learning_style: "Visual",
  timeline: "6 months"
};
console.log("Legacy Payload Test:", validateGenerateRequest(validLegacy) === null ? "PASS" : validateGenerateRequest(validLegacy));

const validNew = {
  ...validLegacy,
  ap_courses: ["AP Calc"],
  scholarship_interest: true
};
console.log("Enriched Payload Test:", validateGenerateRequest(validNew) === null ? "PASS" : validateGenerateRequest(validNew));
