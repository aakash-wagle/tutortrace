const getQuestions = () => {
  return [
    // --- Basic Info (Backward Compatibility) ---
    { id: "grade", group: "Basic Info", label: "What grade/standard are you currently in?", type: "select", options: ["8th", "9th", "10th", "11th", "12th"] },
    { id: "sat_prep", group: "Basic Info", label: "Are you preparing for the SAT?", type: "boolean" },
    { id: "career_goal", group: "Basic Info", label: "What is your future career goal or aspiration?", type: "text" },
    { id: "subjects_strong", group: "Basic Info", label: "Which subjects are you strong in?", type: "multiselect", options: ["Math", "Science", "English", "History", "Computer Science", "Arts"] },
    { id: "subjects_weak", group: "Basic Info", label: "Which subjects do you want to improve in?", type: "multiselect", options: ["Math", "Science", "English", "History", "Computer Science", "Arts"] },
    { id: "study_hours", group: "Basic Info", label: "How many hours per day can you dedicate to studying?", type: "select", options: ["1-2 hours", "2-4 hours", "4-6 hours", "6+ hours"] },
    { id: "learning_style", group: "Basic Info", label: "What is your preferred learning style?", type: "select", options: ["Visual", "Reading/Writing", "Problem-solving", "Mixed"] },
    { id: "timeline", group: "Basic Info", label: "What is your target timeline for this course plan?", type: "select", options: ["1 month", "3 months", "6 months", "1 year"] },
    
    // --- Exams & Certifications ---
    { id: "act_prep", group: "Exams & Certifications", label: "Are you also preparing for the ACT?", type: "boolean" },
    { id: "ap_courses", group: "Exams & Certifications", label: "Which AP (Advanced Placement) courses are you taking or targeting?", type: "multiselect", options: ["AP Calculus AB", "AP Calculus BC", "AP Physics", "AP Chemistry", "AP Biology", "AP Computer Science A", "AP English Language", "AP English Literature", "AP US History", "AP World History", "AP Psychology", "AP Statistics", "None"], optional: true },
    { id: "olympiad_interest", group: "Exams & Certifications", label: "Are you interested in subject olympiads or competitions?", type: "multiselect", options: ["Math Olympiad (AMC/AIME)", "Science Olympiad", "Computing (USACO)", "Physics Olympiad", "Chemistry Olympiad", "None"], optional: true },
    { id: "country_exam", group: "Exams & Certifications", label: "Are you preparing for any country-specific entrance exam?", type: "multiselect", options: ["JEE (India)", "A-Levels (UK)", "IB Diploma", "Gaokao (China)", "ATAR (Australia)", "None / Not applicable"], optional: true },
    
    // --- College & Applications ---
    { id: "target_college_tier", group: "College & Applications", label: "What tier of colleges are you targeting?", type: "select", options: ["Ivy League / Top 10", "Top 25-50", "State / Public University", "Community College", "Vocational / Trade", "Undecided"] },
    { id: "intended_major", group: "College & Applications", label: "What is your intended college major? (if known)", type: "text", optional: true, placeholder: "e.g. Computer Science, Pre-Med, Undecided" },
    { id: "scholarship_interest", group: "College & Applications", label: "Are you applying for scholarships or financial aid?", type: "boolean" },
    { id: "gap_year", group: "College & Applications", label: "What is your plan after high school?", type: "select", options: ["Go straight to college", "Take a gap year", "Vocational / trade path", "Start a business", "Undecided"] },
    
    // --- Academic Standing ---
    { id: "current_gpa", group: "Academic Standing", label: "How would you describe your current academic standing?", type: "select", options: ["Top 10% of class", "Above average", "Average", "Below average — actively improving"] },
    { id: "prior_test_score", group: "Academic Standing", label: "Have you taken the SAT or ACT before?", type: "select", options: ["No, first time", "Yes — scored below 1000 (SAT) / 20 (ACT)", "Yes — scored 1000-1200 (SAT) / 20-25 (ACT)", "Yes — scored 1200-1400 (SAT) / 25-30 (ACT)", "Yes — scored 1400+ (SAT) / 30+ (ACT)"] },
    { id: "learning_challenges", group: "Academic Standing", label: "Do you have any learning differences or challenges we should account for?", type: "multiselect", options: ["Dyslexia", "ADHD / attention difficulties", "Test anxiety", "English is not my first language", "None"], optional: true },
    
    // --- Resources & Environment ---
    { id: "study_mode", group: "Resources & Environment", label: "How are you primarily studying?", type: "select", options: ["Fully self-study", "With a private tutor", "School classes only", "Mix of school + self-study"] },
    { id: "resource_access", group: "Resources & Environment", label: "What learning resources do you have access to?", type: "multiselect", options: ["Internet / YouTube", "School library", "Khan Academy / free platforms", "Paid platforms (Coursera, Udemy, etc.)", "Physical textbooks", "Practice test books"] },
    { id: "extracurriculars", group: "Resources & Environment", label: "What extracurricular activities do you do? (affects realistic study time)", type: "multiselect", options: ["Sports (varsity / competitive)", "Music or arts", "Robotics / coding club", "Student government", "Part-time job", "Volunteering", "None"], optional: true },
    
    // --- Goals Beyond Academics ---
    { id: "skill_goals", group: "Goals Beyond Academics", label: "Are there any skills you want to build alongside academics?", type: "multiselect", options: ["Coding / programming", "Research & writing", "Public speaking", "Data analysis", "Design / creative", "Leadership", "None"], optional: true },
    { id: "internship_interest", group: "Goals Beyond Academics", label: "Are you interested in internships or summer programs?", type: "boolean" }
  ];
};

module.exports = {
  getQuestions
};
