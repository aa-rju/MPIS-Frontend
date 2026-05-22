/**
 * src/components/ProtectedRoutes.jsx
 *
 * UPGRADE: accepts a single role (string) OR multiple roles (array)
 *
 * Usage:
 *   <ProtectedRoute>                          → any authenticated user
 *   <ProtectedRoute roles="ADMIN">            → admin only
 *   <ProtectedRoute roles={["ADMIN","SUPERVISOR"]}> → admin or supervisor
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "var(--bg)", color: "var(--muted)",
        fontFamily: "var(--font-body)", fontSize: "0.9rem"
      }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          Loading...
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // If roles required, check membership
  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(user.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}