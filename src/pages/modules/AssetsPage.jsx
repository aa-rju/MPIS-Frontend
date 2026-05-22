/**
 * src/pages/modules/AssetsPage.jsx
 *
 * ─── WHAT THIS PAGE DOES ────────────────────────────────────────────────────
 * Shows the assets registry: all trucks, machines, vehicles.
 * Lets authorised users create, edit, deactivate, and reactivate assets.
 *
 * ─── PERMISSION-AWARE UI ────────────────────────────────────────────────────
 * The backend enforces permissions via canAccess() — that's the real gate.
 * But the UI should also hide buttons the user can't use.
 * WHY? Two reasons:
 *   1. Better UX — don't show buttons that will just fail.
 *   2. Clarity — user knows exactly what they can do.
 *
 * We read the user's actions from `sheet.actions` (returned by GET /sheets).
 * If actions includes "INPUT", show the Add button. Otherwise, hide it.
 *
 * IMPORTANT: This is UI-only protection. The real security is the backend.
 * Never trust the frontend to enforce security.
 *
 * ─── STATE MANAGEMENT ───────────────────────────────────────────────────────
 * This page has several pieces of state:
 *   assets          → the list from the API
 *   loading/error   → fetch state
 *   showModal       → is the create/edit form visible?
 *   editingAsset    → which asset is being edited (null = creating new)
 *   form            → the form field values
 *   formLoading     → is a save/delete in progress?
 *   filter          → which asset type to show (ALL, TRUCK, MACHINE, VEHICLE)
 *   search          → text search across name and serial
 *
 * ─── HOW TO READ THIS FILE ──────────────────────────────────────────────────
 * 1. Props/setup at top
 * 2. State declarations
 * 3. Data fetching (useEffect)
 * 4. Event handlers (handleX functions)
 * 5. Derived data (filtered list from state)
 * 6. JSX return (the UI)
 */

import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";   // reads :sheetId from URL
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import AppLayout from "../../layouts/AppLayout";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const ASSET_TYPES = ["TRUCK", "MACHINE", "VEHICLE"];

// What to show in the type badge
const TYPE_STYLES = {
  TRUCK:   { label: "Truck",   cls: "badge-amber" },
  MACHINE: { label: "Machine", cls: "badge-blue"  },
  VEHICLE: { label: "Vehicle", cls: "badge-green" },
};

