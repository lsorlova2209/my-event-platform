import { useState, useEffect, useRef, useCallback, Fragment } from "react"
import axios from "axios"

// Пустая строка = тот же хост (через nginx /api). Локально: VITE_API_URL=http://127.0.0.1:8000
const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"

function mediaUrl(path) {
  if (!path) return ""
  if (/^https?:\/\//i.test(path)) return path
  return `${API}${path}`
}

const inputStyle = {
  width: "100%", padding: "12px",
  border: "1px solid #D3D1C7", borderRadius: "8px",
  fontSize: "16px", boxSizing: "border-box", fontFamily: "Arial"
}
const labelStyle = {
  display: "block", marginBottom: "6px",
  color: "#4A4A48", fontSize: "14px"
}
const btnPrimary = {
  padding: "12px 24px", background: "#1A56A0", color: "white",
  border: "none", borderRadius: "8px", cursor: "pointer",
  fontWeight: "bold", fontSize: "15px"
}
const btnGreen = {
  padding: "12px 24px", background: "#0F6E56", color: "white",
  border: "none", borderRadius: "8px", cursor: "pointer",
  fontWeight: "bold", fontSize: "15px"
}
const btnOutline = {
  padding: "10px 20px", background: "white",
  border: "1px solid #D3D1C7", borderRadius: "8px",
  cursor: "pointer", fontSize: "14px"
}
const btnDanger = {
  padding: "12px 24px", background: "#A32D2D", color: "white",
  border: "none", borderRadius: "8px", cursor: "pointer",
  fontWeight: "bold", fontSize: "15px"
}
const card = {
  background: "white", borderRadius: "16px", padding: "24px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)", marginBottom: "24px"
}
const errorBox = {
  background: "#fde8e8", color: "#A32D2D",
  padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px"
}
const successBox = {
  background: "#d8f2ea", color: "#0F6E56",
  padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px"
}

const COMPETITION_LEVELS = [
  { value: "municipal", label: "Муниципальные" },
  { value: "intermunicipal", label: "Межмуниципальные" },
  { value: "regional", label: "Региональные" },
  { value: "interregional", label: "Межрегиональные" },
  { value: "national", label: "Всероссийские" },
  { value: "international", label: "Международные" },
]
const COMPETITION_LEVEL_LABELS = Object.fromEntries(COMPETITION_LEVELS.map(l => [l.value, l.label]))
// Старые club/region + региональные и выше — в скобках регион, иначе клуб
const REGION_ORG_LEVELS = new Set(["region", "regional", "interregional", "national", "international"])
function usesRegionOrg(level) {
  return REGION_ORG_LEVELS.has(level || "municipal")
}
function competitionLevelLabel(level) {
  if (!level) return COMPETITION_LEVEL_LABELS.municipal
  if (level === "club") return "Муниципальные"
  if (level === "region") return "Региональные"
  return COMPETITION_LEVEL_LABELS[level] || level
}

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatRuDate(iso) {
  if (!iso) return "—"
  const [y, m, d] = String(iso).slice(0, 10).split("-")
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

function tournamentTiming(t, today = todayISO()) {
  const eventDate = String(t.event_date || "").slice(0, 10)
  const closes = t.registration_closes_at ? String(t.registration_closes_at).slice(0, 10) : null
  const isPast = eventDate && eventDate < today
  let registrationLabel = "Заявки по запросу"
  let registrationTone = "neutral"
  if (isPast) {
    registrationLabel = "Турнир завершён"
    registrationTone = "past"
  } else if (closes) {
    if (closes < today) {
      registrationLabel = "Регистрация закрыта"
      registrationTone = "closed"
    } else {
      registrationLabel = `Регистрация до ${formatRuDate(closes)}`
      registrationTone = "open"
    }
  } else if (!isPast) {
    registrationLabel = "Предстоящий турнир"
    registrationTone = "open"
  }
  return { isPast, registrationLabel, registrationTone }
}

const registrationToneStyle = {
  open: { background: "#d8f2ea", color: "#0F6E56" },
  closed: { background: "#fde8e8", color: "#A32D2D" },
  past: { background: "#eceae4", color: "#4A4A48" },
  neutral: { background: "#e8eef7", color: "#1A56A0" },
}

const arenaToneStyle = {
  open: { background: "rgba(15,110,86,0.28)", color: "#8de0c8" },
  closed: { background: "rgba(163,45,45,0.28)", color: "#f0a8a8" },
  past: { background: "rgba(255,255,255,0.08)", color: "rgba(244,245,247,0.65)" },
  neutral: { background: "rgba(47,111,191,0.28)", color: "#9ec0ef" },
}

const HERO_IMG = "/hero-karate.png"

const arenaInputStyle = {
  width: "100%", padding: "12px 14px",
  border: "1px solid rgba(255,255,255,0.16)", borderRadius: "10px",
  fontSize: "16px", boxSizing: "border-box",
  background: "rgba(11,13,16,0.65)", color: "#f4f5f7",
  outline: "none",
}
const arenaLabelStyle = {
  display: "block", marginBottom: "6px",
  color: "rgba(244,245,247,0.72)", fontSize: "13px", fontWeight: 600,
}
const arenaBtnPrimary = {
  padding: "12px 22px", background: "#2f6fbf", color: "white",
  border: "none", borderRadius: "10px", cursor: "pointer",
  fontWeight: 700, fontSize: "15px",
}
const arenaBtnGhost = {
  padding: "12px 22px", background: "transparent", color: "#f4f5f7",
  border: "1px solid rgba(255,255,255,0.35)", borderRadius: "10px", cursor: "pointer",
  fontWeight: 600, fontSize: "15px",
}
const arenaPanel = {
  background: "rgba(21,24,32,0.88)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "16px",
  padding: "28px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 18px 48px rgba(0,0,0,0.4)",
}

// ─── ПУБЛИЧНАЯ ГЛАВНАЯ: АРЕНА + ТУРНИРЫ ───────────────────────────────────────
function PublicHomePage({ onLoginClick, onRegisterClick, onTournamentClick }) {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("upcoming")

  useEffect(() => {
    let cancelled = false
    axios.get(`${API}/api/v1/tournaments/`)
      .then(r => { if (!cancelled) setTournaments(Array.isArray(r.data) ? r.data : []) })
      .catch(() => { if (!cancelled) setTournaments([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const today = todayISO()
  const upcoming = tournaments
    .filter(t => String(t.event_date || "").slice(0, 10) >= today)
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
  const past = tournaments
    .filter(t => String(t.event_date || "").slice(0, 10) < today)
    .sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)))
  const list = tab === "upcoming" ? upcoming : past

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d10", fontFamily: "var(--font-body)", color: "#f4f5f7" }}>
      <section style={{ position: "relative", minHeight: "100vh", overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
        <img
          src={HERO_IMG}
          alt=""
          className="arena-hero-bg"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center 20%",
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, rgba(11,13,16,0.96) 0%, rgba(11,13,16,0.62) 48%, rgba(11,13,16,0.28) 100%), linear-gradient(0deg, rgba(11,13,16,0.96) 0%, rgba(11,13,16,0.25) 45%, rgba(11,13,16,0.5) 100%)",
        }} />
        <div style={{
          position: "relative", zIndex: 1, width: "100%",
          padding: "clamp(28px, 6vw, 72px) clamp(20px, 5vw, 64px) clamp(40px, 8vw, 80px)",
          maxWidth: "1200px",
        }}>
          <div className="arena-hero-copy" style={{ textShadow: "0 2px 24px rgba(0,0,0,0.55)" }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: "clamp(84px, 18vw, 160px)",
              fontWeight: 700, lineHeight: 0.88, letterSpacing: "0.02em",
              textTransform: "uppercase", marginBottom: "22px", color: "#ffffff",
            }}>
              СпортДок
            </div>
            <h1 style={{
              margin: "0 0 18px", fontFamily: "var(--font-display)",
              fontSize: "clamp(34px, 6.5vw, 56px)", fontWeight: 600,
              letterSpacing: "0.04em", textTransform: "uppercase", color: "#ffffff",
            }}>
              Турниры всестилевого каратэ
            </h1>
            <p style={{
              margin: "0 0 34px", maxWidth: "520px",
              color: "rgba(255,255,255,0.92)", fontSize: "clamp(19px, 2.6vw, 24px)",
              lineHeight: 1.5, fontWeight: 500,
            }}>
              Платформа для клубов, заявок и проведения соревнований.
            </p>
          </div>
          <div className="arena-hero-cta" style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <button onClick={onLoginClick} className="arena-btn" style={{ ...arenaBtnPrimary, padding: "16px 32px", fontSize: "18px", borderRadius: "12px" }}>Войти</button>
            <button onClick={onRegisterClick} className="arena-btn" style={{ ...arenaBtnGhost, padding: "16px 32px", fontSize: "18px", borderRadius: "12px" }}>Зарегистрировать клуб</button>
          </div>
        </div>
      </section>

      <main id="tournaments" className="arena-section-in" style={{
        width: "100%", maxWidth: "none", margin: "0",
        padding: "56px clamp(12px, 1.5vw, 20px) 80px",
      }}>
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{
            margin: "0 0 8px", fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 600,
            letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            Турниры
          </h2>
          <p style={{ margin: 0, color: "rgba(244,245,247,0.65)", fontSize: "15px" }}>
            Предстоящие и прошедшие соревнования.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          {[
            { id: "upcoming", label: `Предстоящие (${upcoming.length})` },
            { id: "past", label: `Прошедшие (${past.length})` },
          ].map(item => (
            <button
              key={item.id}
              className="arena-btn"
              onClick={() => setTab(item.id)}
              style={{
                ...arenaBtnGhost,
                padding: "10px 16px",
                borderColor: tab === item.id ? "#2f6fbf" : "rgba(255,255,255,0.16)",
                background: tab === item.id ? "#2f6fbf" : "transparent",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ ...arenaPanel, textAlign: "center", color: "rgba(244,245,247,0.65)" }}>Загрузка турниров…</div>
        ) : list.length === 0 ? (
          <div style={{ ...arenaPanel, textAlign: "center", color: "rgba(244,245,247,0.65)" }}>
            {tab === "upcoming" ? "Предстоящих турниров пока нет." : "Прошедших турниров пока нет."}
          </div>
        ) : (
          <div className="arena-tournament-grid">
            {list.map(t => {
              const timing = tournamentTiming(t, today)
              const tone = arenaToneStyle[timing.registrationTone]
              return (
                <button
                  key={t.id}
                  type="button"
                  className="arena-card"
                  onClick={() => onTournamentClick(t)}
                  style={{
                    textAlign: "left",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "14px",
                    background: "rgba(21,24,32,0.88)",
                    padding: "0",
                    cursor: "pointer",
                    overflow: "hidden",
                    color: "inherit",
                    fontFamily: "inherit",
                  }}
                >
                  {t.cover_image ? (
                    <div style={{ height: "160px", overflow: "hidden", background: "#151820" }}>
                      <img
                        src={mediaUrl(t.cover_image)}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </div>
                  ) : null}
                  <div style={{ padding: "22px 20px 16px" }}>
                    <div style={{
                      fontSize: "15px", color: "#9ec0ef", fontWeight: 700,
                      letterSpacing: "0.06em", marginBottom: "10px", textTransform: "uppercase",
                    }}>
                      {formatRuDate(t.event_date)}
                    </div>
                    <div style={{
                      fontSize: "22px", fontWeight: 700, lineHeight: 1.25,
                      marginBottom: "10px", minHeight: "56px",
                    }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: "16px", color: "rgba(244,245,247,0.7)", marginBottom: "14px" }}>
                      {t.location || "Место уточняется"}
                    </div>
                    <span style={{
                      display: "inline-block", fontSize: "14px", padding: "6px 12px",
                      borderRadius: "6px", background: "rgba(47,111,191,0.22)", color: "#9ec0ef",
                    }}>
                      {competitionLevelLabel(t.competition_level)}
                    </span>
                  </div>
                  <div style={{
                    padding: "14px 20px", fontSize: "15px", fontWeight: 700,
                    borderTop: "1px solid rgba(255,255,255,0.08)", ...tone,
                  }}>
                    {timing.registrationLabel}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── СТРАНИЦА ВХОДА ───────────────────────────────────────────────────────────
function LoginPage({ onLogin, onRegister, onBack, emailConfirmMessage }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async () => {
    try {
      const r = await axios.post(`${API}/api/v1/auth/login`, { email, password })
      if (r.data.success) { onLogin(r.data); setError("") }
      else setError(r.data.message)
    } catch { setError("Ошибка соединения с сервером") }
  }

  return (
    <div style={{
      minHeight: "100vh", position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-body)", padding: "24px",
    }}>
      <img
        src={HERO_IMG}
        alt=""
        className="arena-hero-bg"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center 20%",
        }}
      />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(115deg, rgba(11,13,16,0.94) 0%, rgba(11,13,16,0.72) 55%, rgba(11,13,16,0.55) 100%)",
      }} />
      <div className="arena-hero-copy" style={{ ...arenaPanel, width: "420px", maxWidth: "100%", position: "relative", zIndex: 1 }}>
        {onBack && (
          <button onClick={onBack} className="arena-btn" style={{ ...arenaBtnGhost, marginBottom: "20px", padding: "8px 14px", fontSize: "13px" }}>
            ← К турнирам
          </button>
        )}
        <div style={{
          fontFamily: "var(--font-display)", fontSize: "42px", fontWeight: 700,
          letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1, marginBottom: "8px",
        }}>
          СпортДок
        </div>
        <p style={{ color: "rgba(244,245,247,0.68)", marginBottom: "28px", marginTop: 0 }}>Войдите в систему</p>

        {emailConfirmMessage && (
          <div style={{ ...successBox, background: "rgba(15,110,86,0.28)", color: "#8de0c8", marginBottom: "16px" }}>
            {emailConfirmMessage}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={arenaLabelStyle}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={arenaInputStyle} />
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={arenaLabelStyle}>Пароль</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={arenaInputStyle} />
        </div>

        {error && (
          <div style={{ ...errorBox, background: "rgba(163,45,45,0.28)", color: "#f0a8a8" }}>{error}</div>
        )}

        <button onClick={handleLogin} className="arena-btn" style={{ ...arenaBtnPrimary, width: "100%", padding: "14px", marginBottom: "12px" }}>
          Войти
        </button>
        <button onClick={onRegister} className="arena-btn" style={{ ...arenaBtnGhost, width: "100%", padding: "14px" }}>
          Зарегистрировать клуб
        </button>
      </div>
    </div>
  )
}

// ─── РЕГИСТРАЦИЯ КЛУБА ────────────────────────────────────────────────────────
function ClubRegisterPage({ onBack }) {
  const [form, setForm] = useState({
    responsible_name: "", responsible_position: "", full_name: "",
    short_name: "", region: "", contact_phone: "", email: "",
    password: "", trainers: ""
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.responsible_name || !form.full_name || !form.email || !form.password) {
      setError("Заполните обязательные поля: ФИО ответственного, название клуба, email, пароль")
      return
    }
    try {
      const r = await axios.post(`${API}/api/v1/clubs/register`, form)
      if (r.data.success) { setSuccess(r.data.message); setError("") }
      else setError(r.data.message)
    } catch { setError("Ошибка соединения с сервером") }
  }

  return (
    <div style={{
      minHeight: "100vh", position: "relative", overflow: "hidden",
      fontFamily: "var(--font-body)", padding: "32px 16px",
    }}>
      <img
        src={HERO_IMG}
        alt=""
        className="arena-hero-bg"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center 20%",
        }}
      />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(160deg, rgba(11,13,16,0.95) 0%, rgba(11,13,16,0.78) 50%, rgba(11,13,16,0.9) 100%)",
      }} />
      <div className="arena-hero-copy" style={{ maxWidth: "600px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <button onClick={onBack} className="arena-btn" style={{ ...arenaBtnGhost, marginBottom: "16px", padding: "8px 14px", fontSize: "13px" }}>
          ← К турнирам
        </button>
        <div style={arenaPanel}>
          <h2 style={{
            marginTop: 0, marginBottom: "8px", fontFamily: "var(--font-display)",
            fontSize: "28px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            Регистрация клуба
          </h2>
          <p style={{ color: "rgba(244,245,247,0.68)", marginBottom: "24px", marginTop: 0 }}>
            После регистрации администратор рассмотрит вашу заявку.
          </p>

          {success ? (
            <div>
              <div style={{ ...successBox, background: "rgba(15,110,86,0.28)", color: "#8de0c8" }}>{success}</div>
              <button onClick={onBack} className="arena-btn" style={arenaBtnPrimary}>К турнирам</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "16px" }}>
                <label style={arenaLabelStyle}>ФИО ответственного *</label>
                <input type="text" value={form.responsible_name} onChange={e => set("responsible_name", e.target.value)} style={arenaInputStyle} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={arenaLabelStyle}>Должность</label>
                <input type="text" value={form.responsible_position} onChange={e => set("responsible_position", e.target.value)} placeholder="Президент федерации" style={arenaInputStyle} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={arenaLabelStyle}>Полное название организации *</label>
                <input type="text" value={form.full_name} onChange={e => set("full_name", e.target.value)} style={arenaInputStyle} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={arenaLabelStyle}>Сокращённое название</label>
                <input type="text" value={form.short_name} onChange={e => set("short_name", e.target.value)} placeholder="СК Динамо" style={arenaInputStyle} />
              </div>
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "140px" }}>
                  <label style={arenaLabelStyle}>Регион</label>
                  <input type="text" value={form.region} onChange={e => set("region", e.target.value)} placeholder="Санкт-Петербург" style={arenaInputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: "140px" }}>
                  <label style={arenaLabelStyle}>Телефон</label>
                  <input type="text" value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} placeholder="+7 999 000 00 00" style={arenaInputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={arenaLabelStyle}>Тренеры (ФИО через запятую)</label>
                <input type="text" value={form.trainers} onChange={e => set("trainers", e.target.value)} placeholder="Иванов И.И., Петрова А.С." style={arenaInputStyle} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={arenaLabelStyle}>Email для входа *</label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} style={arenaInputStyle} />
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={arenaLabelStyle}>Пароль *</label>
                <input type="password" value={form.password} onChange={e => set("password", e.target.value)} style={arenaInputStyle} />
              </div>

              {error && (
                <div style={{ ...errorBox, background: "rgba(163,45,45,0.28)", color: "#f0a8a8" }}>{error}</div>
              )}
              <button
                onClick={handleSubmit}
                className="arena-btn"
                style={{ ...arenaBtnPrimary, background: "#0f6e56" }}
              >
                Подать заявку
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ПАНЕЛЬ АДМИНИСТРАТОРА ────────────────────────────────────────────────────
function AdminPanel({ user, onLogout }) {
  const [page, setPage] = useState("tournaments")
  const [tournaments, setTournaments] = useState([])
  const [clubs, setClubs] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [closesDate, setClosesDate] = useState("")
  const [competitionLevel, setCompetitionLevel] = useState("municipal")
  const [chiefJudge, setChiefJudge] = useState("")
  const [chiefSecretary, setChiefSecretary] = useState("")
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState("")
  const coverInputRef = useRef(null)
  const [error, setError] = useState("")
  const [secretaries, setSecretaries] = useState([])
  const [showSecretaryForm, setShowSecretaryForm] = useState(false)
  const [secretaryForm, setSecretaryForm] = useState({ name: "", email: "", password: "" })
  const [secretaryError, setSecretaryError] = useState("")

  const resetTournamentForm = () => {
    setEditingId(null)
    setName(""); setLocation(""); setEventDate(""); setClosesDate("")
    setCompetitionLevel("municipal"); setChiefJudge(""); setChiefSecretary("")
    setCoverFile(null); setCoverPreview("")
    setError(""); setShowForm(false)
    if (coverInputRef.current) coverInputRef.current.value = ""
  }

  const handleCoverPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setError("Нужен файл JPG, PNG или WebP"); return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Файл больше 8 МБ"); return
    }
    setError("")
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const loadTournaments = async () => {
    try { const r = await axios.get(`${API}/api/v1/tournaments/`); setTournaments(r.data) } catch { setTournaments([]) }
  }
  const loadClubs = async () => {
    try { const r = await axios.get(`${API}/api/v1/clubs/`); setClubs(r.data) } catch { setClubs([]) }
  }
  const loadSecretaries = async () => {
    try {
      const r = await axios.get(`${API}/api/v1/secretaries/`, { headers: { Authorization: `Bearer ${user.token}` } })
      setSecretaries(r.data)
    } catch {
      setSecretaries([])
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const [tournamentsResponse, clubsResponse, secretariesResponse] = await Promise.all([
          axios.get(`${API}/api/v1/tournaments/`),
          axios.get(`${API}/api/v1/clubs/`),
          axios.get(`${API}/api/v1/secretaries/`, { headers: { Authorization: `Bearer ${user.token}` } })
        ])
        setTournaments(tournamentsResponse.data)
        setClubs(clubsResponse.data)
        setSecretaries(secretariesResponse.data)
      } catch {
        setTournaments([])
        setClubs([])
        setSecretaries([])
      }
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [user.token])

  const handleCreateSecretary = async () => {
    if (!secretaryForm.name || !secretaryForm.email || !secretaryForm.password) {
      setSecretaryError("Заполните имя, email и пароль"); return
    }
    try {
      const r = await axios.post(`${API}/api/v1/secretaries/`, secretaryForm, { headers: { Authorization: `Bearer ${user.token}` } })
      if (r.data.success) {
        setSecretaryForm({ name: "", email: "", password: "" }); setShowSecretaryForm(false); setSecretaryError(""); loadSecretaries()
      } else setSecretaryError(r.data.message || "Ошибка при создании секретаря")
    } catch (e) {
      setSecretaryError(e.response?.data?.message || e.response?.data?.detail || "Ошибка при создании секретаря")
    }
  }

  const handleSaveTournament = async () => {
    if (!name || !eventDate) { setError("Заполните название и дату"); return }
    const headers = { Authorization: `Bearer ${user.token}` }
    try {
      let tournamentId = editingId
      if (editingId) {
        const r = await axios.patch(`${API}/api/v1/tournaments/${editingId}`, {
          name, location, event_date: eventDate,
          registration_closes_at: closesDate || null,
          competition_level: competitionLevel,
          chief_judge: chiefJudge || null,
          chief_secretary: chiefSecretary || null,
        }, { headers })
        if (r.data.success === false) { setError(r.data.message || "Ошибка при сохранении"); return }
      } else {
        const r = await axios.post(`${API}/api/v1/tournaments/`, {
          name, location, event_date: eventDate,
          registration_closes_at: closesDate || null,
          admin_user_id: user.user_id,
          competition_level: competitionLevel,
          chief_judge: chiefJudge || null,
          chief_secretary: chiefSecretary || null,
        }, { headers })
        if (r.data.success === false) { setError(r.data.message || "Ошибка при создании"); return }
        tournamentId = r.data.id
      }
      if (coverFile && tournamentId) {
        const form = new FormData()
        form.append("file", coverFile)
        const up = await axios.post(`${API}/api/v1/tournaments/${tournamentId}/cover`, form, {
          headers: { Authorization: `Bearer ${user.token}` },
        })
        if (up.data.success === false) { setError(up.data.message || "Ошибка загрузки фото"); return }
      }
      resetTournamentForm(); loadTournaments()
    } catch { setError(editingId ? "Ошибка при сохранении" : "Ошибка при создании") }
  }

  const handleEditTournament = (t, e) => {
    e.stopPropagation()
    setEditingId(t.id)
    setName(t.name || "")
    setLocation(t.location || "")
    setEventDate(String(t.event_date || "").slice(0, 10))
    setClosesDate(t.registration_closes_at ? String(t.registration_closes_at).slice(0, 10) : "")
    setCompetitionLevel(
      t.competition_level === "club" ? "municipal"
        : t.competition_level === "region" ? "regional"
          : (t.competition_level || "municipal")
    )
    setChiefJudge(t.chief_judge || "")
    setChiefSecretary(t.chief_secretary || "")
    setCoverFile(null)
    setCoverPreview(t.cover_image ? mediaUrl(t.cover_image) : "")
    if (coverInputRef.current) coverInputRef.current.value = ""
    setError("")
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleApprove = async (id) => {
    await axios.post(`${API}/api/v1/clubs/${id}/approve`, {}, { headers: { Authorization: `Bearer ${user.token}` } })
    loadClubs()
  }
  const handleReject = async (id) => {
    await axios.post(`${API}/api/v1/clubs/${id}/reject`, {}, { headers: { Authorization: `Bearer ${user.token}` } })
    loadClubs()
  }

  const handleDeleteTournament = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm("Удалить турнир? Это действие необратимо.")) return
    await axios.delete(`${API}/api/v1/tournaments/${id}`, { headers: { Authorization: `Bearer ${user.token}` } })
    if (editingId === id) resetTournamentForm()
    loadTournaments()
  }

  if (selectedTournament) {
    return <TournamentDetail tournament={selectedTournament} user={user} onBack={() => setSelectedTournament(null)} />
  }

  const pendingClubs = clubs.filter(c => c.status === "pending")

  return (
    <div style={{ minHeight: "100vh", background: "#f3f2ee", fontFamily: "Arial", padding: "32px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>

        {/* Шапка */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ color: "#1A56A0", margin: 0 }}>СпортДок</h1>
            <p style={{ color: "#4A4A48", margin: "4px 0 0" }}>{user.name} · {user.role}</p>
          </div>
          <button onClick={onLogout} style={btnOutline}>Выйти</button>
        </div>

        {/* Навигация */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          <button onClick={() => setPage("tournaments")} style={{
            ...btnOutline, fontWeight: page === "tournaments" ? "bold" : "normal",
            background: page === "tournaments" ? "#1A56A0" : "white",
            color: page === "tournaments" ? "white" : "#4A4A48"
          }}>Турниры</button>
          <button onClick={() => setPage("clubs")} style={{
            ...btnOutline, fontWeight: page === "clubs" ? "bold" : "normal",
            background: page === "clubs" ? "#1A56A0" : "white",
            color: page === "clubs" ? "white" : "#4A4A48",
            position: "relative"
          }}>
            Клубы {pendingClubs.length > 0 && <span style={{ background: "#A32D2D", color: "white", borderRadius: "10px", padding: "2px 7px", fontSize: "12px", marginLeft: "6px" }}>{pendingClubs.length}</span>}
          </button>
          <button onClick={() => setPage("secretaries")} style={{
            ...btnOutline, fontWeight: page === "secretaries" ? "bold" : "normal",
            background: page === "secretaries" ? "#1A56A0" : "white",
            color: page === "secretaries" ? "white" : "#4A4A48"
          }}>Секретари</button>
        </div>

        {/* Турниры */}
        {page === "tournaments" && (
          <>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showForm ? "24px" : 0 }}>
                <h2 style={{ margin: 0, color: "#1A56A0" }}>{editingId ? "Редактирование турнира" : "Турниры"}</h2>
                <button onClick={() => { if (showForm) resetTournamentForm(); else { setEditingId(null); setShowForm(true) } }} style={btnPrimary}>
                  {showForm ? "Отмена" : "+ Создать турнир"}
                </button>
              </div>
              {showForm && (
                <div style={{ borderTop: "1px solid #f3f2ee", paddingTop: "24px" }}>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Название турнира</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Кубок СПб по всестилевому каратэ" style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Место проведения</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="СПб, СК Юбилейный" style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Дата турнира</label>
                      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Закрытие заявок</label>
                      <input type="date" value={closesDate} onChange={e => setClosesDate(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Уровень соревнований</label>
                    <select value={competitionLevel} onChange={e => setCompetitionLevel(e.target.value)} style={inputStyle}>
                      {COMPETITION_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Главный судья</label>
                      <input type="text" value={chiefJudge} onChange={e => setChiefJudge(e.target.value)} placeholder="Иванов И.И., (ВК, Москва)" style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Главный секретарь</label>
                      <input type="text" value={chiefSecretary} onChange={e => setChiefSecretary(e.target.value)} placeholder="Петров П.П., (ВК, СПб)" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Фото для карточки на главной</label>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleCoverPick}
                      style={{ display: "none" }}
                    />
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => coverInputRef.current?.click()} style={btnOutline}>
                        {coverPreview ? "Сменить фото" : "Добавить фото"}
                      </button>
                      {coverPreview && (
                        <img
                          src={coverPreview}
                          alt=""
                          style={{
                            width: "160px", height: "100px", objectFit: "cover",
                            borderRadius: "8px", border: "1px solid #D3D1C7",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ color: "#4A4A48", fontSize: "12px", marginTop: "6px" }}>JPG, PNG или WebP, до 8 МБ</div>
                  </div>
                  {error && <div style={errorBox}>{error}</div>}
                  <button onClick={handleSaveTournament} style={btnGreen}>
                    {editingId ? "Сохранить изменения" : "Создать турнир"}
                  </button>
                </div>
              )}
            </div>
            <div style={card}>
              {tournaments.length === 0 ? (
                <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Турниров пока нет. Создайте первый!</p>
              ) : tournaments.map(t => (
                <div key={t.id} onClick={() => setSelectedTournament(t)} style={{
                  padding: "16px", borderBottom: "1px solid #f3f2ee",
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", cursor: "pointer", gap: "12px", flexWrap: "wrap"
                }}>
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontWeight: "bold", color: "#1A56A0" }}>{t.name}</div>
                    <div style={{ color: "#4A4A48", fontSize: "14px" }}>{t.location && `${t.location} · `}{t.event_date}</div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
                    <span style={{ padding: "4px 12px", background: "#f3f2ee", borderRadius: "6px", fontSize: "13px", color: "#4A4A48" }}>{t.status}</span>
                    <button
                      onClick={(e) => handleEditTournament(t, e)}
                      style={{ ...btnGreen, padding: "12px 22px", fontSize: "15px" }}
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={(e) => handleDeleteTournament(t.id, e)}
                      style={{ ...btnDanger, padding: "4px 10px", fontSize: "12px", fontWeight: "normal" }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Клубы */}
        {page === "clubs" && (
          <div style={card}>
            <h2 style={{ margin: "0 0 24px", color: "#1A56A0" }}>Клубы</h2>
            {clubs.length === 0 ? (
              <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Заявок от клубов пока нет.</p>
            ) : clubs.map(c => (
              <div key={c.id} style={{ padding: "16px", borderBottom: "1px solid #f3f2ee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "#1A56A0" }}>{c.full_name}</div>
                    <div style={{ color: "#4A4A48", fontSize: "14px" }}>
                      {c.short_name && `${c.short_name} · `}
                      {c.region && `${c.region} · `}
                      {c.responsible_name} · {c.email}
                    </div>
                    {c.trainers && <div style={{ color: "#4A4A48", fontSize: "13px", marginTop: "4px" }}>Тренеры: {c.trainers}</div>}
                    {!c.email_verified && <div style={{ color: "#A32D2D", fontSize: "13px", marginTop: "4px" }}>Email ещё не подтверждён клубом</div>}
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {c.status === "pending" && (
                      <>
                        <button onClick={() => handleApprove(c.id)} style={{ ...btnGreen, padding: "8px 16px", fontSize: "13px" }}>✓ Одобрить</button>
                        <button onClick={() => handleReject(c.id)} style={{ ...btnDanger, padding: "8px 16px", fontSize: "13px" }}>✗ Отклонить</button>
                      </>
                    )}
                    {c.status === "approved" && <span style={{ color: "#0F6E56", fontWeight: "bold", fontSize: "13px" }}>✓ Одобрен</span>}
                    {c.status === "rejected" && <span style={{ color: "#A32D2D", fontSize: "13px" }}>✗ Отклонён</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Секретари */}
        {page === "secretaries" && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showSecretaryForm ? "24px" : 0 }}>
              <h2 style={{ margin: 0, color: "#1A56A0" }}>Секретари</h2>
              <button onClick={() => setShowSecretaryForm(!showSecretaryForm)} style={btnPrimary}>
                {showSecretaryForm ? "Отмена" : "+ Создать секретаря"}
              </button>
            </div>
            {showSecretaryForm && (
              <div style={{ borderTop: "1px solid #f3f2ee", paddingTop: "24px", marginBottom: "24px" }}>
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Имя</label><input type="text" value={secretaryForm.name} onChange={e => setSecretaryForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Email</label><input type="email" value={secretaryForm.email} onChange={e => setSecretaryForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Пароль</label><input type="password" value={secretaryForm.password} onChange={e => setSecretaryForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} /></div>
                </div>
                {secretaryError && <div style={errorBox}>{secretaryError}</div>}
                <button onClick={handleCreateSecretary} style={btnGreen}>Создать</button>
              </div>
            )}
            {secretaries.length === 0 ? (
              <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Секретарей пока нет.</p>
            ) : secretaries.map(s => (
              <div key={s.id} style={{ padding: "12px 0", borderBottom: "1px solid #f3f2ee" }}>
                <div style={{ fontWeight: "bold", color: "#1A56A0" }}>{s.name}</div>
                <div style={{ color: "#4A4A48", fontSize: "14px" }}>{s.email}</div>
              </div>
            ))}
            <p style={{ color: "#4A4A48", fontSize: "13px", marginTop: "16px" }}>
              Доступ секретаря к конкретному столу (турнир / дисциплина / категория) выдаётся на странице турнира.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── СТРАНИЦА ТУРНИРА ─────────────────────────────────────────────────────────
const DISCIPLINE_LABELS = { kata: "Ката", kumite_ok: "Кумитэ ОК", kumite_pk: "Кумитэ ПК", kumite_sz: "Кумитэ СЗ" }
const GENDER_LABELS = { male: "муж.", female: "жен." }
const DRAW_SYSTEM_LABELS = {
  round_robin: "Круговая система",
  single_elimination_repechage: "Олимпийская с утешительной сеткой",
  kata_order: "Порядок выступлений"
}
/** Пустой бокс №|ФИО — как на протоколе после соединителя, пока нет победителя. */
function emptyBracketBox() {
  return { seed: "", name: "", text: " " }
}
function bracketParticipantParts(p, competitionLevel = "municipal") {
  if (!p) return emptyBracketBox()
  const seedPart = p.seed != null && p.seed !== "" ? String(p.seed) : ""
  const org = usesRegionOrg(competitionLevel)
    ? (p.region || p.club_name || "")
    : (p.club_name || p.region || "")
  const orgPart = org ? ` (${org})` : ""
  const namePart = `${p.full_name}${orgPart}`
  return { seed: seedPart, name: namePart, text: `${seedPart ? `${seedPart} ` : ""}${namePart}` }
}

// Старая жеребьёвка давала 1,2,3 в каждой подгруппе — пересчитываем в 1..N (нечёт/чёт), как в Excel.
function normalizeGlobalDrawNumbers(participants) {
  const n = participants.length
  if (n < 5) return participants
  const seeds = participants.map(p => p.seed).filter(s => s != null)
  if (seeds.length !== n) return participants
  if (new Set(seeds).size === n && Math.max(...seeds) === n) return participants

  const bySg = { 1: [], 2: [] }
  participants.forEach(p => {
    const sg = p.subgroup ?? (p.seed % 2 === 1 ? 1 : 2)
    bySg[sg].push(p)
  })
  bySg[1].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
  bySg[2].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
  const idToSeed = {}
  bySg[1].forEach((p, i) => { idToSeed[p.registration_id] = 2 * i + 1 })
  bySg[2].forEach((p, i) => { idToSeed[p.registration_id] = 2 * i + 2 })
  return participants.map(p => ({
    ...p,
    seed: idToSeed[p.registration_id] ?? p.seed,
    subgroup: idToSeed[p.registration_id] % 2 === 1 ? 1 : 2,
  }))
}

const categoryLabel = (discipline, gender, category_name) =>
  [DISCIPLINE_LABELS[discipline] || discipline, GENDER_LABELS[gender] || gender, category_name].filter(Boolean).join(" / ")
const nameInList = (participants, id) => (participants.find(p => p.registration_id === id) || {}).full_name || "?"

// ─── ПУБЛИЧНАЯ СТРАНИЦА ТУРНИРА: УЧАСТНИКИ ПО КАТЕГОРИЯМ ───────────────────────
function PublicTournamentPage({ tournament, onBack, onLoginClick }) {
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const today = todayISO()
  const timing = tournamentTiming(tournament, today)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.scrollTo(0, 0)
    axios.get(`${API}/api/v1/tournaments/${tournament.id}/athletes`)
      .then(r => { if (!cancelled) setAthletes(Array.isArray(r.data) ? r.data : []) })
      .catch(() => { if (!cancelled) setAthletes([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tournament.id])

  const downloadPdf = async () => {
    setPdfError("")
    setPdfLoading(true)
    try {
      const r = await axios.get(`${API}/api/v1/tournaments/${tournament.id}/documents/participants-pdf`, {
        responseType: "blob",
      })
      if (r.data?.type === "application/json") {
        const text = await r.data.text()
        const parsed = JSON.parse(text)
        setPdfError(parsed.message || "Не удалось скачать PDF")
        return
      }
      const url = window.URL.createObjectURL(r.data)
      const a = document.createElement("a")
      a.href = url
      a.download = `участники_${(tournament.name || "tournament").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setPdfError(e.response?.data?.message || "Не удалось скачать PDF")
    } finally {
      setPdfLoading(false)
    }
  }

  const categories = Object.values(athletes.reduce((groups, a) => {
    const key = `${a.discipline}|${a.gender}|${a.category_name}`
    if (!groups[key]) {
      groups[key] = {
        key,
        discipline: a.discipline,
        gender: a.gender,
        category_name: a.category_name,
        athletes: [],
      }
    }
    groups[key].athletes.push(a)
    return groups
  }, {})).map(g => ({
    ...g,
    athletes: [...g.athletes].sort((a, b) => {
      const seedA = a.seed == null ? 9999 : a.seed
      const seedB = b.seed == null ? 9999 : b.seed
      if (seedA !== seedB) return seedA - seedB
      return String(a.full_name || "").localeCompare(String(b.full_name || ""), "ru")
    }),
  })).sort((a, b) =>
    categoryLabel(a.discipline, a.gender, a.category_name)
      .localeCompare(categoryLabel(b.discipline, b.gender, b.category_name), "ru")
  )

  const showRegion = usesRegionOrg(tournament.competition_level)

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d10", fontFamily: "var(--font-body)", color: "#f4f5f7" }}>
      <div style={{
        padding: "20px clamp(16px, 3vw, 32px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(21,24,32,0.92)",
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap",
      }}>
        <button onClick={onBack} className="arena-btn" style={{ ...arenaBtnGhost, padding: "10px 16px", fontSize: "14px" }}>
          ← К турнирам
        </button>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={downloadPdf}
            disabled={pdfLoading || loading || athletes.length === 0}
            className="arena-btn"
            style={{
              ...arenaBtnPrimary,
              padding: "10px 18px",
              fontSize: "14px",
              opacity: (pdfLoading || loading || athletes.length === 0) ? 0.55 : 1,
              cursor: (pdfLoading || loading || athletes.length === 0) ? "not-allowed" : "pointer",
            }}
          >
            {pdfLoading ? "Готовим PDF…" : "Скачать PDF"}
          </button>
          <button onClick={onLoginClick} className="arena-btn" style={{ ...arenaBtnGhost, padding: "10px 18px", fontSize: "14px" }}>
            Войти
          </button>
        </div>
      </div>

      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "36px clamp(16px, 3vw, 28px) 72px" }}>
        <div style={{ marginBottom: "32px" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 600,
            letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ec0ef", marginBottom: "10px",
          }}>
            {formatRuDate(tournament.event_date)}
            {tournament.location ? ` · ${tournament.location}` : ""}
          </div>
          <h1 style={{
            margin: "0 0 12px", fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 600,
            letterSpacing: "0.03em", textTransform: "uppercase", lineHeight: 1.1,
          }}>
            {tournament.name}
          </h1>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{
              display: "inline-block", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: 700,
              ...arenaToneStyle[timing.registrationTone],
            }}>
              {timing.registrationLabel}
            </span>
            <span style={{
              display: "inline-block", fontSize: "13px", padding: "6px 12px",
              borderRadius: "6px", background: "rgba(47,111,191,0.22)", color: "#9ec0ef",
            }}>
              {competitionLevelLabel(tournament.competition_level)}
            </span>
            {!loading && (
              <span style={{ color: "rgba(244,245,247,0.55)", fontSize: "14px" }}>
                {athletes.length} участников · {categories.length} категорий
              </span>
            )}
          </div>
          {pdfError && (
            <div style={{ ...errorBox, background: "rgba(163,45,45,0.28)", color: "#f0a8a8", marginTop: "14px" }}>
              {pdfError}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ ...arenaPanel, textAlign: "center", color: "rgba(244,245,247,0.65)" }}>
            Загрузка участников…
          </div>
        ) : categories.length === 0 ? (
          <div style={{ ...arenaPanel, textAlign: "center", color: "rgba(244,245,247,0.65)" }}>
            Пока нет зарегистрированных участников.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {categories.map(cat => (
              <section key={cat.key} style={arenaPanel}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  gap: "12px", flexWrap: "wrap", marginBottom: "16px",
                  paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}>
                  <h2 style={{
                    margin: 0, fontFamily: "var(--font-display)", fontSize: "22px",
                    fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase",
                  }}>
                    {categoryLabel(cat.discipline, cat.gender, cat.category_name)}
                  </h2>
                  <span style={{ color: "rgba(244,245,247,0.55)", fontSize: "14px" }}>
                    {cat.athletes.length}
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
                    <thead>
                      <tr style={{ color: "rgba(244,245,247,0.55)", textAlign: "left" }}>
                        <th style={{ padding: "8px 10px", fontWeight: 600, width: "48px" }}>№</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>ФИО</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>{showRegion ? "Регион" : "Клуб"}</th>
                        <th style={{ padding: "8px 10px", fontWeight: 600 }}>Возраст</th>
                        {cat.discipline !== "kata" && (
                          <th style={{ padding: "8px 10px", fontWeight: 600 }}>Вес</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {cat.athletes.map((a, i) => (
                        <tr key={a.registration_id || a.id} style={{
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                        }}>
                          <td style={{ padding: "10px", color: "#9ec0ef", fontWeight: 700 }}>
                            {a.seed != null ? a.seed : i + 1}
                          </td>
                          <td style={{ padding: "10px", fontWeight: 600 }}>{a.full_name}</td>
                          <td style={{ padding: "10px", color: "rgba(244,245,247,0.72)" }}>
                            {showRegion ? (a.region || a.club_name || "—") : (a.club_name || "—")}
                          </td>
                          <td style={{ padding: "10px", color: "rgba(244,245,247,0.72)" }}>
                            {a.age_group || "—"}
                          </td>
                          {cat.discipline !== "kata" && (
                            <td style={{ padding: "10px", color: "rgba(244,245,247,0.72)" }}>
                              {a.weight != null ? `${a.weight}` : "—"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── СЕТКА КУМИТЭ (топология по посевам + результатам боёв, для секретаря) ────
// Тот же алгоритм, что и app/draw.py::seed_position_order /
// round1_pairs_by_seed на бэкенде, плюс обход по результатам боёв - как в
// app/documents.py::_bracket_rounds. Название круга (round_label) не влияет
// на построение сетки, важно только для "final"/"bronze".
function nextPowerOfTwo(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}
function seedPositionOrder(bracketSize) {
  let positions = [1]
  while (positions.length < bracketSize) {
    const size = positions.length * 2
    positions = positions.flatMap(p => [p, size + 1 - p])
  }
  return positions
}
function round1PairsBySeed(bracketSize) {
  if (bracketSize <= 1) return []
  const order = seedPositionOrder(bracketSize)
  const pairs = []
  for (let i = 0; i < bracketSize; i += 2) pairs.push([order[i], order[i + 1]])
  return pairs
}
const pairKey = (idA, idB) => [idA, idB].sort().join("|")
function boutsByPairKey(bouts) {
  const map = {}
  bouts.forEach(b => { map[pairKey(b.registration_id_a, b.registration_id_b)] = b })
  return map
}
function resolveMatch(a, b, boutsByPair) {
  if (a && !b) return { winner: a, bout: null }
  if (b && !a) return { winner: b, bout: null }
  if (!a && !b) return { winner: null, bout: null }
  const bout = boutsByPair[pairKey(a.registration_id, b.registration_id)] || null
  if (bout && bout.status === "completed" && bout.winner_registration_id) {
    return { winner: bout.winner_registration_id === a.registration_id ? a : b, bout }
  }
  return { winner: null, bout }
}
function buildBracketRounds(participants, boutsByPair) {
  const sorted = [...participants].filter(p => p.seed).sort((a, b) => a.seed - b.seed)
  const n = sorted.length
  if (n === 0) return []
  const byLocal = {}
  sorted.forEach((p, i) => { byLocal[i + 1] = p })
  const size = nextPowerOfTwo(n)
  let current = round1PairsBySeed(size).map(([la, lb]) => {
    const pa = byLocal[la] || null, pb = byLocal[lb] || null
    const { winner, bout } = resolveMatch(pa, pb, boutsByPair)
    return { a: pa, b: pb, winner, bout }
  })
  const rounds = [current]
  while (current.length > 1) {
    const next = []
    for (let i = 0; i < current.length; i += 2) {
      const wa = current[i].winner, wb = current[i + 1].winner
      // Byes only exist at the leaf level (padding to a power of two); from
      // round 2 on, a missing side means "not decided yet", not "no
      // opponent" - resolveMatch can't tell those apart, so only call it
      // once both feeder matches have an actual winner, or an undecided
      // semifinal would let the other side prematurely "win" the final.
      const { winner, bout } = wa && wb ? resolveMatch(wa, wb, boutsByPair) : { winner: null, bout: null }
      next.push({ a: wa, b: wb, winner, bout })
    }
    rounds.push(next)
    current = next
  }
  return rounds
}
const loserOf = (match) => {
  if (!match || !match.winner) return null
  return match.a && match.a.registration_id === match.winner.registration_id ? match.b : match.a
}

// ТЗ 5.3.7: "Проигравший в первом круге получает второй шанс через
// утешительную сетку. Финалисты утешительной сетки разыгрывают бронзу." -
// т.е. каждый проигравший в 1-м круге СВОЕЙ подгруппы получает вторую
// попытку, а не просто проигрывает того, кто дошёл до финала подгруппы (как
// было раньше - см. git history). Утешительная сетка строится отдельно на
// каждую подгруппу (та же логика посева/боёв, что и в buildBracketRounds),
// её победитель - это "финалист утешительной сетки" этой подгруппы; два
// таких финалиста (по одному на подгруппу) встречаются в матче за 3-е место.
function buildRepechageBracket(round1, boutsByPair) {
  const losers = round1
    .filter(m => m.a && m.b && m.winner)
    .map(m => (m.a.registration_id === m.winner.registration_id ? m.b : m.a))
  if (losers.length === 0) return { rounds: [], champion: null }
  if (losers.length === 1) return { rounds: [], champion: losers[0] }
  const reseeded = [...losers]
    .sort((x, y) => (x.seed ?? 999) - (y.seed ?? 999))
    .map((p, i) => ({ ...p, seed: i + 1 }))
  const rounds = buildBracketRounds(reseeded, boutsByPair)
  const champion = rounds.length ? rounds[rounds.length - 1][0].winner : null
  return { rounds, champion }
}

// participants: [{registration_id, full_name, seed, subgroup, ...}], bouts: raw list for the whole tournament.
// Returns either {roundRobin:true, pairs, drawn} or {roundRobin:false, drawn, subgroupKeys, roundsPerGroup,
// twoGroups, finalMatch, bronzeMatch} - same shape used by both the secretary's entry screen and the
// read-only admin жеребьёвка view, so the two never drift apart.
function computeKumiteBracketData(participants, bouts) {
  const participantIds = new Set(participants.map(p => p.registration_id))
  const tableBouts = bouts.filter(b => participantIds.has(b.registration_id_a) && participantIds.has(b.registration_id_b))
  const boutsByPair = boutsByPairKey(tableBouts)

  if (participants.length === 3) {
    const sorted = [...participants].sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
    const pairs = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => {
      const a = sorted[i], b = sorted[j]
      const { winner, bout } = resolveMatch(a, b, boutsByPair)
      return { a, b, winner, bout }
    })
    return { roundRobin: true, pairs, drawn: sorted.some(p => p.seed) }
  }

  if (!participants.some(p => p.seed)) return { roundRobin: false, drawn: false }

  const bySubgroup = {}
  const useParityGroups = participants.length >= 5
  participants.forEach(p => {
    const k = useParityGroups ? (p.seed % 2 === 1 ? 1 : 2) : (p.subgroup || 1)
    ;(bySubgroup[k] = bySubgroup[k] || []).push(p)
  })
  const subgroupKeys = Object.keys(bySubgroup).sort()
  const roundsPerGroup = subgroupKeys.map(k => buildBracketRounds(bySubgroup[k], boutsByPair))
  const twoGroups = subgroupKeys.length > 1

  const champs = roundsPerGroup.map(r => (r.length ? r[r.length - 1][0].winner : null))
  let finalMatch = null
  if (twoGroups) {
    const rawFinal = champs[0] && champs[1] ? resolveMatch(champs[0], champs[1], boutsByPair) : { winner: null, bout: null }
    finalMatch = { a: champs[0], b: champs[1], winner: rawFinal.winner, bout: rawFinal.bout }
  }

  let bronzeCandidates = null
  let repechagePerGroup = []
  if (twoGroups) {
    // Каждая подгруппа получает свою утешительную сетку из проигравших её
    // 1-го круга (roundsPerGroup[i][0]); финалисты этих двух утешительных
    // сеток встречаются в матче за 3-е место - см. buildRepechageBracket.
    repechagePerGroup = roundsPerGroup.map(rounds => buildRepechageBracket(rounds[0] || [], boutsByPair))
    const [rep1, rep2] = repechagePerGroup
    if (rep1.champion && rep2.champion) bronzeCandidates = [rep1.champion, rep2.champion]
  } else if (roundsPerGroup[0] && roundsPerGroup[0].length >= 2) {
    // Без подгрупп (n=1/2/4 - см. draw.py) круг 1 совпадает с полуфиналом:
    // ровно 2 боя в круге 1 => ровно 2 проигравших, они сразу играют бронзу,
    // отдельная утешительная сетка тут структурно не нужна.
    const semi = roundsPerGroup[0][roundsPerGroup[0].length - 2]
    if (semi.length === 2 && semi[0].winner && semi[1].winner) bronzeCandidates = [loserOf(semi[0]), loserOf(semi[1])]
  }
  const rawBronze = bronzeCandidates ? resolveMatch(bronzeCandidates[0], bronzeCandidates[1], boutsByPair) : null

  return {
    roundRobin: false, drawn: true, subgroupKeys, roundsPerGroup, twoGroups, repechagePerGroup,
    finalMatch,
    bronzeMatch: bronzeCandidates ? { a: bronzeCandidates[0], b: bronzeCandidates[1], winner: rawBronze.winner, bout: rawBronze.bout } : null
  }
}

// ─── ГЕОМЕТРИЯ СЕТКИ (боксы + линии, как в официальных протоколах) ────────────
// Тот же макет, что и в app/documents.py::_BracketDiagram для PDF, только в
// пикселях: колонка листьев, колонки кругов на подгруппу, финал сшивает две
// подгруппы, матч за 3-е место - отдельный мини-блок снизу.
const BR_BOX_W = 260
const BR_BOX_H = 40
const BR_H_GAP = 34
const BR_ROW_H = 50
const BR_GROUP_GAP = 30
const BR_SEED_COL_W = 50
const seedSelectStyle = {
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "transparent",
  textAlign: "center",
  fontSize: "12px",
  fontFamily: "Arial",
  padding: 0,
  margin: 0,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
}

function layoutBracket(roundsPerGroup, finalMatch, bronzeMatch, repechagePerGroup = [], formatLabel = p => ({ seed: "", name: p?.full_name || "", text: p?.full_name || "" })) {
  const boxes = []
  const lines = []
  const labels = []
  const nGroups = roundsPerGroup.length
  const leafCounts = roundsPerGroup.map(r => 2 * r[0].length)
  const maxRounds = Math.max(0, ...roundsPerGroup.map(r => r.length))
  const colX = c => c * (BR_BOX_W + BR_H_GAP)

  let y = 0
  const champYs = []

  roundsPerGroup.forEach((rounds, gi) => {
    const leafN = leafCounts[gi]
    const ys0 = [], present0 = []
    for (let i = 0; i < leafN; i++) {
      const cy = y + BR_BOX_H / 2
      ys0.push(cy)
      const match = rounds[0][Math.floor(i / 2)]
      const slot = i % 2 === 0 ? match.a : match.b
      present0.push(!!slot)
      if (slot) {
        // match.a/b both present means a real two-sided bout; a bye (one
        // side missing) auto-advances the sole entrant with no fight, so it
        // must render as a plain box, not a "won" highlight - otherwise a
        // freshly-drawn bracket looks like fights already happened.
        const realWin = !!(match.a && match.b && match.winner && match.winner.registration_id === slot.registration_id)
        boxes.push({ x: 0, y, ...formatLabel(slot), win: realWin, participant: slot, seedEditable: true })
      }
      y += BR_ROW_H
    }
    if (gi < nGroups - 1) y += BR_GROUP_GAP

    let colYs = ys0, colPresent = present0
    for (let c = 1; c <= rounds.length; c++) {
      const isLastRound = c === rounds.length
      const roundLabel = isLastRound ? (nGroups > 1 ? "semifinal" : "final") : `round${c}`
      const nextYs = []
      for (let j = 0; j < rounds[c - 1].length; j++) {
        const match = rounds[c - 1][j]
        const ya = colYs[2 * j]
        const yb = colYs[2 * j + 1]
        // Вилка всегда — и при бае (один участник), как у полного боя
        const py = (ya + yb) / 2
        nextYs.push(py)
        const xFrom = colX(c) - BR_H_GAP, xTo = colX(c)
        const midX = xFrom + BR_H_GAP / 2
        lines.push({ x1: xFrom, y1: ya, x2: midX, y2: ya }, { x1: xFrom, y1: yb, x2: midX, y2: yb },
          { x1: midX, y1: ya, x2: midX, y2: yb }, { x1: midX, y1: py, x2: xTo, y2: py })
        boxes.push({
          // После каждого соединителя — тот же бокс №|ФИО, что в 1-м круге
          x: xTo, y: py - BR_BOX_H / 2, ...(match.winner ? formatLabel(match.winner) : emptyBracketBox()),
          // Same bye rule as the leaf boxes above - only highlight a name
          // here as "won" if it came from an actual decided bout, not from
          // a bye chain propagating with nobody on the other side yet.
          win: !!(match.a && match.b && match.winner), pending: !match.winner && match.a && match.b,
          // Editable whenever there's a real two-sided match, decided or
          // not - a wrong result needs to be correctable, not just enterable once.
          editable: !!(match.a && match.b),
          match, roundLabel
        })
      }
      colYs = nextYs; colPresent = nextYs.map(() => true)
    }

    const champion = rounds.length ? rounds[rounds.length - 1][0].winner : null
    let champY = colYs.length ? colYs[0] : ys0[0]
    for (let c = rounds.length + 1; c <= maxRounds; c++) {
      const xFrom = colX(c) - BR_H_GAP, xTo = colX(c)
      lines.push({ x1: xFrom, y1: champY, x2: xTo, y2: champY })
      boxes.push({ x: xTo, y: champY - BR_BOX_H / 2, ...(champion ? formatLabel(champion) : emptyBracketBox()) })
    }
    champYs.push(champY)
  })

  let width = (1 + maxRounds) * (BR_BOX_W + BR_H_GAP) - BR_H_GAP
  let height = y

  if (finalMatch) {
    const c = maxRounds + 1
    const xFrom = colX(c) - BR_H_GAP, xTo = colX(c)
    const y0 = champYs[0], y1 = champYs[champYs.length - 1]
    const py = (y0 + y1) / 2
    const midX = xFrom + BR_H_GAP / 2
    lines.push({ x1: xFrom, y1: y0, x2: midX, y2: y0 }, { x1: xFrom, y1: y1, x2: midX, y2: y1 },
      { x1: midX, y1: y0, x2: midX, y2: y1 }, { x1: midX, y1: py, x2: xTo, y2: py })
    labels.push({ x: xTo, y: py - BR_BOX_H / 2 - 18, text: "Финал", bold: true })
    boxes.push({
      x: xTo, y: py - BR_BOX_H / 2, ...(finalMatch.winner ? formatLabel(finalMatch.winner) : emptyBracketBox()),
      win: !!finalMatch.winner, big: true, pending: !finalMatch.winner && finalMatch.a && finalMatch.b, editable: !!(finalMatch.a && finalMatch.b),
      match: finalMatch, roundLabel: "final"
    })
    width = Math.max(width, (c + 1) * (BR_BOX_W + BR_H_GAP) - BR_H_GAP)
  }

  const hasRepechageRounds = repechagePerGroup.some(g => g.rounds && g.rounds.length > 0)

  if (bronzeMatch && !hasRepechageRounds) {
    // Простой случай (0-1 проигравший 1-го круга на подгруппу, или сетка без
    // подгрупп вовсе) - утешительная сетка вырождается в один прямой бой,
    // без промежуточных кругов для отрисовки.
    const labelY = height + 14
    const ya = labelY + 18 + BR_BOX_H / 2
    const yb = ya + BR_ROW_H
    labels.push({ x: 0, y: labelY, text: "Матч за 3-е место", bold: true })
    boxes.push({ x: 0, y: ya - BR_BOX_H / 2, ...(bronzeMatch.a ? formatLabel(bronzeMatch.a) : emptyBracketBox()), win: !!(bronzeMatch.winner && bronzeMatch.a && bronzeMatch.winner.registration_id === bronzeMatch.a.registration_id) })
    boxes.push({ x: 0, y: yb - BR_BOX_H / 2, ...(bronzeMatch.b ? formatLabel(bronzeMatch.b) : emptyBracketBox()), win: !!(bronzeMatch.winner && bronzeMatch.b && bronzeMatch.winner.registration_id === bronzeMatch.b.registration_id) })
    const xFrom = colX(1) - BR_H_GAP, xTo = colX(1)
    const midX = xFrom + BR_H_GAP / 2
    const py = (ya + yb) / 2
    lines.push({ x1: xFrom, y1: ya, x2: midX, y2: ya }, { x1: xFrom, y1: yb, x2: midX, y2: yb },
      { x1: midX, y1: ya, x2: midX, y2: yb }, { x1: midX, y1: py, x2: xTo, y2: py })
    boxes.push({
      x: xTo, y: py - BR_BOX_H / 2, ...(bronzeMatch.winner ? formatLabel(bronzeMatch.winner) : emptyBracketBox()),
      win: !!bronzeMatch.winner, pending: !bronzeMatch.winner && bronzeMatch.a && bronzeMatch.b, editable: true,
      match: bronzeMatch, roundLabel: "bronze"
    })
    height = yb + BR_BOX_H / 2 + 10
  } else if (bronzeMatch && hasRepechageRounds) {
    // Утешительная сетка на подгруппу (проигравшие её 1-го круга) - та же
    // геометрия "листья + круги", что и у основной сетки выше, отдельным
    // блоком, потом финалисты каждой утешительной сетки сходятся в бой за
    // 3-е место - та же геометрия "два листа -> один бокс", что и в простом
    // случае выше.
    const sectionY = height + 14
    labels.push({ x: 0, y: sectionY, text: "Утешительная сетка", bold: true })
    let y2 = sectionY + 22
    const champYs2 = []
    const maxRepRounds = Math.max(0, ...repechagePerGroup.map(g => g.rounds.length))
    const nRepGroups = repechagePerGroup.length

    repechagePerGroup.forEach((group, gi) => {
      const rounds = group.rounds
      if (rounds.length === 0) {
        const champ = group.champion
        if (champ) boxes.push({ x: 0, y: y2, ...formatLabel(champ) })
        champYs2.push(y2 + BR_BOX_H / 2)
        y2 += BR_ROW_H
        if (gi < nRepGroups - 1) y2 += BR_GROUP_GAP
        return
      }
      const leafN = 2 * rounds[0].length
      const ys0 = [], present0 = []
      for (let i = 0; i < leafN; i++) {
        const cy = y2 + BR_BOX_H / 2
        ys0.push(cy)
        const match = rounds[0][Math.floor(i / 2)]
        const slot = i % 2 === 0 ? match.a : match.b
        present0.push(!!slot)
        if (slot) {
          const realWin = !!(match.a && match.b && match.winner && match.winner.registration_id === slot.registration_id)
          boxes.push({ x: 0, y: y2, ...formatLabel(slot), win: realWin })
        }
        y2 += BR_ROW_H
      }
      if (gi < nRepGroups - 1) y2 += BR_GROUP_GAP

      let colYs = ys0, colPresent = present0
      for (let c = 1; c <= rounds.length; c++) {
        const nextYs = []
        for (let j = 0; j < rounds[c - 1].length; j++) {
          const match = rounds[c - 1][j]
          const ya = colYs[2 * j]
          const yb = colYs[2 * j + 1]
          const py = (ya + yb) / 2
          nextYs.push(py)
          const xFrom = colX(c) - BR_H_GAP, xTo = colX(c)
          const midX = xFrom + BR_H_GAP / 2
          lines.push({ x1: xFrom, y1: ya, x2: midX, y2: ya }, { x1: xFrom, y1: yb, x2: midX, y2: yb },
            { x1: midX, y1: ya, x2: midX, y2: yb }, { x1: midX, y1: py, x2: xTo, y2: py })
          boxes.push({
            x: xTo, y: py - BR_BOX_H / 2, ...(match.winner ? formatLabel(match.winner) : emptyBracketBox()),
            win: !!(match.a && match.b && match.winner), pending: !match.winner && match.a && match.b,
            editable: !!(match.a && match.b),
            match, roundLabel: `repechage_r${c}`
          })
        }
        colYs = nextYs; colPresent = nextYs.map(() => true)
      }
      champYs2.push(colYs.length ? colYs[0] : ys0[0])
    })

    const c = maxRepRounds + 1
    const xFrom = colX(c) - BR_H_GAP, xTo = colX(c)
    const y0b = champYs2[0], y1b = champYs2[champYs2.length - 1]
    const py = (y0b + y1b) / 2
    if (champYs2.length > 1) {
      const midX = xFrom + BR_H_GAP / 2
      lines.push({ x1: xFrom, y1: y0b, x2: midX, y2: y0b }, { x1: xFrom, y1: y1b, x2: midX, y2: y1b },
        { x1: midX, y1: y0b, x2: midX, y2: y1b }, { x1: midX, y1: py, x2: xTo, y2: py })
    } else {
      lines.push({ x1: xFrom, y1: py, x2: xTo, y2: py })
    }
    labels.push({ x: xTo, y: py - BR_BOX_H / 2 - 18, text: "Матч за 3-е место", bold: true })
    boxes.push({
      x: xTo, y: py - BR_BOX_H / 2, ...(bronzeMatch.winner ? formatLabel(bronzeMatch.winner) : emptyBracketBox()),
      win: !!bronzeMatch.winner, pending: !bronzeMatch.winner && bronzeMatch.a && bronzeMatch.b, editable: true,
      match: bronzeMatch, roundLabel: "bronze"
    })
    height = y2 + BR_BOX_H / 2 + 10
    width = Math.max(width, (c + 1) * (BR_BOX_W + BR_H_GAP) - BR_H_GAP)
  }

  return { width, height, boxes, lines, labels }
}

// Круговая система (ровно 3 участника, ТЗ 5.3.2) не имеет игровой сетки -
// все играют со всеми, никто не выбывает - но должна выглядеть так же, как
// олимпийская: та же геометрия "два листа сходятся в один бокс", что и у
// одного матча в layoutBracket (тот же приём уже используется для матча за
// 3-е место), просто три таких блока подряд, без общего дерева.
function layoutRoundRobin(pairs, formatLabel = p => ({ seed: "", name: p?.full_name || "", text: p?.full_name || "" })) {
  const boxes = [], lines = [], labels = []
  let y = 0, bottom = 0
  const xFrom = BR_BOX_W, xTo = BR_BOX_W + BR_H_GAP, midX = xFrom + BR_H_GAP / 2
  pairs.forEach(m => {
    const ya = y + BR_BOX_H / 2
    const yb = ya + BR_ROW_H
    const py = (ya + yb) / 2
    boxes.push({ x: 0, y: ya - BR_BOX_H / 2, ...formatLabel(m.a), win: !!(m.winner && m.winner.registration_id === m.a.registration_id), participant: m.a, seedEditable: true })
    boxes.push({ x: 0, y: yb - BR_BOX_H / 2, ...formatLabel(m.b), win: !!(m.winner && m.winner.registration_id === m.b.registration_id), participant: m.b, seedEditable: true })
    lines.push({ x1: xFrom, y1: ya, x2: midX, y2: ya }, { x1: xFrom, y1: yb, x2: midX, y2: yb },
      { x1: midX, y1: ya, x2: midX, y2: yb }, { x1: midX, y1: py, x2: xTo, y2: py })
    boxes.push({
      x: xTo, y: py - BR_BOX_H / 2, ...(m.winner ? formatLabel(m.winner) : emptyBracketBox()),
      win: !!m.winner, pending: !m.winner, editable: true, match: m, roundLabel: "round1"
    })
    bottom = yb + BR_BOX_H / 2
    y = yb + BR_ROW_H
  })
  return { width: xTo + BR_BOX_W, height: bottom, boxes, lines, labels }
}

const KUMITE_DISCIPLINES = [
  { value: "kumite_ok", label: "ОК (ограниченный контакт)" },
  { value: "kumite_pk", label: "ПК (полный контакт)" },
  { value: "kumite_sz", label: "СЗ (средства защиты)" },
]

// ТЗ 4.3 "Справочник видов ката" - официальный список видов программы,
// не стили из реестра ФВКР Приложение №1 (164 конкретных ката). Это уже
// конечный уровень категории на подаче заявки - глубже делить нечего.
const KATA_PROGRAM_TYPES = [
  "ОК-ката-годзю-рю",
  "ОК-ката-вадо-рю",
  "ОК-ката-ренгокай",
  "ОК-ката-группа",
  "СЗ-ката-соло",
  "СЗ-ката-соло с предметом",
  "СЗ-ката-группа",
]

// ТЗ 4.1: "Категории ката"/"Категории кумитэ" - выпадающие списки с
// множественным выбором, а не один на другой (участник может быть заявлен
// сразу в несколько категорий/дисциплин одной подачей карточки - ТЗ 4.5
// прямо разрешает совмещать любое количество видов кумитэ в MVP).
function CategoryMultiSelect({ weightCategories, selectedKata, selectedKumite, onToggleKata, onToggleKumite, disabledKeys }) {
  const boxStyle = { maxHeight: "180px", overflowY: "auto", border: "1px solid #D3D1C7", borderRadius: "8px", padding: "8px", background: "white" }
  const rowStyle = (disabled) => ({ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", padding: "3px 0", opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" })

  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px" }}>
        <label style={labelStyle}>Категории ката</label>
        <div style={boxStyle}>
          {KATA_PROGRAM_TYPES.map(type => {
            const disabled = disabledKeys.has(`kata|${type}`)
            return (
              <label key={type} style={rowStyle(disabled)}>
                <input type="checkbox" checked={selectedKata.includes(type)} disabled={disabled} onChange={() => onToggleKata(type)} />
                {type}{disabled ? " (уже заявлен)" : ""}
              </label>
            )
          })}
        </div>
      </div>
      <div style={{ flex: "1 1 260px" }}>
        <label style={labelStyle}>Категории кумитэ</label>
        <div style={boxStyle}>
          {KUMITE_DISCIPLINES.map(d => (
            <div key={d.value} style={{ marginBottom: "4px" }}>
              <div style={{ fontWeight: "bold", fontSize: "12px", color: "#4A4A48", margin: "6px 0 2px" }}>{d.label}</div>
              {weightCategories.filter(c => c.discipline === d.value).map(c => {
                const key = `${d.value}|${c.name}`
                const disabled = disabledKeys.has(key)
                const checked = selectedKumite.some(s => s.discipline === d.value && s.category_name === c.name)
                return (
                  <label key={c.id} style={rowStyle(disabled)}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onToggleKumite(d.value, c.name)} />
                    {c.name}{disabled ? " (уже заявлен)" : ""}
                  </label>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TournamentDetail({ tournament, user, onBack }) {
  const [athletes, setAthletes] = useState([])
  const [bouts, setBouts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [ranks, setRanks] = useState([])
  const [weightCategories, setWeightCategories] = useState([])
  const [kataTypes, setKataTypes] = useState([])
  const [drawResult, setDrawResult] = useState(null)
  const [drawError, setDrawError] = useState("")
  const [drawLoading, setDrawLoading] = useState(false)
  const [form, setForm] = useState({
    last_name: "", first_name: "", middle_name: "",
    gender: "male", birth_date: "", weight: "",
    rank: "", club_name: "", trainer_name: "", team_number: ""
  })
  const [selectedKata, setSelectedKata] = useState([])
  const [selectedKumite, setSelectedKumite] = useState([])
  const [duplicateInfo, setDuplicateInfo] = useState(null)
  const [error, setError] = useState("")
  const [secretaries, setSecretaries] = useState([])
  const [grants, setGrants] = useState([])
  const [grantForm, setGrantForm] = useState({ secretary_user_id: "", tableKey: "" })
  const [grantError, setGrantError] = useState("")
  const [editingAthleteId, setEditingAthleteId] = useState(null)
  const [tournamentMeta, setTournamentMeta] = useState(tournament)
  const [chiefJudge, setChiefJudge] = useState(tournament.chief_judge || "")
  const [chiefSecretary, setChiefSecretary] = useState(tournament.chief_secretary || "")
  const [officialsMsg, setOfficialsMsg] = useState("")
  const [officialsSaving, setOfficialsSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleKata = (name) => setSelectedKata(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name])
  const toggleKumite = (discipline, name) => setSelectedKumite(s => {
    const exists = s.some(x => x.discipline === discipline && x.category_name === name)
    return exists ? s.filter(x => !(x.discipline === discipline && x.category_name === name)) : [...s, { discipline, category_name: name }]
  })

  // ТЗ 4.4: определяем "того же участника" по точному совпадению ФИО и даты
  // рождения - при совпадении подсвечиваем уже занятые категории, чтобы их
  // нельзя было выбрать повторно (бэкенд всё равно блокирует дубль, это
  // просто даёт секретарю/админу знать заранее, а не после ошибки).
  const checkDuplicate = async () => {
    if (!form.last_name || !form.first_name || !form.birth_date) { setDuplicateInfo(null); return }
    try {
      const r = await axios.get(`${API}/api/v1/tournaments/${tournament.id}/athletes/lookup`, {
        params: { last_name: form.last_name, first_name: form.first_name, middle_name: form.middle_name, birth_date: form.birth_date }
      })
      setDuplicateInfo(r.data.found ? r.data : null)
    } catch { setDuplicateInfo(null) }
  }
  const duplicateKeys = new Set((duplicateInfo?.existing_registrations || []).map(r => `${r.discipline}|${r.category_name}`))

  const loadAthletes = async () => {
    try { const r = await axios.get(`${API}/api/v1/tournaments/${tournament.id}/athletes`); setAthletes(r.data) } catch { setAthletes([]) }
  }
  const loadBouts = async () => {
    try { const r = await axios.get(`${API}/api/v1/tournaments/${tournament.id}/bouts`); setBouts(r.data) } catch { setBouts([]) }
  }
  const loadGrants = async () => {
    try {
      const r = await axios.get(`${API}/api/v1/tournaments/${tournament.id}/secretary-access`, { headers: { Authorization: `Bearer ${user.token}` } })
      setGrants(r.data)
    } catch {
      setGrants([])
    }
  }

  const saveOfficials = async () => {
    setOfficialsSaving(true)
    setOfficialsMsg("")
    try {
      const r = await axios.patch(`${API}/api/v1/tournaments/${tournament.id}`, {
        chief_judge: chiefJudge || null,
        chief_secretary: chiefSecretary || null,
      }, { headers: { Authorization: `Bearer ${user.token}` } })
      if (r.data.success) {
        setTournamentMeta(m => ({ ...m, chief_judge: r.data.chief_judge, chief_secretary: r.data.chief_secretary }))
        setOfficialsMsg("Сохранено — ФИО появятся в PDF")
      } else {
        setOfficialsMsg(r.data.message || "Не удалось сохранить")
      }
    } catch (e) {
      setOfficialsMsg(e.response?.data?.message || "Ошибка сохранения")
    } finally {
      setOfficialsSaving(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const headers = { Authorization: `Bearer ${user.token}` }
        if (user?.role === "admin" || user?.role === "owner") {
          try {
            const repair = await axios.post(`${API}/api/v1/tournaments/${tournament.id}/draw/repair`, {}, { headers })
            if (repair.data.repaired?.length) {
              setDrawError("Жеребьёвка обновлена: № жребья 1…N на всю категорию (как в Excel).")
            }
          } catch { /* repair is best-effort */ }
        }
        const [athletesResponse, boutsResponse, ranksResponse, weightCategoriesResponse, kataTypesResponse, secretariesResponse, grantsResponse] = await Promise.all([
          axios.get(`${API}/api/v1/tournaments/${tournament.id}/athletes`),
          axios.get(`${API}/api/v1/tournaments/${tournament.id}/bouts`),
          axios.get(`${API}/api/v1/ranks/`),
          axios.get(`${API}/api/v1/weight-categories/`),
          axios.get(`${API}/api/v1/kata-types/`),
          axios.get(`${API}/api/v1/secretaries/`, { headers }),
          axios.get(`${API}/api/v1/tournaments/${tournament.id}/secretary-access`, { headers })
        ])
        setAthletes(athletesResponse.data)
        setBouts(boutsResponse.data)
        setRanks(ranksResponse.data)
        setWeightCategories(weightCategoriesResponse.data)
        setKataTypes(kataTypesResponse.data)
        setSecretaries(secretariesResponse.data)
        setGrants(grantsResponse.data)
      } catch {
        setAthletes([])
        setBouts([])
        setRanks([])
        setWeightCategories([])
        setKataTypes([])
        setSecretaries([])
        setGrants([])
      }
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [tournament.id, user.token, user?.role])

  const setGrantField = (k, v) => setGrantForm(f => ({ ...f, [k]: v }))

  const handleGrant = async () => {
    const g = bracketGroups[grantForm.tableKey]
    if (!grantForm.secretary_user_id || !g) { setGrantError("Выберите секретаря и стол"); return }
    try {
      const r = await axios.post(`${API}/api/v1/tournaments/${tournament.id}/secretary-access`, {
        secretary_user_id: grantForm.secretary_user_id,
        discipline: g.discipline,
        gender: g.gender || null,
        category_name: g.category_name || null
      }, { headers: { Authorization: `Bearer ${user.token}` } })
      if (r.data.success) {
        setGrantForm(f => ({ ...f, tableKey: "" })); setGrantError(""); loadGrants()
      } else setGrantError(r.data.message || "Ошибка при выдаче доступа")
    } catch (e) {
      setGrantError(e.response?.data?.message || e.response?.data?.detail || "Ошибка при выдаче доступа")
    }
  }

  const handleRevoke = async (id) => {
    await axios.delete(`${API}/api/v1/secretary-access/${id}`, { headers: { Authorization: `Bearer ${user.token}` } })
    loadGrants()
  }

  const kataNameToStyle = kataTypes.reduce((map, k) => {
    if (!(k.name in map)) map[k.name] = k.group
    return map
  }, {})

  // Сетка/протокол ката группируется по стилю целиком (как в официальных
  // протоколах), а не по конкретной ката, которую выбрал спортсмен - так же,
  // как на бэкенде (см. app/main.py::draw_category_key).
  const drawCategoryName = (a) => a.discipline === "kata" ? (kataNameToStyle[a.category_name] || a.category_name) : a.category_name

  const bracketGroups = athletes.reduce((groups, a) => {
    const categoryName = drawCategoryName(a)
    const key = `${a.discipline}|${a.gender}|${categoryName}`
    if (!groups[key]) groups[key] = { discipline: a.discipline, gender: a.gender, category_name: categoryName, athletes: [] }
    groups[key].athletes.push(a)
    return groups
  }, {})

  const handleRunDraw = async (force = false) => {
    if (force && !window.confirm("Пережеребить все категории заново? Незавершённые бои будут удалены. Категории с уже введёнными результатами не изменятся.")) return
    setDrawLoading(true); setDrawError("")
    try {
      const r = await axios.post(`${API}/api/v1/tournaments/${tournament.id}/draw`, { force }, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      if (r.data.success) {
        setDrawResult(r.data)
        loadAthletes()
        loadBouts()
        const skipped = (r.data.categories || []).filter(c => c.skipped)
        const untouched = (r.data.categories || []).filter(c => c.already_drawn)
        if (force && skipped.length) {
          setDrawError(skipped.map(c => `${c.category_name}: ${c.message}`).join("; "))
        } else if (!force && untouched.length && !(r.data.categories || []).some(c => !c.already_drawn && !c.skipped)) {
          setDrawError("Жеребьёвка уже проведена. Нажмите «Пережеребить заново», чтобы применить новую логику.")
        }
      }
      else setDrawError(r.data.message || "Ошибка при жеребьёвке")
    } catch (e) {
      setDrawError(e.response?.data?.message || e.response?.data?.detail || "Ошибка при жеребьёвке")
    }
    setDrawLoading(false)
  }

  const handleDeleteAthlete = async (id) => {
    if (!window.confirm("Удалить участника? Это действие необратимо.")) return
    await axios.delete(`${API}/api/v1/athletes/${id}`, { headers: { Authorization: `Bearer ${user.token}` } })
    loadAthletes()
  }

  const handleAdmit = async (registrationId) => {
    await axios.post(`${API}/api/v1/registrations/${registrationId}/admit`, {}, { headers: { Authorization: `Bearer ${user.token}` } })
    loadAthletes()
  }
  const handleRejectAdmission = async (registrationId) => {
    await axios.post(`${API}/api/v1/registrations/${registrationId}/reject-admission`, {}, { headers: { Authorization: `Bearer ${user.token}` } })
    loadAthletes()
  }
  const handleResetAdmission = async (registrationId) => {
    await axios.post(`${API}/api/v1/registrations/${registrationId}/reset-admission`, {}, { headers: { Authorization: `Bearer ${user.token}` } })
    loadAthletes()
  }

  const handleCreate = async () => {
    if (!form.last_name || !form.first_name || !form.birth_date) {
      setError("Заполните фамилию, имя и дату рождения"); return
    }
    const categories = [
      ...selectedKata.map(name => ({ discipline: "kata", category_name: name })),
      ...selectedKumite
    ]
    if (categories.length === 0) { setError("Выберите хотя бы одну категорию"); return }

    const failures = []
    for (const cat of categories) {
      try {
        const r = await axios.post(`${API}/api/v1/athletes/`, {
          ...form,
          weight: form.weight ? parseFloat(form.weight) : null,
          middle_name: form.middle_name || null,
          rank: form.rank || null,
          club_name: form.club_name || null,
          trainer_name: form.trainer_name || null,
          team_number: (cat.discipline === "kumite_ok" && cat.category_name === "командные соревнования") ? (form.team_number || null) : null,
          ...cat,
          tournament_id: tournament.id
        }, { headers: { Authorization: `Bearer ${user.token}` } })
        if (!r.data.success) failures.push(`${cat.category_name}: ${r.data.message}`)
      } catch (e) {
        failures.push(`${cat.category_name}: ${e.response?.data?.message || e.response?.data?.detail || "ошибка соединения"}`)
      }
    }

    if (failures.length) setError(failures.join("; "))
    else setError("")
    setForm({ last_name: "", first_name: "", middle_name: "", gender: "male", birth_date: "", weight: "", rank: "", club_name: "", trainer_name: "", team_number: "" })
    setSelectedKata([]); setSelectedKumite([]); setDuplicateInfo(null)
    if (!failures.length) setShowForm(false)
    loadAthletes()
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f2ee", fontFamily: "Arial", padding: "32px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...btnOutline, marginBottom: "16px" }}>← Назад к турнирам</button>
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ color: "#1A56A0", margin: 0 }}>{tournamentMeta.name}</h1>
            <p style={{ color: "#4A4A48", margin: "4px 0 0" }}>{tournamentMeta.location && `${tournamentMeta.location} · `}{tournamentMeta.event_date}</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => window.open(`${API}/api/v1/tournaments/${tournament.id}/documents/excel`, "_blank")} style={btnOutline}>Скачать Excel (по категориям)</button>
            <button onClick={() => window.open(`${API}/api/v1/tournaments/${tournament.id}/documents/pdf`, "_blank")} style={btnOutline}>Скачать PDF</button>
          </div>
        </div>

        {(user?.role === "admin" || user?.role === "owner") && (
          <div style={{ ...card, marginBottom: "16px" }}>
            <h2 style={{ margin: "0 0 16px", color: "#1A56A0" }}>Официальные лица (для PDF)</h2>
            <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "220px" }}>
                <label style={labelStyle}>Главный судья</label>
                <input type="text" value={chiefJudge} onChange={e => setChiefJudge(e.target.value)} placeholder="Иванов И.И., (ВК, Москва)" style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: "220px" }}>
                <label style={labelStyle}>Главный секретарь</label>
                <input type="text" value={chiefSecretary} onChange={e => setChiefSecretary(e.target.value)} placeholder="Петров П.П., (ВК, СПб)" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button onClick={saveOfficials} disabled={officialsSaving} style={btnGreen}>
                {officialsSaving ? "Сохранение…" : "Сохранить"}
              </button>
              {officialsMsg && <span style={{ color: "#4A4A48", fontSize: "14px" }}>{officialsMsg}</span>}
            </div>
          </div>
        )}

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showForm ? "24px" : 0 }}>
            <h2 style={{ margin: 0, color: "#1A56A0" }}>Участники ({athletes.length})</h2>
            <button onClick={() => setShowForm(!showForm)} style={btnPrimary}>{showForm ? "Отмена" : "+ Добавить участника"}</button>
          </div>

          {showForm && (
            <div style={{ borderTop: "1px solid #f3f2ee", paddingTop: "24px" }}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Фамилия *</label><input type="text" value={form.last_name} onChange={e => set("last_name", e.target.value)} onBlur={checkDuplicate} style={inputStyle} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Имя *</label><input type="text" value={form.first_name} onChange={e => set("first_name", e.target.value)} onBlur={checkDuplicate} style={inputStyle} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Отчество</label><input type="text" value={form.middle_name} onChange={e => set("middle_name", e.target.value)} onBlur={checkDuplicate} style={inputStyle} /></div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Пол *</label>
                  <select value={form.gender} onChange={e => set("gender", e.target.value)} style={inputStyle}>
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Дата рождения *</label><input type="date" value={form.birth_date} onChange={e => set("birth_date", e.target.value)} onBlur={checkDuplicate} style={inputStyle} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Точный вес (кг)</label><input type="number" value={form.weight} onChange={e => set("weight", e.target.value)} style={inputStyle} /></div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Разряд / звание</label>
                  <select value={form.rank} onChange={e => set("rank", e.target.value)} style={inputStyle}>
                    <option value="">— выберите —</option>
                    {ranks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Клуб</label><input type="text" value={form.club_name} onChange={e => set("club_name", e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Тренер</label><input type="text" value={form.trainer_name} onChange={e => set("trainer_name", e.target.value)} style={inputStyle} /></div>
              </div>

              {duplicateInfo && (
                <div style={{ ...successBox, marginBottom: "16px" }}>
                  Найден уже поданный участник «{duplicateInfo.full_name}» — личные данные будут взяты из его карточки, здесь можно только добавить новые категории.
                </div>
              )}

              <CategoryMultiSelect weightCategories={weightCategories}
                selectedKata={selectedKata} selectedKumite={selectedKumite}
                onToggleKata={toggleKata} onToggleKumite={toggleKumite} disabledKeys={duplicateKeys} />

              {selectedKumite.some(c => c.discipline === "kumite_ok" && c.category_name === "командные соревнования") && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Номер команды</label>
                  <input type="text" value={form.team_number} onChange={e => set("team_number", e.target.value)} placeholder="Команда 1" style={inputStyle} />
                </div>
              )}

              {error && <div style={errorBox}>{error}</div>}
              <button onClick={handleCreate} style={btnGreen}>Добавить участника</button>
            </div>
          )}
        </div>

        <div style={card}>
          {Object.keys(bracketGroups).length === 0 ? (
            <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Участников пока нет. Добавьте первого!</p>
          ) : Object.values(bracketGroups).map(group => {
            const label = categoryLabel(group.discipline, group.gender, group.category_name)
            return (
              <div key={label} style={{ marginBottom: "12px" }}>
                <div style={{ padding: "10px 4px", background: "#f3f2ee", fontWeight: "bold", color: "#1A56A0", fontSize: "14px" }}>
                  {label} ({group.athletes.length})
                </div>
                {[...group.athletes]
                  .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || (a.full_name || "").localeCompare(b.full_name || "", "ru"))
                  .map((a, i) => (
                  <div key={a.registration_id} style={{ padding: "16px 4px", borderBottom: "1px solid #f3f2ee", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <div style={{
                        flexShrink: 0, width: "28px", textAlign: "center", fontWeight: "bold",
                        color: "#1A56A0", fontSize: "15px"
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: "bold", color: "#1A56A0" }}>{a.full_name}</div>
                        <div style={{ color: "#4A4A48", fontSize: "14px" }}>
                          {[a.club_name, a.weight && `${a.weight} кг`, a.rank, a.age_group].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {!a.admission_status && (
                        <>
                          <button onClick={() => handleAdmit(a.registration_id)} style={{ ...btnGreen, padding: "6px 10px", fontSize: "12px" }}>✓ Допустить</button>
                          <button onClick={() => handleRejectAdmission(a.registration_id)} style={{ ...btnDanger, padding: "6px 10px", fontSize: "12px" }}>✗ Не допустить</button>
                        </>
                      )}
                      {a.admission_status === "approved" && (
                        <button type="button" onClick={() => handleResetAdmission(a.registration_id)} title="Изменить решение о допуске"
                          style={{ ...btnOutline, padding: "6px 10px", fontSize: "12px", color: "#0F6E56", fontWeight: "bold", borderColor: "#0F6E56" }}>
                          ✓ Допущен
                        </button>
                      )}
                      {a.admission_status === "rejected" && (
                        <button type="button" onClick={() => handleResetAdmission(a.registration_id)} title="Изменить решение о допуске"
                          style={{ ...btnOutline, padding: "6px 10px", fontSize: "12px", color: "#A32D2D", borderColor: "#A32D2D" }}>
                          ✗ Не допущен
                        </button>
                      )}
                      <button onClick={() => setEditingAthleteId(a.id)} style={{ ...btnOutline, padding: "6px 12px", fontSize: "13px" }}>✎ Изменить</button>
                      <button onClick={() => handleDeleteAthlete(a.id)} style={{ ...btnDanger, padding: "6px 12px", fontSize: "13px" }}>✗ Удалить</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {editingAthleteId && (
          <Modal onClose={() => setEditingAthleteId(null)}>
            <h3 style={{ margin: "0 0 12px", color: "#1A56A0" }}>Изменить участника</h3>
            <AthleteEditForm athleteId={editingAthleteId} user={user} ranks={ranks}
              onDone={() => { setEditingAthleteId(null); loadAthletes() }}
              onCancel={() => setEditingAthleteId(null)} />
          </Modal>
        )}

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <h2 style={{ margin: 0, color: "#1A56A0" }}>Жеребьёвка</h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={() => handleRunDraw(false)} disabled={drawLoading} style={btnPrimary}>
                {drawLoading ? "Жеребьёвка..." : "Провести жеребьёвку"}
              </button>
              <button onClick={() => handleRunDraw(true)} disabled={drawLoading} style={btnOutline}>
                Пережеребить заново
              </button>
            </div>
          </div>

          {drawError && <div style={{ ...errorBox, marginTop: "16px" }}>{drawError}</div>}

          {Object.keys(bracketGroups).length === 0 ? (
            <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Сначала добавьте участников.</p>
          ) : (
            <div style={{ marginTop: "16px" }}>
              {Object.values(bracketGroups).map(group => {
                const label = categoryLabel(group.discipline, group.gender, group.category_name)

                if (group.discipline === "kata") {
                  const drawn = group.athletes.some(a => a.seed != null)
                  return (
                    <div key={label} style={{ marginBottom: "24px" }}>
                      <div style={{ fontWeight: "bold", color: "#1A56A0", marginBottom: "8px" }}>{label}</div>
                      {!drawn ? (
                        <p style={{ color: "#4A4A48", fontSize: "14px" }}>Жеребьёвка не проведена</p>
                      ) : (
                        <>
                          <SeedRenumberList tournamentId={tournament.id} athletes={group.athletes} user={user} onChanged={loadAthletes} />
                          <KataTable grant={{ tournament_id: tournament.id, category_name: group.category_name, gender: group.gender }}
                            user={user} participants={group.athletes} kataTypes={kataTypes} />
                        </>
                      )}
                    </div>
                  )
                }

                // Кумитэ - тот же интерактивный компонент, что и у секретаря
                // (KumiteBracket сам по себе не завязан на конкретный "стол",
                // ему нужен только tournament_id), поэтому админ тоже может
                // кликнуть по бою прямо в сетке и внести результат.
                return (
                  <div key={label} style={{ marginBottom: "24px" }}>
                    <div style={{ fontWeight: "bold", color: "#1A56A0", marginBottom: "8px" }}>{label}</div>
                    <KumiteBracket grant={{ tournament_id: tournament.id }} user={user} participants={group.athletes} bouts={bouts}
                      competitionLevel={tournament.competition_level || "municipal"}
                      onChanged={() => { loadAthletes(); loadBouts() }} />
                  </div>
                )
              })}
            </div>
          )}

          {drawResult && (
            <div style={{ marginTop: "24px", borderTop: "1px solid #f3f2ee", paddingTop: "16px" }}>
              <div style={{ fontWeight: "bold", color: "#1A56A0", marginBottom: "12px" }}>Результат последней жеребьёвки</div>
              {drawResult.categories.map((cat, i) => (
                <div key={i} style={{ marginBottom: "16px" }}>
                  <div style={{ fontWeight: "bold" }}>{categoryLabel(cat.discipline, cat.gender, cat.category_name)}</div>
                  <div style={{ fontSize: "13px", color: "#4A4A48", marginBottom: "6px" }}>
                    {cat.already_drawn ? "Уже проведена ранее — не тронута (нажмите «Пережеребить заново»)" : cat.skipped ? cat.message : (DRAW_SYSTEM_LABELS[cat.system] || cat.system)}
                  </div>

                  {cat.system === "kata_order" && cat.participants.map(p => (
                    <div key={p.registration_id} style={{ fontSize: "13px" }}>№{p.seed} {p.full_name}</div>
                  ))}

                  {cat.system === "round_robin" && cat.matches.map((m, j) => (
                    <div key={j} style={{ fontSize: "13px" }}>
                      {nameInList(cat.participants, m.registration_id_a)} vs {nameInList(cat.participants, m.registration_id_b)}
                    </div>
                  ))}

                  {cat.system === "single_elimination_repechage" && cat.subgroups.map((sub, k) => (
                    <div key={k} style={{ marginBottom: "6px" }}>
                      {sub.subgroup && <div style={{ fontSize: "13px", color: "#4A4A48" }}>Подгруппа {sub.subgroup}</div>}
                      {sub.round1.map((p, j) => (
                        <div key={j} style={{ fontSize: "13px" }}>
                          №{p.seed_a} {nameInList(sub.participants, p.registration_id_a)} vs {p.bye ? "БАЙ" : `№${p.seed_b} ${nameInList(sub.participants, p.registration_id_b)}`}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <h2 style={{ margin: "0 0 16px", color: "#1A56A0" }}>Секретари турнира</h2>
          {secretaries.length === 0 ? (
            <p style={{ color: "#4A4A48", fontSize: "14px" }}>Секретарей пока нет — создайте их на вкладке «Секретари» в общем меню.</p>
          ) : Object.keys(bracketGroups).length === 0 ? (
            <p style={{ color: "#4A4A48", fontSize: "14px" }}>Сначала добавьте участников — доступ выдаётся на конкретный стол (дисциплина/пол/категория), а столы появляются вместе с заявками.</p>
          ) : (
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 160px" }}>
                <label style={labelStyle}>Секретарь</label>
                <select value={grantForm.secretary_user_id} onChange={e => setGrantField("secretary_user_id", e.target.value)} style={inputStyle}>
                  <option value="">— выберите —</option>
                  {secretaries.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                </select>
              </div>
              <div style={{ flex: "2 1 220px" }}>
                <label style={labelStyle}>Стол (дисциплина / пол / категория)</label>
                <select value={grantForm.tableKey} onChange={e => setGrantField("tableKey", e.target.value)} style={inputStyle}>
                  <option value="">— выберите —</option>
                  {Object.entries(bracketGroups).map(([key, g]) => (
                    <option key={key} value={key}>{categoryLabel(g.discipline, g.gender, g.category_name)}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleGrant} style={btnPrimary}>Выдать доступ</button>
            </div>
          )}
          {grantError && <div style={errorBox}>{grantError}</div>}

          {grants.length === 0 ? (
            <p style={{ color: "#4A4A48", fontSize: "14px" }}>Доступ к столам пока никому не выдан.</p>
          ) : grants.map(g => (
            <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f2ee", fontSize: "14px" }}>
              <div>
                <strong>{g.secretary_name || "?"}</strong> — {categoryLabel(g.discipline, g.gender, g.category_name) || DISCIPLINE_LABELS[g.discipline] || g.discipline}
              </div>
              <button onClick={() => handleRevoke(g.id)} style={{ ...btnDanger, padding: "6px 12px", fontSize: "13px" }}>✗ Отозвать</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── КАБИНЕТ КЛУБА ────────────────────────────────────────────────────────────
function ClubPanel({ user, onLogout }) {
  const [tournaments, setTournaments] = useState([])
  const [club, setClub] = useState(null)
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [ranks, setRanks] = useState([])
  const [weightCategories, setWeightCategories] = useState([])
  const [form, setForm] = useState({
    last_name: "", first_name: "", middle_name: "",
    gender: "male", birth_date: "", weight: "",
    rank: "", trainer_name: "", team_number: ""
  })
  const [selectedKata, setSelectedKata] = useState([])
  const [selectedKumite, setSelectedKumite] = useState([])
  const [duplicateInfo, setDuplicateInfo] = useState(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [newTrainer, setNewTrainer] = useState("")
  const [trainerError, setTrainerError] = useState("")

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleKata = (name) => setSelectedKata(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name])
  const toggleKumite = (discipline, name) => setSelectedKumite(s => {
    const exists = s.some(x => x.discipline === discipline && x.category_name === name)
    return exists ? s.filter(x => !(x.discipline === discipline && x.category_name === name)) : [...s, { discipline, category_name: name }]
  })

  const checkDuplicate = async () => {
    if (!form.last_name || !form.first_name || !form.birth_date || !selectedTournament) { setDuplicateInfo(null); return }
    try {
      const r = await axios.get(`${API}/api/v1/tournaments/${selectedTournament.id}/athletes/lookup`, {
        params: { last_name: form.last_name, first_name: form.first_name, middle_name: form.middle_name, birth_date: form.birth_date }
      })
      setDuplicateInfo(r.data.found ? r.data : null)
    } catch { setDuplicateInfo(null) }
  }
  const duplicateKeys = new Set((duplicateInfo?.existing_registrations || []).map(r => `${r.discipline}|${r.category_name}`))

  const loadClub = async () => {
    try {
      const r = await axios.get(`${API}/api/v1/clubs/`)
      setClub(r.data.find(c => c.id === user.club_id) || null)
    } catch {
      setClub(null)
    }
  }
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const [tournamentsResponse, clubsResponse, ranksResponse, weightCategoriesResponse] = await Promise.all([
          axios.get(`${API}/api/v1/tournaments/`),
          axios.get(`${API}/api/v1/clubs/`),
          axios.get(`${API}/api/v1/ranks/`),
          axios.get(`${API}/api/v1/weight-categories/`)
        ])
        setTournaments(tournamentsResponse.data)
        setClub(clubsResponse.data.find(c => c.id === user.club_id) || null)
        setRanks(ranksResponse.data)
        setWeightCategories(weightCategoriesResponse.data)
      } catch {
        setTournaments([])
        setClub(null)
        setRanks([])
        setWeightCategories([])
      }
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [user.club_id])

  const trainers = (club?.trainers || "").split(",").map(t => t.trim()).filter(Boolean)

  const handleAddTrainer = async () => {
    const name = newTrainer.trim()
    if (!name) { setTrainerError("Укажите ФИО тренера"); return }
    try {
      const r = await axios.post(`${API}/api/v1/clubs/${user.club_id}/trainers`, { name }, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      if (r.data.success) { setNewTrainer(""); setTrainerError(""); loadClub() }
      else setTrainerError(r.data.message || "Не удалось добавить тренера")
    } catch (e) {
      setTrainerError(e.response?.data?.message || e.response?.data?.detail || "Не удалось добавить тренера")
    }
  }

  const handleRemoveTrainer = async (name) => {
    try {
      await axios.delete(`${API}/api/v1/clubs/${user.club_id}/trainers`, {
        params: { name }, headers: { Authorization: `Bearer ${user.token}` }
      })
      loadClub()
    } catch (e) {
      setTrainerError(e.response?.data?.message || e.response?.data?.detail || "Не удалось удалить тренера")
    }
  }

  const resetForm = () => {
    setForm({
      last_name: "", first_name: "", middle_name: "", gender: "male", birth_date: "", weight: "",
      rank: "", trainer_name: "", team_number: ""
    })
    setSelectedKata([]); setSelectedKumite([]); setDuplicateInfo(null)
  }

  const handleCreate = async () => {
    if (!form.last_name || !form.first_name || !form.birth_date) {
      setError("Заполните фамилию, имя и дату рождения"); return
    }
    const categories = [
      ...selectedKata.map(name => ({ discipline: "kata", category_name: name })),
      ...selectedKumite
    ]
    if (categories.length === 0) { setError("Выберите хотя бы одну категорию"); return }

    const failures = []
    for (const cat of categories) {
      try {
        const r = await axios.post(`${API}/api/v1/athletes/`, {
          ...form,
          weight: form.weight ? parseFloat(form.weight) : null,
          middle_name: form.middle_name || null,
          rank: form.rank || null,
          trainer_name: form.trainer_name || null,
          team_number: (cat.discipline === "kumite_ok" && cat.category_name === "командные соревнования") ? (form.team_number || null) : null,
          club_name: club ? (club.short_name || club.full_name) : null,
          ...cat,
          tournament_id: selectedTournament.id
        }, { headers: { Authorization: `Bearer ${user.token}` } })
        if (!r.data.success) failures.push(`${cat.category_name}: ${r.data.message}`)
      } catch (e) {
        failures.push(`${cat.category_name}: ${e.response?.data?.message || e.response?.data?.detail || "ошибка соединения"}`)
      }
    }

    resetForm()
    if (failures.length) setError(failures.join("; "))
    else { setError(""); setShowForm(false); setSuccess("Участник добавлен") }
  }

  if (selectedTournament) {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f2ee", fontFamily: "Arial", padding: "32px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <button onClick={() => { setSelectedTournament(null); setShowForm(false); setError(""); setSuccess("") }} style={{ ...btnOutline, marginBottom: "16px" }}>← Назад к турнирам</button>
          <div style={{ marginBottom: "24px" }}>
            <h1 style={{ color: "#1A56A0", margin: 0 }}>{selectedTournament.name}</h1>
            <p style={{ color: "#4A4A48", margin: "4px 0 0" }}>{selectedTournament.location && `${selectedTournament.location} · `}{selectedTournament.event_date}</p>
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, color: "#1A56A0" }}>Заявить участника</h2>
              <button onClick={() => { setShowForm(!showForm); setSuccess("") }} style={btnPrimary}>{showForm ? "Отмена" : "+ Добавить участника"}</button>
            </div>

            {success && <div style={{ ...successBox, marginTop: "16px" }}>{success}</div>}

            {showForm && (
              <div style={{ borderTop: "1px solid #f3f2ee", paddingTop: "24px", marginTop: "24px" }}>
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Фамилия *</label><input type="text" value={form.last_name} onChange={e => set("last_name", e.target.value)} onBlur={checkDuplicate} style={inputStyle} /></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Имя *</label><input type="text" value={form.first_name} onChange={e => set("first_name", e.target.value)} onBlur={checkDuplicate} style={inputStyle} /></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Отчество</label><input type="text" value={form.middle_name} onChange={e => set("middle_name", e.target.value)} onBlur={checkDuplicate} style={inputStyle} /></div>
                </div>

                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Пол *</label>
                    <select value={form.gender} onChange={e => set("gender", e.target.value)} style={inputStyle}>
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Дата рождения *</label><input type="date" value={form.birth_date} onChange={e => set("birth_date", e.target.value)} onBlur={checkDuplicate} style={inputStyle} /></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Точный вес (кг)</label><input type="number" value={form.weight} onChange={e => set("weight", e.target.value)} style={inputStyle} /></div>
                </div>

                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Разряд / звание</label>
                    <select value={form.rank} onChange={e => set("rank", e.target.value)} style={inputStyle}>
                      <option value="">— выберите —</option>
                      {ranks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Тренер</label>
                    <select value={form.trainer_name} onChange={e => set("trainer_name", e.target.value)} style={inputStyle}>
                      <option value="">— выберите —</option>
                      {trainers.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {duplicateInfo && (
                  <div style={{ ...successBox, marginBottom: "16px" }}>
                    Найден уже поданный участник «{duplicateInfo.full_name}» — личные данные будут взяты из его карточки, здесь можно только добавить новые категории.
                  </div>
                )}

                <CategoryMultiSelect weightCategories={weightCategories}
                  selectedKata={selectedKata} selectedKumite={selectedKumite}
                  onToggleKata={toggleKata} onToggleKumite={toggleKumite} disabledKeys={duplicateKeys} />

                {selectedKumite.some(c => c.discipline === "kumite_ok" && c.category_name === "командные соревнования") && (
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Номер команды</label>
                    <input type="text" value={form.team_number} onChange={e => set("team_number", e.target.value)} placeholder="Команда 1" style={inputStyle} />
                  </div>
                )}

                {error && <div style={errorBox}>{error}</div>}
                <button onClick={handleCreate} style={btnGreen}>Подать заявку</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f2ee", fontFamily: "Arial", padding: "32px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ color: "#1A56A0", margin: 0 }}>СпортДок</h1>
            <p style={{ color: "#4A4A48", margin: "4px 0 0" }}>{club ? (club.short_name || club.full_name) : user.name} · клуб</p>
          </div>
          <button onClick={onLogout} style={btnOutline}>Выйти</button>
        </div>

        <div style={{ ...card, marginBottom: "24px" }}>
          <h2 style={{ margin: "0 0 16px", color: "#1A56A0" }}>Тренеры</h2>
          {trainers.length === 0 ? (
            <p style={{ color: "#4A4A48", fontSize: "14px", marginBottom: "16px" }}>Тренеров пока нет.</p>
          ) : (
            <div style={{ marginBottom: "16px" }}>
              {trainers.map(t => (
                <div key={t} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f2ee" }}>
                  <span>{t}</span>
                  <button onClick={() => handleRemoveTrainer(t)} style={{ ...btnDanger, padding: "4px 10px", fontSize: "12px" }}>✗ Удалить</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <label style={labelStyle}>ФИО тренера</label>
              <input type="text" value={newTrainer} onChange={e => setNewTrainer(e.target.value)} placeholder="Иванов И.И." style={inputStyle} />
            </div>
            <button onClick={handleAddTrainer} style={btnGreen}>+ Добавить тренера</button>
          </div>
          {trainerError && <div style={{ ...errorBox, marginTop: "12px" }}>{trainerError}</div>}
        </div>

        <div style={card}>
          <h2 style={{ margin: "0 0 24px", color: "#1A56A0" }}>Турниры</h2>
          {tournaments.length === 0 ? (
            <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Турниров пока нет.</p>
          ) : tournaments.map(t => (
            <div key={t.id} onClick={() => setSelectedTournament(t)} style={{
              padding: "16px", borderBottom: "1px solid #f3f2ee",
              display: "flex", justifyContent: "space-between",
              alignItems: "center", cursor: "pointer"
            }}>
              <div>
                <div style={{ fontWeight: "bold", color: "#1A56A0" }}>{t.name}</div>
                <div style={{ color: "#4A4A48", fontSize: "14px" }}>{t.location && `${t.location} · `}{t.event_date}</div>
              </div>
              <span style={{ padding: "4px 12px", background: "#f3f2ee", borderRadius: "6px", fontSize: "13px", color: "#4A4A48" }}>{t.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── КАБИНЕТ СЕКРЕТАРЯ ────────────────────────────────────────────────────────
const KATA_ROUND_LABELS = { round1: "1-й круг", round2: "2-й круг", final: "Финал" }
const KATA_ROUND_RANGES = { round1: [5, 7], round2: [6, 8], final: [7, 9] }

function SecretaryPanel({ user, onLogout }) {
  const [grants, setGrants] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const [g, t] = await Promise.all([
          axios.get(`${API}/api/v1/secretaries/me/access`, { headers: { Authorization: `Bearer ${user.token}` } }),
          axios.get(`${API}/api/v1/tournaments/`)
        ])
        setGrants(g.data)
        setTournaments(t.data)
        setError("")
      } catch {
        setError("Не удалось загрузить список столов")
      }
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [user.token])

  if (selected) {
    const tournament = tournaments.find(t => t.id === selected.tournament_id)
    return <SecretaryTable user={user} grant={selected} tournament={tournament} onBack={() => setSelected(null)} />
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f2ee", fontFamily: "Arial", padding: "32px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ color: "#1A56A0", margin: 0 }}>СпортДок</h1>
            <p style={{ color: "#4A4A48", margin: "4px 0 0" }}>{user.name} · секретарь</p>
          </div>
          <button onClick={onLogout} style={btnOutline}>Выйти</button>
        </div>

        <div style={card}>
          <h2 style={{ margin: "0 0 24px", color: "#1A56A0" }}>Мои столы</h2>
          {error && <div style={errorBox}>{error}</div>}
          {grants.length === 0 ? (
            <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Вам пока не выдан доступ ни к одному столу. Обратитесь к администратору турнира.</p>
          ) : grants.map(g => {
            const tournament = tournaments.find(t => t.id === g.tournament_id)
            return (
              <div key={g.id} onClick={() => setSelected(g)} style={{
                padding: "16px", borderBottom: "1px solid #f3f2ee",
                display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer"
              }}>
                <div>
                  <div style={{ fontWeight: "bold", color: "#1A56A0" }}>{tournament ? tournament.name : "Турнир"}</div>
                  <div style={{ color: "#4A4A48", fontSize: "14px" }}>{categoryLabel(g.discipline, g.gender, g.category_name)}</div>
                </div>
                <span style={{ color: "#1A56A0", fontSize: "20px" }}>→</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SecretaryTable({ user, grant, tournament, onBack }) {
  const [athletes, setAthletes] = useState([])
  const [bouts, setBouts] = useState([])
  const [kataTypes, setKataTypes] = useState([])
  const isKata = grant.discipline === "kata"

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const athletesResponse = await axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/athletes`)
        setAthletes(athletesResponse.data)
        if (!isKata) {
          const boutsResponse = await axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/bouts`)
          setBouts(boutsResponse.data)
          setKataTypes([])
        } else {
          const kataTypesResponse = await axios.get(`${API}/api/v1/kata-types/`)
          setKataTypes(kataTypesResponse.data)
          setBouts([])
        }
      } catch {
        setAthletes([])
        setBouts([])
        setKataTypes([])
      }
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [grant.tournament_id, isKata])

  // grant.category_name — это стиль ката (см. app/main.py::draw_category_key),
  // а a.category_name у спортсмена — конкретная ката, которую он выбрал при
  // заявке, поэтому для ката сравниваем через стиль, а не напрямую.
  const kataNameToStyle = kataTypes.reduce((map, k) => {
    if (!(k.name in map)) map[k.name] = k.group
    return map
  }, {})

  const participants = athletes.filter(a =>
    a.discipline === grant.discipline &&
    (isKata ? (kataNameToStyle[a.category_name] || a.category_name) === grant.category_name : a.category_name === grant.category_name) &&
    (!grant.gender || a.gender === grant.gender)
  )

  const label = categoryLabel(grant.discipline, grant.gender, grant.category_name)

  return (
    <div style={{ minHeight: "100vh", background: "#f3f2ee", fontFamily: "Arial", padding: "32px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...btnOutline, marginBottom: "16px" }}>← Назад к столам</button>
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ color: "#1A56A0", margin: 0 }}>{tournament ? tournament.name : "Турнир"}</h1>
            <p style={{ color: "#4A4A48", margin: "4px 0 0" }}>{label}</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => window.open(`${API}/api/v1/tournaments/${grant.tournament_id}/documents/excel`, "_blank")} style={btnOutline}>Скачать Excel (по категориям)</button>
            <button onClick={() => window.open(`${API}/api/v1/tournaments/${grant.tournament_id}/documents/pdf`, "_blank")} style={btnOutline}>Скачать PDF</button>
          </div>
        </div>

        {isKata ? (
          <KataTable grant={grant} user={user} participants={participants} kataTypes={kataTypes} />
        ) : (
          <KumiteBracket
            grant={grant}
            user={user}
            participants={participants}
            bouts={bouts}
            competitionLevel={tournament?.competition_level || "municipal"}
            onChanged={async () => {
              const [athletesResponse, boutsResponse] = await Promise.all([
                axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/athletes`),
                axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/bouts`)
              ])
              setAthletes(athletesResponse.data)
              setBouts(boutsResponse.data)
            }}
          />
        )}
      </div>
    </div>
  )
}

// ТЗ 5.3.4: ручная перестановка номеров жеребьёвки - админ/владелец меняет
// номер в выпадающем списке, участники автоматически меняются местами.
function SeedRenumberList({ tournamentId, athletes, user, onChanged }) {
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")

  const seeded = [...athletes].filter(x => x.seed != null).sort((x, y) => x.seed - y.seed)
  const canEdit = user?.role === "admin" || user?.role === "owner"
  if (!canEdit || seeded.length < 2) return null

  const displayOptions = seeded.map((_, i) => i + 1)

  const handleDisplayChange = async (participant, newDisplay) => {
    if (busyId || participant.seed === newDisplay) return
    const other = seeded.find(x => x.seed === newDisplay)
    if (!other) return
    setBusyId(participant.registration_id)
    setError("")
    try {
      const r = await axios.post(`${API}/api/v1/tournaments/${tournamentId}/draw/swap-seed`, {
        registration_id_a: participant.registration_id,
        registration_id_b: other.registration_id
      }, { headers: { Authorization: `Bearer ${user.token}` } })
      if (r.data.success) onChanged()
      else setError(r.data.message || "Не удалось поменять номера")
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.detail || "Не удалось поменять номера")
    }
    setBusyId("")
  }

  return (
    <div style={{ marginTop: "8px", marginBottom: "8px" }}>
      <div style={{ fontSize: "13px", color: "#4A4A48", marginBottom: "8px" }}>
        Номера жребья от 1 до {seeded.length} без повторов — измените № жребья, спортсмен поменяется автоматически
      </div>
      {seeded.map(p => (
        <div key={p.registration_id} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
          <select
            value={p.seed}
            disabled={!!busyId}
            onChange={e => handleDisplayChange(p, Number(e.target.value))}
            style={{ ...inputStyle, width: "72px", padding: "6px 8px" }}
          >
            {displayOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ fontSize: "13px", color: "#1A1A1A" }}>{p.full_name}</span>
        </div>
      ))}
      {error && <div style={{ ...errorBox, margin: 0 }}>{error}</div>}
    </div>
  )
}

const KATA_TH = { border: "1px solid #D3D1C7", padding: "6px 8px", background: "#f3f2ee", fontSize: "12px", textAlign: "center", whiteSpace: "nowrap" }
const KATA_TD = { border: "1px solid #D3D1C7", padding: "6px 8px", fontSize: "13px", textAlign: "center" }

// Протокол ката как в официальном образце - все круги видны сразу одной
// таблицей (ФИО + 5 оценок судей + итог на круг + место), а не по одному
// кругу за раз с карточками на каждого участника.
function KataTable({ grant, user, participants, kataTypes = [] }) {
  const [scores, setScores] = useState([])
  const [places, setPlaces] = useState({})
  const [tiesAtCutoff, setTiesAtCutoff] = useState([])
  const [activeCell, setActiveCell] = useState(null)

  const load = useCallback(async () => {
    const params = { category_name: grant.category_name }
    if (grant.gender) params.gender = grant.gender
    try {
      const r = await axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/kata-scores`, { params })
      setScores(r.data)
    } catch { setScores([]) }
    try {
      const r2 = await axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/kata-standings`, { params: { ...params, round_label: "final" } })
      const p = {}
      ;(r2.data.ranked || []).forEach(x => { p[x.registration_id] = x.place })
      setPlaces(p)
    } catch { setPlaces({}) }
    // round1/round2 имеют отсечку (проход в следующий круг) - если на границе
    // ничья, ТЗ 5.4 требует "дополнительное ката", т.к. текущая цепочка
    // тай-брейков (итог -> мин. засчитанная -> макс. засчитанная) её не
    // разрешает. determine_round_result это уже считает, но раньше нигде
    // не показывалось секретарю/админу.
    try {
      const results = await Promise.all(["round1", "round2"].map(round_label =>
        axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/kata-standings`, { params: { ...params, round_label } })
      ))
      setTiesAtCutoff(results.map((r, i) => r.data.tie_at_cutoff ? ["round1", "round2"][i] : null).filter(Boolean))
    } catch { setTiesAtCutoff([]) }
  }, [grant.category_name, grant.gender, grant.tournament_id])
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      await load()
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [load])

  if (participants.length === 0) {
    return <div style={card}><p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Участников в этой категории нет.</p></div>
  }

  const rounds = Object.keys(KATA_ROUND_LABELS)
  const byRegRound = {}
  scores.forEach(s => { byRegRound[`${s.registration_id}|${s.round_label}`] = s })
  const sorted = [...participants].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))

  return (
    <div style={card}>
      {tiesAtCutoff.length > 0 && (
        <div style={{ ...errorBox, marginBottom: "16px" }}>
          Ничья на границе прохода дальше ({tiesAtCutoff.map(r => KATA_ROUND_LABELS[r]).join(", ")}) — по ТЗ требуется дополнительное ката, чтобы определить, кто проходит дальше.
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={KATA_TH} rowSpan={2}>№</th>
              <th style={{ ...KATA_TH, textAlign: "left" }} rowSpan={2}>Фамилия Имя</th>
              {rounds.map(r => <th key={r} style={KATA_TH} colSpan={7}>{KATA_ROUND_LABELS[r]}</th>)}
              <th style={KATA_TH} rowSpan={2}>Место</th>
            </tr>
            <tr>
              {rounds.map(r => ["Ката", 1, 2, 3, 4, 5, "Итог"].map(c => <th key={r + c} style={KATA_TH}>{c}</th>))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.registration_id}>
                <td style={KATA_TD}>{i + 1}</td>
                <td style={{ ...KATA_TD, textAlign: "left" }}>{p.full_name}</td>
                {rounds.map(r => {
                  const s = byRegRound[`${p.registration_id}|${r}`]
                  const vals = s ? [s.score_1, s.score_2, s.score_3, s.score_4, s.score_5, s.total_score] : null
                  const openForm = () => setActiveCell({
                    registrationId: p.registration_id, name: p.full_name, roundLabel: r,
                    existing: vals ? vals.slice(0, 5) : null, existingKataName: s?.kata_name || null
                  })
                  return (
                    <Fragment key={r}>
                      <td onClick={openForm} title={s?.kata_name ? "Нажмите, чтобы изменить ката" : "Выбрать ката"} style={{
                        ...KATA_TD, cursor: "pointer", background: s ? "white" : "#faf9f5", textAlign: "left", fontSize: "11px", maxWidth: "90px"
                      }}>
                        {s?.kata_name || "—"}
                      </td>
                      {[0, 1, 2, 3, 4, 5].map(col => (
                        <td key={col} onClick={openForm} title={vals ? "Нажмите, чтобы изменить оценки" : "Ввести оценки"} style={{
                          ...KATA_TD, cursor: "pointer", background: vals ? "white" : "#faf9f5",
                          fontWeight: col === 5 && vals ? "bold" : "normal",
                          color: col === 5 && vals ? "#0F6E56" : "#1A1A1A"
                        }}>
                          {vals ? vals[col] : (col === 0 ? "—" : "")}
                        </td>
                      ))}
                    </Fragment>
                  )
                })}
                <td style={{ ...KATA_TD, fontWeight: "bold", color: places[p.registration_id] ? "#0F6E56" : "#1A1A1A" }}>
                  {places[p.registration_id] || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {activeCell && (
        <Modal onClose={() => setActiveCell(null)}>
          <h3 style={{ margin: "0 0 12px", color: "#1A56A0" }}>Оценки: {activeCell.name} — {KATA_ROUND_LABELS[activeCell.roundLabel]}</h3>
          <KataScoreForm registrationId={activeCell.registrationId} roundLabel={activeCell.roundLabel} existingScores={activeCell.existing}
            existingKataName={activeCell.existingKataName} kataTypes={kataTypes}
            tournamentId={grant.tournament_id} user={user}
            onDone={() => { setActiveCell(null); load() }} onCancel={() => setActiveCell(null)} />
        </Modal>
      )}
    </div>
  )
}

function KataScoreForm({ registrationId, roundLabel, existingScores, existingKataName, kataTypes = [], tournamentId, user, onDone, onCancel }) {
  const [scores, setScores] = useState(existingScores ? existingScores.map(String) : ["", "", "", "", ""])
  const [kataName, setKataName] = useState(existingKataName || "")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [lo, hi] = KATA_ROUND_RANGES[roundLabel] || [0, 10]
  const inputRefs = useRef([])

  const kataGroups = kataTypes.reduce((groups, k) => {
    (groups[k.group] = groups[k.group] || []).push(k)
    return groups
  }, {})

  // So the secretary can enter all 5 judges' scores in a row without
  // touching the mouse: focus the first field on open, and let ←/→ jump
  // between fields instead of only moving the caret within one.
  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  const setScore = (i, v) => setScores(s => s.map((x, j) => j === i ? v : x))

  const jumpTo = (i) => {
    const el = inputRefs.current[i]
    if (el) { el.focus(); el.select() }
  }
  const handleKeyDown = (i, e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); jumpTo(i + 1) }
    else if (e.key === "ArrowLeft") { e.preventDefault(); jumpTo(i - 1) }
  }

  const submit = async () => {
    const nums = scores.map(s => parseFloat(s))
    if (nums.some(n => Number.isNaN(n))) { setError("Заполните все 5 оценок"); return }
    setSaving(true); setError("")
    try {
      const r = await axios.post(`${API}/api/v1/kata-scores/`, {
        tournament_id: tournamentId, registration_id: registrationId, round_label: roundLabel, scores: nums,
        kata_name: kataName || null
      }, { headers: { Authorization: `Bearer ${user.token}` } })
      if (r.data.success) onDone()
      else { setError(r.data.message || "Ошибка при сохранении"); setSaving(false) }
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.message || "Ошибка соединения с сервером")
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{ marginBottom: "10px" }}>
        <label style={labelStyle}>Ката (реестр ФВКР)</label>
        <select value={kataName} onChange={e => setKataName(e.target.value)} style={inputStyle}>
          <option value="">— выбрать —</option>
          {Object.entries(kataGroups).map(([group, types]) => (
            <optgroup key={group} label={group}>
              {types.map(k => <option key={k.id} value={k.name}>{k.code ? `${k.code} — ${k.name}` : k.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        {scores.map((v, i) => (
          <input key={i} ref={el => (inputRefs.current[i] = el)} type="number" step="0.1" min={lo} max={hi} value={v}
            onChange={e => setScore(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
            style={{ ...inputStyle, width: "70px" }} placeholder={`${lo}-${hi}`} />
        ))}
        <button onClick={submit} disabled={saving} style={{ ...btnGreen, padding: "8px 14px", fontSize: "13px" }}>Сохранить</button>
        <button onClick={onCancel} style={{ ...btnOutline, padding: "8px 14px", fontSize: "13px" }}>Отмена</button>
        {error && <div style={{ ...errorBox, width: "100%", margin: 0 }}>{error}</div>}
      </div>
    </div>
  )
}

// ТЗ 4.6/5.2: редактирование карточки участника (только админ/владелец,
// сама роль уже проверяется бэкендом). Список участников отдаёт только
// склеенное full_name, поэтому при открытии формы дозагружаем карточку
// отдельным GET, чтобы получить фамилию/имя/отчество по отдельности.
function AthleteEditForm({ athleteId, user, ranks, onDone, onCancel }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    axios.get(`${API}/api/v1/athletes/${athleteId}`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => {
        if (r.data.success) {
          const a = r.data
          setForm({
            last_name: a.last_name || "", first_name: a.first_name || "", middle_name: a.middle_name || "",
            gender: a.gender || "male", birth_date: a.birth_date || "", weight: a.weight ?? "",
            rank: a.rank || "", club_name: a.club_name || "", trainer_name: a.trainer_name || ""
          })
        } else setError(r.data.message || "Не удалось загрузить участника")
      })
      .catch(() => setError("Не удалось загрузить участника"))
  }, [athleteId, user.token])

  if (!form) return <p style={{ color: "#4A4A48" }}>Загрузка...</p>

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.last_name || !form.first_name || !form.birth_date) {
      setError("Заполните фамилию, имя и дату рождения"); return
    }
    setSaving(true); setError("")
    try {
      const r = await axios.patch(`${API}/api/v1/athletes/${athleteId}`, {
        ...form,
        weight: form.weight === "" ? null : parseFloat(form.weight),
        middle_name: form.middle_name || null,
        rank: form.rank || null
      }, { headers: { Authorization: `Bearer ${user.token}` } })
      if (r.data.success) onDone()
      else { setError(r.data.message || "Ошибка при сохранении"); setSaving(false) }
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.message || "Ошибка соединения с сервером")
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <div style={{ flex: 1 }}><label style={labelStyle}>Фамилия *</label><input type="text" value={form.last_name} onChange={e => set("last_name", e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>Имя *</label><input type="text" value={form.first_name} onChange={e => set("first_name", e.target.value)} style={inputStyle} /></div>
      </div>
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>Отчество</label>
        <input type="text" value={form.middle_name} onChange={e => set("middle_name", e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Пол *</label>
          <select value={form.gender} onChange={e => set("gender", e.target.value)} style={inputStyle}>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </div>
        <div style={{ flex: 1 }}><label style={labelStyle}>Дата рождения *</label><input type="date" value={form.birth_date} onChange={e => set("birth_date", e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>Точный вес (кг)</label><input type="number" value={form.weight} onChange={e => set("weight", e.target.value)} style={inputStyle} /></div>
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Разряд / звание</label>
          <select value={form.rank} onChange={e => set("rank", e.target.value)} style={inputStyle}>
            <option value="">— выберите —</option>
            {ranks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}><label style={labelStyle}>Клуб</label><input type="text" value={form.club_name} onChange={e => set("club_name", e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1 }}><label style={labelStyle}>Тренер</label><input type="text" value={form.trainer_name} onChange={e => set("trainer_name", e.target.value)} style={inputStyle} /></div>
      </div>
      {error && <div style={errorBox}>{error}</div>}
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={submit} disabled={saving} style={btnGreen}>Сохранить</button>
        <button onClick={onCancel} style={btnOutline}>Отмена</button>
      </div>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(20,20,20,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: "12px", padding: "20px 24px", maxWidth: "480px", width: "100%",
        boxShadow: "0 16px 48px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto"
      }}>
        {children}
      </div>
    </div>
  )
}

// Линии - через <svg>, боксы - через позиционированные HTML-блоки поверх
// (чтобы форма ввода результата оставалась обычной интерактивной вёрсткой,
// а не жила внутри svg). Геометрия общая с PDF (app/documents.py).
function BracketSvgView({ layout, interactive, onOpenMatch, canEditSeeds, displayOptions, onSeedChange, seedBusy }) {
  return (
    <div style={{ position: "relative", width: layout.width, height: layout.height }}>
      <svg width={layout.width} height={layout.height} style={{ position: "absolute", top: 0, left: 0 }}>
        {layout.lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#C9C7BC" strokeWidth="1.5" />
        ))}
      </svg>
      {layout.labels.map((lb, i) => (
        <div key={i} style={{
          position: "absolute", left: lb.x, top: lb.y, width: BR_BOX_W, fontSize: "12px",
          color: "#4A4A48", fontWeight: lb.bold ? "bold" : "normal", textAlign: lb.bold ? "center" : "left"
        }}>{lb.text}</div>
      ))}
      {layout.boxes.map((b, i) => {
        const clickable = interactive && b.editable
        return (
          <div key={i}
            onClick={clickable ? () => onOpenMatch(b) : undefined}
            title={clickable ? (b.pending ? "Ввести результат" : "Нажмите, чтобы изменить результат") : (b.text || undefined)}
            style={{
              position: "absolute", left: b.x, top: b.y, width: BR_BOX_W, height: BR_BOX_H,
              boxSizing: "border-box", border: `${b.big ? 2 : 1}px ${b.pending ? "dashed" : "solid"} ${b.big ? "#1A56A0" : "#D3D1C7"}`,
              borderRadius: "2px", background: "white",
              display: "flex", alignItems: "stretch", justifyContent: b.text ? "flex-start" : "center",
              fontSize: "12px", fontFamily: "Arial",
              fontWeight: b.text && b.win ? "bold" : "normal",
              color: b.text && b.win ? "#0F6E56" : (b.pending ? "#4A4A48" : "#1A1A1A"),
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              cursor: clickable ? "pointer" : "default"
            }}
          >
            {/* Всегда №|ФИО — как на протоколе после соединителя */}
            <>
              <div style={{
                width: BR_SEED_COL_W, minWidth: BR_SEED_COL_W, borderRight: "1px solid #E5E2D8",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2px",
                padding: "0 3px", boxSizing: "border-box"
              }}
                onClick={e => e.stopPropagation()}
              >
                {canEditSeeds && b.seedEditable && b.participant && displayOptions?.length ? (
                  <>
                    <select
                      value={b.participant.seed ?? ""}
                      disabled={seedBusy}
                      onChange={e => onSeedChange?.(b.participant, Number(e.target.value))}
                      style={{ ...seedSelectStyle, cursor: seedBusy ? "wait" : "pointer" }}
                    >
                      {displayOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span style={{ fontSize: "9px", lineHeight: 1, color: "#666", flexShrink: 0, pointerEvents: "none", userSelect: "none" }} aria-hidden>▼</span>
                  </>
                ) : (b.seed || "")}
              </div>
              <div style={{
                flex: 1, minWidth: 0, display: "flex", alignItems: "center",
                padding: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>
                {b.name
                  || (b.pending ? (interactive ? "Ввести результат" : "—") : "")}
              </div>
            </>
          </div>
        )
      })}
    </div>
  )
}

function KumiteBracket({ grant, user, participants, bouts, onChanged, competitionLevel = "municipal" }) {
  const [activeMatch, setActiveMatch] = useState(null)
  const [seedBusy, setSeedBusy] = useState(false)
  const canEditSeeds = user?.role === "admin" || user?.role === "owner"

  if (participants.length === 0) {
    return <div style={card}><p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Участников в этой категории нет.</p></div>
  }

  const bracketParticipants = normalizeGlobalDrawNumbers(participants)
  const data = computeKumiteBracketData(bracketParticipants, bouts)

  if (!data.drawn) {
    return <div style={card}><p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Жеребьёвка ещё не проведена администратором.</p></div>
  }

  const formatLabel = (p) => bracketParticipantParts(p, competitionLevel)
  const displayOptions = [...bracketParticipants].filter(p => p.seed != null).map(p => p.seed).sort((a, b) => a - b)

  const handleSeedChange = async (participant, newSeed) => {
    if (!canEditSeeds || seedBusy) return
    if (participant.seed === newSeed) return
    const other = bracketParticipants.find(p => p.seed === newSeed)
    if (!other) return
    setSeedBusy(true)
    try {
      const r = await axios.post(`${API}/api/v1/tournaments/${grant.tournament_id}/draw/swap-seed`, {
        registration_id_a: participant.registration_id,
        registration_id_b: other.registration_id
      }, { headers: { Authorization: `Bearer ${user.token}` } })
      if (r.data.success) onChanged()
    } catch { /* bracket stays as-is until reload */ }
    setSeedBusy(false)
  }

  // Круговая система (ровно 3 участника, ТЗ 5.3.2) не имеет игровой сетки -
  // все играют со всеми, никто не выбывает - но использует ту же геометрию
  // (layoutRoundRobin) и тот же интерактивный BracketSvgView/модалку, что и
  // олимпийская сетка ниже, чтобы визуально они не отличались.
  const layout = data.roundRobin
    ? layoutRoundRobin(data.pairs, formatLabel)
    : layoutBracket(data.roundsPerGroup, data.finalMatch, data.bronzeMatch, data.repechagePerGroup, formatLabel)

  return (
    <div style={card}>
      {canEditSeeds && (
        <div style={{ fontSize: "13px", color: "#4A4A48", marginBottom: "8px" }}>
          Измените № жребья в первом круге — спортсмен поменяется автоматически
        </div>
      )}
      {data.roundRobin && <div style={{ fontSize: "13px", color: "#4A4A48", marginBottom: "12px" }}>Круговая система — каждый с каждым</div>}
      <div style={{ overflowX: "auto", paddingBottom: "8px" }}>
        <BracketSvgView layout={layout} interactive onOpenMatch={setActiveMatch}
          canEditSeeds={canEditSeeds} displayOptions={displayOptions}
          onSeedChange={handleSeedChange} seedBusy={seedBusy} />
      </div>
      {activeMatch && (
        <Modal onClose={() => setActiveMatch(null)}>
          <h3 style={{ margin: "0 0 12px", color: "#1A56A0" }}>Результат боя</h3>
          <BoutResultForm a={activeMatch.match.a} b={activeMatch.match.b} roundLabel={activeMatch.roundLabel}
            existingBout={activeMatch.match.bout} tournamentId={grant.tournament_id} user={user}
            onDone={() => { setActiveMatch(null); onChanged() }} onCancel={() => setActiveMatch(null)} />
        </Modal>
      )}
    </div>
  )
}

function BoutResultForm({ a, b, roundLabel, existingBout, tournamentId, user, onDone, onCancel }) {
  // Pre-fill from the existing bout when correcting an already-decided
  // match, instead of making the secretary re-type both sides from zero.
  const [wazaAriA, setWazaAriA] = useState(existingBout?.waza_ari_a ?? 0)
  const [ipponA, setIpponA] = useState(existingBout?.ippon_a ?? 0)
  const [linesA, setLinesA] = useState(existingBout?.lines_a ?? [0, 0, 0])
  const [wazaAriB, setWazaAriB] = useState(existingBout?.waza_ari_b ?? 0)
  const [ipponB, setIpponB] = useState(existingBout?.ippon_b ?? 0)
  const [linesB, setLinesB] = useState(existingBout?.lines_b ?? [0, 0, 0])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const setLine = (side, i, v) => (side === "a" ? setLinesA : setLinesB)(arr => arr.map((x, j) => j === i ? Number(v) : x))

  const submit = async () => {
    setSaving(true); setError("")
    try {
      let boutId = existingBout?.id
      if (!boutId) {
        const r = await axios.post(`${API}/api/v1/bouts/`, {
          tournament_id: tournamentId, registration_id_a: a.registration_id, registration_id_b: b.registration_id, round_label: roundLabel
        }, { headers: { Authorization: `Bearer ${user.token}` } })
        if (!r.data.success) { setError(r.data.message || "Ошибка при создании поединка"); setSaving(false); return }
        boutId = r.data.id
      }
      const r2 = await axios.post(`${API}/api/v1/bouts/${boutId}/result`, {
        waza_ari_a: wazaAriA, ippon_a: ipponA, line1_level_a: linesA[0], line2_level_a: linesA[1], line3_level_a: linesA[2],
        waza_ari_b: wazaAriB, ippon_b: ipponB, line1_level_b: linesB[0], line2_level_b: linesB[1], line3_level_b: linesB[2]
      }, { headers: { Authorization: `Bearer ${user.token}` } })
      if (!r2.data.success) { setError(r2.data.message || "Ошибка при сохранении результата"); setSaving(false); return }
      onDone()
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.message || "Ошибка соединения с сервером")
      setSaving(false)
    }
  }

  const sides = [
    { label: "А", name: a.full_name, wa: wazaAriA, setWa: setWazaAriA, ip: ipponA, setIp: setIpponA, lines: linesA, side: "a" },
    { label: "Б", name: b.full_name, wa: wazaAriB, setWa: setWazaAriB, ip: ipponB, setIp: setIpponB, lines: linesB, side: "b" }
  ]

  return (
    <div style={{ marginTop: "8px", borderTop: "1px solid #f3f2ee", paddingTop: "8px" }}>
      {sides.map(s => (
        <div key={s.side} style={{ marginBottom: "8px" }}>
          <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>{s.label}: {s.name}</div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "11px", color: "#4A4A48" }}>Ваза-ари</label>
            <input type="number" min="0" value={s.wa} onChange={e => s.setWa(Number(e.target.value))} style={{ ...inputStyle, width: "50px", padding: "6px" }} />
            <label style={{ fontSize: "11px", color: "#4A4A48" }}>Иппон</label>
            <input type="number" min="0" value={s.ip} onChange={e => s.setIp(Number(e.target.value))} style={{ ...inputStyle, width: "50px", padding: "6px" }} />
            <label style={{ fontSize: "11px", color: "#4A4A48" }}>Нарушения (1/2/3)</label>
            {s.lines.map((v, i) => (
              <select key={i} value={v} onChange={e => setLine(s.side, i, e.target.value)} style={{ ...inputStyle, padding: "6px", fontSize: "12px", width: "56px" }}>
                {[0, 1, 2, 3].map(lv => <option key={lv} value={lv}>{lv}</option>)}
              </select>
            ))}
          </div>
        </div>
      ))}
      {error && <div style={errorBox}>{error}</div>}
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={submit} disabled={saving} style={{ ...btnGreen, padding: "8px 14px", fontSize: "13px" }}>{saving ? "Сохранение..." : "Сохранить результат"}</button>
        <button onClick={onCancel} style={{ ...btnOutline, padding: "8px 14px", fontSize: "13px" }}>Отмена</button>
      </div>
    </div>
  )
}

// ─── ГЛАВНЫЙ КОМПОНЕНТ ────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home")
  const [user, setUser] = useState(null)
  const [emailConfirmMessage, setEmailConfirmMessage] = useState(null)
  const [publicTournament, setPublicTournament] = useState(null)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("confirm_email")
    if (!token) return
    axios.post(`${API}/api/v1/clubs/confirm-email`, null, { params: { token } })
      .then(r => {
        setEmailConfirmMessage(r.data.message)
        setPage("login")
      })
      .catch(() => {
        setEmailConfirmMessage("Не удалось подтвердить email - ссылка недействительна или устарела")
        setPage("login")
      })
    window.history.replaceState({}, "", window.location.pathname)
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    setPublicTournament(null)
    setPage("panel")
  }

  const handleLogout = () => {
    setUser(null)
    setPublicTournament(null)
    setPage("home")
  }

  if (page === "register") {
    return <ClubRegisterPage onBack={() => setPage("home")} />
  }
  if (page === "login") {
    return (
      <LoginPage
        onLogin={handleLogin}
        onRegister={() => setPage("register")}
        onBack={() => setPage(publicTournament ? "tournament" : "home")}
        emailConfirmMessage={emailConfirmMessage}
      />
    )
  }
  if (page === "panel" && user) {
    if (user.role === "admin" || user.role === "owner") {
      return <AdminPanel user={user} onLogout={handleLogout} />
    }
    if (user.role === "club") {
      return <ClubPanel user={user} onLogout={handleLogout} />
    }
    if (user.role === "secretary") {
      return <SecretaryPanel user={user} onLogout={handleLogout} />
    }
  }
  if (page === "tournament" && publicTournament) {
    return (
      <PublicTournamentPage
        tournament={publicTournament}
        onBack={() => { setPublicTournament(null); setPage("home") }}
        onLoginClick={() => setPage("login")}
      />
    )
  }
  return (
    <PublicHomePage
      onLoginClick={() => setPage("login")}
      onRegisterClick={() => setPage("register")}
      onTournamentClick={(t) => { setPublicTournament(t); setPage("tournament") }}
    />
  )
}