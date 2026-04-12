const YT_KEY = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_YOUTUBE_API_KEY ?? "";

export async function searchYoutubeVideo(query: string): Promise<string> {
  if (!YT_KEY) return "";
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(query)}&maxResults=1&type=video&key=${YT_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const data = await res.json() as { items?: { id?: { videoId?: string } }[] };
    return data?.items?.[0]?.id?.videoId ?? "";
  } catch {
    return "";
  }
}
