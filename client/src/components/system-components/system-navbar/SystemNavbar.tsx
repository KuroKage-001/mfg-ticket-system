import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../../hooks/system-hooks/useAuth';
import mfgLogo from '../../../assets/images/MFG.jpg';

function SystemNavbar(): React.ReactElement {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = (): void => {
    void logout();
  };

  const baseLinkClass =
    'relative inline-flex items-center gap-1.5 px-1 py-0.5 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:rounded';

  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    isActive
      ? `${baseLinkClass} text-white after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-white`
      : `${baseLinkClass} text-slate-300 hover:text-white`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }): string =>
    isActive
      ? 'block rounded-md px-3 py-2 text-sm font-semibold text-white bg-white/10'
      : 'block rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors';

  // Role pill colour
  const rolePillClass =
    user?.role === 'ADMIN'
      ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-inset ring-indigo-400/30'
      : 'bg-emerald-500/20 text-emerald-200 ring-1 ring-inset ring-emerald-400/30';

  return (
    <header className="w-full sticky top-0 z-40 bg-slate-900 shadow-md shadow-black/20 border-b border-white/5">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-14 items-center justify-between">

          {/* ── Left: Logo + Nav links ─────────────────────────── */}
          <div className="flex items-center gap-6">
            {/* Logo */}
            <NavLink
              to="/dashboard"
              className="flex items-center gap-2.5 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:rounded-md"
              aria-label="Go to dashboard"
            >
              <img
                src={mfgLogo}
                alt="MFG Logo"
                className="h-8 w-8 rounded-md object-cover ring-1 ring-white/20"
              />
              <span className="hidden sm:block text-sm font-bold tracking-tight text-white leading-none">
                IT MFG<span className="text-slate-400 font-normal ml-1 text-xs tracking-normal">Ticket System</span>
              </span>
            </NavLink>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-px bg-white/10" aria-hidden="true" />

            {/* Desktop nav links */}
            <div className="hidden sm:flex items-center gap-5" role="list">
              <NavLink to="/dashboard" className={navLinkClass} role="listitem">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </NavLink>
              <NavLink to="/tickets" className={navLinkClass} role="listitem">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Tickets
              </NavLink>
              {user?.role === 'ADMIN' && (
                <NavLink to="/admin/users" className={navLinkClass} role="listitem">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Users
                </NavLink>
              )}
              {user?.role === 'ADMIN' && (
                <NavLink to="/admin/kb" className={navLinkClass} role="listitem">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Knowledge Base
                </NavLink>
              )}
            </div>
          </div>

          {/* ── Right: User info + logout ──────────────────────── */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2.5">
                {/* Avatar initial */}
                <div
                  className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white uppercase shrink-0 ring-1 ring-white/20"
                  aria-hidden="true"
                >
                  {user.fullName.charAt(0)}
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-semibold text-white">{user.fullName}</span>
                  <span className={`mt-0.5 inline-flex w-fit rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${rolePillClass}`}>
                    {user.role}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/15 active:bg-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => { setMobileOpen((o) => !o); }}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className="sm:hidden inline-flex items-center justify-center rounded-md p-1.5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {mobileOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Mobile menu ────────────────────────────────────────── */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-white/10 pb-3 pt-2 space-y-1" role="menu">
            <NavLink to="/dashboard" className={mobileLinkClass} onClick={() => { setMobileOpen(false); }}>Dashboard</NavLink>
            <NavLink to="/tickets"   className={mobileLinkClass} onClick={() => { setMobileOpen(false); }}>Tickets</NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin/users" className={mobileLinkClass} onClick={() => { setMobileOpen(false); }}>Users</NavLink>
            )}
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin/kb" className={mobileLinkClass} onClick={() => { setMobileOpen(false); }}>Knowledge Base</NavLink>
            )}
            <div className="border-t border-white/10 mt-2 pt-2 px-3 flex items-center justify-between">
              {user && (
                <span className="text-xs text-slate-300">{user.fullName}</span>
              )}
              <button
                type="button"
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                className="text-xs text-slate-300 hover:text-white underline"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

export default SystemNavbar;
