import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "./AdminUsers.css";
const ROLES = ["ADMIN", "SUPERVISOR", "EMPLOYEE"];

export default function AdminUsers() {
  const { user: me, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create user form
  const [form, setForm] = useState({
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "EMPLOYEE"
});

const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

const handleCreate = async (e) => {
  e.preventDefault();

  setFormError("");
  setFormSuccess("");

  if (form.password !== form.confirmPassword) {
    setFormError("Passwords do not match");
    return;
  }

  setCreating(true);
    try {
      await api.post("/auth/users", form);
      setFormSuccess(`User "${form.name}" created successfully.`);
      setForm({
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "EMPLOYEE"
});
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (u) => {
    try {
      const updated = await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated.data : x)));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update user");
    }
  };

  const handleRoleChange = async (u, role) => {
    try {
      const updated = await api.patch(`/users/${u.id}`, { role });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated.data : x)));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update role");
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete user");
    }
  };

  const roleBadge = (role) => {
    const colors = {
      ADMIN: "bg-purple-100 text-purple-700",
      SUPERVISOR: "bg-blue-100 text-blue-700",
      EMPLOYEE: "bg-gray-100 text-gray-700",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[role] || ""}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b px-6 py-3 flex justify-between items-center">
        <div>
          <span className="font-bold text-gray-800">Admin Panel</span>
          <span className="ml-3 text-sm text-gray-500">User Management</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{me?.name} {roleBadge(me?.role)}</span>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Create User */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Create New User</h2>

          {formError && (
            <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {formError}
            </p>
          )}
          {formSuccess && (
            <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              {formSuccess}
            </p>
          )}

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
              <input
                required
                type="text"
                placeholder="Jane Doe"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                required
                type="email"
                placeholder="jane@company.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

<div>
  <label className="block text-xs font-medium text-gray-600 mb-1">
    Password
  </label>

  <div style={{ position: "relative" }}>
    <input
      required
      type={showPassword ? "text" : "password"}
      placeholder="Min 8 characters"
      value={form.password}
      onChange={(e) =>
        setForm((f) => ({
          ...f,
          password: e.target.value
        }))
      }
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
    />

    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      style={{
        position: "absolute",
        right: 12,
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        cursor: "pointer"
      }}
    >
      {showPassword ? "🙈" : "👁"}
    </button>
  </div>
</div>

<div>
  <label className="block text-xs font-medium text-gray-600 mb-1">
    Confirm Password
  </label>

  <div style={{ position: "relative" }}>
    <input
      required
      type={showConfirmPassword ? "text" : "password"}
      placeholder="Confirm password"
      value={form.confirmPassword}
      onChange={(e) =>
        setForm((f) => ({
          ...f,
          confirmPassword: e.target.value
        }))
      }
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
    />

    <button
      type="button"
      onClick={() =>
        setShowConfirmPassword(!showConfirmPassword)
      }
      style={{
        position: "absolute",
        right: 12,
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        cursor: "pointer"
      }}
    >
      {showConfirmPassword ? "🙈" : "👁"}
    </button>
  </div>

  {form.confirmPassword &&
    form.password !== form.confirmPassword && (
      <p
        style={{
          color: "red",
          fontSize: 12,
          marginTop: 6
        }}
      >
        Passwords do not match
      </p>
    )}
</div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>

        {/* User List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">All Users</h2>

          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Role</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="py-2">
                      <td className="py-3 pr-4 font-medium text-gray-800">
                        {u.name}
                        {u.id === me?.id && (
                          <span className="ml-2 text-xs text-gray-400">(you)</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{u.email}</td>
                      <td className="py-3 pr-4">
                        {u.id === me?.id ? (
                          roleBadge(u.role)
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            u.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3">
                        {u.id !== me?.id && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleToggleActive(u)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {u.isActive ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleDelete(u)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}