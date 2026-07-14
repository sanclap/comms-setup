export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col fixed h-full z-10">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">E</span>
            </div>
            <span className="font-semibold text-sm text-white">EDXSO Comms</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <NavLink href="/" label="Dashboard" icon="📊" />
          <NavLink href="/events" label="Events" icon="📅" />
          <NavLink href="/upload" label="Upload CSV" icon="📤" />
          <NavLink href="/send" label="Send Campaign" icon="✉️" />
          <NavLink href="/blast" label="Quick Blast" icon="⚡" />
          <NavLink href="/logs" label="Message Logs" icon="📋" />
          <NavLink href="/templates" label="Templates" icon="📝" />
          <NavLink href="/post-event" label="Post-Event Mail" icon="🎓" />
          <NavLink href="/drips" label="Drip Scheduler" icon="⏰" />
          <NavLink href="/certificates" label="Certificates" icon="🏅" />
          <NavLink href="/bible" label="Event Bible" icon="📖" />
        </nav>
        <div className="p-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">v1.0 · EDXSO Internal</p>
        </div>
      </aside>
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a href={href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
      <span className="text-base leading-none">{icon}</span>
      {label}
    </a>
  );
}