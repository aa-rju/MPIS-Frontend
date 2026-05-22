/**
 * Dashboard.jsx
 *
 * Shows every module the user can access.
 * Admin sees all 7 modules.
 * Others see only sheets they have SheetPermission rows for.
 *
 * Clicking a card navigates to /modules/:moduleKey/:sheetId
 * The sheetId in the URL is required by every backend API call for canAccess().
 */

import { useAuth }    from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useApi }     from "../hooks/useApi";

const MODULE_ICONS = {
  inventory:    "📦",
  rate_table:   "💰",
  assets:       "🚛",
  maintenance:  "🔧",
  plant_report: "🏭",
  raw_material: "⚙️",
  orders:       "📋",
};

// All 7 modules are fully built — no "coming soon"
const BUILT_MODULES = new Set([
  "inventory", "rate_table", "assets",
  "maintenance", "plant_report", "raw_material", "orders",
]);

const ROLE_BADGE = {
  ADMIN:      { label: "Admin",      cls: "badge-amber" },
  SUPERVISOR: { label: "Supervisor", cls: "badge-blue"  },
  EMPLOYEE:   { label: "Employee",   cls: "badge-gray"  },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const { data: sheets, loading, error } = useApi("/sheets");

  const badge = ROLE_BADGE[user?.role] || ROLE_BADGE.EMPLOYEE;

  const handleClick = (sheet) => {
    if (BUILT_MODULES.has(sheet.moduleKey)) {
      navigate(`/modules/${sheet.moduleKey}/${sheet.id}`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* Navbar */}
      <nav style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 52,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--accent)", fontSize: "1rem", letterSpacing: "-0.02em" }}>
          MPIS
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{user?.name}</span>
          <span className={`badge ${badge.cls}`}>{badge.label}</span>
          {user?.role === "ADMIN" && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/admin/sheets")}>
              Admin Panel
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate("/login"); }}>
            Logout
          </button>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
        <div className="page-header">
          <h1>Welcome back, {user?.name}</h1>
          <p>
            {user?.role === "ADMIN"
              ? "Full system access — click any module to open it."
              : "Your accessible modules are shown below."}
          </p>
        </div>

        {loading && <div style={{ color: "var(--muted)", padding: "20px 0" }}>Loading modules...</div>}
        {error   && <div className="alert alert-error">{error}</div>}

        {sheets && sheets.length === 0 && user?.role !== "ADMIN" && (
          <div className="card" style={{ textAlign: "center", padding: 56 }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🔒</div>
            <p style={{ color: "var(--muted)" }}>No modules assigned yet.</p>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: 6 }}>Ask your admin to grant you access.</p>
          </div>
        )}

        <div className="grid-3" style={{ marginTop: 24 }}>
          {sheets?.map((sheet) => {
            const built = BUILT_MODULES.has(sheet.moduleKey);
            return (
              <div
                key={sheet.id}
                className="card"
                style={{ cursor: built ? "pointer" : "default", transition: "border-color 0.15s, background 0.15s", position: "relative" }}
                onClick={() => handleClick(sheet)}
                onMouseEnter={(e) => { if (built) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--surface2)"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
              >
                <div style={{ fontSize: "2rem", marginBottom: 10 }}>
                  {MODULE_ICONS[sheet.moduleKey] || "📄"}
                </div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{sheet.name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 12, lineHeight: 1.4 }}>
                  {sheet.description}
                </div>

                {/* Permission badges for non-admin users */}
                {sheet.actions && sheet.actions.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {sheet.actions.map((a) => (
                      <span key={a} className="badge badge-amber" style={{ fontSize: "0.6rem" }}>{a}</span>
                    ))}
                  </div>
                )}

                {built && (
                  <div style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600, marginTop: 4 }}>
                    Open →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}