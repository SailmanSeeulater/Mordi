# Mordi: from web app to Windows desktop app

A summary of what Mordi is today, and a proposal for taking it to a native
Windows app written in C++ and JavaScript.

---

## Part 1: What Mordi is today

### The product

Mordi is a personal habit and time tracker. You set weekly goals, log what you
did (with an optional mood, place, and duration), and the app shows how your
week is going and what your year has looked like.

| Area | What it does |
|---|---|
| **Week card** | Completion percent for the week, streak, entry count, a Mon–Sun strip of days (click one to open the month calendar), plus clock and weather chips |
| **Goal rings** | One progress ring per goal, dashed until something is logged; draggable |
| **Goal deck** | Goals as a stack of cards that fans open; reorder by dragging |
| **Time logger** | Name an action, start a timer, stop, then save it as an entry with a duration. Survives reloads and stays in sync across tabs |
| **Activity** | GitHub-style heatmap of the last year, darker the more you logged; drag to scroll |
| **Notes** | Up to 5 per user, pinnable |
| **To do** | One-line to-dos: add, tick, clear done |
| **Lately** | Feed of recent entries grouped by day, auto-scrolling, click to pause |
| **Goals / Places / Reports / Settings** | Goal management, location history on Google Maps, weekly mood and completion reports, account and theme settings |
| **Look** | 25 matte themes (16 light, 9 dark), all WCAG-checked; the dashboard's sections can be rearranged |

### The stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router 7, axios, recharts, Google Maps JS API |
| Backend | Java 21, Spring Boot 3.5, Spring Security, JPA/Hibernate |
| Data | PostgreSQL 16 with Flyway migrations (V1–V8), Redis for login rate limiting |
| Auth | 15-minute JWT access tokens, plus a 30-day rotating refresh token in an httpOnly `SameSite=Strict` cookie. Reusing a rotated token revokes the whole token family |
| Tests | ~93 JUnit/Mockito backend tests, ~180 Vitest/Testing Library frontend tests, ESLint, theme-contrast checker |
| Hosting | Oracle Cloud VPS, host nginx + Let's Encrypt, Docker Compose (postgres, redis, backend, frontend) |
| CI/CD | GitHub Actions runs tests on every push/PR; deploys build images in CI, push to GHCR, and the VPS pulls them pinned to the commit sha |

### API surface

All under `/api`, bearer-token authenticated except `auth`:

- `auth` — `register`, `login`, `refresh`, `logout`
- `goals` — CRUD
- `behaviors` (log entries) — CRUD, `today`, `range?start&end`
- `locations` — CRUD
- `notes` — CRUD, `limit`
- `todos` — CRUD, `DELETE /done`
- `reports` — `generate`

