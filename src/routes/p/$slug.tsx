import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { PanoViewer } from "@/components/pano-viewer";
import { getChallenge } from "@/lib/challenges";

export const Route = createFileRoute("/p/$slug")({
  component: CapturePage,
  head: ({ params }) => {
    const challenge = getChallenge(params.slug);
    return {
      meta: [{ title: challenge ? `${challenge.name} | OSINT Challenges` : "Missing capture | OSINT Challenges" }],
    };
  },
});

function CapturePage() {
  const { slug } = Route.useParams();
  const challenge = getChallenge(slug);

  if (!challenge) {
    return (
      <SiteShell>
        <div className="sp-missing">
          <h1>Capture not on the board</h1>
          <Link to="/" className="sp-back">
            Return to captures
          </Link>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="sp-viewer-head">
        <div>
          <Link to="/" className="sp-back">
            ← Captures
          </Link>
          <h1>{challenge.name}</h1>
        </div>
        <p className="sp-note">
          {challenge.category} · {challenge.points} pts · {challenge.width}×{challenge.height}
        </p>
      </div>
      <div className="sp-pano-frame">
        <PanoViewer src={challenge.image} label={`${challenge.name} spherical capture`} />
      </div>
      <p className="sp-brief">{challenge.brief}</p>
      <p className="sp-note">Answers are pinpointed on the map on the CTF site, not here.</p>
    </SiteShell>
  );
}
