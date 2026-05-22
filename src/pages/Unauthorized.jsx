import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <h1>403 — Forbidden</h1>
      <p>You don't have permission to view this page.</p>
      <button onClick={() => navigate(-1)}>Go back</button>
    </div>
  );
}