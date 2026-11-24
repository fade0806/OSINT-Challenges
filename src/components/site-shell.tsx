import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { gateStatus, lockBoard } from "@/lib/captures.functions";
import { OPERATOR_SESSION_EVENT, publishOperatorSession } from "@/lib/operator-session";

const year = new Date().getFullYear();

function OperatorLinks() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const sessionStamp = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const started = sessionStamp.current;
    gateStatus()
      .then((status) => {
        if (!cancelled && sessionStamp.current === started) setOpen(status.unlocked);
      })
      .catch(() => {
        if (!cancelled && sessionStamp.current === started) setOpen(false);
      });
    function onSession(event: Event) {
      sessionStamp.current += 1;
      const unlocked = event instanceof CustomEvent && event.detail?.unlocked === true;
      setOpen(unlocked);
    }
    window.addEventListener(OPERATOR_SESSION_EVENT, onSession);
    return () => {
      cancelled = true;
      window.removeEventListener(OPERATOR_SESSION_EVENT, onSession);
    };
  }, []);

  return (
    <>
      {open ? (
        <button
          type="button"
          className="sp-nav-box sp-nav-box-solid"
          disabled={leaving}
          onClick={() => {
            if (leaving) return;
            setLeaving(true);
            void lockBoard()
              .then(() => {
                publishOperatorSession(false);
                window.location.assign("/admin");
              })
              .catch(() => {
                setLeaving(false);
                setOpen(true);
              });
          }}
        >
          Logout
        </button>
      ) : null}
      <Link to="/admin" className="sp-nav-box">
        Admin
      </Link>
    </>
  );
}

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
                  SENTINALS<span>PRIME</span>
                </span>
                <span className="sp-brand-subtitle">Field board // GEOINT</span>
              </span>
            </Link>
          </div>
          <div className="sp-navbar-right">
            <OperatorLinks />
            <div className="sp-system-status">
              <span />
              SYS_STATUS: ONLINE
            </div>
            <UserButton />
          </div>
        </div>
      </header>
      <main className="sp-main">{children}</main>
      <footer className="sp-footer">
        <div className="sp-footer-brand">
          <span className="sp-footer-dot" />
          <strong>Powered by SentinalsPrime CTF</strong>
          <span className="sp-footer-dot" />
        </div>
        <p>NUST MCS Information Security © {year}</p>
      </footer>
    </>
  );
}
