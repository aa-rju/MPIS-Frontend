/**
 * App.jsx — Root router
 *
 * URL pattern for all data modules: /modules/:moduleKey/:sheetId
 *   :moduleKey → tells React which component to render
 *   :sheetId   → SheetDefinition ID, needed by backend canAccess() on every API call
 *
 * Phase 2 active modules (no diesel per owner decision):
 *   assets | inventory | rate_table | maintenance | plant_report | raw_material | orders
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider }  from "./context/AuthContext";
import ProtectedRoute    from "./components/ProtectedRoutes";

// Phase 1
import Login         from "./pages/Login";
import Dashboard     from "./pages/Dashboard";
import AdminUsers    from "./pages/AdminUsers";
import AdminSheets   from "./pages/AdminSheets";
import Unauthorized  from "./pages/Unauthorized";

// Phase 2 — all 7 data modules
import AssetsPage       from "./pages/modules/AssetsPage";
import InventoryPage    from "./pages/modules/InventoryPage";
import RateTablePage    from "./pages/modules/RateTablePage";
import MaintenancePage  from "./pages/modules/MaintenancePage";
import PlantReportPage  from "./pages/modules/PlantReportPage";
import RawMaterialPage  from "./pages/modules/RawMaterialPage";
import OrdersPage       from "./pages/modules/OrdersPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"        element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Admin only */}
          <Route path="/admin/users"  element={<ProtectedRoute roles="ADMIN"><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/sheets" element={<ProtectedRoute roles="ADMIN"><AdminSheets /></ProtectedRoute>} />
          <Route path="/admin"        element={<Navigate to="/admin/sheets" replace />} />

          {/* All authenticated users */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* ── Phase 2 module routes ──────────────────────────────────── */}
          <Route path="/modules/assets/:sheetId"       element={<ProtectedRoute><AssetsPage /></ProtectedRoute>} />
          <Route path="/modules/inventory/:sheetId"    element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
          <Route path="/modules/rate_table/:sheetId"   element={<ProtectedRoute><RateTablePage /></ProtectedRoute>} />
          <Route path="/modules/maintenance/:sheetId"  element={<ProtectedRoute><MaintenancePage /></ProtectedRoute>} />
          <Route path="/modules/plant_report/:sheetId" element={<ProtectedRoute><PlantReportPage /></ProtectedRoute>} />
          <Route path="/modules/raw_material/:sheetId" element={<ProtectedRoute><RawMaterialPage /></ProtectedRoute>} />
          <Route path="/modules/orders/:sheetId"       element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="/"  element={<Navigate to="/login" replace />} />
          <Route path="*"  element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;