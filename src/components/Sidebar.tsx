import { NavLink } from 'react-router';
import { LayoutDashboard, Map as MapIcon, Settings, LogOut, Shield } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar({ isAdmin, onLogout }: { isAdmin: boolean; onLogout: () => void }) {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Access Map', path: '/map', icon: MapIcon },
    { name: 'Admin', path: '/admin', icon: Settings },
  ];

  return (
    <aside className="w-full md:w-64 bg-white border-b md:border-r border-gray-200 shrink-0 shadow-sm z-10 flex flex-col h-auto md:h-full">
      <div className="p-6 md:h-20 flex items-center gap-3 border-b border-gray-200">
        <div className="bg-blue-600 rounded-lg p-2 text-white">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">NetGuard</h1>
      </div>

      <nav className="flex-1 p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ease-out font-medium text-sm whitespace-nowrap',
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500/20'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {isAdmin && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-red-600 hover:bg-red-50 transition-colors font-medium text-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}
