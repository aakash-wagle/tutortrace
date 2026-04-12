export async function POST() {
  const res = await fetch('http://localhost:3001/api/course-plan/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await res.json();
  return Response.json(data);
}
