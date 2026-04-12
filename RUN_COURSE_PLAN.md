# 🚀 Running the Course Plan AI Services

The Course Plan architecture is completely decoupled from the main project and consists of three separate running processes:
1. **LiteLLM Proxy**: The middleman router that handles API logic.
2. **Node Backend**: The stateless service that parses instructions and handles validation.
3. **Vite Frontend**: The glassmorphic UI where users interact.

To run the full end-to-end stack, you will need **three separate terminal windows**.

---

## 🟢 Terminal 1: Boot The LLM Proxy
LiteLLM is required to map your Google AI Studio keys securely to the backend without hardcoding keys in your server code.

1. Open your first terminal window.
2. Export your exact Google AI Studio key:
   ```bash
   export GEMINI_API_KEY="AIzaSy...your_studio_key_here..."
   ```
3. Boot the persistent proxy server (configured for the 2.5 Flash model):
   ```bash
   litellm --model gemini/gemini-2.5-flash
   ```
   *You should see it output: `Uvicorn running on http://0.0.0.0:4000`*

---

## 🔵 Terminal 2: Boot The Node Backend
This service provides the dynamic REST endpoints (`/api/course-plan/questions` and `/generate`).

1. Open a second terminal window.
2. Navigate into your backend directory:
   ```bash
   cd "course-plan-service"
   ```
3. Start the Express development server:
   ```bash
   npm run dev
   ```
   *You should see it output: `Server is running on port 3001`*

---

## 🟣 Terminal 3: Boot The React Frontend
This is the Vite-powered UI that proxies its API calls securely to your backend.

1. Open your third terminal window.
2. Navigate into your frontend directory:
   ```bash
   cd "course-plan-frontend"
   ```
3. Start the Vite UI server:
   ```bash
   npm run dev
   ```
   *You should see it output: `Local: http://localhost:3002/`*

---

🎉 **Done!** You can now visit `http://localhost:3002/` in your browser. When you fill out the form, the data flows seamlessly:
`Frontend (3002) --> Backend (3001) --> LiteLLM (4000) --> Google Gemini (Cloud)`.
