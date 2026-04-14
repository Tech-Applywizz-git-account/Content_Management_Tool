import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User, Role } from '../types';

interface ProtectedRouteProps {
    user: User | null;
    isRestoringSession?: boolean; // Add this prop
    allowedRoles?: Role[];
    children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user, isRestoringSession, allowedRoles, children }) => {
    const location = useLocation();

    // Only return null if we DON'T have a user AND we are still restoring session.
    // If we have a user (even one from Sync recovery), we should render immediately 
    // to avoid the "blank screen" flash on refresh.
    if (isRestoringSession && !user) {
        return null;
    }

    if (!user) {
        // Redirect to login if not authenticated
        console.log('ProtectedRoute: No user found, redirecting to login...', location.pathname);
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Check if any of the secondary roles match
        const hasSecondaryAccess = user.secondary_roles?.some(r => allowedRoles.includes(r));
        
        if (!hasSecondaryAccess) {
            // Redirect to their own dashboard if role not allowed
            const rolePath = user.role.toLowerCase();
            return <Navigate to={`/${rolePath}`} replace />;
        }
    }

    return <>{children}</>;
};

export default ProtectedRoute;
