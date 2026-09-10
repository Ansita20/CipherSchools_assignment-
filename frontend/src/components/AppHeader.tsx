import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="app-header">
      <Link to="/" className="brand">
        LLD Practice
      </Link>
      {user ? (
        <div className="header-actions">
          <Link to="/history">History</Link>
          <span className="muted">{user.email}</span>
          <button type="button" className="secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      ) : (
        <Link to="/login">Log in</Link>
      )}
    </header>
  );
}
