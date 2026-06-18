import json
import sqlite3
import os
import sys
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from datetime import date, datetime
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), "studioflow.db")

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        studio_name TEXT NOT NULL DEFAULT 'Meu Estúdio',
        email       TEXT NOT NULL UNIQUE,
        password    TEXT NOT NULL,
        whatsapp    TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        phone      TEXT NOT NULL,
        email      TEXT,
        notes      TEXT,
        visits     INTEGER NOT NULL DEFAULT 0,
        last_visit TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        duration   INTEGER NOT NULL,
        price      REAL NOT NULL,
        category   TEXT NOT NULL DEFAULT 'Outros',
        active     INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        service_id  TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        date        TEXT NOT NULL,
        time        TEXT NOT NULL,
        duration    INTEGER NOT NULL,
        status      TEXT NOT NULL DEFAULT 'aguardando'
                    CHECK(status IN ('confirmado','aguardando','concluido','cancelado')),
        notes       TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
        user_id              TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        notify_new           INTEGER NOT NULL DEFAULT 1,
        notify_cancel        INTEGER NOT NULL DEFAULT 1,
        notify_confirm       INTEGER NOT NULL DEFAULT 1,
        notify_daily_email   INTEGER NOT NULL DEFAULT 0,
        notify_weekly        INTEGER NOT NULL DEFAULT 1,
        wa_confirm_24h       INTEGER NOT NULL DEFAULT 1,
        wa_reminder_2h       INTEGER NOT NULL DEFAULT 1,
        wa_thanks            INTEGER NOT NULL DEFAULT 0,
        pref_dark_auto       INTEGER NOT NULL DEFAULT 0,
        pref_show_values     INTEGER NOT NULL DEFAULT 1,
        pref_block_lunch     INTEGER NOT NULL DEFAULT 1,
        pref_allow_sunday    INTEGER NOT NULL DEFAULT 0
    );
    """)

    # Seed demo user if empty
    row = c.execute("SELECT id FROM users LIMIT 1").fetchone()
    if not row:
        _seed(c)

    conn.commit()
    conn.close()


def _seed(c):
    """Insert demo data matching the frontend mock."""
    import hashlib

    uid = "user-demo"
    pw = hashlib.sha256("demo123".encode()).hexdigest()

    c.execute("""
        INSERT INTO users (id, name, studio_name, email, password, whatsapp)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (uid, "Isabel Rocha", "Studio Isabel Lashes", "isabel@studio.com", pw, "(11) 99876-5432"))

    c.execute("INSERT INTO settings (user_id) VALUES (?)", (uid,))

    clients_data = [
        ("c1", "Beatriz Cavalcante", "(11) 98765-4321", "bia@email.com", "Prefere atendimentos pela manhã. Alérgica a látex.", 12, "2026-05-10"),
        ("c2", "Amanda Martins", "(11) 99123-4567", "amanda.m@email.com", "Cliente VIP — sempre vem com indicações.", 24, "2026-05-15"),
        ("c3", "Luana Ferreira", "(11) 97654-3210", None, "Pele oleosa, micropigmentação delicada.", 6, "2026-04-28"),
        ("c4", "Camila Rocha", "(11) 98888-1234", "camila.r@email.com", None, 3, "2026-05-12"),
        ("c5", "Fernanda Lima", "(11) 96655-2211", None, "Indicação da Amanda.", 1, "2026-05-05"),
        ("c6", "Patrícia Mendes", "(11) 99887-7665", "paty@email.com", None, 8, "2026-05-09"),
        ("c7", "Juliana Souza", "(11) 91122-3344", None, None, 15, "2026-05-14"),
        ("c8", "Bruna Oliveira", "(11) 93344-5566", "bruna.o@email.com", "Sensível a perfumes.", 4, "2026-04-20"),
    ]
    for row in clients_data:
        c.execute("""
            INSERT INTO clients (id, user_id, name, phone, email, notes, visits, last_visit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (row[0], uid, row[1], row[2], row[3], row[4], row[5], row[6]))

    services_data = [
        ("s1", "Lash Lifting", 60, 120, "Cílios"),
        ("s2", "Volume Russo", 90, 220, "Cílios"),
        ("s3", "Volume Brasileiro", 75, 180, "Cílios"),
        ("s4", "Design de Sobrancelha", 30, 60, "Sobrancelha"),
        ("s5", "Design + Henna", 45, 80, "Sobrancelha"),
        ("s6", "Microblading", 120, 450, "Sobrancelha"),
        ("s7", "Limpeza de Pele Profunda", 75, 150, "Estética"),
    ]
    for row in services_data:
        c.execute("""
            INSERT INTO services (id, user_id, name, duration, price, category)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (row[0], uid, row[1], row[2], row[3], row[4]))

    today = date.today().isoformat()
    tomorrow = date.fromordinal(date.today().toordinal() + 1).isoformat()

    appointments_data = [
        ("a1", "c1", "s1", today, "09:00", 60, "confirmado", "Cliente sensível, usar máscara hipoalergênica."),
        ("a2", "c2", "s2", today, "10:30", 90, "aguardando", None),
        ("a3", "c3", "s6", today, "14:00", 120, "concluido", None),
        ("a4", "c4", "s4", today, "16:30", 45, "confirmado", None),
        ("a5", "c5", "s1", tomorrow, "09:30", 60, "confirmado", None),
        ("a6", "c6", "s5", tomorrow, "11:00", 45, "aguardando", None),
        ("a7", "c7", "s2", tomorrow, "15:00", 90, "confirmado", None),
    ]
    for row in appointments_data:
        c.execute("""
            INSERT INTO appointments (id, user_id, client_id, service_id, date, time, duration, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (row[0], uid, row[1], row[2], row[3], row[4], row[5], row[6], row[7]))


# ---------------------------------------------------------------------------
# Auth helpers (simple token = user_id for demo; production use JWT)
# ---------------------------------------------------------------------------

import hashlib

def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def check_password(pw: str, hashed: str) -> bool:
    return hash_password(pw) == hashed


# In-memory session store: token -> user_id
_sessions: dict[str, str] = {}


def create_session(user_id: str) -> str:
    token = str(uuid.uuid4())
    _sessions[token] = user_id
    return token


def get_user_id_from_token(token: str) -> str | None:
    return _sessions.get(token)


# ---------------------------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------------------------

class StudioFlowHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"  {self.address_string()} — {format % args}")

    # ---- helpers -----------------------------------------------------------

    def _send(self, status: int, data):
        body = json.dumps(data, ensure_ascii=False, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def _auth(self):
        """Return user_id from Bearer token or None."""
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
            return get_user_id_from_token(token)
        return None

    def _require_auth(self):
        uid = self._auth()
        if not uid:
            self._send(401, {"error": "Não autenticado"})
        return uid

    # ---- routing -----------------------------------------------------------

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_PUT(self):
        self._route("PUT")

    def do_PATCH(self):
        self._route("PATCH")

    def do_DELETE(self):
        self._route("DELETE")

    def _route(self, method: str):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)

        # Strip /api prefix
        if path.startswith("/api"):
            path = path[4:] or "/"

        routes = [
            # Auth
            ("POST", r"^/auth/login$", self.route_login),
            ("POST", r"^/auth/logout$", self.route_logout),
            ("GET",  r"^/auth/me$", self.route_me),

            # Clients
            ("GET",    r"^/clients$", self.route_clients_list),
            ("POST",   r"^/clients$", self.route_clients_create),
            ("GET",    r"^/clients/(?P<id>[^/]+)$", self.route_clients_get),
            ("PUT",    r"^/clients/(?P<id>[^/]+)$", self.route_clients_update),
            ("DELETE", r"^/clients/(?P<id>[^/]+)$", self.route_clients_delete),

            # Services
            ("GET",    r"^/services$", self.route_services_list),
            ("POST",   r"^/services$", self.route_services_create),
            ("GET",    r"^/services/(?P<id>[^/]+)$", self.route_services_get),
            ("PUT",    r"^/services/(?P<id>[^/]+)$", self.route_services_update),
            ("DELETE", r"^/services/(?P<id>[^/]+)$", self.route_services_delete),

            # Appointments
            ("GET",    r"^/appointments$", self.route_appointments_list),
            ("POST",   r"^/appointments$", self.route_appointments_create),
            ("GET",    r"^/appointments/(?P<id>[^/]+)$", self.route_appointments_get),
            ("PUT",    r"^/appointments/(?P<id>[^/]+)$", self.route_appointments_update),
            ("PATCH",  r"^/appointments/(?P<id>[^/]+)/status$", self.route_appointments_status),
            ("DELETE", r"^/appointments/(?P<id>[^/]+)$", self.route_appointments_delete),

            # Dashboard
            ("GET", r"^/dashboard$", self.route_dashboard),

            # Settings
            ("GET",  r"^/settings$", self.route_settings_get),
            ("PUT",  r"^/settings$", self.route_settings_update),

            # Profile
            ("PUT", r"^/profile$", self.route_profile_update),
        ]

        for m, pattern, handler in routes:
            if m != method:
                continue
            match = re.fullmatch(pattern, path)
            if match:
                handler(qs=qs, params=match.groupdict())
                return

        self._send(404, {"error": f"Rota não encontrada: {method} {path}"})

    # =========================================================================
    # Auth routes
    # =========================================================================

    def route_login(self, qs, params):
        body = self._read_body()
        email = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""

        if not email or not password:
            self._send(400, {"error": "E-mail e senha são obrigatórios"})
            return

        conn = get_db()
        row = conn.execute(
            "SELECT * FROM users WHERE lower(email) = ?", (email,)
        ).fetchone()
        conn.close()

        if not row or not check_password(password, row["password"]):
            self._send(401, {"error": "E-mail ou senha incorretos"})
            return

        token = create_session(row["id"])
        self._send(200, {
            "token": token,
            "user": {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "studio_name": row["studio_name"],
                "whatsapp": row["whatsapp"],
            }
        })

    def route_logout(self, qs, params):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
            _sessions.pop(token, None)
        self._send(200, {"message": "Logout realizado"})

    def route_me(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        conn = get_db()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
        conn.close()
        if not row:
            self._send(404, {"error": "Usuário não encontrado"})
            return
        self._send(200, {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "studio_name": row["studio_name"],
            "whatsapp": row["whatsapp"],
        })

    # =========================================================================
    # Client routes
    # =========================================================================

    def route_clients_list(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        q = (qs.get("q", [""])[0] or "").strip()
        conn = get_db()
        if q:
            rows = conn.execute("""
                SELECT * FROM clients WHERE user_id = ?
                AND (lower(name) LIKE ? OR phone LIKE ? OR lower(email) LIKE ?)
                ORDER BY name
            """, (uid, f"%{q.lower()}%", f"%{q}%", f"%{q.lower()}%")).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM clients WHERE user_id = ? ORDER BY name", (uid,)
            ).fetchall()
        conn.close()
        self._send(200, [dict(r) for r in rows])

    def route_clients_create(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        body = self._read_body()
        name = (body.get("name") or "").strip()
        phone = (body.get("phone") or "").strip()
        if not name or not phone:
            self._send(400, {"error": "Nome e telefone são obrigatórios"})
            return
        cid = str(uuid.uuid4())
        conn = get_db()
        conn.execute("""
            INSERT INTO clients (id, user_id, name, phone, email, notes, visits, last_visit)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        """, (cid, uid, name, phone,
              body.get("email") or None,
              body.get("notes") or None,
              date.today().isoformat()))
        conn.commit()
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (cid,)).fetchone()
        conn.close()
        self._send(201, dict(row))

    def route_clients_get(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        conn = get_db()
        row = conn.execute(
            "SELECT * FROM clients WHERE id = ? AND user_id = ?", (params["id"], uid)
        ).fetchone()
        conn.close()
        if not row:
            self._send(404, {"error": "Cliente não encontrada"})
            return
        self._send(200, dict(row))

    def route_clients_update(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        body = self._read_body()
        conn = get_db()
        existing = conn.execute(
            "SELECT * FROM clients WHERE id = ? AND user_id = ?", (params["id"], uid)
        ).fetchone()
        if not existing:
            conn.close()
            self._send(404, {"error": "Cliente não encontrada"})
            return
        name = body.get("name", existing["name"])
        phone = body.get("phone", existing["phone"])
        email = body.get("email", existing["email"])
        notes = body.get("notes", existing["notes"])
        conn.execute("""
            UPDATE clients SET name=?, phone=?, email=?, notes=? WHERE id=? AND user_id=?
        """, (name, phone, email, notes, params["id"], uid))
        conn.commit()
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (params["id"],)).fetchone()
        conn.close()
        self._send(200, dict(row))

    def route_clients_delete(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        conn = get_db()
        row = conn.execute(
            "SELECT id FROM clients WHERE id = ? AND user_id = ?", (params["id"], uid)
        ).fetchone()
        if not row:
            conn.close()
            self._send(404, {"error": "Cliente não encontrada"})
            return
        conn.execute("DELETE FROM clients WHERE id = ?", (params["id"],))
        conn.commit()
        conn.close()
        self._send(200, {"message": "Cliente removida"})

    # =========================================================================
    # Service routes
    # =========================================================================

    def route_services_list(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM services WHERE user_id = ? AND active = 1 ORDER BY category, name", (uid,)
        ).fetchall()
        conn.close()
        self._send(200, [dict(r) for r in rows])

    def route_services_create(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        body = self._read_body()
        name = (body.get("name") or "").strip()
        if not name:
            self._send(400, {"error": "Nome é obrigatório"})
            return
        sid = str(uuid.uuid4())
        conn = get_db()
        conn.execute("""
            INSERT INTO services (id, user_id, name, duration, price, category)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (sid, uid, name,
              int(body.get("duration") or 60),
              float(body.get("price") or 0),
              body.get("category") or "Outros"))
        conn.commit()
        row = conn.execute("SELECT * FROM services WHERE id = ?", (sid,)).fetchone()
        conn.close()
        self._send(201, dict(row))

    def route_services_get(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        conn = get_db()
        row = conn.execute(
            "SELECT * FROM services WHERE id = ? AND user_id = ?", (params["id"], uid)
        ).fetchone()
        conn.close()
        if not row:
            self._send(404, {"error": "Serviço não encontrado"})
            return
        self._send(200, dict(row))

    def route_services_update(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        body = self._read_body()
        conn = get_db()
        existing = conn.execute(
            "SELECT * FROM services WHERE id = ? AND user_id = ?", (params["id"], uid)
        ).fetchone()
        if not existing:
            conn.close()
            self._send(404, {"error": "Serviço não encontrado"})
            return
        conn.execute("""
            UPDATE services SET name=?, duration=?, price=?, category=?
            WHERE id=? AND user_id=?
        """, (
            body.get("name", existing["name"]),
            int(body.get("duration", existing["duration"])),
            float(body.get("price", existing["price"])),
            body.get("category", existing["category"]),
            params["id"], uid
        ))
        conn.commit()
        row = conn.execute("SELECT * FROM services WHERE id = ?", (params["id"],)).fetchone()
        conn.close()
        self._send(200, dict(row))

    def route_services_delete(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        conn = get_db()
        row = conn.execute(
            "SELECT id FROM services WHERE id = ? AND user_id = ?", (params["id"], uid)
        ).fetchone()
        if not row:
            conn.close()
            self._send(404, {"error": "Serviço não encontrado"})
            return
        # Soft delete to preserve historical appointments
        conn.execute("UPDATE services SET active = 0 WHERE id = ?", (params["id"],))
        conn.commit()
        conn.close()
        self._send(200, {"message": "Serviço removido"})

    # =========================================================================
    # Appointment routes
    # =========================================================================

    def _apt_row_to_dict(self, row) -> dict:
        """Enrich appointment row with client/service names."""
        d = dict(row)
        # Build clientInitials
        name = d.get("client_name") or ""
        parts = name.split()
        d["clientInitials"] = "".join(p[0] for p in parts[:2]).upper()
        return d

    def route_appointments_list(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        date_filter = qs.get("date", [None])[0]
        status_filter = qs.get("status", [None])[0]

        sql = """
            SELECT a.*,
                   c.name  AS client_name,
                   c.phone AS client_phone,
                   s.name  AS service_name,
                   s.price AS service_price
            FROM appointments a
            JOIN clients  c ON c.id = a.client_id
            JOIN services s ON s.id = a.service_id
            WHERE a.user_id = ?
        """
        args = [uid]
        if date_filter:
            sql += " AND a.date = ?"
            args.append(date_filter)
        if status_filter:
            sql += " AND a.status = ?"
            args.append(status_filter)
        sql += " ORDER BY a.date, a.time"

        conn = get_db()
        rows = conn.execute(sql, args).fetchall()
        conn.close()
        self._send(200, [self._apt_row_to_dict(r) for r in rows])

    def route_appointments_create(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        body = self._read_body()

        client_id  = body.get("client_id") or ""
        service_id = body.get("service_id") or ""
        apt_date   = body.get("date") or ""
        apt_time   = body.get("time") or ""

        if not all([client_id, service_id, apt_date, apt_time]):
            self._send(400, {"error": "client_id, service_id, date e time são obrigatórios"})
            return

        conn = get_db()

        # Validate ownership
        client = conn.execute(
            "SELECT * FROM clients WHERE id = ? AND user_id = ?", (client_id, uid)
        ).fetchone()
        service = conn.execute(
            "SELECT * FROM services WHERE id = ? AND user_id = ?", (service_id, uid)
        ).fetchone()

        if not client:
            conn.close()
            self._send(404, {"error": "Cliente não encontrada"})
            return
        if not service:
            conn.close()
            self._send(404, {"error": "Serviço não encontrado"})
            return

        # Check for time conflict
        conflict = conn.execute("""
            SELECT id FROM appointments
            WHERE user_id = ? AND date = ? AND time = ?
            AND status NOT IN ('cancelado')
        """, (uid, apt_date, apt_time)).fetchone()
        if conflict:
            conn.close()
            self._send(409, {"error": "Já existe um agendamento neste horário"})
            return

        aid = str(uuid.uuid4())
        duration = body.get("duration") or service["duration"]
        conn.execute("""
            INSERT INTO appointments (id, user_id, client_id, service_id, date, time, duration, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'aguardando', ?)
        """, (aid, uid, client_id, service_id, apt_date, apt_time,
              int(duration), body.get("notes") or None))

        # Increment client visits counter
        conn.execute("""
            UPDATE clients SET visits = visits + 1, last_visit = ?
            WHERE id = ?
        """, (apt_date, client_id))

        conn.commit()

        row = conn.execute("""
            SELECT a.*, c.name AS client_name, c.phone AS client_phone,
                   s.name AS service_name, s.price AS service_price
            FROM appointments a
            JOIN clients c ON c.id = a.client_id
            JOIN services s ON s.id = a.service_id
            WHERE a.id = ?
        """, (aid,)).fetchone()
        conn.close()
        self._send(201, self._apt_row_to_dict(row))

    def route_appointments_get(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        conn = get_db()
        row = conn.execute("""
            SELECT a.*, c.name AS client_name, c.phone AS client_phone,
                   s.name AS service_name, s.price AS service_price
            FROM appointments a
            JOIN clients c ON c.id = a.client_id
            JOIN services s ON s.id = a.service_id
            WHERE a.id = ? AND a.user_id = ?
        """, (params["id"], uid)).fetchone()
        conn.close()
        if not row:
            self._send(404, {"error": "Agendamento não encontrado"})
            return
        self._send(200, self._apt_row_to_dict(row))

    def route_appointments_update(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        body = self._read_body()
        conn = get_db()
        existing = conn.execute(
            "SELECT * FROM appointments WHERE id = ? AND user_id = ?", (params["id"], uid)
        ).fetchone()
        if not existing:
            conn.close()
            self._send(404, {"error": "Agendamento não encontrado"})
            return
        conn.execute("""
            UPDATE appointments
            SET client_id=?, service_id=?, date=?, time=?, duration=?, notes=?
            WHERE id=? AND user_id=?
        """, (
            body.get("client_id", existing["client_id"]),
            body.get("service_id", existing["service_id"]),
            body.get("date", existing["date"]),
            body.get("time", existing["time"]),
            int(body.get("duration", existing["duration"])),
            body.get("notes", existing["notes"]),
            params["id"], uid
        ))
        conn.commit()
        row = conn.execute("""
            SELECT a.*, c.name AS client_name, c.phone AS client_phone,
                   s.name AS service_name, s.price AS service_price
            FROM appointments a
            JOIN clients c ON c.id = a.client_id
            JOIN services s ON s.id = a.service_id
            WHERE a.id = ?
        """, (params["id"],)).fetchone()
        conn.close()
        self._send(200, self._apt_row_to_dict(row))

    def route_appointments_status(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        body = self._read_body()
        status = body.get("status") or ""
        valid = ("confirmado", "aguardando", "concluido", "cancelado")
        if status not in valid:
            self._send(400, {"error": f"Status inválido. Válidos: {valid}"})
            return
        conn = get_db()
        row = conn.execute(
            "SELECT id FROM appointments WHERE id = ? AND user_id = ?", (params["id"], uid)
        ).fetchone()
        if not row:
            conn.close()
            self._send(404, {"error": "Agendamento não encontrado"})
            return
        conn.execute(
            "UPDATE appointments SET status = ? WHERE id = ?", (status, params["id"])
        )
        conn.commit()
        row = conn.execute("""
            SELECT a.*, c.name AS client_name, c.phone AS client_phone,
                   s.name AS service_name, s.price AS service_price
            FROM appointments a
            JOIN clients c ON c.id = a.client_id
            JOIN services s ON s.id = a.service_id
            WHERE a.id = ?
        """, (params["id"],)).fetchone()
        conn.close()
        self._send(200, self._apt_row_to_dict(row))

    def route_appointments_delete(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        conn = get_db()
        row = conn.execute(
            "SELECT id FROM appointments WHERE id = ? AND user_id = ?", (params["id"], uid)
        ).fetchone()
        if not row:
            conn.close()
            self._send(404, {"error": "Agendamento não encontrado"})
            return
        conn.execute("DELETE FROM appointments WHERE id = ?", (params["id"],))
        conn.commit()
        conn.close()
        self._send(200, {"message": "Agendamento removido"})

    # =========================================================================
    # Dashboard
    # =========================================================================

    def route_dashboard(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        today = date.today().isoformat()
        conn = get_db()

        today_count = conn.execute("""
            SELECT COUNT(*) FROM appointments
            WHERE user_id = ? AND date = ? AND status != 'cancelado'
        """, (uid, today)).fetchone()[0]

        upcoming = conn.execute("""
            SELECT COUNT(*) FROM appointments
            WHERE user_id = ? AND date >= ? AND status IN ('confirmado','aguardando')
        """, (uid, today)).fetchone()[0]

        total_clients = conn.execute(
            "SELECT COUNT(*) FROM clients WHERE user_id = ?", (uid,)
        ).fetchone()[0]

        # New clients this month
        first_of_month = today[:8] + "01"
        new_clients = conn.execute("""
            SELECT COUNT(*) FROM clients
            WHERE user_id = ? AND last_visit >= ?
        """, (uid, first_of_month)).fetchone()[0]

        # Revenue today (concluded)
        today_revenue = conn.execute("""
            SELECT COALESCE(SUM(s.price), 0)
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.user_id = ? AND a.date = ? AND a.status = 'concluido'
        """, (uid, today)).fetchone()[0]

        # Revenue this week (Mon–today)
        from datetime import timedelta
        today_dt = date.today()
        monday = today_dt - timedelta(days=today_dt.weekday())
        week_revenue = conn.execute("""
            SELECT COALESCE(SUM(s.price), 0)
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.user_id = ? AND a.date >= ? AND a.date <= ?
            AND a.status = 'concluido'
        """, (uid, monday.isoformat(), today)).fetchone()[0]

        # Revenue by day this week
        revenue_week = []
        days_pt = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
        for i in range(7):
            d = (monday + timedelta(days=i)).isoformat()
            val = conn.execute("""
                SELECT COALESCE(SUM(s.price), 0)
                FROM appointments a
                JOIN services s ON s.id = a.service_id
                WHERE a.user_id = ? AND a.date = ? AND a.status = 'concluido'
            """, (uid, d)).fetchone()[0]
            revenue_week.append({"day": days_pt[i], "value": float(val)})

        # Popular services
        popular = conn.execute("""
            SELECT s.name, COUNT(*) AS cnt
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.user_id = ?
            GROUP BY s.id
            ORDER BY cnt DESC
            LIMIT 4
        """, (uid,)).fetchall()

        # Retention rate (clients with > 1 visit)
        total_c = conn.execute(
            "SELECT COUNT(*) FROM clients WHERE user_id = ?", (uid,)
        ).fetchone()[0]
        returning = conn.execute(
            "SELECT COUNT(*) FROM clients WHERE user_id = ? AND visits > 1", (uid,)
        ).fetchone()[0]
        retention = round((returning / total_c * 100) if total_c > 0 else 0)

        conn.close()
        self._send(200, {
            "stats": {
                "todayAppointments": today_count,
                "upcoming": upcoming,
                "totalClients": total_clients,
                "estimatedRevenue": float(today_revenue),
                "weekRevenue": float(week_revenue),
                "newClients": new_clients,
                "retentionRate": retention,
            },
            "revenueWeek": revenue_week,
            "popularServices": [{"name": r["name"], "count": r["cnt"]} for r in popular],
        })

    # =========================================================================
    # Settings
    # =========================================================================

    def route_settings_get(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        conn = get_db()
        row = conn.execute("SELECT * FROM settings WHERE user_id = ?", (uid,)).fetchone()
        if not row:
            conn.execute("INSERT INTO settings (user_id) VALUES (?)", (uid,))
            conn.commit()
            row = conn.execute("SELECT * FROM settings WHERE user_id = ?", (uid,)).fetchone()
        conn.close()
        self._send(200, dict(row))

    def route_settings_update(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        body = self._read_body()
        conn = get_db()
        existing = conn.execute("SELECT * FROM settings WHERE user_id = ?", (uid,)).fetchone()
        if not existing:
            conn.execute("INSERT INTO settings (user_id) VALUES (?)", (uid,))
            conn.commit()
            existing = conn.execute("SELECT * FROM settings WHERE user_id = ?", (uid,)).fetchone()
        fields = [
            "notify_new", "notify_cancel", "notify_confirm", "notify_daily_email",
            "notify_weekly", "wa_confirm_24h", "wa_reminder_2h", "wa_thanks",
            "pref_dark_auto", "pref_show_values", "pref_block_lunch", "pref_allow_sunday",
        ]
        updates = {f: int(body[f]) if f in body else existing[f] for f in fields}
        conn.execute("""
            UPDATE settings SET
                notify_new=:notify_new, notify_cancel=:notify_cancel,
                notify_confirm=:notify_confirm, notify_daily_email=:notify_daily_email,
                notify_weekly=:notify_weekly, wa_confirm_24h=:wa_confirm_24h,
                wa_reminder_2h=:wa_reminder_2h, wa_thanks=:wa_thanks,
                pref_dark_auto=:pref_dark_auto, pref_show_values=:pref_show_values,
                pref_block_lunch=:pref_block_lunch, pref_allow_sunday=:pref_allow_sunday
            WHERE user_id=:user_id
        """, {**updates, "user_id": uid})
        conn.commit()
        row = conn.execute("SELECT * FROM settings WHERE user_id = ?", (uid,)).fetchone()
        conn.close()
        self._send(200, dict(row))

    # =========================================================================
    # Profile
    # =========================================================================

    def route_profile_update(self, qs, params):
        uid = self._require_auth()
        if not uid:
            return
        body = self._read_body()
        conn = get_db()
        existing = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
        if not existing:
            conn.close()
            self._send(404, {"error": "Usuário não encontrado"})
            return

        name        = body.get("name", existing["name"])
        studio_name = body.get("studio_name", existing["studio_name"])
        email       = body.get("email", existing["email"])
        whatsapp    = body.get("whatsapp", existing["whatsapp"])

        # If changing password
        new_pw = body.get("password")
        pw_hash = hash_password(new_pw) if new_pw else existing["password"]

        conn.execute("""
            UPDATE users SET name=?, studio_name=?, email=?, whatsapp=?, password=?
            WHERE id=?
        """, (name, studio_name, email, whatsapp, pw_hash, uid))
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
        conn.close()
        self._send(200, {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "studio_name": row["studio_name"],
            "whatsapp": row["whatsapp"],
        })


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    port = int(os.environ.get("PORT", 8000))
    init_db()
    server = HTTPServer(("0.0.0.0", port), StudioFlowHandler)
    print(f"✨ StudioFlow API rodando em http://localhost:{port}")
    print(f"   Banco de dados: {DB_PATH}")
    print(f"   Demo login: isabel@studio.com / demo123")
    print("   Pressione Ctrl+C para parar.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor encerrado.")


if __name__ == "__main__":
    main()
