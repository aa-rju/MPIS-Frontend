/**
 * src/layouts/AppLayout.jsx
 *
 * ─── WHY A SHARED LAYOUT? ───────────────────────────────────────────────────
 * Every module page (Assets, Inventory, Diesel, etc.) has the same navbar.
 * Without a layout component, every page would copy-paste 40 lines of navbar JSX.
 *
 * With a layout component:
 *   - Change the navbar once → all pages update.
 *   - Each page only writes its own content, not the chrome around it.
 *
 * USAGE:
 *   <AppLayout title="Assets" subtitle="Trucks, machines & vehicles">
 *     <YourPageContent />
 *   </AppLayout>
 *
 * ─── props.children ─────────────────────────────────────────────────────────
 * In React, anything between <AppLayout>...</AppLayout> becomes `props.children`.
 * The layout just renders {children} in the right spot.
 * This is the "slot" pattern — layout provides the frame, page fills the slot.
 */

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AppLayout({ title, subtitle, children, actions }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleBadge = {
    ADMIN: { label: "Admin", cls: "badge-amber" },
    SUPERVISOR: { label: "Supervisor", cls: "badge-blue" },
    EMPLOYEE: { label: "Employee", cls: "badge-gray" },
  };
  const badge = roleBadge[user?.role] || roleBadge.EMPLOYEE;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <nav style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",       // stays at top when scrolling
        top: 0,
        zIndex: 100,              // above page content
      }}>
        {/* Left: brand + breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              color: "var(--accent)",
              fontSize: "1rem",
              cursor: "pointer",
              letterSpacing: "-0.02em",
            }}
            onClick={() => navigate("/dashboard")}
          >
            MPIS
          </span>

          {/* Breadcrumb separator */}
          <span style={{ color: "var(--border2)", fontSize: "1.2rem" }}>›</span>

          <span style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--text)",
          }}>
            {title}
          </span>
        </div>

        {/* Right: user info + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {user?.name}
          </span>
          <span className={`badge ${badge.cls}`}>{badge.label}</span>

          {user?.role === "ADMIN" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/admin/sheets")}
            >
              Admin
            </button>
          )}

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>

          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      {/* ── Page Content ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Page header: title + subtitle + optional action buttons */}
        {(title || actions) && (
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 28,
            gap: 16,
          }}>
            <div className="page-header" style={{ marginBottom: 0 }}>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {/* actions = buttons passed by the page (e.g. "Add Asset" button) */}
            {actions && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {actions}
              </div>
            )}
          </div>
        )}

        {/* Page-specific content rendered here */}
        {children}
      </div>
    </div>
  );
}