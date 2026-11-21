# Mera Bharat — Travel Tour Website (with backend)

Static Mera Bharat tourism site, now with a small Node.js backend:

- **Booking form** submissions are saved to a SQLite database.
- **Contact form** submissions are saved to the same database.
- **Sign Up modal** creates accounts (scrypt-hashed passwords, unique email).
- **Navbar search** live-filters the package cards; Search button jumps to results.
- **Package "Book Now" buttons** prefill the booking form with that destination.
- **Admin panel** at `/admin` (password protected) shows all bookings, messages and sign ups.
- Footer social icons link to the real social platforms.
- Frontend design is unchanged; everything was wired to actually work.

## Live

The site is deployed on Render: https://mera-bharat-htt4.onrender.com

Admin panel: https://mera-bharat-htt4.onrender.com/admin

## Run locally

Requires Node.js 22.5 or newer (uses the built-in `node:sqlite`).

```bash
npm install
npm start
```

Open http://localhost:3000 — the site works exactly as before, but the
Book and Contact forms now save submissions.

Admin panel: http://localhost:3000/admin
Default login: user `admin`, password `merabharat-admin`
(**change this before deploying** — see below).

## Configuration (environment variables)

| Variable        | Default                  | Purpose                        |
|-----------------|--------------------------|--------------------------------|
| `PORT`          | `3000`                   | Server port                    |
| `ADMIN_USER`    | `admin`                  | Admin panel username           |
| `ADMIN_PASSWORD`| `merabharat-admin`       | Admin panel password           |
| `DATABASE_PATH` | `./data/mera-bharat.db`  | SQLite database file location  |

## Free deploy (Render — no card required)

1. Push this folder to a GitHub repo.
2. On https://render.com create a **Web Service** from the repo (free tier):
   - Build command: `npm install`
   - Start command: `npm start`
   - Add env vars `ADMIN_USER` and `ADMIN_PASSWORD` (a strong password).
3. Render gives a public URL like `https://mera-bharat.onrender.com`.

**Note:** Render's free tier has an ephemeral filesystem, so the SQLite
database resets when the service restarts or redeploys. Fine for a demo.
For data that survives restarts, the next free step is a hosted DB
(Turso free tier) — ask and it can be swapped in without changing the
frontend.

## Project layout

```
server.js          Express server + API + admin panel
public/            The website (index.html, style.css, app.js, images)
data/              SQLite database (created on first run)
```

API:

- `POST /api/bookings` — `{where_to, how_many, arrivals, leaving, details}`
- `POST /api/contacts` — `{name, email, message}`
- `POST /api/signups` — `{name, email, password}` (password stored scrypt-hashed)
- `GET /admin` — admin panel (Basic Auth)
- `GET /api/bookings`, `GET /api/contacts`, `GET /api/signups` — JSON export (Basic Auth; signups export never includes password hashes)
