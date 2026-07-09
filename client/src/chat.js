// Streams a Danish conversation-practice reply from /api/chat/reply.
// Server-Sent Events over a plain fetch (not EventSource, since EventSource
// can't send a POST body or auth headers).

import { getToken } from "./api.js";

export async function streamChatReply({ scenario, level, messages }, { onText, onDone, onError }) {
  let res;
  try {
    res = await fetch("/api/chat/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ scenario, level, messages }),
    });
  } catch (e) {
    onError(e.message || "Network error.");
    return;
  }

  const isStream = res.headers.get("content-type")?.includes("text/event-stream");
  if (!res.ok || !isStream || !res.body) {
    const data = await res.json().catch(() => ({}));
    onError(data.error || `Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || ""; // last chunk may be an incomplete event
    for (const evt of events) {
      const line = evt.trim();
      if (!line.startsWith("data:")) continue;
      const payload = JSON.parse(line.slice(5).trim());
      if (payload.error) onError(payload.error);
      else if (payload.done) onDone();
      else if (payload.text) onText(payload.text);
    }
  }
}