The frontend calls the API with a **relative** base URL (`baseURL: ""`) and
relies on nginx serving both on one origin. That detail matters a lot for the
desktop app (see [Auth](#the-one-real-problem-auth)).

---

## Part 2: The desktop app

### Why a desktop app at all

A desktop app is only worth building if it does things a browser tab can't.
For a habit and time tracker, those are clear:

1. **Always there.** A tray icon showing the running timer, with no tab to lose.
2. **Global hotkey quick-log.** Press a shortcut anywhere in Windows, a small
   popup appears, type "read 20 pages", Enter, gone.
3. **Idle detection.** Auto-pause the timer when you walk away, and ask on
   return whether to keep the idle time.
4. **Automatic time tracking (opt-in).** Record which app is in the
   foreground, and turn a stretch of VS Code into a suggested "Coding, 1h 40m"
   entry you confirm with one click.
5. **Native reminders.** Windows toast notifications: "You haven't logged
   Gym this week, 2 of 3 left."
6. **Works offline.** Log on a plane; it syncs when you're back.
7. **Starts with Windows**, single instance, remembers its window.

Everything else — the dashboard, goals, reports, themes — already exists in
React and should be reused, not rewritten.

### Choosing the architecture

| Option | UI | Where C++ fits | Install size | Verdict |
|---|---|---|---|---|
| **C++ Win32 host + WebView2 + existing React** | Reused as is | The whole native shell: window, tray, hotkeys, tracking, storage | A few MB (uses the WebView2 runtime already on Windows 10/11) | **Recommended** |
| Electron + C++ native addon (N-API) | Reused as is | Only the addon; Electron does the rest | Well over 100 MB | Easiest, but C++ is a side dish and the size is hard to justify |
| Qt 6 / QML | Rewritten in QML (which is JavaScript) | Everything | Tens of MB | Truly native, but throws away the React app; check Qt licensing |
| `webview/webview` library | Reused | Thin wrapper over WebView2 | A few MB | Good way to prototype, less control than WebView2 directly |
| Tauri | Reused | None: it's Rust | Small | Great tool, but doesn't meet the C++ brief |

**Recommendation: a C++ Win32 app hosting the React build in WebView2.** The
React app stays the UI, C++ owns everything native, and the two talk over a
small message bridge. It's the only option where both languages do real,
visible work — which is also what makes it a strong portfolio piece.

### How it fits together

```
┌──────────────────────── mordi.exe (C++) ────────────────────────┐
│                                                                 │
│  Win32 window ── WebView2 ── https://app.mordi/  (React build)  │
│                     ▲                                           │
│                     │ JSON-RPC over postMessage                 │
│                     ▼                                           │
│  Bridge ── Timer · Tray · Hotkey · Idle · Activity · Toasts     │
│    │       Credential store (DPAPI) · SQLite (cache + outbox)   │
│    │                                                            │
└────┼────────────────────────────────────────────────────────────┘
     │ WinHTTP (refresh only)            React → axios (bearer)
     ▼                                            │
  https://latesailor.dev/api  ◄───────────────────┘
```

**Loading the UI.** Ship the Vite `dist/` folder next to the exe and map it to
a virtual host with `SetVirtualHostNameToFolderMapping("app.mordi", ...)`, so
the app runs at `https://app.mordi/` — a real HTTPS origin, no local server.
Two consequences:

- Virtual host mapping has no SPA fallback, so reloading `/goals` 404s. Use
  `HashRouter` in the desktop build (a one-line switch on a build flag).
- The API base URL can no longer be relative. Make it a build-time setting
  (`VITE_API_BASE`), defaulting to `""` for the web build.

**The bridge.** Use WebView2's `PostWebMessageAsJson` / `WebMessageReceived`
with a small typed JSON-RPC contract (`{ id, method, params }` →
`{ id, result | error }`), rather than `AddHostObjectToScript`. It's explicit,
easy to version, and easy to test from both sides. The C++ side must **check
the message's source origin** and drop anything not from `https://app.mordi`,
so a page that somehow navigates elsewhere can't call native code.

On the JavaScript side, add one module, `platform.js`, with the same interface
in two implementations: `platform.web.js` (localStorage, browser geolocation,
no-ops for tray and hotkeys) and `platform.desktop.js` (calls into the
bridge). Components call `platform`, never the bridge directly, so the web app
keeps working unchanged.

### The one real problem: auth

This is the part that will break if nobody plans for it.

Today the refresh token lives in a `SameSite=Strict` cookie on
`latesailor.dev`. In the desktop app the UI runs on `https://app.mordi/` and
calls `https://latesailor.dev/api`, which is a **cross-site** request. The
browser engine will not send a `SameSite=Strict` cookie cross-site, so refresh
silently fails and the user is logged out every 15 minutes.

Don't weaken the web cookie to fix it. Give the desktop its own flow instead:

1. `POST /api/auth/desktop/login` — same as login, but returns the refresh
   token in the response body instead of a cookie.
2. `POST /api/auth/desktop/refresh` — takes the refresh token in the body,
   rotates it exactly like today (same family revocation), returns both tokens.
3. **C++ holds the refresh token**, encrypted with DPAPI
   (`CryptProtectData`) or in Windows Credential Manager (`CredWriteW`).
   JavaScript never sees it; it asks the bridge for a fresh access token.

Point 3 is what keeps the desktop as safe as the web: on the web, `httpOnly`
stops injected script from reading the refresh token; on the desktop, keeping
it in C++ does the same job.

Also add `https://app.mordi` to the backend's CORS allowed origins.

### Native features, and the Windows APIs behind them

| Feature | Windows API | Notes |
|---|---|---|
| Tray icon + menu | `Shell_NotifyIconW` | Tooltip shows the running timer; menu: start/stop, quick log, open, quit |
| Global quick-log hotkey | `RegisterHotKey` | Opens a small borderless WebView2 window; make the shortcut configurable, since conflicts are common |
| Idle detection | `GetLastInputInfo` | Poll every ~30 s; past a threshold, pause and ask on return |
| Foreground app tracking | `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` + `QueryFullProcessImageNameW` | Event-driven, not polling. Record process name + time only, never window titles by default |
| Toast notifications | C++/WinRT `Windows.UI.Notifications` | Needs an AppUserModelID, which comes free with MSIX packaging |
| Token storage | DPAPI / Credential Manager | See auth above |
| Offline cache + outbox | SQLite | Pending writes replayed on reconnect |
| Single instance | Named mutex | Second launch focuses the first window |
| Start with Windows | `HKCU\...\Run`, or an MSIX startup task | Opt-in, off by default |
| Location | `navigator.geolocation` inside WebView2 | Already works; handle WebView2's permission prompt in C++ |

### Moving the timer into C++

Today the running timer is a pair of timestamps in `localStorage`. On the
desktop, the timer has to keep going when the window is closed to the tray,
and the tray, hotkey popup, and main window all need to agree on it. So the
C++ side should own the timer state (persisted to SQLite) and push changes to
any open WebView over the bridge. The React `useTimer` hook keeps its
interface; only its storage moves behind `platform`.

### Offline sync

Log entries, to-dos, notes, and saved timers go into a SQLite **outbox** when
offline and replay on reconnect. Replays can duplicate — a request that
reached the server but whose response was lost gets sent again — so each write
needs a client-generated **idempotency key** (a UUID), and the backend should
store it and return the original result on a repeat. That's one small column
and a unique index per table, plus a Flyway migration. Treat this as a later
phase; everything before it works online-only.

### Privacy (for activity tracking)

Automatic tracking is the most useful feature and the easiest to get wrong.

- **Off by default**, with a plain explanation before turning it on.
- **Local only.** Raw foreground-app data never leaves the machine; only
  entries the user confirms are sent to the server.
- **Process names, not window titles** by default (titles contain document
  names, email subjects, and URLs).
- An **exclude list**, and a one-click "pause tracking".
- A **"delete all tracking data"** button that actually does.

### Project layout

```
Mordi/
├── backend/            # unchanged, plus desktop auth endpoints
├── frontend/           # unchanged, plus platform.js and a desktop build flag
└── desktop/
    ├── CMakeLists.txt
    ├── vcpkg.json      # webview2, wil, nlohmann-json, sqlite3, cppwinrt
    ├── src/
    │   ├── main.cpp            # WinMain, single instance, message loop
    │   ├── app_window.cpp      # Win32 window + WebView2 setup
    │   ├── bridge/             # JSON-RPC dispatch, origin check
    │   ├── auth/               # token store (DPAPI), refresh over WinHTTP
    │   ├── timer/              # authoritative timer state
    │   ├── native/             # tray, hotkey, idle, activity, toasts
    │   └── storage/            # SQLite cache + outbox
    ├── resources/              # icon, manifest (DPI awareness), version info
    └── tests/                  # GoogleTest: bridge, timer, outbox, token store
```

**Toolchain:** MSVC + CMake + vcpkg. C++20. WIL for COM/handle RAII.
**Tests:** GoogleTest for the C++ side (bridge parsing, timer math, outbox
replay, token store round-trip); Vitest keeps covering React, including both
`platform` implementations.

### Packaging and distribution

- **Installer:** MSIX is the modern choice (clean install/uninstall, gives you
  the AppUserModelID toasts need, built-in updates via App Installer). Inno
  Setup is the simpler fallback if MSIX fights you.
- **WebView2 runtime:** preinstalled on Windows 11 and nearly all Windows 10.
  Bundle Microsoft's Evergreen bootstrapper for the rest.
- **Code signing:** unsigned installers trigger SmartScreen warnings. A
  signing certificate (for example Azure Trusted Signing) fixes that — check
  current pricing before committing.
- **Updates:** MSIX handles this itself; with Inno Setup, WinSparkle is the
  usual choice.
- **CI:** a `windows-latest` GitHub Actions job that builds the frontend with
  the desktop flag, builds the exe, runs GoogleTest, packages the installer,
  and attaches it to a GitHub Release on a `desktop-v*` tag.

### Roadmap

| Phase | Goal | Done when |
|---|---|---|
| **0. Prepare the web app** | Desktop-ready without breaking the web | `VITE_API_BASE`, `platform.js` (web implementation only), HashRouter behind a flag, desktop auth endpoints with tests, CORS origin added. Web app still passes every test |
| **1. Shell MVP** | The app runs | Window hosts the bundle at `https://app.mordi/`, bridge `ping` works, login + refresh work through the C++ token store, single instance, window position remembered |
| **2. Always there** | Worth installing | Tray with live timer, C++-owned timer, global quick-log hotkey, idle auto-pause, toast reminders |
| **3. Automatic tracking** | The headline feature | Opt-in foreground tracking, local timeline, one-click "save as entry" suggestions, exclude list, delete-all |
| **4. Offline** | Works on a plane | SQLite outbox, idempotency keys end to end, sync status indicator |
| **5. Ship it** | Someone else can install it | Signed MSIX (or Inno Setup), auto-update, CI release job |

Phases 0–2 are a solid, finished app on their own. 3 and 4 are where it gets
genuinely interesting.

### Risks and open questions

- **Cross-site auth** is the biggest risk and is designed for above. Build and
  test it in Phase 0, before any C++ exists.
- **Two WebViews** (main window + quick-log popup) each run their own React
  instance. Keep shared state in C++, not in either window.
- **Hotkey conflicts** — `RegisterHotKey` fails if another app owns the
  shortcut. Surface that clearly and let the user change it.
- **Idempotency** touches every write path on the backend. Worth doing
  properly once rather than per table later.
- **Mac/Linux later?** WebView2 is Windows-only. If cross-platform ever
  matters, the `webview/webview` library abstracts WebView2, WKWebView, and
  WebKitGTK behind one C++ API; starting on it now would keep that door open
  at the cost of some WebView2-specific control.

### Other ideas worth considering

- **Focus sessions:** a Pomodoro mode on top of the timer, logged as entries.
- **Always-on-top mini widget:** today's rings and the timer in a small
  corner window.
- **Jump list tasks:** right-click the taskbar icon for "Start timer" and
  "Quick log".
- **Local export:** one-click CSV/JSON backup of your own data.
- **Weekly report as a toast** on Sunday evening, opening straight to Reports.
