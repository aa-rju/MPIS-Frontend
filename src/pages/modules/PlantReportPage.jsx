/**
 * PlantReportPage.jsx
 *
 * The plant's daily operational diary.
 * Every day someone records: what component was worked on, when maintenance
 * started/ended, when the plant started/stopped producing.
 * Admin reviews and checks entries.
 *
 * BASED ON GOOGLE SHEET: each row has
 *   Date | Description | Component Name | Component Details | Serial No
 *   Maintenance Start | Maintenance End | Plant Start | Plant Stop
 *   Remarks | Checked by Admin
 *
 * Two VIEWS:
 *   1. Log view  — chronological table of all entries
 *   2. Unchecked — only entries admin hasn't reviewed yet
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth }   from "../../context/AuthContext";
import api from "../../api/axios";
import AppLayout from "../../layouts/AppLayout";

// Today's date in YYYY-MM-DD for default form value
const todayStr = () => new Date().toISOString().split("T")[0];

// Format a DateTime string to readable time HH:MM
const fmtTime = (dt) => {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

// Format a DateTime string to readable date
const fmtDate = (dt) => {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const EMPTY_FORM = {
  date: todayStr(),
  componentName: "",
  componentDetails: "",
  componentSerialNo: "",
  description: "",
  maintenanceStart: "",
  maintenanceEnd: "",
  plantStartTime: "",
  plantStopTime: "",
  remarks: "",
};

export default function PlantReportPage() {
  const { sheetId } = useParams();
  const { user }    = useAuth();

  // Data
  const [reports, setReports]   = useState([]);
  const [stats, setStats]       = useState({ total: 0, unchecked: 0, checked: 0 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [canDo, setCanDo]       = useState(new Set());

  // View controls
  const [tab, setTab]           = useState("ALL");     // ALL | UNCHECKED
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [expanded, setExpanded] = useState(null);      // which row is expanded

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [formErr, setFormErr]     = useState("");
  const [saving, setSaving]       = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo)   params.set("to",   dateTo);
      if (tab === "UNCHECKED") params.set("unchecked", "true");

      const [recs, st] = await Promise.all([
        api.get(`/plantreport/${sheetId}?${params}`),
        api.get(`/plantreport/${sheetId}/stats`),
      ]);
      setReports(recs.data);
      setStats(st.data);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load plant reports");
    } finally {
      setLoading(false);
    }
  };

  // Fetch permissions for non-admin users
  const fetchPermissions = async () => {
    if (user?.role === "ADMIN") {
      setCanDo(new Set(["READ", "INPUT", "EDIT", "DELETE"]));
      return;
    }
    try {
      const res = await api.get("/sheets");
      const s = res.data.find((x) => x.id === sheetId);
      if (s?.actions) setCanDo(new Set(s.actions));
    } catch {}
  };

  useEffect(() => {
    fetchPermissions();
  }, [sheetId]);

  useEffect(() => {
    fetchData();
  }, [sheetId, tab, dateFrom, dateTo]);

  // ── Modal helpers ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErr("");
    setShowModal(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      date:              r.date?.split("T")[0] || todayStr(),
      componentName:     r.componentName || "",
      componentDetails:  r.componentDetails || "",
      componentSerialNo: r.componentSerialNo || "",
      description:       r.description || "",
      maintenanceStart:  r.maintenanceStart ? new Date(r.maintenanceStart).toISOString().slice(0,16) : "",
      maintenanceEnd:    r.maintenanceEnd   ? new Date(r.maintenanceEnd).toISOString().slice(0,16)   : "",
      plantStartTime:    r.plantStartTime   ? new Date(r.plantStartTime).toISOString().slice(0,16)   : "",
      plantStopTime:     r.plantStopTime    ? new Date(r.plantStopTime).toISOString().slice(0,16)    : "",
      remarks:           r.remarks || "",
    });
    setFormErr("");
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleField = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  // ── Save (create or update) ──────────────────────────────────────────────────

  const handleSave = async (e) => {
    e.preventDefault();
    setFormErr("");
    setSaving(true);
    try {
      if (editing) {
        const r = await api.patch(`/plantreport/${sheetId}/${editing.id}`, form);
        setReports((prev) => prev.map((x) => (x.id === editing.id ? r.data : x)));
      } else {
        const r = await api.post(`/plantreport/${sheetId}`, form);
        setReports((prev) => [r.data, ...prev]);
      }
      closeModal();
      fetchData(); // refresh stats
    } catch (e) {
      setFormErr(e.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Admin check ──────────────────────────────────────────────────────────────

  const handleCheck = async (report) => {
    try {
      const r = await api.patch(`/plantreport/${sheetId}/${report.id}/check`);
      setReports((prev) => prev.map((x) => (x.id === report.id ? r.data : x)));
      fetchData(); // refresh stats
    } catch (e) {
      alert(e.response?.data?.message || "Failed to mark as checked");
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (report) => {
    if (!confirm(`Delete plant report for ${fmtDate(report.date)}?`)) return;
    try {
      await api.delete(`/plantreport/${sheetId}/${report.id}`);
      setReports((prev) => prev.filter((x) => x.id !== report.id));
      fetchData();
    } catch (e) {
      alert(e.response?.data?.message || "Failed to delete");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppLayout
      title="Plant Report"
      subtitle="Daily plant operation and downtime log"
      actions={
        canDo.has("INPUT") && (
          <button className="btn btn-primary" onClick={openCreate}>+ Add Entry</button>
        )
      }
    >
      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          ["Total Entries",  stats.total,     "var(--text)"],
          ["Unchecked",      stats.unchecked, "var(--red)"],
          ["Checked",        stats.checked,   "var(--green)"],
        ].map(([label, value, color]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "10px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="tabs">
            <button className={`tab${tab === "ALL" ? " active" : ""}`}       onClick={() => setTab("ALL")}>All Entries</button>
            <button className={`tab${tab === "UNCHECKED" ? " active" : ""}`} onClick={() => setTab("UNCHECKED")}>
              ⚠ Unchecked {stats.unchecked > 0 && `(${stats.unchecked})`}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.82rem", color: "var(--muted)" }}>
            <span>From:</span>
            <input type="date" className="input" style={{ width: 140, padding: "5px 8px" }}
              value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span>To:</span>
            <input type="date" className="input" style={{ width: 140, padding: "5px 8px" }}
              value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            {(dateFrom || dateTo) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                Clear
              </button>
            )}
          </div>

          <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginLeft: "auto" }}>
            {reports.length} entries
          </span>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 40, color: "var(--muted)" }}>
          <div className="spinner" /> Loading...
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!loading && reports.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 56 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🏭</div>
          <p style={{ color: "var(--muted)" }}>
            {tab === "UNCHECKED" ? "All entries have been checked. " : "No plant reports yet. "}
          </p>
          {canDo.has("INPUT") && tab === "ALL" && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openCreate}>
              Add First Entry
            </button>
          )}
        </div>
      )}

      {/* ── Reports table ───────────────────────────────────────────────── */}
      {!loading && reports.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Component</th>
                  <th>Description</th>
                  <th>Maint. Start</th>
                  <th>Maint. End</th>
                  <th>Plant Start</th>
                  <th>Plant Stop</th>
                  <th>Status</th>
                  {(canDo.has("EDIT") || canDo.has("DELETE")) && (
                    <th style={{ textAlign: "right" }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <>
                    <tr
                      key={r.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      <td>
                        <span className="mono" style={{ whiteSpace: "nowrap" }}>
                          {fmtDate(r.date)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{r.componentName}</span>
                        {r.componentSerialNo && (
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                            S/N: {r.componentSerialNo}
                          </div>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: "0.82rem", maxWidth: 200 }}>
                        {r.description ? (
                          <span style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {r.description}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="mono">{fmtTime(r.maintenanceStart)}</td>
                      <td className="mono">{fmtTime(r.maintenanceEnd)}</td>
                      <td className="mono">{fmtTime(r.plantStartTime)}</td>
                      <td className="mono">{fmtTime(r.plantStopTime)}</td>
                      <td>
                        {r.checkedByAdmin
                          ? <span className="badge badge-green">✓ Checked</span>
                          : <span className="badge badge-amber">Pending</span>}
                      </td>
                      {(canDo.has("EDIT") || canDo.has("DELETE")) && (
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {canDo.has("EDIT") && !r.checkedByAdmin && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: "var(--green)" }}
                                onClick={() => handleCheck(r)}
                              >
                                ✓ Check
                              </button>
                            )}
                            {canDo.has("EDIT") && (
                              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>
                                Edit
                              </button>
                            )}
                            {canDo.has("DELETE") && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Expandable detail row */}
                    {expanded === r.id && (
                      <tr key={`${r.id}-detail`}>
                        <td colSpan={9} style={{ background: "var(--surface2)", padding: "16px 20px" }}>
                          <div className="grid-2" style={{ gap: 16, fontSize: "0.85rem" }}>
                            <div>
                              <div style={{ color: "var(--muted)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Component Details</div>
                              <div>{r.componentDetails || "—"}</div>
                            </div>
                            <div>
                              <div style={{ color: "var(--muted)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Description</div>
                              <div>{r.description || "—"}</div>
                            </div>
                            <div>
                              <div style={{ color: "var(--muted)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Remarks</div>
                              <div>{r.remarks || "—"}</div>
                            </div>
                            <div>
                              <div style={{ color: "var(--muted)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Added</div>
                              <div>{fmtDate(r.createdAt)}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            style={{ maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>
                {editing ? `Edit Entry — ${fmtDate(editing.date)}` : "Add Plant Report Entry"}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}>✕</button>
            </div>

            {formErr && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>{formErr}</div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Date */}
                <div className="form-group">
                  <label className="label">Date *</label>
                  <input className="input" name="date" type="date" value={form.date} onChange={handleField} required />
                </div>

                {/* Component section */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                    Component Information
                  </div>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="form-group" style={{ gridColumn: "1/-1" }}>
                      <label className="label">Component Name *</label>
                      <input className="input" name="componentName" value={form.componentName} onChange={handleField}
                        required placeholder="e.g. Jaw Crusher, Belt Conveyor, Screen" />
                    </div>
                    <div className="form-group">
                      <label className="label">Component Details</label>
                      <input className="input" name="componentDetails" value={form.componentDetails} onChange={handleField}
                        placeholder="Model, type, etc." />
                    </div>
                    <div className="form-group">
                      <label className="label">Serial Number</label>
                      <input className="input" name="componentSerialNo" value={form.componentSerialNo} onChange={handleField}
                        placeholder="Manufacturer serial" />
                    </div>
                  </div>
                </div>

                {/* Time section */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                    Times
                  </div>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="label">Maintenance Start</label>
                      <input className="input" name="maintenanceStart" type="datetime-local"
                        value={form.maintenanceStart} onChange={handleField} />
                    </div>
                    <div className="form-group">
                      <label className="label">Maintenance End</label>
                      <input className="input" name="maintenanceEnd" type="datetime-local"
                        value={form.maintenanceEnd} onChange={handleField} />
                    </div>
                    <div className="form-group">
                      <label className="label">Plant Start Time</label>
                      <input className="input" name="plantStartTime" type="datetime-local"
                        value={form.plantStartTime} onChange={handleField} />
                    </div>
                    <div className="form-group">
                      <label className="label">Plant Stop Time</label>
                      <input className="input" name="plantStopTime" type="datetime-local"
                        value={form.plantStopTime} onChange={handleField} />
                    </div>
                  </div>
                </div>

                {/* Notes section */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="form-group" style={{ gridColumn: "1/-1" }}>
                      <label className="label">Description</label>
                      <textarea className="input" name="description" value={form.description} onChange={handleField}
                        rows={2} style={{ resize: "vertical" }}
                        placeholder="What happened, what work was done..." />
                    </div>
                    <div className="form-group" style={{ gridColumn: "1/-1" }}>
                      <label className="label">Remarks</label>
                      <textarea className="input" name="remarks" value={form.remarks} onChange={handleField}
                        rows={2} style={{ resize: "vertical" }}
                        placeholder="Additional notes..." />
                    </div>
                  </div>
                </div>

              </div>

              {/* Form actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Add Entry"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}