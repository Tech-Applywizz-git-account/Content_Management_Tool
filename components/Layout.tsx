import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  Calendar,
  Eye,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { BarChart3 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  onOpenCreate: () => void;
  activeView?: string;
  onChangeView?: (view: string) => void;
  finalReviewCount?: number;
  approvedVideosCount?: number;
  hideSidebar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onOpenCreate, activeView = 'dashboard', onChangeView, finalReviewCount, approvedVideosCount, hideSidebar = false }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleNavigate = (view: string) => {
    const rolePath = user.role === Role.SUB_EDITOR ? 'sub_editor' : user.role.toLowerCase();
    if (view === 'dashboard') {
      navigate(`/${rolePath}`);
    } else {
      navigate(`/${rolePath}/${view}`);
    }
    onChangeView?.(view);
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
      {!hideSidebar && (
        <aside className="hidden md:flex flex-col w-72 bg-white border-r-2 border-black shadow-[4px_0px_0px_0px_rgba(0,0,0,0.05)] z-10">
          <div className="p-8 border-b-2 border-black bg-white">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-[#D946EF] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] leading-none">
              ApplyWizz
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest mt-2 text-slate-900">Workflow System</p>
          </div>

          <div className="flex-1 px-6 py-8 space-y-6 overflow-y-auto scrollbar-hide">
            <div className="space-y-3">
              {/* Dashboard Link */}
              <button
                onClick={() => handleNavigate('dashboard')}
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
                  onClick={() => handleNavigate('mywork')}
                  className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'mywork'
                    ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                    }`}
                >
                  <PenTool className="w-5 h-5" />
                  <span>My Work</span>
                </button>
              )}
              {/* Overview - For CMO and Partnership Associate */}
              {(user.role === Role.CMO || user.role === Role.PARTNER_ASSOCIATE) && (
                <button
                  onClick={() => handleNavigate('overview')}
                  className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'overview'
                    ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                    }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Overview</span>
                </button>
              )}

              {/* Final Review - Only for CMO */}
              {user.role === Role.CMO && (
                <button
                  onClick={() => handleNavigate('final-review')}
                  className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'final-review'
                    ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                    }`}
                >
                  <Eye className="w-5 h-5" />
                  <span className="flex items-center">
                    Final Review
                    {finalReviewCount !== undefined && finalReviewCount > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                        {finalReviewCount}
                      </span>
                    )}
                  </span>
                </button>
              )}

              {/* Calendar - Visible for most roles */}
              {(user.role === Role.CEO || user.role === Role.CMO || user.role === Role.SUB_EDITOR || user.role === Role.WRITER || user.role === Role.CINE || user.role === Role.EDITOR || user.role === Role.DESIGNER || user.role === Role.OPS || user.role === Role.PARTNER_ASSOCIATE) && (
                <button
                  onClick={() => handleNavigate('calendar')}
                  className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'calendar'
                    ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                    }`}
                >
                  <Calendar className="w-5 h-5" />
                  <span>Calendar</span>
                </button>
              )}

              {/* Approved Videos - Visible for WRITER */}
              {user.role === Role.WRITER && (
                <button
                  onClick={() => handleNavigate('approved-videos')}
                  className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'approved-videos'
                    ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                    }`}
                >
                  <Video className="w-5 h-5" />
                  <span className="flex items-center">
                    Approved Influencer Videos
                    {approvedVideosCount !== undefined && approvedVideosCount > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                        {approvedVideosCount}
                      </span>
                    )}
                  </span>
                </button>
              )}

              {/* CEO Approved Scripts - Visible for PARTNER_ASSOCIATE */}
              {user.role === Role.PARTNER_ASSOCIATE && (
                <button
                  onClick={() => handleNavigate('ceo-approved-scripts')}
                  className={`w-full flex items-center space-x-3 px-4 py-4 border-2 font-bold uppercase transition-all ${activeView === 'ceo-approved-scripts'
                    ? 'bg-[#D946EF] text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black border-transparent hover:border-black hover:bg-slate-50'
                    }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>CEO Approved Scripts</span>
                </button>
              )}

              {/* Lead Magnet Scripts - Visible for WRITER, CMO, CEO, SUB_EDITOR */}

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
      )}

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b-2 border-black z-50 flex items-center justify-between p-4 shadow-md">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-black uppercase text-[#D946EF]">ApplyWizz</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none bg-white"
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay/Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-white z-50 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:hidden border-r-2 border-black`}>
        <div className="p-6 border-b-2 border-black">
          <h1 className="text-2xl font-black uppercase tracking-tighter text-[#D946EF]">
            ApplyWizz
          </h1>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-hide">
          <button
            onClick={() => { handleNavigate('dashboard'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 border-2 border-black font-black uppercase ${activeView === 'dashboard' ? 'bg-[#D946EF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </button>

          {user.role !== Role.CEO && user.role !== Role.ADMIN && (
            <button
              onClick={() => { handleNavigate('mywork'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 border-2 border-black font-black uppercase ${activeView === 'mywork' ? 'bg-[#D946EF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}
            >
              <PenTool className="w-5 h-5" />
              <span>My Work</span>
            </button>
          )}

          {(user.role === Role.CMO || user.role === Role.PARTNER_ASSOCIATE) && (
            <>
              <button
                onClick={() => { handleNavigate('overview'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 border-2 border-black font-black uppercase ${activeView === 'overview' ? 'bg-[#D946EF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}
              >
                <BarChart3 className="w-5 h-5" />
                <span>Overview</span>
              </button>
            </>
          )}

          {user.role === Role.CMO && (
            <>
              <button
                onClick={() => { handleNavigate('final-review'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 border-2 border-black font-black uppercase ${activeView === 'final-review' ? 'bg-[#D946EF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}
              >
                <Eye className="w-5 h-5" />
                <span>Final Review ({finalReviewCount || 0})</span>
              </button>
            </>
          )}

          {(user.role === Role.CEO || user.role === Role.CMO || user.role === Role.SUB_EDITOR || user.role === Role.WRITER || user.role === Role.CINE || user.role === Role.EDITOR || user.role === Role.DESIGNER || user.role === Role.OPS || user.role === Role.PARTNER_ASSOCIATE) && (
            <button
              onClick={() => { handleNavigate('calendar'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 border-2 border-black font-black uppercase ${activeView === 'calendar' ? 'bg-[#D946EF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}
            >
              <Calendar className="w-5 h-5" />
              <span>Calendar</span>
            </button>
          )}

          {/* Mobile Approved Influencer Videos */}
          {user.role === Role.WRITER && (
            <button
              onClick={() => { handleNavigate('approved-videos'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 border-2 border-black font-black uppercase ${activeView === 'approved-videos' ? 'bg-[#D946EF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}
            >
              <Video className="w-5 h-5" />
              <span className="flex items-center">
                Approved Influencer Videos
                {approvedVideosCount !== undefined && approvedVideosCount > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {approvedVideosCount}
                  </span>
                )}
              </span>
            </button>
          )}

          {/* Mobile CEO Approved Scripts */}
          {user.role === Role.PARTNER_ASSOCIATE && (
            <button
              onClick={() => { handleNavigate('ceo-approved-scripts'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 border-2 border-black font-black uppercase ${activeView === 'ceo-approved-scripts' ? 'bg-[#D946EF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>CEO Approved Scripts</span>
            </button>
          )}

          {/* Mobile Lead Magnet Scripts */}
          {(user.role === Role.WRITER || user.role === Role.CMO || user.role === Role.CEO || user.role === Role.SUB_EDITOR) && (
            <button
              onClick={() => { handleNavigate('lead-magnet-scripts'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 border-2 border-black font-black uppercase ${activeView === 'lead-magnet-scripts' ? 'bg-[#6366F1] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}
            >
              <FileText className={`w-5 h-5 ${activeView === 'lead-magnet-scripts' ? 'text-white' : 'text-[#6366F1]'}`} />
              <span>Lead Magnet Scripts</span>
            </button>
          )}
        </div>

        <div className="absolute bottom-0 w-full p-4 border-t-2 border-black bg-slate-50">
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              onLogout();
            }}
            className="w-full flex items-center justify-center space-x-2 p-3 bg-[#FF4F4F] text-white border-2 border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className={`flex-1 h-screen overflow-hidden flex flex-col pt-20 md:pt-0 bg-white`}>
        <div className="flex-1 overflow-y-auto">
          <div className={`w-full ${hideSidebar ? '' : 'px-6 py-4'}`}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
