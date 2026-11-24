import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassTabs } from "@/components/glass-tabs";
import { SiteShell } from "@/components/site-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  adminBoard,
  claimBoard,
  defaultBriefing,
  openConsole,
  publishCapture,
  removeCapture,
  saveBriefing,
  setCaptureShown,
  unlockBoard,
  updateCapture,
  type Briefing,
  type CaptureCard,
} from "@/lib/captures.functions";
import { inspectCapture } from "@/lib/prepare-capture";
import { storePanorama } from "@/lib/store-panorama";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin · OSINT | SentinalsPrime" }] }),
});

type Draft = {
  name: string;
  category: string;
  brief: string;
  thumb: string;
  mime: string;
  wide: boolean;
  bytes: number;
  width: number;
  height: number;
};

const emptyDraft = (): Draft => ({
  name: "",
  category: "GEOINT",
  brief: "",
  thumb: "",
  mime: "image/jpeg",
  wide: true,
  bytes: 0,
  width: 0,
  height: 0,
});

function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${mb.toFixed(1)} MB`;
  if (mb >= 0.1) return `${mb.toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [gate, setGate] = useState<{ mode: "account" | "passphrase"; unlocked: boolean } | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [board, setBoard] = useState<{
    isOperator: boolean;
    operatorCount: number;
    captures: CaptureCard[];
    briefing: Briefing;
  } | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  const [panel, setPanel] = useState("challenges");

  async function refresh() {
    const next = await adminBoard();
    setBoard(next);
  }

  useEffect(() => {
    let cancelled = false;
    openConsole()
      .then((entry) => {
        if (cancelled) return;
        setGate({ mode: entry.mode, unlocked: entry.unlocked });
        if (entry.board) setBoard(entry.board);
      })
      .catch(() => {
        if (!cancelled) setGate({ mode: "account", unlocked: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gate?.unlocked || board) return;
    if (gate.mode === "account" && !user) return;
    let cancelled = false;
    adminBoard()
      .then((next) => {
        if (!cancelled) setBoard(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open the console.");
      });
    return () => {
      cancelled = true;
    };
  }, [user, gate, board]);

  if (!gate || (gate.mode === "account" && isPending)) {
    return (
      <SiteShell>
        <p className="sp-lede">Checking operator session…</p>
      </SiteShell>
    );
  }
  if (gate.mode === "passphrase" && !gate.unlocked) {
    return (
      <SiteShell>
        <h1 className="sp-page-title">Operator</h1>
        <p className="sp-lede">The board is public. Publishing a challenge requires the operator passphrase.</p>
        <form
          className="sp-auth-card"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setBusy(true);
            try {
              const opened = await unlockBoard({ data: passphrase });
              setGate({ mode: "passphrase", unlocked: true });
              if (opened.board) setBoard(opened.board);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not unlock the console.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="sp-field">
            Passphrase
            <input
              type="password"
              required
              value={passphrase}
              autoComplete="current-password"
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>
          {error ? <p className="sp-form-error">{error}</p> : null}
          <button className="sp-button sp-button-solid" type="submit" disabled={busy}>
            {busy ? "Working…" : "Unlock console"}
          </button>
        </form>
      </SiteShell>
    );
  }
  if (gate.mode === "account" && !user) return <RedirectToSignIn />;

  async function onClaim() {
    setError("");
    setBusy(true);
    try {
      await claimBoard();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim the board.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const prepared = await inspectCapture(file);
      setDraft((current) => ({ ...current, ...prepared }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  async function onPublish(event: FormEvent) {
    event.preventDefault();
    if (!files.length) {
      setError("Add at least one panorama.");
      return;
    }
    if (files.length === 1 && !draft.name.trim()) {
      setError("Name the challenge, or add several files and each filename is used.");
      return;
    }
    setError("");
    setNotice("");
    setBusy(true);
    try {
      let last = "";
      for (const file of files) {
        setProgress(file.name);
        const prepared = await storePanorama(file, (percent) => setProgress(`${file.name} · ${percent}%`));
        const fromFile = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 80);
        const name = files.length === 1 ? draft.name.trim() : fromFile || draft.name.trim();
        if (!name) throw new Error("Each file needs a name.");
        const created = await publishCapture({
          data: {
            name,
            category: draft.category,
            brief: draft.brief,
            mime: prepared.mime,
            image: prepared.image,
            thumb: prepared.thumb,
            imagePath: prepared.imagePath,
            thumbPath: prepared.thumbPath,
            bytes: prepared.bytes,
            width: prepared.width,
            height: prepared.height,
          },
        });
        last = created.slug;
      }
      setDraft(emptyDraft());
      setFiles([]);
      setNotice(last);
      setPanel("challenges");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <SiteShell>
      <h1 className="sp-page-title">Operator</h1>
      <p className="sp-lede">
        Upload an equirectangular image, name the challenge, and write the brief. It appears on the board as a sphere
        immediately.
      </p>
      {error ? <p className="sp-form-error sp-form-error-block">{error}</p> : null}
      {!board ? (
        <p className="sp-lede">Opening the console…</p>
      ) : !board.isOperator && board.operatorCount === 0 ? (
        <div className="sp-auth-card">
          <p>
            No operator holds this board yet. The first account to claim it is the only one that can publish or edit
            challenges. Do that before you share the link.
          </p>
          <button type="button" className="sp-button sp-button-solid" disabled={busy} onClick={onClaim}>
            Claim this board
          </button>
        </div>
      ) : !board.isOperator ? (
        <div className="sp-auth-card">
          <p>This account is not the board operator. Challenges stay visible, but only the operator can change them.</p>
          <Link to="/" className="sp-back">
            Return to challenges
          </Link>
        </div>
      ) : (
        <>
        <section className="sp-stage">
          <GlassTabs
            label="Operator"
            value={panel}
            onChange={setPanel}
            tabs={[
              { id: "challenges", label: "Challenges" },
              { id: "new", label: "New" },
              { id: "briefing", label: "Briefing" },
            ]}
          />
          <div
            id="panel-Operator-briefing"
            role="tabpanel"
            aria-labelledby="tab-Operator-briefing"
            className={panel === "briefing" ? "sp-pane is-on" : "sp-pane"}
          >
            <BriefingEditor
              briefing={board.briefing ?? defaultBriefing}
              onSaved={(next) => setBoard((current) => (current ? { ...current, briefing: next } : current))}
              onError={setError}
            />
          </div>
          <div
            id="panel-Operator-new"
            role="tabpanel"
            aria-labelledby="tab-Operator-new"
            className={panel === "new" ? "sp-pane is-on" : "sp-pane"}
          >
          <form className="sp-admin-panel" onSubmit={onPublish}>
            <h2>New challenge</h2>
            <label className="sp-field">
              Name
              <input
                maxLength={80}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder={files.length > 1 ? "Each file uses its own name" : "Challenge name"}
              />
            </label>
            <label className="sp-field">
              Category
              <input
                required
                maxLength={40}
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              />
            </label>
            <label className="sp-field">
              Description
              <textarea
                maxLength={2000}
                rows={4}
                value={draft.brief}
                onChange={(event) => setDraft({ ...draft, brief: event.target.value })}
                placeholder="What should the analyst look for?"
              />
            </label>
            <label className="sp-drop">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const next = [...(event.target.files ?? [])];
                  setFiles(next);
                  const first = next[0];
                  if (first) void onFile(first);
                }}
              />
              <span>
                {files.length > 1
                  ? `${files.length} panoramas. Each original is added. Nothing already on the board is removed.`
                  : draft.bytes
                    ? `Original kept · ${formatSize(draft.bytes)} · ${draft.width}×${draft.height}. Not resized.`
                    : "Choose one or more equirectangular images, up to 100 MB each"}
              </span>
            </label>
            {draft.thumb ? (
              <img className="sp-admin-preview" alt="" src={`data:image/jpeg;base64,${draft.thumb}`} />
            ) : null}
            {draft.thumb && !draft.wide ? (
              <p className="sp-note">This frame is not 2:1. It will still open in the sphere, but the horizon may warp.</p>
            ) : null}
            <button className="sp-button sp-button-solid" type="submit" disabled={busy}>
              {busy ? progress || "Working…" : "Publish sphere"}
            </button>
            {notice ? (
              <p className="sp-note">
                Live.{" "}
                <Link to="/p/$slug" params={{ slug: notice }} className="sp-back">
                  Open the sphere
                </Link>
              </p>
            ) : null}
          </form>
          </div>
          <div
            id="panel-Operator-challenges"
            role="tabpanel"
            aria-labelledby="tab-Operator-challenges"
            className={panel === "challenges" ? "sp-pane is-on" : "sp-pane"}
          >
          <section className="sp-admin-list">
            {board.captures.length === 0 ? <p className="sp-note">No challenges yet.</p> : null}
            {board.captures.map((capture) => (
              <CaptureEditor key={capture.slug} capture={capture} onChanged={refresh} onError={setError} />
            ))}
          </section>
          </div>
        </section>
        </>
      )}
    </SiteShell>
  );
}

function BriefingEditor({
  briefing,
  onSaved,
  onError,
}: {
  briefing: Briefing;
  onSaved: (next: Briefing) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Briefing>(briefing);
  const [busy, setBusy] = useState(false);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError("");
    try {
      const saved = await saveBriefing({ data: draft });
      setDraft(saved);
      onSaved(saved);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save the briefing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sp-admin-panel" onSubmit={onSave}>
      <h2>Briefing</h2>
      <p>The intro, the three notes, and the footnote are what visitors read on the Briefing tab.</p>
      <label className="sp-field">
        Intro
        <textarea
          required
          maxLength={500}
          rows={3}
          value={draft.lede}
          onChange={(event) => setDraft({ ...draft, lede: event.target.value })}
        />
      </label>
      {draft.steps.map((step, index) => (
        <div key={step.kicker} className="sp-step-edit">
          <label className="sp-field">
            {step.kicker} title
            <input
              required
              maxLength={40}
              value={step.title}
              onChange={(event) => {
                const steps = draft.steps.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, title: event.target.value } : item,
                );
                setDraft({ ...draft, steps });
              }}
            />
          </label>
          <label className="sp-field">
            {step.kicker} description
            <textarea
              required
              maxLength={320}
              rows={3}
              value={step.body}
              onChange={(event) => {
                const steps = draft.steps.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, body: event.target.value } : item,
                );
                setDraft({ ...draft, steps });
              }}
            />
          </label>
        </div>
      ))}
      <label className="sp-field">
        Footnote
        <input
          required
          maxLength={280}
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
      </label>
      <button className="sp-button sp-button-solid" type="submit" disabled={busy}>
        {busy ? "Working…" : "Save briefing"}
      </button>
    </form>
  );
}

function CaptureEditor({
  capture,
  onChanged,
  onError,
}: {
  capture: CaptureCard;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(capture.name);
  const [category, setCategory] = useState(capture.category);
  const [brief, setBrief] = useState(capture.brief);
  const [image, setImage] = useState("");
  const [thumb, setThumb] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [thumbPath, setThumbPath] = useState("");
  const [mime, setMime] = useState("image/jpeg");
  const [bytes, setBytes] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError("");
    try {
      await updateCapture({
        data: {
          slug: capture.slug,
          name,
          category,
          brief,
          ...(imagePath
            ? { imagePath, thumbPath, mime, bytes, width, height }
            : image && thumb
              ? { image, thumb, mime }
              : {}),
        },
      });
      setImage("");
      setThumb("");
      setImagePath("");
      setThumbPath("");
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete ${capture.name} from the board?`)) return;
    setBusy(true);
    onError("");
    try {
      await removeCapture({ data: capture.slug });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete it.");
      setBusy(false);
    }
  }

  return (
    <form className="sp-admin-panel sp-admin-card" onSubmit={onSave}>
      <div className="sp-admin-row">
        <img
          className="sp-admin-thumb"
          alt=""
          src={
            thumb
              ? `data:image/jpeg;base64,${thumb}`
              : capture.thumbSrc || `/api/media/${capture.slug}?v=${encodeURIComponent(capture.updatedAt)}`
          }
        />
        <div>
          <h3>{capture.name}</h3>
          <Link to="/p/$slug" params={{ slug: capture.slug }} className="sp-back">
            Open sphere
          </Link>
          <p className="sp-note">
            {bytes
              ? `Replacement original · ${formatSize(bytes)} · ${width}×${height}. Not resized.`
              : capture.bytes
                ? `Stored original · ${formatSize(capture.bytes)}${capture.width ? ` · ${capture.width}×${capture.height}` : ""}. Not resized.`
                : "Upload the original again if the sphere looks soft."}
          </p>
        </div>
      </div>
      <div className="sp-admin-split">
        <label className="sp-field">
          Name
          <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="sp-field">
          Category
          <input required maxLength={40} value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
      </div>
      <label className="sp-field">
        Description
        <textarea maxLength={2000} rows={2} value={brief} onChange={(event) => setBrief(event.target.value)} />
      </label>
      <div className="sp-admin-actions">
        <label className="sp-drop">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setProgress(file.name);
              try {
                const prepared = await storePanorama(file, (percent) => setProgress(`${file.name} · ${percent}%`));
                setImage(prepared.image ?? "");
                setThumb(prepared.thumb);
                setImagePath(prepared.imagePath ?? "");
                setThumbPath(prepared.thumbPath ?? "");
                setMime(prepared.mime);
                setBytes(prepared.bytes);
                setWidth(prepared.width);
                setHeight(prepared.height);
              } catch (err) {
                onError(err instanceof Error ? err.message : "Could not read that image.");
              } finally {
                setBusy(false);
                setProgress("");
              }
            }}
          />
          <span>{progress ? progress : thumb ? "Replacement ready" : "Replace file"}</span>
        </label>
        <button className="sp-button sp-button-solid" type="submit" disabled={busy}>
          {busy ? progress || "Working…" : "Save"}
        </button>
        <button
          className="sp-button"
          type="button"
          disabled={busy}
          onClick={() =>
            void setCaptureShown({ data: { slug: capture.slug, visible: !capture.visible } }).then(() => onChanged())
          }
        >
          {capture.visible ? "Hide" : "Unhide"}
        </button>
        <button className="sp-button" type="button" disabled={busy} onClick={() => void onDelete()}>
          Delete
        </button>
      </div>
    </form>
  );
}
