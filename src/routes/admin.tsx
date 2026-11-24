import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  adminBoard,
  claimBoard,
  defaultBriefing,
  gateStatus,
  publishCapture,
  removeCapture,
  saveBriefing,
  setCaptureShown,
  unlockBoard,
  updateCapture,
  type Briefing,
  type CaptureCard,
} from "@/lib/captures.functions";
import { prepareCapture } from "@/lib/prepare-capture";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Operator console | SENTINALSPRIME" }] }),
});

type Draft = {
  name: string;
  category: string;
  brief: string;
  image: string;
  thumb: string;
  mime: string;
  wide: boolean;
};

const emptyDraft = (): Draft => ({
  name: "",
  category: "GEOINT",
  brief: "",
  image: "",
  thumb: "",
  mime: "image/jpeg",
  wide: true,
});

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

  async function refresh() {
    const next = await adminBoard();
    setBoard(next);
  }

  useEffect(() => {
    let cancelled = false;
    gateStatus()
      .then((status) => {
        if (!cancelled) setGate(status);
      })
      .catch(() => {
        if (!cancelled) setGate({ mode: "account", unlocked: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gate) return;
    if (gate.mode === "passphrase" && !gate.unlocked) return;
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
  }, [user, gate]);

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
        <p className="sp-lede">The board is public. Publishing a capture requires the operator passphrase.</p>
        <form
          className="sp-auth-card"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setBusy(true);
            try {
              await unlockBoard({ data: passphrase });
              setGate({ mode: "passphrase", unlocked: true });
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

  async function onFile(file: File | undefined, apply: (next: Pick<Draft, "image" | "thumb" | "wide">) => void) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const prepared = await prepareCapture(file);
      apply(prepared);
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
      setError("Name the capture, or add several files and each filename is used.");
      return;
    }
    setError("");
    setNotice("");
    setBusy(true);
    try {
      let last = "";
      for (const file of files) {
        const prepared = await prepareCapture(file);
        const fromFile = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 80);
        const name = files.length === 1 ? draft.name.trim() : fromFile || draft.name.trim();
        if (!name) throw new Error("Each file needs a name.");
        const created = await publishCapture({
          data: {
            name,
            category: draft.category,
            brief: draft.brief,
            image: prepared.image,
            thumb: prepared.thumb,
            mime: prepared.mime,
          },
        });
        last = created.slug;
      }
      setDraft(emptyDraft());
      setFiles([]);
      setNotice(last);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <h1 className="sp-page-title">Operator</h1>
      <p className="sp-lede">
        Upload an equirectangular image, name it, and write the brief. It appears on the board as a sphere immediately.
      </p>
      {error ? <p className="sp-form-error sp-form-error-block">{error}</p> : null}
      {!board ? (
        <p className="sp-lede">Opening the console…</p>
      ) : !board.isOperator && board.operatorCount === 0 ? (
        <div className="sp-auth-card">
          <p>
            No operator holds this board yet. The first account to claim it is the only one that can publish or edit
            captures. Do that before you share the link.
          </p>
          <button type="button" className="sp-button sp-button-solid" disabled={busy} onClick={onClaim}>
            Claim this board
          </button>
        </div>
      ) : !board.isOperator ? (
        <div className="sp-auth-card">
          <p>This account is not the board operator. Captures stay visible, but only the operator can change them.</p>
          <Link to="/" className="sp-back">
            Return to captures
          </Link>
        </div>
      ) : (
        <>
          <BriefingEditor
            briefing={board.briefing ?? defaultBriefing}
            onSaved={(next) => setBoard((current) => (current ? { ...current, briefing: next } : current))}
            onError={setError}
          />
          <form className="sp-admin-panel" onSubmit={onPublish}>
            <h2>New capture</h2>
            <label className="sp-field">
              Name
              <input
                maxLength={80}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder={files.length > 1 ? "Each file uses its own name" : "Capture name"}
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
                  if (first) void onFile(first, (prepared) => setDraft((current) => ({ ...current, ...prepared })));
                }}
              />
              <span>
                {files.length > 1
                  ? `${files.length} panoramas ready. Publishing adds them. Nothing already on the board is removed.`
                  : draft.thumb
                    ? "Panorama ready at its original size. Choose more files to add them too."
                    : "Choose one or more equirectangular images"}
              </span>
            </label>
            {draft.thumb ? (
              <img className="sp-admin-preview" alt="" src={`data:image/jpeg;base64,${draft.thumb}`} />
            ) : null}
            {draft.thumb && !draft.wide ? (
              <p className="sp-note">This frame is not 2:1. It will still open in the sphere, but the horizon may warp.</p>
            ) : null}
            <button className="sp-button sp-button-solid" type="submit" disabled={busy}>
              {busy ? "Working…" : "Publish sphere"}
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
          <section className="sp-admin-list">
            <h2 className="sp-category-title">On the board</h2>
            {board.captures.length === 0 ? <p className="sp-note">No captures yet.</p> : null}
            {board.captures.map((capture) =>
              capture.sample ? (
                <form key={capture.slug} className="sp-admin-panel">
                  <h3>{capture.name}</h3>
                  <p>This starter sphere stays on the board until you hide it. New uploads are added beside it.</p>
                  <button
                    className="sp-button"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void setCaptureShown({
                        data: { slug: capture.slug, visible: !capture.visible, sample: true },
                      }).then(() => refresh())
                    }
                  >
                    {capture.visible ? "Shown to players — hide" : "Hidden — show to players"}
                  </button>
                </form>
              ) : (
                <CaptureEditor key={capture.slug} capture={capture} onChanged={refresh} onError={setError} />
              ),
            )}
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
      <p>These three notes and the intro are what visitors read. Captures themselves are published below.</p>
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
  const [mime, setMime] = useState("image/jpeg");
  const [busy, setBusy] = useState(false);

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
          ...(image && thumb ? { image, thumb, mime } : {}),
        },
      });
      setImage("");
      setThumb("");
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Remove ${capture.name} from the board?`)) return;
    setBusy(true);
    onError("");
    try {
      await removeCapture({ data: capture.slug });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not remove it.");
      setBusy(false);
    }
  }

  return (
    <form className="sp-admin-panel" onSubmit={onSave}>
      <div className="sp-admin-row">
        <img
          className="sp-admin-thumb"
          alt=""
          src={thumb ? `data:image/jpeg;base64,${thumb}` : `/api/media/${capture.slug}?v=${encodeURIComponent(capture.updatedAt)}`}
        />
        <div>
          <h3>{capture.name}</h3>
          <Link to="/p/$slug" params={{ slug: capture.slug }} className="sp-back">
            Open sphere
          </Link>
        </div>
      </div>
      <label className="sp-field">
        Name
        <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="sp-field">
        Category
        <input required maxLength={40} value={category} onChange={(event) => setCategory(event.target.value)} />
      </label>
      <label className="sp-field">
        Description
        <textarea maxLength={2000} rows={3} value={brief} onChange={(event) => setBrief(event.target.value)} />
      </label>
      <label className="sp-drop">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const prepared = await prepareCapture(file);
              setImage(prepared.image);
              setThumb(prepared.thumb);
              setMime(prepared.mime);
            } catch (err) {
              onError(err instanceof Error ? err.message : "Could not read that image.");
            } finally {
              setBusy(false);
            }
          }}
        />
        <span>{thumb ? "Replacement ready" : "Replace the panorama"}</span>
      </label>
      <div className="sp-admin-actions">
        <button className="sp-button sp-button-solid" type="submit" disabled={busy}>
          {busy ? "Working…" : "Save"}
        </button>
        <button
          className="sp-button"
          type="button"
          disabled={busy}
          onClick={() =>
            void setCaptureShown({ data: { slug: capture.slug, visible: !capture.visible } }).then(() => onChanged())
          }
        >
          {capture.visible ? "Shown to players" : "Hidden from players"}
        </button>
        <button className="sp-button" type="button" disabled={busy} onClick={() => void onDelete()}>
          Remove
        </button>
      </div>
    </form>
  );
}
