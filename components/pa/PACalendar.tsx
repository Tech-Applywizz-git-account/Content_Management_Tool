import React from 'react';
import CmoCalendar from '../cmo/CmoCalendar';
import { Project } from '../../types';

interface PACalendarProps {
  projects: Project[];
}

const PACalendar: React.FC<PACalendarProps> = ({ projects }) => {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-black uppercase text-slate-500 mb-2">Publishing Calendar</h2>
        <p className="font-bold text-slate-400 text-sm">Track how your registered brands align with project schedules.</p>
      </div>
      <CmoCalendar projects={projects} />
    </div>
  );
};

export default PACalendar;
