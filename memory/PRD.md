# PRD — Sistem Pemesanan Ruangan Laboratorium FH UNRI

## Original Problem Statement
Web-based booking system for 2 lab rooms (Labor 1 & Labor 2) at Fakultas Hukum, Universitas Riau. Goal: prevent schedule conflicts with tiered approval workflow (Kepala Labor → Tata Usaha). 4 fixed roles: Mahasiswa (no password), Kepala Labor, TU, Admin/Dekan. Bahasa Indonesia UI.

## User Choices (initial session)
- Auth: JWT-based custom auth
- Student notifications: skip (booking code + check page only)
- Report export: PDF + Excel
- Real-time TV kiosk: WebSocket
- Default admin: `admin@fh.unri.ac.id` / `admin123`

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB), bcrypt, PyJWT, openpyxl, reportlab
- **Frontend**: React (CRA) + React Router + Tailwind + Shadcn UI + Cabinet Grotesk / IBM Plex Sans fonts + sonner toasts
- **Realtime**: Native WebSocket (`/api/ws`) broadcasting `booking_created` / `booking_updated`
- **Auth**: JWT httpOnly cookie for staff; Mahasiswa unauthenticated with booking-code + NIM lookup

## User Personas
1. **Mahasiswa** — Self-input Nama/NIM/Kelas, submits form, tracks via code
2. **Kepala Labor** — Approves/rejects pending requests
3. **Tata Usaha** — Views master calendar, reschedules with audit log
4. **Admin/Dekan** — Manages users, operating hours, holidays, quotas, kiosk tokens, rooms

## Implemented (Feb 2026)
### Backend
- JWT auth (login/logout/me) + role-based dependency
- Admin seed on startup + rooms seed (Labor 1, Labor 2)
- Public booking form endpoint with CAPTCHA, NIM regex, op-hours, holidays, quota, rate-limit validation
- **Overlap-based conflict detection** (start<end_existing AND end>start_existing) — handles inside/partial/wrap cases
- Race-condition guard on approval (re-checks conflicts at approve time)
- Booking code generator (`LAB-YYYY-XXXX`)
- Public status check (by code or NIM); public edit (while menunggu) + cancel
- Approve/Reject/Reschedule with audit log
- Admin CRUD: users, mahasiswa cache (edit typos), rooms (rename/activate), settings
- Operating hours per weekday + holiday list + quota per class per week + rate limit per IP per hour + SLA reminder + auto-expire past pending
- Kiosk token: generate/revoke/verify
- Excel + PDF exports with filters
- WebSocket broadcast for live kiosk

### Frontend
- Landing page (Swiss + high-contrast) with law building hero
- `/pesan` — Booking form with live conflict feedback + suggested slots
- `/cek-status` — Search by code or NIM, edit/cancel
- `/masuk` — Staff login
- `/dasbor/kepala-labor` — Approval queue (tabs by status)
- `/dasbor/tu` — Monthly calendar + day detail + reschedule
- `/dasbor/admin` — Users, Mahasiswa data, Rooms, Schedule/Holidays, Quota/Rate/SLA, Kiosk
- `/laporan` — Filterable report + PDF/Excel download
- `/kiosk/tv?token=…` — Dark full-screen monthly calendar + today's schedule pane, live WebSocket updates

## Backlog / Next Actions
### P1
- Email/WhatsApp notification for status changes to students (opt-in via contact field)
- Notifications bell UI for staff (backend endpoint exists)
- PWA manifest + service worker for "install to homescreen"

### P2
- Bulk import mahasiswa CSV (Admin)
- Charts on Laporan (utilization per room, peak hours)
- ICS calendar export for TU
- Multi-fakultas support (currently single-fakultas by design)
