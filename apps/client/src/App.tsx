import { Navigate, Route, Routes } from "react-router-dom";
import { useVaultStore } from "./store/vault";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UnlockPage from "./pages/UnlockPage";
import VaultPage from "./pages/VaultPage";

function App() {
  const { token, locked } = useVaultStore();

  return (
    <Routes>
      <Route path="/register" element={token ? <Navigate to="/unlock" replace /> : <RegisterPage />} />
      <Route path="/login" element={token ? <Navigate to="/unlock" replace /> : <LoginPage />} />
      <Route
        path="/unlock"
        element={!token ? <Navigate to="/login" replace /> : locked ? <UnlockPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/"
        element={
          !token ? (
            <Navigate to="/login" replace />
          ) : locked ? (
            <Navigate to="/unlock" replace />
          ) : (
            <VaultPage />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
