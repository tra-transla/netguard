import { Outlet, useLocation } from 'react-router';
import Sidebar from './Sidebar';

export default function Layout({ isAdmin, onLogout }: { isAdmin: boolean; onLogout: () => void }) {
  const location = useLocation();
  const showSidebar = location.pathname.startsWith('/admin');

  return (
    <div className="flex h-screen bg-slate-950 flex-col md:flex-row font-sans text-slate-200">
      {showSidebar && <Sidebar isAdmin={isAdmin} onLogout={onLogout} />}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
        <div className="w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
