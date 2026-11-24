import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassTabs } from "@/components/glass-tabs";
import { SiteShell } from "@/components/site-shell";
import { getBoard } from "@/lib/captures.functions";

export const Route = createFileRoute("/")({
  loader: () => getBoard(),
  staleTime: 0,
  component: Home,
  head: () => ({ meta: [{ title: "OSINT | SentinalsPrime" }] }),
});

function Home() {
  const { captures, briefing } = Route.useLoaderData();
  const [tab, setTab] = useState("challenges");

  useEffect(() => {
    if (window.location.hash === "#briefing") setTab("briefing");
  }, []);

  function select(id: string) {
    setTab(id);
    const next = id === "briefing" ? "#briefing" : "#challenges";
    window.history.replaceState(null, "", next);
  }

  return (
    <SiteShell>
      <section className="sp-hero">
        <span className="sp-hud sp-hud-tl" />
        <span className="sp-hud sp-hud-tr" />
        <span className="sp-hud sp-hud-bl" />
        <span className="sp-hud sp-hud-br" />
        <div className="sp-directive">
          <span />
          Field board
          <span />
        </div>
        <h1 className="sp-page-title">
          SENTINALS<em>PRIME</em> CTF
        </h1>
        <p className="sp-lede">{briefing.lede}</p>
      </section>

      <section className="sp-stage">
        <GlassTabs
          label="Board"
          value={tab}
          onChange={select}
          tabs={[
            { id: "challenges", label: "Challenges" },
            { id: "briefing", label: "Briefing" },
          ]}
        />
        <div
          id="panel-Board-challenges"
          role="tabpanel"
          aria-labelledby="tab-Board-challenges"
          className={tab === "challenges" ? "sp-pane is-on" : "sp-pane"}
        >
          {captures.length === 0 ? (
            <p className="sp-empty">No challenges on the board yet.</p>
          ) : (
            <div className="sp-capture-grid">
              {captures.map((capture) => (
                <Link key={capture.slug} to="/p/$slug" params={{ slug: capture.slug }} className="sp-capture-card">
                  <img
                    className="sp-capture-thumb"
                    src={`/api/media/${capture.slug}?v=${encodeURIComponent(capture.updatedAt)}`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="sp-capture-meta">
                    <span>{capture.category}</span>
                    <h3>{capture.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div
          id="panel-Board-briefing"
          role="tabpanel"
          aria-labelledby="tab-Board-briefing"
          className={tab === "briefing" ? "sp-pane is-on" : "sp-pane"}
        >
          <p className="sp-note">{briefing.note}</p>
          <section className="sp-feature-grid" id="briefing">
            {briefing.steps.map((step, index) => (
              <article key={step.kicker} className="sp-feature-card" style={{ animationDelay: `${index * 140}ms` }}>
                <span className="sp-kicker">{step.kicker}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <b />
              </article>
            ))}
          </section>
        </div>
      </section>
    </SiteShell>
  );
}
