import { useState } from "react";
import { api } from "../api";
import { PageTitle, Card, Field, ErrorNote, btn, input } from "../App";

export default function Push() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deeplink, setDeeplink] = useState("");
  const [marketing, setMarketing] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api<{ audienceSize: number }>("/admin/push", {
        method: "POST",
        json: { title, body: body || undefined, deeplink: deeplink || null, marketing },
      });
      setResult(`Sent to ${res.audienceSize} customer${res.audienceSize === 1 ? "" : "s"}.`);
      setTitle("");
      setBody("");
      setDeeplink("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle title="Push notifications" />
      <Card>
        <p className="mb-4 text-sm text-gray-500">
          Broadcast to customers. Marketing sends skip anyone who opted out of promotions; transactional
          (non-marketing) sends go to everyone.
        </p>
        <ErrorNote message={error} />
        {result && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{result}</p>}
        <Field label="Title">
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Message (optional)">
          <textarea className={input} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} />
        </Field>
        <Field label="Deep link (optional, e.g. /offers)">
          <input className={input} value={deeplink} onChange={(e) => setDeeplink(e.target.value)} />
        </Field>
        <label className="mb-4 flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          Marketing (respect opt-outs)
        </label>
        <div className="flex justify-end">
          <button className={btn} onClick={send} disabled={!title || busy}>
            {busy ? "Sending…" : "Send broadcast"}
          </button>
        </div>
      </Card>
    </>
  );
}
