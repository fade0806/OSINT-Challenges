import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const year = new Date().getFullYear();

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="sp-cinematic-glow" aria-hidden="true" />
      <div className="sp-hex-grid" aria-hidden="true" />
      <header className="sp-navbar">
        <div className="sp-navbar-inner">
          <div className="sp-navbar-left">
            <Link to="/" className="sp-brand">
              <svg viewBox="0 0 100 100" className="sp-logo" fill="none" aria-hidden="true">
                <path
                  d="M50 5 70 20v15h15l5 25-20 20-20 15-20-15-20-20 5-25h15V20Z"
                  fill="#050505"
                  stroke="#dc2626"
                  strokeWidth="4"
                />
                <path d="M42 20h16l-8 15Z" fill="#dc2626" />
                <path d="m28 45 14 5-14 5Z" fill="#60a5fa" className="sp-eye-pulse" />
                <path d="m72 45-14 5 14 5Z" fill="#60a5fa" className="sp-eye-pulse" />
                <path
                  d="m40 65 10 7 10-7v13L50 85l-10-7Z"
                  fill="#171717"
                  stroke="#dc2626"
                  strokeWidth="2"
                />
              </svg>
              <span className="sp-brand-copy">
                <span className="sp-brand-title">
                  OSINT<span>Challenges</span>
                </span>
                <span className="sp-brand-subtitle">SentinalsPrime // GEOINT</span>
              </span>
            </Link>
            <nav className="sp-primary-nav">
              <Link to="/">Captures</Link>
              <a href="#briefing">Briefing</a>
            </nav>
          </div>
          <div className="sp-navbar-right">
            <div className="sp-system-status">
              <span />
              SYS_STATUS: ONLINE
            </div>
          </div>
        </div>
      </header>
      <main className="sp-main">{children}</main>
      <footer className="sp-footer">
        <div className="sp-footer-brand">
          <span className="sp-footer-dot" />
          <strong>Powered by SentinalsPrime</strong>
          <span className="sp-footer-dot" />
        </div>
        <p>OSINT Challenges · spherical imagery for the field board · {year}</p>
      </footer>
    </>
  );
}
