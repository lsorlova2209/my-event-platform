import { useState, useEffect } from "react"
import axios from "axios"

const API = "http://127.0.0.1:8000"

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

// ─── СТРАНИЦА ВХОДА ───────────────────────────────────────────────────────────
function LoginPage({ onLogin, onRegister }) {
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
    <div style={{ minHeight: "100vh", background: "#f3f2ee", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial" }}>
      <div style={{ background: "white", padding: "48px", borderRadius: "16px", width: "420px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <h1 style={{ color: "#1A56A0", marginBottom: "8px" }}>СпортДок</h1>
        <p style={{ color: "#4A4A48", marginBottom: "32px" }}>Войдите в систему</p>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} />
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Пароль</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
        </div>

        {error && <div style={errorBox}>{error}</div>}

        <button onClick={handleLogin} style={{ ...btnPrimary, width: "100%", padding: "14px", marginBottom: "12px" }}>Войти</button>
        <button onClick={onRegister} style={{ ...btnOutline, width: "100%", padding: "14px" }}>Зарегистрировать клуб</button>

        <div style={{ marginTop: "24px", padding: "16px", background: "#f3f2ee", borderRadius: "8px", fontSize: "13px", color: "#4A4A48" }}>
          <strong>Тест:</strong> admin@sportdok.ru / admin123
        </div>
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
    <div style={{ minHeight: "100vh", background: "#f3f2ee", fontFamily: "Arial", padding: "32px" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...btnOutline, marginBottom: "16px" }}>← Назад ко входу</button>
        <div style={card}>
          <h2 style={{ color: "#1A56A0", marginTop: 0 }}>Регистрация клуба</h2>
          <p style={{ color: "#4A4A48", marginBottom: "24px" }}>После регистрации администратор рассмотрит вашу заявку.</p>

          {success ? (
            <div>
              <div style={successBox}>{success}</div>
              <button onClick={onBack} style={btnPrimary}>Перейти ко входу</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>ФИО ответственного *</label>
                <input type="text" value={form.responsible_name} onChange={e => set("responsible_name", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Должность</label>
                <input type="text" value={form.responsible_position} onChange={e => set("responsible_position", e.target.value)} placeholder="Президент федерации" style={inputStyle} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Полное название организации *</label>
                <input type="text" value={form.full_name} onChange={e => set("full_name", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Сокращённое название</label>
                <input type="text" value={form.short_name} onChange={e => set("short_name", e.target.value)} placeholder="СК Динамо" style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Регион</label>
                  <input type="text" value={form.region} onChange={e => set("region", e.target.value)} placeholder="Санкт-Петербург" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Телефон</label>
                  <input type="text" value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} placeholder="+7 999 000 00 00" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Тренеры (ФИО через запятую)</label>
                <input type="text" value={form.trainers} onChange={e => set("trainers", e.target.value)} placeholder="Иванов И.И., Петрова А.С." style={inputStyle} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Email для входа *</label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={labelStyle}>Пароль *</label>
                <input type="password" value={form.password} onChange={e => set("password", e.target.value)} style={inputStyle} />
              </div>

              {error && <div style={errorBox}>{error}</div>}
              <button onClick={handleSubmit} style={btnGreen}>Подать заявку</button>
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
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [closesDate, setClosesDate] = useState("")
  const [error, setError] = useState("")
  const [secretaries, setSecretaries] = useState([])
  const [showSecretaryForm, setShowSecretaryForm] = useState(false)
  const [secretaryForm, setSecretaryForm] = useState({ name: "", email: "", password: "" })
  const [secretaryError, setSecretaryError] = useState("")

  const loadTournaments = async () => {
    try { const r = await axios.get(`${API}/api/v1/tournaments/`); setTournaments(r.data) } catch {}
  }
  const loadClubs = async () => {
    try { const r = await axios.get(`${API}/api/v1/clubs/`); setClubs(r.data) } catch {}
  }
  const loadSecretaries = async () => {
    try {
      const r = await axios.get(`${API}/api/v1/secretaries/`, { headers: { Authorization: `Bearer ${user.token}` } })
      setSecretaries(r.data)
    } catch {}
  }

  useEffect(() => { loadTournaments(); loadClubs(); loadSecretaries() }, [])

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

  const handleCreate = async () => {
    if (!name || !eventDate) { setError("Заполните название и дату"); return }
    try {
      await axios.post(`${API}/api/v1/tournaments/`, {
        name, location, event_date: eventDate,
        registration_closes_at: closesDate || null,
        admin_user_id: user.user_id
      })
      setName(""); setLocation(""); setEventDate(""); setClosesDate("")
      setShowForm(false); setError(""); loadTournaments()
    } catch { setError("Ошибка при создании") }
  }

  const handleApprove = async (id) => {
    await axios.post(`${API}/api/v1/clubs/${id}/approve`)
    loadClubs()
  }
  const handleReject = async (id) => {
    await axios.post(`${API}/api/v1/clubs/${id}/reject`)
    loadClubs()
  }

  const handleDeleteTournament = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm("Удалить турнир? Это действие необратимо.")) return
    await axios.delete(`${API}/api/v1/tournaments/${id}`)
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
                <h2 style={{ margin: 0, color: "#1A56A0" }}>Турниры</h2>
                <button onClick={() => setShowForm(!showForm)} style={btnPrimary}>
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
                  {error && <div style={errorBox}>{error}</div>}
                  <button onClick={handleCreate} style={btnGreen}>Создать турнир</button>
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
                  alignItems: "center", cursor: "pointer"
                }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "#1A56A0" }}>{t.name}</div>
                    <div style={{ color: "#4A4A48", fontSize: "14px" }}>{t.location && `${t.location} · `}{t.event_date}</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ padding: "4px 12px", background: "#f3f2ee", borderRadius: "6px", fontSize: "13px", color: "#4A4A48" }}>{t.status}</span>
                    <button onClick={(e) => handleDeleteTournament(t.id, e)} style={{ ...btnDanger, padding: "6px 12px", fontSize: "13px" }}>✗ Удалить</button>
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
const categoryLabel = (discipline, gender, category_name) =>
  [DISCIPLINE_LABELS[discipline] || discipline, GENDER_LABELS[gender] || gender, category_name].filter(Boolean).join(" / ")
const nameInList = (participants, id) => (participants.find(p => p.registration_id === id) || {}).full_name || "?"

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
  const bySeed = {}
  participants.forEach(p => { if (p.seed) bySeed[p.seed] = p })
  const n = Object.keys(bySeed).length
  if (n === 0) return []
  const size = nextPowerOfTwo(n)
  let current = round1PairsBySeed(size).map(([sa, sb]) => {
    const pa = bySeed[sa] || null, pb = bySeed[sb] || null
    const { winner, bout } = resolveMatch(pa, pb, boutsByPair)
    return { a: pa, b: pb, winner, bout }
  })
  const rounds = [current]
  while (current.length > 1) {
    const next = []
    for (let i = 0; i < current.length; i += 2) {
      const { winner, bout } = resolveMatch(current[i].winner, current[i + 1].winner, boutsByPair)
      next.push({ a: current[i].winner, b: current[i + 1].winner, winner, bout })
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

function TournamentDetail({ tournament, user, onBack }) {
  const [athletes, setAthletes] = useState([])
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
    rank: "", club_name: "", trainer_name: "",
    discipline: "kata", category_name: ""
  })
  const [error, setError] = useState("")
  const [secretaries, setSecretaries] = useState([])
  const [grants, setGrants] = useState([])
  const [grantForm, setGrantForm] = useState({ secretary_user_id: "", tableKey: "" })
  const [grantError, setGrantError] = useState("")

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const setDiscipline = (v) => setForm(f => ({ ...f, discipline: v, category_name: "" }))

  const loadAthletes = async () => {
    try { const r = await axios.get(`${API}/api/v1/tournaments/${tournament.id}/athletes`); setAthletes(r.data) } catch {}
  }
  const loadRanks = async () => {
    try { const r = await axios.get(`${API}/api/v1/ranks/`); setRanks(r.data) } catch {}
  }
  const loadWeightCategories = async () => {
    try { const r = await axios.get(`${API}/api/v1/weight-categories/`); setWeightCategories(r.data) } catch {}
  }
  const loadKataTypes = async () => {
    try { const r = await axios.get(`${API}/api/v1/kata-types/`); setKataTypes(r.data) } catch {}
  }
  const loadSecretaries = async () => {
    try {
      const r = await axios.get(`${API}/api/v1/secretaries/`, { headers: { Authorization: `Bearer ${user.token}` } })
      setSecretaries(r.data)
    } catch {}
  }
  const loadGrants = async () => {
    try {
      const r = await axios.get(`${API}/api/v1/tournaments/${tournament.id}/secretary-access`, { headers: { Authorization: `Bearer ${user.token}` } })
      setGrants(r.data)
    } catch {}
  }

  useEffect(() => { loadAthletes(); loadRanks(); loadWeightCategories(); loadKataTypes(); loadSecretaries(); loadGrants() }, [])

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

  const kataGroups = kataTypes.reduce((groups, k) => {
    if (!groups[k.group]) groups[k.group] = []
    groups[k.group].push(k)
    return groups
  }, {})

  const bracketGroups = athletes.reduce((groups, a) => {
    const key = `${a.discipline}|${a.gender}|${a.category_name}`
    if (!groups[key]) groups[key] = { discipline: a.discipline, gender: a.gender, category_name: a.category_name, athletes: [] }
    groups[key].athletes.push(a)
    return groups
  }, {})

  const handleRunDraw = async () => {
    setDrawLoading(true); setDrawError("")
    try {
      const r = await axios.post(`${API}/api/v1/tournaments/${tournament.id}/draw`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      if (r.data.success) { setDrawResult(r.data); loadAthletes() }
      else setDrawError(r.data.message || "Ошибка при жеребьёвке")
    } catch (e) {
      setDrawError(e.response?.data?.message || e.response?.data?.detail || "Ошибка при жеребьёвке")
    }
    setDrawLoading(false)
  }

  const handleDeleteAthlete = async (id) => {
    if (!window.confirm("Удалить участника? Это действие необратимо.")) return
    await axios.delete(`${API}/api/v1/athletes/${id}`)
    loadAthletes()
  }

  const handleCreate = async () => {
    if (!form.last_name || !form.first_name || !form.birth_date) {
      setError("Заполните фамилию, имя и дату рождения"); return
    }
    try {
      await axios.post(`${API}/api/v1/athletes/`, {
        ...form,
        weight: form.weight ? parseFloat(form.weight) : null,
        middle_name: form.middle_name || null,
        rank: form.rank || null,
        club_name: form.club_name || null,
        trainer_name: form.trainer_name || null,
        category_name: form.category_name || null,
        tournament_id: tournament.id
      })
      setForm({ last_name: "", first_name: "", middle_name: "", gender: "male", birth_date: "", weight: "", rank: "", club_name: "", trainer_name: "", discipline: "kata", category_name: "" })
      setShowForm(false); setError(""); loadAthletes()
    } catch { setError("Ошибка при добавлении участника") }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f2ee", fontFamily: "Arial", padding: "32px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...btnOutline, marginBottom: "16px" }}>← Назад к турнирам</button>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ color: "#1A56A0", margin: 0 }}>{tournament.name}</h1>
          <p style={{ color: "#4A4A48", margin: "4px 0 0" }}>{tournament.location && `${tournament.location} · `}{tournament.event_date}</p>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showForm ? "24px" : 0 }}>
            <h2 style={{ margin: 0, color: "#1A56A0" }}>Участники ({athletes.length})</h2>
            <button onClick={() => setShowForm(!showForm)} style={btnPrimary}>{showForm ? "Отмена" : "+ Добавить участника"}</button>
          </div>

          {showForm && (
            <div style={{ borderTop: "1px solid #f3f2ee", paddingTop: "24px" }}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>Фамилия *</label><input type="text" value={form.last_name} onChange={e => set("last_name", e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Имя *</label><input type="text" value={form.first_name} onChange={e => set("first_name", e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Отчество</label><input type="text" value={form.middle_name} onChange={e => set("middle_name", e.target.value)} style={inputStyle} /></div>
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

              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Дисциплина</label>
                  <select value={form.discipline} onChange={e => setDiscipline(e.target.value)} style={inputStyle}>
                    <option value="kata">Ката</option>
                    <option value="kumite_ok">ОК (ограниченный контакт)</option>
                    <option value="kumite_pk">ПК (полный контакт)</option>
                    <option value="kumite_sz">СЗ (средства защиты)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Категория</label>
                  {form.discipline === "kata" ? (
                    <select value={form.category_name} onChange={e => set("category_name", e.target.value)} style={inputStyle}>
                      <option value="">— выберите —</option>
                      {Object.entries(kataGroups).map(([group, types]) => (
                        <optgroup key={group} label={group}>
                          {types.map(k => <option key={k.id} value={k.name}>{k.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    <select value={form.category_name} onChange={e => set("category_name", e.target.value)} style={inputStyle}>
                      <option value="">— выберите —</option>
                      {weightCategories.filter(c => c.discipline === form.discipline).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {error && <div style={errorBox}>{error}</div>}
              <button onClick={handleCreate} style={btnGreen}>Добавить участника</button>
            </div>
          )}
        </div>

        <div style={card}>
          {athletes.length === 0 ? (
            <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Участников пока нет. Добавьте первого!</p>
          ) : athletes.map(a => (
            <div key={a.id} style={{ padding: "16px", borderBottom: "1px solid #f3f2ee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: "bold", color: "#1A56A0" }}>{a.full_name}</div>
                <div style={{ color: "#4A4A48", fontSize: "14px" }}>
                  {a.club_name && `${a.club_name} · `}
                  {a.discipline === "kata" ? "Ката" : a.discipline === "kumite_ok" ? "ОК" : a.discipline === "kumite_pk" ? "ПК" : "СЗ"}
                  {a.category_name && ` · ${a.category_name}`}
                  {a.weight && ` · ${a.weight} кг`}
                  {a.rank && ` · ${a.rank}`}
                </div>
              </div>
              <button onClick={() => handleDeleteAthlete(a.id)} style={{ ...btnDanger, padding: "6px 12px", fontSize: "13px" }}>✗ Удалить</button>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, color: "#1A56A0" }}>Жеребьёвка</h2>
            <button onClick={handleRunDraw} disabled={drawLoading} style={btnPrimary}>
              {drawLoading ? "Жеребьёвка..." : "Провести жеребьёвку"}
            </button>
          </div>

          {drawError && <div style={{ ...errorBox, marginTop: "16px" }}>{drawError}</div>}

          {Object.keys(bracketGroups).length === 0 ? (
            <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Сначала добавьте участников.</p>
          ) : (
            <div style={{ marginTop: "16px" }}>
              {Object.values(bracketGroups).map(group => {
                const label = categoryLabel(group.discipline, group.gender, group.category_name)
                const drawn = group.athletes.some(a => a.seed != null)
                const sorted = [...group.athletes].sort((x, y) => {
                  const sx = x.subgroup ?? -1, sy = y.subgroup ?? -1
                  if (sx !== sy) return sx - sy
                  return (x.seed ?? 999) - (y.seed ?? 999)
                })
                return (
                  <div key={label} style={{ marginBottom: "20px" }}>
                    <div style={{ fontWeight: "bold", color: "#1A56A0", marginBottom: "8px" }}>{label}</div>
                    {!drawn ? (
                      <p style={{ color: "#4A4A48", fontSize: "14px" }}>Жеребьёвка не проведена</p>
                    ) : (
                      sorted.map(a => (
                        <div key={a.id} style={{ display: "flex", gap: "12px", padding: "6px 0", borderBottom: "1px solid #f3f2ee", fontSize: "14px" }}>
                          {a.subgroup && <span style={{ color: "#4A4A48", minWidth: "90px" }}>Подгруппа {a.subgroup}</span>}
                          <span style={{ fontWeight: "bold", minWidth: "30px" }}>№{a.seed}</span>
                          <span style={{ flex: 1 }}>{a.full_name}</span>
                          <span style={{ color: "#4A4A48" }}>{a.club_name}</span>
                        </div>
                      ))
                    )}
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
                  <div style={{ fontSize: "13px", color: "#4A4A48", marginBottom: "6px" }}>{DRAW_SYSTEM_LABELS[cat.system] || cat.system}</div>

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
  const [kataTypes, setKataTypes] = useState([])
  const [form, setForm] = useState({
    last_name: "", first_name: "", middle_name: "",
    gender: "male", birth_date: "", weight: "",
    rank: "", trainer_name: "",
    discipline: "kata", category_name: "", team_number: ""
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setDiscipline = (v) => setForm(f => ({ ...f, discipline: v, category_name: "", team_number: "" }))

  const loadTournaments = async () => {
    try { const r = await axios.get(`${API}/api/v1/tournaments/`); setTournaments(r.data) } catch {}
  }
  const loadClub = async () => {
    try {
      const r = await axios.get(`${API}/api/v1/clubs/`)
      setClub(r.data.find(c => c.id === user.club_id) || null)
    } catch {}
  }
  const loadRanks = async () => {
    try { const r = await axios.get(`${API}/api/v1/ranks/`); setRanks(r.data) } catch {}
  }
  const loadWeightCategories = async () => {
    try { const r = await axios.get(`${API}/api/v1/weight-categories/`); setWeightCategories(r.data) } catch {}
  }
  const loadKataTypes = async () => {
    try { const r = await axios.get(`${API}/api/v1/kata-types/`); setKataTypes(r.data) } catch {}
  }

  useEffect(() => { loadTournaments(); loadClub(); loadRanks(); loadWeightCategories(); loadKataTypes() }, [])

  const kataGroups = kataTypes.reduce((groups, k) => {
    if (!groups[k.group]) groups[k.group] = []
    groups[k.group].push(k)
    return groups
  }, {})

  const trainers = (club?.trainers || "").split(",").map(t => t.trim()).filter(Boolean)

  const resetForm = () => setForm({
    last_name: "", first_name: "", middle_name: "", gender: "male", birth_date: "", weight: "",
    rank: "", trainer_name: "", discipline: "kata", category_name: "", team_number: ""
  })

  const handleCreate = async () => {
    if (!form.last_name || !form.first_name || !form.birth_date) {
      setError("Заполните фамилию, имя и дату рождения"); return
    }
    try {
      await axios.post(`${API}/api/v1/athletes/`, {
        ...form,
        weight: form.weight ? parseFloat(form.weight) : null,
        middle_name: form.middle_name || null,
        rank: form.rank || null,
        trainer_name: form.trainer_name || null,
        category_name: form.category_name || null,
        team_number: form.team_number || null,
        club_name: club ? (club.short_name || club.full_name) : null,
        tournament_id: selectedTournament.id
      })
      resetForm()
      setShowForm(false); setError(""); setSuccess("Участник добавлен")
    } catch { setError("Ошибка при добавлении участника") }
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
                  <div style={{ flex: 1 }}><label style={labelStyle}>Фамилия *</label><input type="text" value={form.last_name} onChange={e => set("last_name", e.target.value)} style={inputStyle} /></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Имя *</label><input type="text" value={form.first_name} onChange={e => set("first_name", e.target.value)} style={inputStyle} /></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Отчество</label><input type="text" value={form.middle_name} onChange={e => set("middle_name", e.target.value)} style={inputStyle} /></div>
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
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Тренер</label>
                    <select value={form.trainer_name} onChange={e => set("trainer_name", e.target.value)} style={inputStyle}>
                      <option value="">— выберите —</option>
                      {trainers.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Дисциплина</label>
                    <select value={form.discipline} onChange={e => setDiscipline(e.target.value)} style={inputStyle}>
                      <option value="kata">Ката</option>
                      <option value="kumite_ok">ОК (ограниченный контакт)</option>
                      <option value="kumite_pk">ПК (полный контакт)</option>
                      <option value="kumite_sz">СЗ (средства защиты)</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Категория</label>
                    {form.discipline === "kata" ? (
                      <select value={form.category_name} onChange={e => set("category_name", e.target.value)} style={inputStyle}>
                        <option value="">— выберите —</option>
                        {Object.entries(kataGroups).map(([group, types]) => (
                          <optgroup key={group} label={group}>
                            {types.map(k => <option key={k.id} value={k.name}>{k.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    ) : (
                      <select value={form.category_name} onChange={e => set("category_name", e.target.value)} style={inputStyle}>
                        <option value="">— выберите —</option>
                        {weightCategories.filter(c => c.discipline === form.discipline).map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {form.discipline === "kumite_ok" && form.category_name === "командные соревнования" && (
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
const WIN_METHOD_LABELS = { hansoku: "ханзоку", ippon: "иппон", waza_ari: "ваза-ари", score: "по очкам" }
const KATA_ROUND_LABELS = { round1: "1-й круг", round2: "2-й круг", final: "Финал" }
const KATA_ROUND_RANGES = { round1: [5, 7], round2: [6, 8], final: [7, 9] }

function SecretaryPanel({ user, onLogout }) {
  const [grants, setGrants] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState("")

  const load = async () => {
    try {
      const [g, t] = await Promise.all([
        axios.get(`${API}/api/v1/secretaries/me/access`, { headers: { Authorization: `Bearer ${user.token}` } }),
        axios.get(`${API}/api/v1/tournaments/`)
      ])
      setGrants(g.data); setTournaments(t.data); setError("")
    } catch { setError("Не удалось загрузить список столов") }
  }
  useEffect(() => { load() }, [])

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
  const [kataRound, setKataRound] = useState("round1")
  const [kataStandings, setKataStandings] = useState(null)
  const isKata = grant.discipline === "kata"

  const load = async () => {
    try {
      const a = await axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/athletes`)
      setAthletes(a.data)
      if (!isKata) {
        const b = await axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/bouts`)
        setBouts(b.data)
      }
    } catch {}
  }
  useEffect(() => { load() }, [])

  const participants = athletes.filter(a =>
    a.discipline === grant.discipline &&
    a.category_name === grant.category_name &&
    (!grant.gender || a.gender === grant.gender)
  )

  const loadKataStandings = async () => {
    try {
      const params = { category_name: grant.category_name, round_label: kataRound }
      if (grant.gender) params.gender = grant.gender
      const r = await axios.get(`${API}/api/v1/tournaments/${grant.tournament_id}/kata-standings`, { params })
      setKataStandings(r.data)
    } catch { setKataStandings(null) }
  }
  useEffect(() => { if (isKata) loadKataStandings() }, [isKata, kataRound, athletes])

  const label = categoryLabel(grant.discipline, grant.gender, grant.category_name)

  return (
    <div style={{ minHeight: "100vh", background: "#f3f2ee", fontFamily: "Arial", padding: "32px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...btnOutline, marginBottom: "16px" }}>← Назад к столам</button>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ color: "#1A56A0", margin: 0 }}>{tournament ? tournament.name : "Турнир"}</h1>
          <p style={{ color: "#4A4A48", margin: "4px 0 0" }}>{label}</p>
        </div>

        {isKata ? (
          <KataTable grant={grant} user={user} participants={participants}
            kataRound={kataRound} setKataRound={setKataRound}
            standings={kataStandings} onChanged={loadKataStandings} />
        ) : (
          <KumiteBracket grant={grant} user={user} participants={participants} bouts={bouts} onChanged={load} />
        )}
      </div>
    </div>
  )
}

function KataTable({ grant, user, participants, kataRound, setKataRound, standings, onChanged }) {
  const [editing, setEditing] = useState(null)
  const rankedByReg = {}
  ;(standings?.ranked || []).forEach(r => { rankedByReg[r.registration_id] = r })
  const sorted = [...participants].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))

  return (
    <div style={card}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {Object.keys(KATA_ROUND_LABELS).map(r => (
          <button key={r} onClick={() => { setKataRound(r); setEditing(null) }} style={{
            ...btnOutline, fontWeight: kataRound === r ? "bold" : "normal",
            background: kataRound === r ? "#1A56A0" : "white",
            color: kataRound === r ? "white" : "#4A4A48"
          }}>{KATA_ROUND_LABELS[r]}</button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Участников в этой категории нет.</p>
      ) : sorted.map(p => {
        const rank = rankedByReg[p.registration_id]
        return (
          <div key={p.registration_id} style={{ padding: "12px 0", borderBottom: "1px solid #f3f2ee" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {p.seed && <span style={{ color: "#4A4A48", marginRight: "8px" }}>№{p.seed}</span>}
                <strong>{p.full_name}</strong>
                {p.club_name && <span style={{ color: "#4A4A48" }}> · {p.club_name}</span>}
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {rank ? (
                  <span style={{ fontSize: "13px", color: "#0F6E56", fontWeight: "bold" }}>
                    {rank.total} балл. {rank.place ? `· ${rank.place} место` : ""}
                  </span>
                ) : (
                  <span style={{ fontSize: "13px", color: "#4A4A48" }}>не оценён</span>
                )}
                <button onClick={() => setEditing(editing === p.registration_id ? null : p.registration_id)} style={{ ...btnOutline, padding: "6px 12px", fontSize: "13px" }}>
                  {rank ? "Изменить оценки" : "Ввести оценки"}
                </button>
              </div>
            </div>
            {editing === p.registration_id && (
              <KataScoreForm registrationId={p.registration_id} roundLabel={kataRound} tournamentId={grant.tournament_id} user={user}
                onDone={() => { setEditing(null); onChanged() }} onCancel={() => setEditing(null)} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function KataScoreForm({ registrationId, roundLabel, tournamentId, user, onDone, onCancel }) {
  const [scores, setScores] = useState(["", "", "", "", ""])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [lo, hi] = KATA_ROUND_RANGES[roundLabel] || [0, 10]

  const setScore = (i, v) => setScores(s => s.map((x, j) => j === i ? v : x))

  const submit = async () => {
    const nums = scores.map(s => parseFloat(s))
    if (nums.some(n => Number.isNaN(n))) { setError("Заполните все 5 оценок"); return }
    setSaving(true); setError("")
    try {
      const r = await axios.post(`${API}/api/v1/kata-scores/`, {
        tournament_id: tournamentId, registration_id: registrationId, round_label: roundLabel, scores: nums
      }, { headers: { Authorization: `Bearer ${user.token}` } })
      if (r.data.success) onDone()
      else { setError(r.data.message || "Ошибка при сохранении"); setSaving(false) }
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.message || "Ошибка соединения с сервером")
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
      {scores.map((v, i) => (
        <input key={i} type="number" step="0.1" min={lo} max={hi} value={v} onChange={e => setScore(i, e.target.value)}
          style={{ ...inputStyle, width: "70px" }} placeholder={`${lo}-${hi}`} />
      ))}
      <button onClick={submit} disabled={saving} style={{ ...btnGreen, padding: "8px 14px", fontSize: "13px" }}>Сохранить</button>
      <button onClick={onCancel} style={{ ...btnOutline, padding: "8px 14px", fontSize: "13px" }}>Отмена</button>
      {error && <div style={{ ...errorBox, width: "100%", margin: 0 }}>{error}</div>}
    </div>
  )
}

function KumiteBracket({ grant, user, participants, bouts, onChanged }) {
  const participantIds = new Set(participants.map(p => p.registration_id))
  const tableBouts = bouts.filter(b => participantIds.has(b.registration_id_a) && participantIds.has(b.registration_id_b))
  const boutsByPair = boutsByPairKey(tableBouts)

  if (participants.length === 0) {
    return <div style={card}><p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Участников в этой категории нет.</p></div>
  }

  // Круговая система (ровно 3 участника, ТЗ 5.3.2) - не олимпийская сетка,
  // каждый играет с каждым, любое название круга подходит.
  if (participants.length === 3) {
    const sorted = [...participants].sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
    if (!sorted.some(p => p.seed)) {
      return <div style={card}><p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Жеребьёвка ещё не проведена администратором.</p></div>
    }
    const pairs = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => {
      const a = sorted[i], b = sorted[j]
      const { winner, bout } = resolveMatch(a, b, boutsByPair)
      return { a, b, winner, bout }
    })
    return (
      <div style={card}>
        <div style={{ fontSize: "13px", color: "#4A4A48", marginBottom: "12px" }}>Круговая система — каждый с каждым</div>
        {pairs.map((m, i) => (
          <MatchBox key={i} match={m} roundLabel="round1" tournamentId={grant.tournament_id} user={user} onChanged={onChanged} />
        ))}
      </div>
    )
  }

  if (!participants.some(p => p.seed)) {
    return <div style={card}><p style={{ color: "#4A4A48", textAlign: "center", padding: "32px 0" }}>Жеребьёвка ещё не проведена администратором.</p></div>
  }

  const bySubgroup = {}
  participants.forEach(p => { const k = p.subgroup || 1; (bySubgroup[k] = bySubgroup[k] || []).push(p) })
  const subgroupKeys = Object.keys(bySubgroup).sort()
  const roundsPerGroup = subgroupKeys.map(k => buildBracketRounds(bySubgroup[k], boutsByPair))
  const twoGroups = subgroupKeys.length > 1

  const champs = roundsPerGroup.map(r => (r.length ? r[r.length - 1][0].winner : null))
  const finalMatch = twoGroups && champs[0] && champs[1] ? resolveMatch(champs[0], champs[1], boutsByPair) : null

  let bronzeCandidates = null
  if (twoGroups) {
    const last1 = roundsPerGroup[0][roundsPerGroup[0].length - 1]?.[0]
    const last2 = roundsPerGroup[1][roundsPerGroup[1].length - 1]?.[0]
    if (last1?.winner && last2?.winner) bronzeCandidates = [loserOf(last1), loserOf(last2)]
  } else if (roundsPerGroup[0] && roundsPerGroup[0].length >= 2) {
    const semi = roundsPerGroup[0][roundsPerGroup[0].length - 2]
    if (semi.length === 2 && semi[0].winner && semi[1].winner) bronzeCandidates = [loserOf(semi[0]), loserOf(semi[1])]
  }
  const bronzeMatch = bronzeCandidates ? resolveMatch(bronzeCandidates[0], bronzeCandidates[1], boutsByPair) : null

  return (
    <div style={card}>
      {subgroupKeys.map((k, gi) => (
        <div key={k} style={{ marginBottom: "20px" }}>
          {twoGroups && <div style={{ fontWeight: "bold", color: "#4A4A48", marginBottom: "8px" }}>Подгруппа {k}</div>}
          <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "4px" }}>
            {roundsPerGroup[gi].map((round, ri) => (
              <div key={ri} style={{ minWidth: "230px" }}>
                <div style={{ fontSize: "12px", color: "#4A4A48", marginBottom: "6px", fontWeight: "bold" }}>
                  {ri === roundsPerGroup[gi].length - 1 ? (twoGroups ? "Финал подгруппы" : "Финал") : `Круг ${ri + 1}`}
                </div>
                {round.map((match, mi) => (
                  <MatchBox key={mi} match={match} tournamentId={grant.tournament_id} user={user}
                    roundLabel={ri === roundsPerGroup[gi].length - 1 ? (twoGroups ? "semifinal" : "final") : `round${ri + 1}`}
                    onChanged={onChanged} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      {twoGroups && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", color: "#4A4A48", marginBottom: "6px", fontWeight: "bold" }}>Финал</div>
          {champs[0] && champs[1] ? (
            <div style={{ maxWidth: "230px", margin: "0 auto" }}>
              <MatchBox match={{ a: champs[0], b: champs[1], winner: finalMatch.winner, bout: finalMatch.bout }}
                tournamentId={grant.tournament_id} user={user} roundLabel="final" onChanged={onChanged} />
            </div>
          ) : (
            <p style={{ color: "#4A4A48", fontSize: "13px" }}>Ждём победителей обеих подгрупп</p>
          )}
        </div>
      )}

      {bronzeCandidates && bronzeCandidates[0] && bronzeCandidates[1] && (
        <div>
          <div style={{ fontSize: "12px", color: "#4A4A48", marginBottom: "6px", fontWeight: "bold" }}>Матч за 3-е место</div>
          <div style={{ maxWidth: "230px", margin: "0 auto" }}>
            <MatchBox match={{ a: bronzeCandidates[0], b: bronzeCandidates[1], winner: bronzeMatch.winner, bout: bronzeMatch.bout }}
              tournamentId={grant.tournament_id} user={user} roundLabel="bronze" onChanged={onChanged} />
          </div>
        </div>
      )}
    </div>
  )
}

function MatchBox({ match, roundLabel, tournamentId, user, onChanged }) {
  const [showForm, setShowForm] = useState(false)
  const { a, b, winner, bout } = match
  if (!a && !b) return null
  const decided = bout && bout.status === "completed"

  const rowStyle = (p) => ({
    padding: "3px 0", fontSize: "13px",
    fontWeight: winner && p && winner.registration_id === p.registration_id ? "bold" : "normal",
    color: winner && p && winner.registration_id === p.registration_id ? "#0F6E56" : "#1A1A1A"
  })

  return (
    <div style={{ border: "1px solid #D3D1C7", borderRadius: "8px", padding: "10px", marginBottom: "10px", background: "white" }}>
      <div style={rowStyle(a)}>{a ? a.full_name : ""}</div>
      {b && <div style={{ ...rowStyle(b), borderTop: "1px solid #f3f2ee" }}>{b.full_name}</div>}

      {a && b && !decided && (
        showForm ? (
          <BoutResultForm a={a} b={b} roundLabel={roundLabel} existingBoutId={bout?.id} tournamentId={tournamentId} user={user}
            onDone={() => { setShowForm(false); onChanged() }} onCancel={() => setShowForm(false)} />
        ) : (
          <button onClick={() => setShowForm(true)} style={{ ...btnOutline, padding: "5px 10px", fontSize: "12px", marginTop: "6px" }}>Ввести результат</button>
        )
      )}
      {decided && bout.win_method && (
        <div style={{ fontSize: "11px", color: "#4A4A48", marginTop: "4px" }}>{WIN_METHOD_LABELS[bout.win_method] || bout.win_method}</div>
      )}
    </div>
  )
}

function BoutResultForm({ a, b, roundLabel, existingBoutId, tournamentId, user, onDone, onCancel }) {
  const [wazaAriA, setWazaAriA] = useState(0)
  const [ipponA, setIpponA] = useState(0)
  const [linesA, setLinesA] = useState([0, 0, 0])
  const [wazaAriB, setWazaAriB] = useState(0)
  const [ipponB, setIpponB] = useState(0)
  const [linesB, setLinesB] = useState([0, 0, 0])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const setLine = (side, i, v) => (side === "a" ? setLinesA : setLinesB)(arr => arr.map((x, j) => j === i ? Number(v) : x))

  const submit = async () => {
    setSaving(true); setError("")
    try {
      let boutId = existingBoutId
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
  const [page, setPage] = useState("login")
  const [user, setUser] = useState(null)

  const handleLogin = (userData) => {
    setUser(userData)
    setPage("panel")
  }

  if (page === "register") return <ClubRegisterPage onBack={() => setPage("login")} />
  if (page === "panel" && user) {
    if (user.role === "admin" || user.role === "owner") {
      return <AdminPanel user={user} onLogout={() => { setUser(null); setPage("login") }} />
    }
    if (user.role === "club") {
      return <ClubPanel user={user} onLogout={() => { setUser(null); setPage("login") }} />
    }
    if (user.role === "secretary") {
      return <SecretaryPanel user={user} onLogout={() => { setUser(null); setPage("login") }} />
    }
  }
  return <LoginPage onLogin={handleLogin} onRegister={() => setPage("register")} />
}