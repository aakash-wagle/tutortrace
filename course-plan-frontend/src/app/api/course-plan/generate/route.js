export const maxDuration = 120; // Allow up to 120 seconds for AI generation

export async function POST(request) {
  const body = await request.json();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 115000); // 115s safety

    const res = await fetch('http://localhost:3001/api/course-plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const text = await res.text();

    // Forward the exact status and body from the backend
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message =
      err.name === 'AbortError'
        ? 'AI generation timed out. Please try again.'
        : `Backend connection error: ${err.message}`;

    return Response.json(
      { success: false, message },
      { status: 503 }
    );
  }
}
