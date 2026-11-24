import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { challenges, getCategories } from "@/lib/challenges";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const categories = getCategories();

  return (
    <SiteShell>
      <h1 className="sp-page-title">OSINT Challenges</h1>
      <p className="sp-lede">
        Spherical imagery for field-analysis challenges. Open a capture, look around, then
        submit the answer on the CTF board by pinning the location on the map.
      </p>

      {categories.map((category) => (
        <section key={category}>
          <h2 className="sp-category-title">{category}</h2>
          <div className="sp-capture-grid">
            {challenges
              .filter((challenge) => challenge.category === category)
              .map((challenge) => (
                <Link
                  key={challenge.slug}
                  to="/p/$slug"
                  params={{ slug: challenge.slug }}
                  className="sp-capture-card"
                >
                  <img
                    className="sp-capture-thumb"
                    src={challenge.thumb}
                    alt=""
                    width={960}
                    height={480}
                  />
                  <div className="sp-capture-meta">
                    <h3>{challenge.name}</h3>
                    <p>
                      {challenge.points} pts · {challenge.width}×{challenge.height}
                    </p>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      ))}

      <p className="sp-note">Answers are pinpointed on the map on the CTF site, not here.</p>

      <section className="sp-feature-grid" id="briefing">
        <article className="sp-feature-card">
          <span className="sp-kicker">01</span>
          <h3>Open</h3>
          <p>Each card is one equirectangular capture. Nothing on this page is the flag.</p>
        </article>
        <article className="sp-feature-card">
          <span className="sp-kicker">02</span>
          <h3>Look</h3>
          <p>Drag to turn, scroll to zoom, and use the compass. The sphere is the clue.</p>
        </article>
        <article className="sp-feature-card">
          <span className="sp-kicker">03</span>
          <h3>Pin</h3>
          <p>Take the read back to the CTF and drop the pin on the geo challenge map.</p>
        </article>
      </section>
    </SiteShell>
  );
}
