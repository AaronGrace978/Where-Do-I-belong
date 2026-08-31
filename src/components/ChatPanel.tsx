import type { ChatMsg } from "../lib/types";

export function RichText({ text }: { text: string }) {
  const blocks = text.split("\n");
  return (
    <div className="rich">
      {blocks.map((line, i) => {
        if (!line.trim()) return <div key={i} className="gap" />;
        const html = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(/^_([^_]+)_$/g, "<em>$1</em>");
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

interface Props {
  messages: ChatMsg[];
  streaming: string;
  busy: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onOpenSettings: () => void;
  providerLabel: string;
  model: string;
}

export default function ChatPanel({
  messages,
  streaming,
  busy,
  error,
  onSend,
  onOpenSettings,
  providerLabel,
  model,
}: Props) {
  return (
    <aside className="panel chat-panel">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Compass</p>
          <h2>Ask where you belong</h2>
        </div>
        <button className="ghost" type="button" onClick={onOpenSettings}>
          {providerLabel} · {model}
        </button>
      </header>
      <div className="transcript">
        {messages.map((m) => (
          <article key={m.id} className={`bubble ${m.role}`}>
            {m.role === "assistant" ? <RichText text={m.content} /> : <p>{m.content}</p>}
          </article>
        ))}
        {streaming ? (
          <article className="bubble assistant">
            <RichText text={streaming} />
          </article>
        ) : null}
        {busy && !streaming ? <p className="thinking">Reading the atlas…</p> : null}
        {error ? <p className="err">{error}</p> : null}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const box = e.currentTarget.elements.namedItem("q") as HTMLInputElement;
          const v = box.value.trim();
          if (!v || busy) return;
          onSend(v);
          box.value = "";
        }}
      >
        <input
          name="q"
          placeholder="I am unique. I need work. I have to leave…"
          autoComplete="off"
        />
        <button type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </aside>
  );
}
