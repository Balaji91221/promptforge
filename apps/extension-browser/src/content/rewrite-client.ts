// Streams the rewrite from the hosted backend and yields accumulated text so
// the overlay can render as it generates (latency budget §15). Used only when
// no BYO provider is configured; BYO rewrites run in the background worker.

export interface StreamHandlers {
  onText: (accumulated: string) => void;
  onDone: (full: string) => void;
  onError: (message: string) => void;
}

export async function streamRewrite(input: string, handlers: StreamHandlers): Promise<void> {
  let res: Response;
  try {
    res = await fetch(__PF_API__, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input, platform: "anthropic" }),
    });
  } catch (e) {
    handlers.onError(`network error: ${(e as Error).message}`);
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    handlers.onError((body as { error?: string }).error ?? `http ${res.status}`);
    return;
  }
  if (!res.body) {
    handlers.onError("empty response body");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]" || !payload) continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          full += evt.delta.text as string;
          handlers.onText(full);
        }
      } catch {
        /* ignore keep-alive / non-JSON lines */
      }
    }
  }
  handlers.onDone(full);
}
