/**
 * AdminSheets.jsx — Permission Management for all Sheets
 *
 * THE PERMISSION BUG (now fixed):
 * ═══════════════════════════════
 * PROBLEM 1 — JavaScript Set mutation:
 *   React state must be treated as immutable. A JavaScript Set is an object.
 *   When you do: const current = prev[userId]  ← this is a REFERENCE, not a copy.
 *   Then: current.delete(action)               ← mutates the ORIGINAL Set in state.
 *   React sees the same object reference, thinks nothing changed → stale UI.
 *   FIX: Always spread into a new Set: new Set(prev[userId] || [])
 *
 * PROBLEM 2 — editState survives sheet switching:
 *   When admin clicks a different sheet, loadPermissions() correctly fetches
 *   new data, but between the click and the API response, the OLD editState
 *   still shows checkboxes for the previous sheet's users.
 *   This creates a flash where the wrong user's permissions appear briefly.
 *   FIX: Reset editState to {} immediately when a new sheet is selected,
 *   before the async fetch begins.
 *
 * PROBLEM 3 — save button has no visual feedback:
 *   setSaving(true/false) was a single boolean, so if two saves ran
 *   simultaneously (clicking Save on two users quickly), the first one
 *   finishing would re-enable the button before the second finished.
 *   FIX: Track saving state per userId: { [userId]: boolean }
 *
 * PROBLEM 4 — no reload after save:
 *   After saving, the frontend never re-fetched from the server.
 *   If the save failed silently, the UI showed the wrong state.
 *   FIX: After save, always reload permissions from server.
 *
 * PROBLEM 5 — dead API call to /dashboard:
 *   useApi("/dashboard") was in the component but /dashboard doesn't exist.
 *   This caused a 404 error on every AdminSheets load, cluttering logs.
 *   FIX: Removed that call entirely.
 */

import { useState, useCallback } from "react";
import { useApi }    from "../hooks/useApi";
import { useAuth }   from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const ACTIONS = ["READ", "INPUT", "EDIT", "DELETE"];

const ACTION_META = {
  READ:   { desc: "View records",     color: "var(--blue)"  },
  INPUT:  { desc: "Add new records",  color: "var(--green)" },
  EDIT:   { desc: "Modify records",   color: "var(--accent)"},
  DELETE: { desc: "Delete records",   color: "var(--red)"   },
};

const MODULE_ICONS = {
  inventory:    "📦",
  rate_table:   "💰",
  assets:       "🚛",
  maintenance:  "🔧",
  plant_report: "🏭",
  raw_material: "⚙️",
  orders:       "📋",
};

