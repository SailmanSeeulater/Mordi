import { useEffect } from "react";
import { Link } from "react-router-dom";
import "./landing.css";

const WEEK = [
  { day: "Mon", entry: "Ran 3.2 mi — Mission Bay", mark: "LOGGED" },
  { day: "Tue", entry: "Ran 2.8 mi — Lake Murray", mark: "LOGGED" },
  { day: "Wed", entry: "No entry recorded", mark: "MISSED", miss: true },
  { day: "Thu", entry: "Ran 4.0 mi — Mission Bay", mark: "LOGGED" },
  { day: "Fri", entry: "Ran 3.1 mi — Lake Murray", mark: "LOGGED" },
  { day: "Sat", entry: "Awaiting today's entry", mark: "OPEN", open: true },
];

const CAPABILITIES = [
  {
    title: "Set the goal",
    body: "Name it, pick a category, choose how often it should happen. Weekly, daily, or a count you're aiming for.",
  },
  {
    title: "Log the day",
    body: "One entry per day, with the mood that went with it. Takes a few seconds and builds the record you'll read later.",
  },
  {
    title: "Fix your position",
    body: "Capture where you were when it happened. Coordinates resolve to real addresses and plot on a chart of your week.",
  },
  {
    title: "Close the week",
    body: "Every Sunday the log closes out: completion rate, streak, mood trend, and what slipped.",
  },
];

export default function Landing() {
  useEffect(() => {
    document.body.classList.add("mordi-landing");
    return () => document.body.classList.remove("mordi-landing");
  }, []);

  return (
    <div className="lp">
      <header>
        <nav className="lp-nav">
          <Link to="/" className="lp-mark">
            Mordi <span>Deck Log</span>
          </Link>
          <div className="lp-nav-actions">
            <Link to="/login" className="lp-btn lp-btn--ghost">
              Sign in
            </Link>
            <Link to="/register" className="lp-btn lp-btn--primary">
              Start a log
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div>
            <p className="lp-eyebrow">Personal accountability</p>
            <h1>
              Keep a log.
              <br />
              <em>Read it back.</em>
            </h1>
            <p>
              Mordi is a daily record of what you meant to do and what you
              actually did — entered by hand, fixed to a place and a time, and
              closed out every week so the pattern is impossible to argue with.
            </p>
            <div className="lp-hero-actions">
              <Link to="/register" className="lp-btn lp-btn--primary lp-btn--lg">
                Start a log
              </Link>
              <Link to="/login" className="lp-btn lp-btn--ghost lp-btn--lg">
                Sign in
              </Link>
            </div>
            <p className="lp-hero-note">
              Free · No card · Your entries stay yours
            </p>
          </div>

          {/* Signature element: a ruled log sheet, current day open */}
          <div className="lp-sheet" aria-label="Example week from a Mordi log">
            <div className="lp-sheet-head">
              <span>Week 34 · Run four times</span>
              <b>Open</b>
            </div>
            {WEEK.map((row) => (
              <div
                key={row.day}
                className={`lp-row${row.miss ? " lp-row--miss" : ""}${
                  row.open ? " lp-row--open" : ""
                }`}
              >
                <span className="lp-row-day">{row.day}</span>
                <span className="lp-row-entry">{row.entry}</span>
                <span className="lp-row-mark">{row.mark}</span>
              </div>
            ))}
            <div className="lp-sheet-foot">
              <span>4 of 4 complete</span>
              <strong>12-day streak</strong>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-inner">
            <p className="lp-eyebrow">How it works</p>
            <h2 className="lp-h2">Four things, in order</h2>
            <p className="lp-lede">
              A log is only useful if keeping it is faster than avoiding it.
              Mordi is built around one entry a day.
            </p>
            <div className="lp-grid">
              {CAPABILITIES.map((c, i) => (
                <div className="lp-cell" key={c.title}>
                  <span className="lp-cell-idx">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-build">
          <div className="lp-inner">
            <p className="lp-eyebrow">Colophon</p>
            <h2 className="lp-h2">How it's built</h2>
            <p className="lp-lede">
              Mordi is a working portfolio project, running in production on
              infrastructure I provisioned and maintain.
            </p>
            <div className="lp-stack">
              {[
                "Java 22",
                "Spring Boot",
                "Spring Security",
                "React",
                "Vite",
                "PostgreSQL",
                "Redis",
                "Docker",
                "Kubernetes",
                "nginx",
                "Oracle Cloud",
              ].map((t) => (
                <span className="lp-chip" key={t}>
                  {t}
                </span>
              ))}
            </div>
            <dl className="lp-specs">
              <div className="lp-spec">
                <dt>API</dt>
                <dd>
                  Spring Boot REST service with stateless JWT auth, BCrypt
                  hashing, and a Spring Security filter chain.
                </dd>
              </div>
              <div className="lp-spec">
                <dt>Data</dt>
                <dd>
                  PostgreSQL for durable records, Redis for cached report
                  aggregates.
                </dd>
              </div>
              <div className="lp-spec">
                <dt>Delivery</dt>
                <dd>
                  Four containerized services behind an nginx reverse proxy with
                  Let's Encrypt TLS.
                </dd>
              </div>
              <div className="lp-spec">
                <dt>Source</dt>
                <dd>
                  <a href="https://github.com/SailmanSeeulater/Mordi">
                    github.com/SailmanSeeulater/Mordi
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="lp-section lp-close">
          <div className="lp-inner">
            <h2 className="lp-h2">Start today's entry</h2>
            <p className="lp-lede">
              The first week is the only hard one. After that you're just
              keeping the record going.
            </p>
            <Link to="/register" className="lp-btn lp-btn--primary lp-btn--lg">
              Start a log
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <span>Mordi · latesailor.dev</span>
        <span>
          Built by Perfect Phanitchaleun ·{" "}
          <a href="https://github.com/SailmanSeeulater/Mordi">Source</a>
        </span>
      </footer>
    </div>
  );
}