// Empty form state — used both for init and after reset
const EMPTY_FORM = {
  name: "",
  serialNo: "",
  registrationNo: "",
  type: "TRUCK",
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function AssetsPage() {
  /**
   * useParams() reads URL parameters.
   * Our route is: /assets/:sheetId
   * So sheetId = the SheetDefinition ID for the "assets" sheet.
   * This gets sent to the backend in every API call.
   */
  const { sheetId } = useParams();
  const { user } = useAuth();

  // ── Page state ─────────────────────────────────────────────────────────────
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Modal (create/edit form) state ─────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null); // null = create mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // ── Filter/search state ─────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // ── User's permissions on this sheet ───────────────────────────────────────
  // Admin has all permissions. Non-admin: read from sheet.actions.
  // We store a Set for O(1) lookup: canDo.has("INPUT")
  const [canDo, setCanDo] = useState(new Set());

  // ─── DATA FETCHING ──────────────────────────────────────────────────────────

  /**
   * Fetch assets from the API.
   * URL: GET /api/assets/:sheetId
   * The sheetId in the URL triggers canAccess("READ") on the backend.
   */
  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/assets/${sheetId}`);
      setAssets(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch what permissions this user has on the assets sheet.
   * Admin always has full access — we set all 4 actions.
   * Others: fetch from /sheets to get their actions list.
   */
  const fetchPermissions = async () => {
    if (user?.role === "ADMIN") {
      setCanDo(new Set(["READ", "INPUT", "EDIT", "DELETE"]));
      return;
    }
    try {
      const res = await api.get("/sheets");
      // res.data is an array of sheets WITH their actions for this user
      const thisSheet = res.data.find((s) => s.id === sheetId);
      if (thisSheet?.actions) {
        setCanDo(new Set(thisSheet.actions));
      }
    } catch {
      // Can't fetch permissions — leave canDo empty (safest default)
    }
  };

  /**
   * useEffect runs after the component mounts.
   * The [] dependency array means "run once when page loads".
   * If sheetId changed (e.g. navigation), it would re-run too.
   */
  useEffect(() => {
    fetchPermissions();
    fetchAssets();
  }, [sheetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── FILTERED/SEARCHED DATA ─────────────────────────────────────────────────

  /**
   * useMemo = recompute only when assets, typeFilter, or search changes.
   * Without useMemo, this would re-compute on EVERY render (including typing).
   * With useMemo, it only recomputes when the data actually changes.
   *
   * PERFORMANCE NOTE: For small lists (< 500 items) this doesn't matter much.
   * It's still good practice — and a good concept to understand.
   */
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchesType = typeFilter === "ALL" || a.type === typeFilter;
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        a.name.toLowerCase().includes(searchLower) ||
        (a.serialNo && a.serialNo.toLowerCase().includes(searchLower)) ||
        (a.registrationNo && a.registrationNo.toLowerCase().includes(searchLower));
      return matchesType && matchesSearch;
    });
  }, [assets, typeFilter, search]);

  // ─── EVENT HANDLERS ──────────────────────────────────────────────────────────

  /** Open the modal in CREATE mode */
  const openCreateModal = () => {
    setEditingAsset(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  /** Open the modal in EDIT mode — pre-fill form with existing data */
  const openEditModal = (asset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name,
      serialNo: asset.serialNo || "",
      registrationNo: asset.registrationNo || "",
      type: asset.type,
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAsset(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  /** Handle form field changes — works for any field */
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Save: either CREATE or UPDATE depending on editingAsset.
   *
   * This is a common pattern — one submit handler checks which mode we're in.
   * Alternatively you could have two separate handlers, but this is DRY.
   */
  const handleSave = async (e) => {
    e.preventDefault(); // prevent browser's default form submit (page reload)
    setFormError("");
    setFormLoading(true);

    try {
      if (editingAsset) {
        // UPDATE mode: PATCH /api/assets/:sheetId/:id
        const res = await api.patch(`/assets/${sheetId}/${editingAsset.id}`, form);
        // Update the asset in local state — no need to re-fetch the whole list
        setAssets((prev) =>
          prev.map((a) => (a.id === editingAsset.id ? res.data : a))
        );
      } else {
        // CREATE mode: POST /api/assets/:sheetId
        const res = await api.post(`/assets/${sheetId}`, form);
        // Prepend new asset to the list (shows at top)
        setAssets((prev) => [res.data, ...prev]);
      }
      closeModal();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save asset");
    } finally {
      setFormLoading(false);
    }
  };

  /** Soft delete — sets isActive = false on backend */
  const handleDeactivate = async (asset) => {
    if (!window.confirm(`Deactivate "${asset.name}"?\n\nIt will be hidden from lists but its history is preserved.`)) return;
    try {
      await api.delete(`/assets/${sheetId}/${asset.id}`);
      // Remove from local state (it's now inactive, hidden from normal view)
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to deactivate asset");
    }
  };

  // ─── UI HELPERS ───────────────────────────────────────────────────────────────

  const getTypeCounts = () => {
    const counts = { TRUCK: 0, MACHINE: 0, VEHICLE: 0 };
    assets.forEach((a) => { if (counts[a.type] !== undefined) counts[a.type]++; });
    return counts;
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  const counts = getTypeCounts();

  return (
    <AppLayout
      title="Assets"
      subtitle="Registry of all trucks, machines, and vehicles"
      actions={
        // Only show "Add Asset" button if user has INPUT permission
        canDo.has("INPUT") && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            + Add Asset
          </button>
        )
      }
    >
      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {ASSET_TYPES.map((type) => (
          <div
            key={type}
            className="card"
            style={{ cursor: "pointer", transition: "border-color 0.15s" }}
            onClick={() => setTypeFilter(typeFilter === type ? "ALL" : type)}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {type}S
            </div>
            <div style={{ fontSize: "2rem", fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--accent)", marginTop: 4 }}>
              {counts[type]}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>
              {typeFilter === type ? "Click to clear filter" : "Click to filter"}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter + Search Bar ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Type filter buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {["ALL", ...ASSET_TYPES].map((t) => (
              <button
                key={t}
                className={`btn btn-sm ${typeFilter === t ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setTypeFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search input */}
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Search by name, serial no, registration..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Result count */}
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
            {filteredAssets.length} of {assets.length} assets
          </span>
        </div>
      </div>

      {/* ── Error State ────────────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── Loading State ──────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
          Loading assets...
        </div>
      )}

      {/* ── Empty State ────────────────────────────────────────────────── */}
      {!loading && filteredAssets.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🚛</div>
          <p style={{ color: "var(--muted)" }}>
            {assets.length === 0
              ? "No assets registered yet."
              : "No assets match your filter."}
          </p>
          {canDo.has("INPUT") && assets.length === 0 && (
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={openCreateModal}
            >
              Add First Asset
            </button>
          )}
        </div>
      )}

      {/* ── Assets Table ───────────────────────────────────────────────── */}
      {!loading && filteredAssets.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Serial No.</th>
                  <th>Reg. No.</th>
                  <th>Status</th>
                  <th>Added</th>
                  {/* Only show Actions column if user can do anything */}
                  {(canDo.has("EDIT") || canDo.has("DELETE")) && (
                    <th style={{ textAlign: "right" }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const typeStyle = TYPE_STYLES[asset.type] || {};
                  return (
                    <tr key={asset.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{asset.name}</span>
                      </td>
                      <td>
                        <span className={`badge ${typeStyle.cls}`}>
                          {typeStyle.label}
                        </span>
                      </td>
                      <td>
                        <span className="mono">
                          {asset.serialNo || "—"}
                        </span>
                      </td>
                      <td>
                        <span className="mono">
                          {asset.registrationNo || "—"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${asset.isActive ? "badge-green" : "badge-red"}`}>
                          {asset.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                        {new Date(asset.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      {(canDo.has("EDIT") || canDo.has("DELETE")) && (
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {canDo.has("EDIT") && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => openEditModal(asset)}
                              >
                                Edit
                              </button>
                            )}
                            {canDo.has("DELETE") && asset.isActive && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeactivate(asset)}
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ────────────────────────────────────────── */}
      {showModal && (
        /**
         * Modal overlay: a fixed full-screen div with semi-transparent background.
         * Clicking outside the modal (the overlay itself) closes it.
         * Clicking inside (the white box) does NOT close it.
         *
         * This is the standard "click outside to close" pattern.
         */
        <div
          style={{
            position: "fixed", inset: 0,           // top/right/bottom/left = 0
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
          onClick={closeModal}   // click OUTSIDE the modal box to close
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 440, padding: 28 }}
            onClick={(e) => e.stopPropagation()} // prevent clicks inside from closing
          >
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: "1.1rem" }}>
                {editingAsset ? `Edit: ${editingAsset.name}` : "Add New Asset"}
              </h2>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={closeModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Form error */}
            {formError && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                {formError}
              </div>
            )}

            {/* Asset form */}
            <form onSubmit={handleSave}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Asset Type (shown first — it's the most important field) */}
                <div className="form-group">
                  <label className="label">Asset Type *</label>
                  <select
                    name="type"
                    className="input"
                    value={form.type}
                    onChange={handleFormChange}
                    required
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div className="form-group">
                  <label className="label">Asset Name *</label>
                  <input
                    name="name"
                    className="input"
                    placeholder={
                      form.type === "TRUCK" ? "e.g. Tata Tipper 01" :
                      form.type === "MACHINE" ? "e.g. Jaw Crusher A" :
                      "e.g. Toyota Hilux 01"
                    }
                    value={form.name}
                    onChange={handleFormChange}
                    required
                    minLength={2}
                  />
                </div>

                {/* Serial Number */}
                <div className="form-group">
                  <label className="label">Serial Number</label>
                  <input
                    name="serialNo"
                    className="input"
                    placeholder="Manufacturer serial number (optional)"
                    value={form.serialNo}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Registration Number (mainly for trucks/vehicles) */}
                <div className="form-group">
                  <label className="label">
                    Registration No.
                    {form.type === "MACHINE" && (
                      <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>
                        (not required for machines)
                      </span>
                    )}
                  </label>
                  <input
                    name="registrationNo"
                    className="input"
                    placeholder={form.type !== "MACHINE" ? "e.g. Ba 1 Ja 1234" : "N/A for machines"}
                    value={form.registrationNo}
                    onChange={handleFormChange}
                  />
                </div>

              </div>

              {/* Form actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formLoading}
                  style={{ flex: 1 }}
                >
                  {formLoading
                    ? "Saving..."
                    : editingAsset ? "Save Changes" : "Add Asset"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={formLoading}
                >
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