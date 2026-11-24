import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { getBoard } from "@/lib/captures.functions";

export const Route = createFileRoute("/")({
  loader: () => getBoard(),
  staleTime: 0,
  component: Home,
  head: () => ({ meta: [{ title: "SENTINALSPRIME" }] }),
});

function Home() {
  const { captures, briefing } = Route.useLoaderData();
  const categories = [...new Set(captures.map((capture) => capture.category))];

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
          SENTINALS<em>PRIME</em>
        </h1>
        <p className="sp-lede">{briefing.lede}</p>
      </section>

      {captures.length === 0 ? (
        <p className="sp-empty">No captures on the board yet.</p>
      ) : (
        categories.map((category) => (
          <section key={category} className="sp-board-section">
            <h2 className="sp-category-title">{category}</h2>
            <div className="sp-capture-grid">
              {captures
                .filter((capture) => capture.category === category)
                .map((capture) => (
                  <Link key={capture.slug} to="/p/$slug" params={{ slug: capture.slug }} className="sp-capture-card">
                    <img
                      className="sp-capture-thumb"
                      src={`/api/media/${capture.slug}?v=${encodeURIComponent(capture.updatedAt)}`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="sp-capture-meta">
                      <h3>{capture.name}</h3>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        ))
      )}

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
    </SiteShell>
  );
}