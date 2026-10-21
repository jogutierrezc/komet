export default function SidebarItem({ icon: Icon, label, active, onClick, collapsed, badge, itemId, solid }) {
  return (
    <button
      type="button"
      data-nav-id={itemId}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={`relative z-10 w-full h-10 flex items-center rounded-lg text-sm font-medium transition-colors duration-150 ${
        collapsed ? 'justify-center' : 'justify-between px-3'
      } ${active ? `text-white ${solid ? 'bg-night-3' : ''}` : 'text-[#B9CAD2] hover:text-white hover:bg-night-2'}`}
    >
      <span className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
        <Icon size={18} strokeWidth={1.8} />
        {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      </span>
      {!collapsed && badge ? (
        <span className="font-mono text-[11px] font-medium bg-comet text-ink rounded-full px-2 py-0.5">{badge}</span>
      ) : null}
    </button>
  );
}
