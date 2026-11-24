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
      <h1 className="sp-page-title">SENTINALSPRIME</h1>
      <p className="sp-lede">{briefing.lede}</p>

      {captures.length === 0 ? (
        <p className="sp-empty">No captures on the board yet.</p>
      ) : (
        categories.map((category) => (
          <section key={category}>
            <h2 className="sp-category-title">{category}</h2>
            <div className="sp-capture-grid">
              {captures
                .filter((capture) => capture.category === category)
                .map((capture) => (
                  <Link key={capture.slug} to="/p/$slug" params={{ slug: capture.slug }} className="sp-capture-card">
                    <img
                      className="sp-capture-thumb"
                      src={
                        capture.updatedAt === "static"
                          ? "/panoramas/basalt-reach-thumb.jpg"
                          : `/api/media/${capture.slug}?v=${encodeURIComponent(capture.updatedAt)}`
                      }
                      alt=""
                      width={960}
                      height={480}
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
        {briefing.steps.map((step) => (
          <article key={step.kicker} className="sp-feature-card">
            <span className="sp-kicker">{step.kicker}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}