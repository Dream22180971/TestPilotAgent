const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

/** Turn a failed response into a readable message (FastAPI puts it in `detail`). */
async function errorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  try {
    const detail = JSON.parse(text)?.detail;
    if (typeof detail === "string") return detail;
  } catch {
    /* not JSON */
  }
  return text || `${fallback}: ${response.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response, "Request failed"));
  }

  return response.json() as Promise<T>;
}

/** 触发浏览器下载 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export { API_BASE_URL, downloadBlob, errorMessage, request };
