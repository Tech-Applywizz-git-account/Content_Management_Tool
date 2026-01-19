import React from 'react';
import { Role, User } from '../types';
import {
  LayoutDashboard,
  PenTool,
  Video,
  Scissors,
  Palette,
  Globe,
  LogOut,
  Menu,
  X,
  Calendar
} from 'lucide-react';
import { BarChart3 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  onOpenCreate: () => void;
  activeView?: string;
  onChangeView?: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onOpenCreate, activeView = 'dashboard', onChangeView }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const handleCalendarView = () => {
    onChangeView?.('calendar');  // Trigger the view change to 'calendar'
  };
  
  const getRoleIcon = (role: Role) => {
    switch (role) {
      case Role.WRITER: return <PenTool className="w-5 h-5" />;
      case Role.CINE: return <Video className="w-5 h-5" />;
      case Role.EDITOR: return <Scissors className="w-5 h-5" />;
      case Role.DESIGNER: return <Palette className="w-5 h-5" />;
      case Role.OPS: return <Globe className="w-5 h-5" />;
      default: return <LayoutDashboard className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex h-screen bg-white font-sans text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r-2 border-black shadow-[4px_0px_0px_0px_rgba(0,0,0,0.05)] z-10">
        <div className="p-8 border-b-2 border-black bg-white">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-[#D946EF] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] leading-none">
            ApplyWizz
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest mt-2 text-slate-900">Workflow System</p>
        </div>

        <div className="flex-1 px-6 py-8 space-y-6 overflow-y-auto">
          <div className="space-y-3">
            {/* Dashboard Link */}
            <button
              onClick={() => onChangeView?.('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-4 border-2 border-black font-black uppercase transition-transform hover:-translate-y-1 hover:-translate-x-1 ${activeView === 'dashboard'
                ? 'bg-[#D946EF] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white text-black hover:bg-slate-50'
                }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            {/* My Work - For CMO and Production Roles (not CEO/ADMIN) */}
            {user.role !== Role.CEO && user.role !== Role.ADMIN && (
              <button
                onClick={() => onChangeView?.('mywork')}
                className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'mywork'
                  ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                  }`}
              >
                <PenTool className="w-5 h-5" />
                <span>My Work</span>
              </button>
            )}
            {/* Overview - Only for CMO */}
{user.role === Role.CMO && (
  <button
    onClick={() => onChangeView?.('overview')}
    className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${
      activeView === 'overview'
        ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
        : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
    }`}
  >
    <BarChart3 className="w-5 h-5" />
    <span>Overview</span>
  </button>
)}
  
            {/* Calendar - Visible for CMO, CEO, and other roles */}
            {(user.role === Role.CEO || user.role === Role.CMO || user.role === Role.SUB_EDITOR || user.role === Role.WRITER || user.role === Role.CINE || user.role === Role.EDITOR || user.role === Role.DESIGNER || user.role === Role.OPS) && (
              <button
                onClick={() => onChangeView?.('calendar')}
                className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'calendar'
                  ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                  }`}
              >
                <Calendar className="w-5 h-5" />
                <span>Calendar</span>
              </button>
            )}
          </div>
        </div>

        {/* User Footer */}
        <div className="p-6 border-t-2 border-black bg-slate-50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-[#4ADE80] border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {getRoleIcon(user.role)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-black uppercase truncate">{user.full_name}</p>
            </div>
    
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 p-3 bg-[#FF4F4F] text-white border-2 border-black font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b-2 border-black z-50 flex items-center justify-between p-4 shadow-md">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-black uppercase text-[#D946EF]">ApplyWizz</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none bg-white">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-40 pt-24 px-6 md:hidden">
          <button onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Logout button clicked in Layout');
              onLogout();
            }} 
            className="w-full bg-[#FF4F4F] text-white border-2 border-black p-4 font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center space-x-2 mt-8"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-20 md:pt-0 p-4 md:p-12 bg-white">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
