async function safeErrorMessage(res) {
    try {
        const data = await res.json();
        if (data && typeof data.error === "string") {
            return data.error;
        }
    }
    catch {
        // ignore json parse failures and fall through
    }
    return res.statusText || `Request failed (${res.status}).`;
}
export async function extractTextFromFile(file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/extract-text", { method: "POST", body: form });
    if (!res.ok) {
        throw new Error(await safeErrorMessage(res));
    }
    return (await res.json());
}
export async function submitEssay(text) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mock") === "1") {
        const res = await fetch("/mock/sampleFeedback.json");
        if (!res.ok) {
            throw new Error("Failed to load mock feedback data.");
        }
        return (await res.json());
    }
    const res = await fetch("/api/essay-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ essay_text: text }),
    });
    if (!res.ok) {
        throw new Error(await safeErrorMessage(res));
    }
    return (await res.json());
}
