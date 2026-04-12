require('dotenv').config();
const { generateCoursePlan } = require('./services/geminiService');

const run = async () => {
    try {
        console.log("Checking API key:", process.env.GOOGLE_API_KEY ? "Set" : "Not Set");
        const res = await generateCoursePlan({
            "grade": "11th",
            "sat_prep": true,
            "career_goal": "Software Engineer at a top tech company",
            "subjects_strong": ["Math", "Computer Science"],
            "subjects_weak": ["English"],
            "study_hours": "2-4 hours",
            "learning_style": "Problem-solving",
            "timeline": "6 months"
        });
        console.log("SUCCESS. Output parsed successfully.");
    } catch(e) {
        console.error("ERROR CAUGHT DETAILS:");
        console.error(e);
    }
}
run();
