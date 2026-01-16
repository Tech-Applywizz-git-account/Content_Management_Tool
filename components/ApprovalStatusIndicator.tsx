import React from 'react';
import { Project, WorkflowStage } from '../types';
import { CheckCircle, Circle, Users, User, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface ApprovalStatusIndicatorProps {
  project: Project;
}

const ApprovalStatusIndicator: React.FC<ApprovalStatusIndicatorProps> = ({ project }) => {
  // Check if project has been reviewed by CMO
  const hasCmoReview = project.history?.some(event => 
    event.stage === WorkflowStage.SCRIPT_REVIEW_L1 ||
    event.stage === WorkflowStage.FINAL_REVIEW_CMO
  );
  
  // Check if CMO approved the project
  const cmoApproved = project.history?.some(event => 
    (event.stage === WorkflowStage.SCRIPT_REVIEW_L1 && event.action === 'APPROVED') ||
    (event.stage === WorkflowStage.FINAL_REVIEW_CMO && event.action === 'APPROVED')
  );
  
  // Check if project has been reviewed by CEO
  const hasCeoReview = project.history?.some(event => 
    event.stage === WorkflowStage.SCRIPT_REVIEW_L2 ||
    event.stage === WorkflowStage.FINAL_REVIEW_CEO
  );
  
  // Check if CEO approved the project
  const ceoApproved = project.history?.some(event => 
    (event.stage === WorkflowStage.SCRIPT_REVIEW_L2 && event.action === 'APPROVED') ||
    (event.stage === WorkflowStage.FINAL_REVIEW_CEO && event.action === 'APPROVED')
  );
  
  // Check if CEO approved the final review specifically
  const ceoFinalApproved = project.history?.some(event => 
    event.stage === WorkflowStage.FINAL_REVIEW_CEO && event.action === 'APPROVED'
  );
  
  // Get the latest approval timestamps
  const cmoApprovalEvent = project.history?.find(event => 
    (event.stage === WorkflowStage.SCRIPT_REVIEW_L1 && event.action === 'APPROVED') ||
    (event.stage === WorkflowStage.FINAL_REVIEW_CMO && event.action === 'APPROVED')
  );
  
  const ceoApprovalEvent = project.history?.find(event => 
    (event.stage === WorkflowStage.SCRIPT_REVIEW_L2 && event.action === 'APPROVED') ||
    (event.stage === WorkflowStage.FINAL_REVIEW_CEO && event.action === 'APPROVED')
  );

  return (
    <div className="border-2 border-black p-6 bg-white">
      <h2 className="text-xl font-black uppercase mb-4 text-slate-900 flex items-center gap-2">
        <Eye size={24} className="text-blue-600" />
        Approval Status
      </h2>
      
      <div className="space-y-4">
        {/* CMO Approval Status */}
        <div className="flex items-center justify-between p-4 border-2 border-slate-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-300">
              {cmoApproved ? (
                <CheckCircle size={24} className="text-green-600" />
              ) : hasCmoReview ? (
                <Circle size={24} className="text-yellow-500" />
              ) : (
                <Circle size={24} className="text-gray-300" />
              )}
            </div>
            <div>
              <div className="font-bold text-slate-900">CMO Review</div>
              <div className="text-sm text-slate-600">
                {cmoApproved ? 'Approved' : hasCmoReview ? 'In Review' : 'Pending'}
              </div>
            </div>
          </div>
          {cmoApprovalEvent && (
            <div className="text-right">
              <div className="text-xs font-bold text-green-600">APPROVED</div>
              <div className="text-xs text-slate-500">
                {format(new Date(cmoApprovalEvent.timestamp), 'dd MMM yyyy')}
              </div>
              <div className="text-xs text-slate-500">
                by {cmoApprovalEvent.actor_name}
              </div>
            </div>
          )}
        </div>
        
        {/* CEO Approval Status */}
        <div className="flex items-center justify-between p-4 border-2 border-slate-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 border-2 border-purple-300">
              {ceoApproved ? (
                <CheckCircle size={24} className="text-green-600" />
              ) : hasCeoReview ? (
                <Circle size={24} className="text-yellow-500" />
              ) : (
                <Circle size={24} className="text-gray-300" />
              )}
            </div>
            <div>
              <div className="font-bold text-slate-900">CEO Review</div>
              <div className="text-sm text-slate-600">
                {ceoApproved ? 'Approved' : hasCeoReview ? 'In Review' : 'Pending'}
              </div>
            </div>
          </div>
          {ceoApprovalEvent && (
            <div className="text-right">
              <div className="text-xs font-bold text-green-600">APPROVED</div>
              <div className="text-xs text-slate-500">
                {format(new Date(ceoApprovalEvent.timestamp), 'dd MMM yyyy')}
              </div>
              <div className="text-xs text-slate-500">
                by {ceoApprovalEvent.actor_name}
              </div>
            </div>
          )}
        </div>
        
        {/* Current Stage Indicator */}
        <div className="mt-6 pt-4 border-t-2 border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className="text-slate-600" />
            <span className="font-bold text-slate-900">Current Workflow Stage</span>
          </div>
          <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded">
            <div className="font-bold text-slate-900">
              {project.current_stage?.replace(/_/g, ' ') || 'Unknown Stage'}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Assigned to: {project.assigned_to_role}
            </div>
          </div>
        </div>
        
        {/* Schedule Post Availability */}
        {ceoFinalApproved && project.current_stage === WorkflowStage.OPS_SCHEDULING && (
          <div className="mt-4 p-3 bg-green-50 border-2 border-green-500 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600" />
              <span className="font-bold text-green-800">Ready for Scheduling</span>
            </div>
            <div className="text-sm text-green-700 mt-1">
              Final CEO approval received - schedule post feature is now available
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalStatusIndicator;