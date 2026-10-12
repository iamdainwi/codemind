/**
 * lib/api/chat.ts
 * SSE streaming chat API.
 * Uses native fetch + ReadableStream — no EventSource (to support POST-based queries).
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * Stream chat tokens from the server via SSE.
 * Yields each token string as it arrives.
 * Caller is responsible for breaking the loop on [DONE].
 */
export async function* streamChat(
  repoId: string,
  query: string
): AsyncGenerator<string, void, unknown> {
  const url = `${BASE}/api/v1/chat/${repoId}/stream?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "text/event-stream" },
  });

  if (!response.ok) {
    throw new Error(`Chat stream failed: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as { token?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.token) yield parsed.token;
      } catch {
        // skip malformed lines
      }
    }
  }
}

export async function getChatHistory(repoId: string) {
  const res = await fetch(`${BASE}/api/v1/chat/${repoId}/history`, {
    credentials: "include",
  });
  return res.json();
}

export async function clearChatHistory(repoId: string) {
  await fetch(`${BASE}/api/v1/chat/${repoId}/history`, {
    method: "DELETE",
    credentials: "include",
  });
}
