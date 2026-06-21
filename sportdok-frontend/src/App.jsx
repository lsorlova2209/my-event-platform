import { useState } from "react"
import axios from "axios"

function App() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [user, setUser] = useState(null)

  const handleLogin = async () => {
    try {
      const response = await axios.post("http://127.0.0.1:8000/api/v1/auth/login", {
        email,
        password
      })
      if (response.data.success) {
        setUser(response.data)
        setError("")
      } else {
        setError(response.data.message)
      }
    } catch (e) {
      setError("Ошибка соединения с сервером")
    }
  }

  if (user) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#f3f2ee",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif"
      }}>
        <div style={{
          background: "white",
          padding: "48px",
          borderRadius: "16px",
          width: "400px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
          <h2 style={{ color: "#1A56A0", marginBottom: "8px" }}>Добро пожаловать!</h2>
          <p style={{ color: "#4A4A48", marginBottom: "8px" }}>{user.name}</p>
          <p style={{ color: "#4A4A48", marginBottom: "24px" }}>Роль: {user.role}</p>
          <button
            onClick={() => setUser(null)}
            style={{
              padding: "12px 24px",
              background: "#f3f2ee",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              color: "#4A4A48"
            }}
          >
            Выйти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f3f2ee",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        background: "white",
        padding: "48px",
        borderRadius: "16px",
        width: "400px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)"
      }}>
        <h1 style={{ color: "#1A56A0", marginBottom: "8px" }}>СпортДок</h1>
        <p style={{ color: "#4A4A48", marginBottom: "32px" }}>Войдите в систему</p>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", color: "#4A4A48" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              width: "100%", padding: "12px",
              border: "1px solid #D3D1C7", borderRadius: "8px",
              fontSize: "16px", boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", color: "#4A4A48" }}>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: "100%", padding: "12px",
              border: "1px solid #D3D1C7", borderRadius: "8px",
              fontSize: "16px", boxSizing: "border-box"
            }}
          />
        </div>

        {error && (
          <div style={{
            background: "#fde8e8", color: "#A32D2D",
            padding: "12px", borderRadius: "8px", marginBottom: "16px",
            fontSize: "14px"
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          style={{
            width: "100%", padding: "14px",
            background: "#1A56A0", color: "white",
            border: "none", borderRadius: "8px",
            fontSize: "16px", fontWeight: "bold", cursor: "pointer"
          }}
        >
          Войти
        </button>

        <div style={{ marginTop: "24px", padding: "16px", background: "#f3f2ee", borderRadius: "8px", fontSize: "13px", color: "#4A4A48" }}>
          <strong>Тестовые аккаунты:</strong><br/>
          admin@sportdok.ru / admin123<br/>
          club@sportdok.ru / club123
        </div>
      </div>
    </div>
  )
}

export default App