import React, { useState } from 'react';
import { User } from '../types';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileClock,
  Settings,
  LogOut,
  Menu,
  X,
  Search
} from 'lucide-react';


export type AdminView = 'DASH' | 'USERS' | 'USER_ADD' | 'ROLES' | 'LOGS' | 'SETTINGS';

interface AdminLayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: AdminView;
  onNavigate: (view: AdminView) => void;
  onLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, user, currentView, onNavigate, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'DASH', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'USERS', label: 'Users', icon: Users },
    { id: 'ROLES', label: 'Roles & Permissions', icon: ShieldCheck },
    { id: 'LOGS', label: 'Audit Logs', icon: FileClock },
    { id: 'SETTINGS', label: 'System Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-red-900/50">A</div>
          <div>
            <span className="text-xl font-bold tracking-tight block">ApplyWizz</span>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Admin Panel</span>
          </div>
        </div>

        <div className="flex-1 px-4 space-y-1 mt-6">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">Management</div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as AdminView)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md transition-colors ${currentView === item.id || (currentView === 'USER_ADD' && item.id === 'USERS')
                  ? 'bg-red-600 text-white shadow-md shadow-red-900/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <span className="font-bold text-white">AD</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
              <p className="text-xs text-slate-500 truncate">Administrator</p>
            </div>
  
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Logout button clicked in AdminLayout');
              onLogout();
            }}
            className="w-full flex items-center justify-center space-x-2 p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors text-sm"
            disabled={false} // We'll handle disabling in the parent component
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-slate-900 text-white z-50 flex items-center justify-between p-4 shadow-md">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-white">A</div>
          <span className="font-bold">ApplyWizz Admin</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900 z-40 pt-20 px-6 md:hidden">
          <div className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id as AdminView); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${currentView === item.id ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => {
            console.log('Logout button clicked (mobile)');
            onLogout();
          }} className="text-red-400 flex items-center space-x-2 mt-8 px-4">
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-20 md:pt-0 bg-slate-50">
        {/* Top Search Bar (Desktop only) */}
        <header className="hidden md:flex bg-white h-16 border-b border-slate-200 px-8 items-center justify-between sticky top-0 z-10">
          <div className="text-sm text-slate-500">
            System Version 1.1 <span className="mx-2">•</span> Admin Console
          </div>
          <div className="w-96 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search system settings..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;