export default function AdminSheets() {
  const { user: me, logout } = useAuth();
  const navigate = useNavigate();

  // All sheets list (left panel)
  const { data: sheets, loading: sheetsLoading, error: sheetsError } = useApi("/sheets");
  // All non-admin users (table rows)
  const { data: users } = useApi("/users");

  // Which sheet is selected in the left panel
  const [selectedSheet, setSelectedSheet] = useState(null);
  // Loading state while fetching permissions for selected sheet
  const [loadingPerms, setLoadingPerms] = useState(false);
  // Per-user save state: { [userId]: "idle" | "saving" | "saved" | "error" }
  const [saveState, setSaveState] = useState({});

  /**
   * editState: { [userId]: Set<SheetAction> }
   *
   * KEY RULE: Never mutate a Set stored in state.
   * Always create a NEW Set when toggling, using: new Set(existing)
   *
   * WHY? React uses Object.is() to compare old and new state.
   * If you mutate the existing Set, the reference doesn't change.
   * React sees the same reference and skips re-rendering. Checkbox stays wrong.
   */
  const [editState, setEditState] = useState({});

  /**
   * Load permissions for a sheet.
   * Critical: clear editState BEFORE the async fetch starts.
   * Otherwise the old sheet's permissions flash in the UI during loading.
   */
  const loadPermissions = useCallback(async (sheet) => {
    // Immediately clear old state — no stale data visible during load
    setSelectedSheet(sheet);
    setEditState({});          // ← clear immediately, not after fetch
    setSaveState({});
    setLoadingPerms(true);

    try {
      const res = await api.get(`/permissions/sheet/${sheet.id}`);

      // Build editState: for each user+action row in the response, add the action to that user's Set
      const state = {};
      for (const up of res.data.userPermissions) {
        // new Set(...) creates a fresh Set — no shared references
        state[up.user.id] = new Set(up.actions);
      }
      setEditState(state);
    } catch (err) {
      console.error("Failed to load permissions:", err);
    } finally {
      setLoadingPerms(false);
    }
  }, []);

  /**
   * Toggle one action for one user.
   *
   * CORRECT pattern — always create a new Set:
   *   new Set(prev[userId] || [])
   *
   * WRONG pattern — mutates existing Set:
   *   const current = prev[userId];  current.delete(action);
   */
  const toggleAction = (userId, action) => {
    setEditState((prev) => {
      const current = new Set(prev[userId] || []); // ← NEW Set, not the stored one
      if (current.has(action)) current.delete(action);
      else current.add(action);
      return { ...prev, [userId]: current };        // ← spread into new object
    });
  };

  /**
   * Shortcut: grant all 4 actions to a user at once.
   * Useful when onboarding a new supervisor to a sheet.
   */
  const grantAll = (userId) => {
    setEditState((prev) => ({ ...prev, [userId]: new Set(ACTIONS) }));
  };

  /**
   * Shortcut: revoke all access for a user on this sheet.
   */
  const revokeAll = (userId) => {
    setEditState((prev) => ({ ...prev, [userId]: new Set() }));
  };

  /**
   * Save permissions for one user.
   * After save: reload from server to confirm truth.
   * Per-user save state prevents button confusion when saving multiple users.
   */
  const savePermissions = async (userId) => {
    setSaveState((prev) => ({ ...prev, [userId]: "saving" }));

    try {
      const actions = Array.from(editState[userId] || []);
      await api.post("/permissions/sync", {
        userId,
        sheetId: selectedSheet.id,
        actions,
      });

      // Mark as saved, then fade back to idle
      setSaveState((prev) => ({ ...prev, [userId]: "saved" }));
      setTimeout(() => setSaveState((prev) => ({ ...prev, [userId]: "idle" })), 1800);

      // Reload from server — confirm the save actually took effect
      await loadPermissions(selectedSheet);
    } catch (err) {
      setSaveState((prev) => ({ ...prev, [userId]: "error" }));
      alert(err.response?.data?.message || "Failed to save permissions");
      setTimeout(() => setSaveState((prev) => ({ ...prev, [userId]: "idle" })), 2000);
    }
  };

  const getUserActions = (userId) => editState[userId] || new Set();
  const nonAdminUsers  = users?.filter((u) => u.role !== "ADMIN") ?? [];

  const getSaveButtonLabel = (userId) => {
    const s = saveState[userId] || "idle";
    if (s === "saving") return "Saving...";
    if (s === "saved")  return "✓ Saved";
    if (s === "error")  return "Error — retry";
    return "Save";
  };

  const getSaveButtonStyle = (userId) => {
    const s = saveState[userId] || "idle";
    if (s === "saved")  return "btn btn-sm" + " " + "btn-ghost";
    if (s === "error")  return "btn btn-sm btn-danger";
    return "btn btn-primary btn-sm";
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 52,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--accent)", fontSize: "1rem" }}>
            MPIS
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/admin/users")}>Users</button>
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--accent)", borderColor: "var(--accent-dim)" }}>Sheets</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/dashboard")}>Dashboard</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{me?.name}</span>
          <span className="badge badge-amber">Admin</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate("/login"); }}>Logout</button>
        </div>
      </nav>

      {/* ── Split Layout ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", height: "calc(100vh - 52px)" }}>

        {/* Left: Sheet list */}
        <div style={{ borderRight: "1px solid var(--border)", overflowY: "auto", padding: "20px 16px" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
              Modules
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              Select a module to manage who can access it
            </div>
          </div>

          {sheetsLoading && <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Loading...</div>}
          {sheetsError   && <div className="alert alert-error">{sheetsError}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sheets?.map((sheet) => {
              const isSelected = selectedSheet?.id === sheet.id;
              return (
                <button
                  key={sheet.id}
                  onClick={() => loadPermissions(sheet)}
                  style={{
                    background: isSelected ? "var(--accent-dim)" : "transparent",
                    border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: "var(--radius)",
                    padding: "10px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.12s",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1.1rem" }}>{MODULE_ICONS[sheet.moduleKey] || "📄"}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: isSelected ? "var(--accent)" : "var(--text)", fontSize: "0.875rem" }}>
                        {sheet.name}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                        {sheet.moduleKey}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Permission editor */}
        <div style={{ overflowY: "auto", padding: 28 }}>
          {!selectedSheet ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
              <div style={{ fontSize: "3rem" }}>🔐</div>
              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Select a module from the left to manage permissions</div>
            </div>
          ) : loadingPerms ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--muted)" }}>
              <div className="spinner" />
              Loading permissions for {selectedSheet.name}...
            </div>
          ) : (
            <>
              {/* Sheet header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <span style={{ fontSize: "1.6rem" }}>{MODULE_ICONS[selectedSheet.moduleKey] || "📄"}</span>
                  <h1 style={{ fontSize: "1.4rem", fontFamily: "var(--font-display)" }}>{selectedSheet.name}</h1>
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  Check the boxes to grant access. Click <strong style={{ color: "var(--text)" }}>Save</strong> on each row to apply.
                  Admins always have full access and are not shown here.
                </p>
              </div>

              {/* Action legend */}
              <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                {ACTIONS.map(a => (
                  <div key={a} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACTION_META[a].color }} />
                    <span style={{ color: "var(--muted)" }}><strong style={{ color: "var(--text)" }}>{a}</strong> — {ACTION_META[a].desc}</span>
                  </div>
                ))}
              </div>

              {/* Permissions table */}
              {nonAdminUsers.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                  No users created yet. Go to <strong>Users</strong> to create employees and supervisors first.
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ padding: "12px 16px", width: "30%" }}>User</th>
                        <th style={{ padding: "12px 16px" }}>Role</th>
                        {ACTIONS.map((a) => (
                          <th key={a} style={{ padding: "12px 8px", textAlign: "center", width: 72 }}>
                            <div style={{ color: ACTION_META[a].color }}>{a}</div>
                          </th>
                        ))}
                        <th style={{ padding: "12px 8px", textAlign: "center" }}>Quick</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Save</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nonAdminUsers.map((u) => {
                        const actions = getUserActions(u.id);
                        const saveLabel = getSaveButtonLabel(u.id);
                        const saveCls   = getSaveButtonStyle(u.id);
                        const isSaving  = (saveState[u.id] || "idle") === "saving";
                        const isSaved   = (saveState[u.id] || "idle") === "saved";

                        return (
                          <tr key={u.id} style={!u.isActive ? { opacity: 0.4 } : {}}>
                            {/* User info */}
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{u.name}</div>
                              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 1 }}>{u.email}</div>
                              {!u.isActive && (
                                <span className="badge badge-red" style={{ marginTop: 4 }}>Inactive</span>
                              )}
                            </td>

                            {/* Role badge */}
                            <td style={{ padding: "12px 16px" }}>
                              <span className={`badge ${u.role === "SUPERVISOR" ? "badge-blue" : "badge-gray"}`}>
                                {u.role}
                              </span>
                            </td>

                            {/* Checkboxes — one per action */}
                            {ACTIONS.map((a) => (
                              <td key={a} style={{ padding: "12px 8px", textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={actions.has(a)}
                                  onChange={() => toggleAction(u.id, a)}
                                  disabled={isSaving || !u.isActive}
                                  style={{
                                    width: 17, height: 17,
                                    accentColor: ACTION_META[a].color,
                                    cursor: u.isActive ? "pointer" : "not-allowed",
                                  }}
                                />
                              </td>
                            ))}

                            {/* Quick-grant / revoke */}
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: "0.7rem", padding: "3px 7px", color: "var(--green)" }}
                                  onClick={() => grantAll(u.id)}
                                  disabled={isSaving || !u.isActive}
                                  title="Grant all 4 permissions"
                                >
                                  All
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: "0.7rem", padding: "3px 7px", color: "var(--red)" }}
                                  onClick={() => revokeAll(u.id)}
                                  disabled={isSaving || !u.isActive}
                                  title="Revoke all permissions"
                                >
                                  None
                                </button>
                              </div>
                            </td>

                            {/* Save button — per user */}
                            <td style={{ padding: "8px 16px", textAlign: "right" }}>
                              <button
                                className={saveCls}
                                disabled={isSaving || !u.isActive}
                                onClick={() => savePermissions(u.id)}
                                style={isSaved ? { color: "var(--green)", borderColor: "var(--green)" } : {}}
                              >
                                {isSaving && <span className="spinner" style={{ width: 12, height: 12 }} />}
                                {saveLabel}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p style={{ marginTop: 16, fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text)" }}>Tip:</strong> Use <em>All</em> to grant full access,
                <em> None</em> to revoke everything. Inactive users cannot log in regardless of permissions.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}