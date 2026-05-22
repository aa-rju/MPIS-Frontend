import "./Login.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const user = await login(email, password);

      if (user.role === "ADMIN") navigate("/admin");
      else navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* Left Panel */}
      <div className="login-brand">
        <h1>MPIS</h1>

        <div className="brand-footer">
          Secure Enterprise Access
        </div>
      </div>

      {/* Right Panel */}
      <div className="login-card">

        <h2>Welcome Back</h2>
        <p className="subtitle">
          Sign in to continue
        </p>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <label>Email</label>
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <label>Password</label>

          <div className="password-box">
            <input
              type={show ? "text" : "password"}
              required
              placeholder="Enter password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />

            <button
              type="button"
              onClick={() => setShow(!show)}
            >
              {show ? "🙈" : "👁"}
            </button>
          </div>

          <button
            className="login-btn"
            disabled={loading}
            type="submit"
          >
            {loading
              ? "Signing In..."
              : "Sign In"}
          </button>
        </form>

      </div>
    </div>
  );
}