// This component is deprecated. The comments and feedback section is now directly in CmoOverview.
// This file is kept for reference or potential future use.

import React from 'react';
import { Project } from '../../types';

interface TimelineViewProps {
  project: Project;
}

const CmoTimelineView: React.FC<TimelineViewProps> = ({ project }) => {
  return (
    <div className="text-center py-8 text-gray-500 italic">
      The timeline view has been replaced with a comments and feedback section in the main project view.
    </div>
  );
};

export default CmoTimelineView;