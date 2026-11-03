import { lazy, Suspense } from 'react';
import Map from './pages/Map';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ProtectedRoute from './components/ui/ProtectedRoute';
import { BrowserRouter, Outlet, Routes, Route } from 'react-router-dom';
import { FlagProvider } from './context/FlagContext';
import { AuthProvider } from './context/AuthContext';

// /moda hanya terdaftar bila VITE_MODA_ENABLED=true saat dev/build. Saat mati,
// alamat itu jatuh ke halaman "tidak ada" dan bundler membuang seluruh kodenya.
// Syarat ditulis di tempat, bukan lewat konstanta, supaya impornya ikut terbuang.
const Moda = import.meta.env.VITE_MODA_ENABLED === 'true' ? lazy(() => import('./pages/Moda')) : null;

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

export function AppRoutes() {
  return (
    <Routes>
      {/* Data publik dan simulasi, tidak butuh backend atau akun */}
      {Moda && (
        <Route
          path='/moda'
          element={
            <Suspense fallback={<p className='p-6 text-sm'>Memuat…</p>}>
              <Moda />
            </Suspense>
          }
        />
      )}

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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
