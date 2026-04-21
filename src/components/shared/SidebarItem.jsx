export default function SidebarItem({ icon: Icon, label, active, onClick, collapsed, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center group transition-all duration-200 ${
        collapsed ? 'justify-center px-0 py-3' : 'justify-between px-4 py-3'
      } ${
        active 
          ? 'bg-blue-600/10 text-blue-400 border-l-4 border-blue-500 rounded-l-none' 
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
      title={collapsed ? label : ""}
    >
      <div className={`flex items-center ${collapsed ? '' : 'space-x-3'}`}>
        <Icon size={20} className={active ? 'text-blue-400' : 'group-hover:text-white'} />
        {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
      </div>
      {!collapsed && badge && (
        <span className="bg-blue-600 text-[10px] px-1.5 py-0.5 rounded text-white font-bold">{badge}</span>
      )}
    </button>
  );
}
