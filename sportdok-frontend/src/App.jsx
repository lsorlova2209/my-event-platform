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

  const loadTournaments = async () => {
    try { const r = await axios.get(`${API}/api/v1/tournaments/`); setTournaments(r.data) } catch {}
  }
  const loadClubs = async () => {
    try { const r = await axios.get(`${API}/api/v1/clubs/`); setClubs(r.data) } catch {}
  }

  useEffect(() => { loadTournaments(); loadClubs() }, [])

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
    return <TournamentDetail tournament={selectedTournament} onBack={() => setSelectedTournament(null)} />
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
      </div>
    </div>
  )
}

// ─── СТРАНИЦА ТУРНИРА ─────────────────────────────────────────────────────────
function TournamentDetail({ tournament, onBack }) {
  const [athletes, setAthletes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    last_name: "", first_name: "", middle_name: "",
    gender: "male", birth_date: "", weight: "",
    rank: "", club_name: "", trainer_name: "",
    discipline: "kata", category_name: ""
  })
  const [error, setError] = useState("")

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const loadAthletes = async () => {
    try { const r = await axios.get(`${API}/api/v1/tournaments/${tournament.id}/athletes`); setAthletes(r.data) } catch {}
  }

  useEffect(() => { loadAthletes() }, [])

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
                    <option>МСМК</option>
                    <option>МС</option>
                    <option>КМС</option>
                    <option>1 разряд</option>
                    <option>2 разряд</option>
                    <option>3 разряд</option>
                    <option>1 юн. разряд</option>
                    <option>2 юн. разряд</option>
                    <option>3 юн. разряд</option>
                    <option>Б/р</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Клуб</label><input type="text" value={form.club_name} onChange={e => set("club_name", e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Тренер</label><input type="text" value={form.trainer_name} onChange={e => set("trainer_name", e.target.value)} style={inputStyle} /></div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Дисциплина</label>
                  <select value={form.discipline} onChange={e => set("discipline", e.target.value)} style={inputStyle}>
                    <option value="kata">Ката</option>
                    <option value="kumite_ok">ОК (ограниченный контакт)</option>
                    <option value="kumite_pk">ПК (полный контакт)</option>
                    <option value="kumite_sz">СЗ (средства защиты)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Категория</label><input type="text" value={form.category_name} onChange={e => set("category_name", e.target.value)} placeholder="Мужчины 18+, до 75кг" style={inputStyle} /></div>
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
  }
  return <LoginPage onLogin={handleLogin} onRegister={() => setPage("register")} />
}