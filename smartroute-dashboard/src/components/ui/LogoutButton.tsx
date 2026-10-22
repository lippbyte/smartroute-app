import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LogoutButton() {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
    logout();
    navigate('/login'); // Redirect ke halaman login setelah logout
    };
    return (
        <button
          onClick={handleLogout}
          className="fixed bottom-6 right-6 z-100 bg-dark-1 hover:bg-red-700 text-white px-4 py-2 font-mono rounded-sm border border-light-1/25 transition"
        >
            Logout
        </button>
    )
}