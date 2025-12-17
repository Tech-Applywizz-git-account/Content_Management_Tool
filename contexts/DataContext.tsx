import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Project, SystemLog, Role } from '../types';
import { db } from '../services/supabaseDb';

interface DataContextType {
  users: User[];
  logs: SystemLog[];
  projects: Project[];
  loading: boolean;
  error: string | null;
  refreshData: (user: User) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async (user: User) => {
    console.log(`🔄 Refreshing data for ${user.full_name} (${user.role})...`);
    setLoading(true);
    setError(null);

    try {
      if (user.role === Role.ADMIN) {
        console.log("--- Fetching ADMIN data ---");
        const fetchedUsers = await db.getUsers();
        console.log(`✅ Fetched ${fetchedUsers.length} users`);
        setUsers([...fetchedUsers]);

        const fetchedLogs = await db.getSystemLogs();
        console.log(`✅ Fetched ${fetchedLogs.length} logs`);
        setLogs([...fetchedLogs]);
      } else {
        console.log("--- Fetching USER data ---");
        const userProjects = await db.getMyWork(user)
        console.log(`✅ Fetched ${userProjects.length} projects`);
        setProjects([...userProjects]);
      }
    } catch (err: any) {
      console.error("❌ Refresh data failed:", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DataContext.Provider
      value={{
        users,
        logs,
        projects,
        loading,
        error,
        refreshData
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};