import { NavLink } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Settings, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut, isConfigured } = useAuth();

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-48 border-r border-divider bg-surface shrink-0">
        <div className="px-5 py-5 border-b border-divider">
          <span className="text-[15px] font-medium text-text">Portfolio</span>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-5 py-2 text-sm transition-colors ${
                  isActive
                    ? 'text-text font-medium bg-fill'
                    : 'text-muted hover:text-text hover:bg-fill'
                }`
              }
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User Account / Sign out */}
        {isConfigured && user && (
          <div className="p-3 border-t border-divider">
            <div className="px-2 py-1.5 mb-1.5 text-xs text-muted flex items-center gap-2 truncate">
              <UserIcon size={13} className="shrink-0" />
              <span className="truncate" title={user.email}>{user.email}</span>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted hover:text-negative hover:bg-fill rounded transition-colors"
            >
              <LogOut size={13} strokeWidth={1.5} />
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-content mx-auto px-6 py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-divider flex justify-around z-50">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-4 text-xs gap-1 ${
                isActive ? 'text-text' : 'text-muted'
              }`
            }
          >
            <Icon size={18} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

