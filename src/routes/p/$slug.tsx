import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { PanoViewer } from "@/components/pano-viewer";
import { getCapture } from "@/lib/captures.functions";

export const Route = createFileRoute("/p/$slug")({
  loader: ({ params }) => getCapture({ data: params.slug }),
  staleTime: 0,
  component: CapturePage,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `${loaderData.name} | SENTINALSPRIME` : "Missing challenge | SENTINALSPRIME",
      },
    ],
  }),
});

function CapturePage() {
  const capture = Route.useLoaderData();

  if (!capture) {
    return (
      <SiteShell>
        <div className="sp-missing">
          <h1>Challenge not on the board</h1>
          <Link to="/" className="sp-back">
            Return to challenges
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
            ← Challenges
          </Link>
          <h1>{capture.name}</h1>
        </div>
        <p className="sp-note">{capture.category}</p>
      </div>
      <div className="sp-pano-frame">
        <PanoViewer src={capture.src ?? `/api/media/${capture.slug}?kind=full&v=${encodeURIComponent(capture.updatedAt)}`} label={`${capture.name} spherical capture`} />
      </div>
      {capture.brief ? <p className="sp-brief">{capture.brief}</p> : null}
      <p className="sp-note">Answers are pinpointed on the map on the CTF site, not here.</p>
    </SiteShell>
  );
}
