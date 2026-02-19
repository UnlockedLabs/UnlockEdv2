import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
// import { useTheme } from '../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { UserRole, Page } from '../types';

interface LayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  userRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  facilityName?: string;
}

export function Layout({ 
  children, 
  currentPage, 
  onNavigate, 
  userRole, 
  onRoleChange,
  facilityName = 'Central State Correctional Facility'
}: LayoutProps) {
  const { theme, toggleTheme } = useTheme();

  // Get page title based on current page
  const getPageTitle = () => {
  };

  return (
    <div className="min-h-screen bg-[#E2E7EA] dark:bg-[#0a0a0a] flex">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-16 bg-white dark:bg-[#171717] border-b border-gray-200 dark:border-[#262626] px-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl text-[#203622] dark:text-white">{getPageTitle()}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{facilityName}</p>
          </div>
          
          {/* Right side - Theme toggle, user role, user avatar */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-[#E2E7EA] dark:hover:bg-[#262626] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="size-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Sun className="size-5 text-gray-400" />
              )}
            </button>

            {/* Role Switcher */}
            <select 
              value={userRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              className="bg-[#E2E7EA] dark:bg-[#262626] text-[#203622] dark:text-white px-3 py-1.5 rounded border border-gray-200 dark:border-[#262626] text-sm focus:outline-none focus:ring-2 focus:ring-[#556830] dark:focus:ring-[#8fb55e]"
            >
              <option value="facility_admin">Facility Admin</option>
              <option value="department_admin">Department Admin</option>
            </select>

            {/* User Avatar */}
            <div className="size-9 rounded-full bg-[#556830] dark:bg-[#8fb55e] flex items-center justify-center text-white dark:text-[#0a0a0a] text-sm font-semibold">
              JD
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}