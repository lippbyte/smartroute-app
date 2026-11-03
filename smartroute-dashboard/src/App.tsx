import Map from './pages/Map';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Moda from './pages/Moda';
import ProtectedRoute from './components/ui/ProtectedRoute';
import { BrowserRouter, Outlet, Routes, Route } from 'react-router-dom';
import { FlagProvider } from './context/FlagContext';
import { AuthProvider } from './context/AuthContext';

function NotFound() {
  return (
    <div className='w-full h-screen flex justify-center items-center text-2xl'>
      <p>Halaman tidak ada.</p>
    </div>
  );
}

// FlagProvider memanggil backend dashboard, jadi tidak dipasang di rute /moda.
function WithFlags() {
  return (
    <FlagProvider>
      <Outlet />
    </FlagProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Data publik dan simulasi, tidak butuh backend atau akun */}
          <Route path='/moda' element={<Moda />} />

          <Route element={<WithFlags />}>
            {/* Public Route */}
            <Route path='/login' element={<Login />} />

            {/* Protected Routes (Harus Login) */}
            <Route element={<ProtectedRoute />}>
              <Route path='/' element={<Dashboard />} />
              <Route path='/map' element={<Map />} />
            </Route>

            {/* Fallback Route */}
            <Route path='*' element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}