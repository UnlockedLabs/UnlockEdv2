import {
    HomeIcon,
    AcademicCapIcon,
    RectangleStackIcon,
    // ClipboardDocumentCheckIcon,
    UsersIcon,
    UserGroupIcon,
    BookOpenIcon,
    ChartBarIcon,
    BuildingOfficeIcon,
    CalendarIcon,
    LightBulbIcon,
    GlobeAltIcon,
    BookmarkSquareIcon,
    ChevronDownIcon,
    ChevronRightIcon,
  } from '@heroicons/react/24/outline';
  import { useState } from 'react';
  import { Page } from '../types';
  
  interface SidebarProps {
    currentPage: Page;
    onNavigate: (page: Page) => void;
  }
  
  export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
    const [expandedSections, setExpandedSections] = useState<string[]>(['program-management']);
    const [collapsed, setCollapsed] = useState(false);
  
    const toggleSection = (section: string) => {
      setExpandedSections(prev =>
        prev.includes(section)
          ? prev.filter(s => s !== section)
          : [...prev, section]
      );
    };
  
    const isActive = (pageName: string | string[]) => {
      const names = Array.isArray(pageName) ? pageName : [pageName];
      return names.includes(currentPage.name);
    };
  
    return (
      <div 
        className={`bg-white dark:bg-[#171717] border-r border-gray-200 dark:border-[#262626] transition-all duration-300 flex flex-col ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Logo/Header */}
        <div className="h-16 border-b border-gray-200 dark:border-[#262626] flex items-center justify-between px-4 shrink-0">
          {!collapsed && (
            <div className="text-xl text-[#203622] dark:text-white font-semibold">
              UnlockEd
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-[#E2E7EA] dark:hover:bg-[#262626] transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronRightIcon className={`size-5 text-gray-600 dark:text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
  
        {/* Navigation */}
        <nav className="p-3 space-y-1 overflow-y-auto flex-1">
          {/* Dashboard - Standalone */}
          <button 
            onClick={() => onNavigate({ name: 'dashboard' })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive('dashboard')
                ? 'bg-[#556830] dark:bg-[#556830] text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
            }`}
          >
            <HomeIcon className="size-5 shrink-0" />
            {!collapsed && <span className="text-sm">Dashboard</span>}
          </button>
  
          {!collapsed && <div className="pt-4 pb-2 px-3">
            <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500">Core</div>
          </div>}
  
          {/* Residents */}
          <button 
            onClick={() => onNavigate({ name: 'residents' })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive('residents')
                ? 'bg-[#556830] dark:bg-[#556830] text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
            }`}
          >
            <UsersIcon className="size-5 shrink-0" />
            {!collapsed && <span className="text-sm">Residents</span>}
          </button>
  
          {/* Admins */}
          <button 
            onClick={() => onNavigate({ name: 'admins' })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive('admins')
                ? 'bg-[#556830] dark:bg-[#556830] text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
            }`}
          >
            <UserGroupIcon className="size-5 shrink-0" />
            {!collapsed && <span className="text-sm">Admins</span>}
          </button>
  
          {/* Facilities */}
          <button 
            onClick={() => onNavigate({ name: 'facilities' })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive('facilities')
                ? 'bg-[#556830] dark:bg-[#556830] text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
            }`}
          >
            <BuildingOfficeIcon className="size-5 shrink-0" />
            {!collapsed && <span className="text-sm">Facilities</span>}
          </button>
  
          {/* Operational Insights */}
          <button 
            onClick={() => onNavigate({ name: 'operational-insights' })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive('operational-insights')
                ? 'bg-[#556830] dark:bg-[#556830] text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
            }`}
          >
            <ChartBarIcon className="size-5 shrink-0" />
            {!collapsed && <span className="text-sm">Operational Insights</span>}
          </button>
  
          {/* Divider */}
          {!collapsed && <div className="border-t border-gray-200 dark:border-[#262626] my-3"></div>}
  
          {/* Program Management Section */}
          <div>
            {!collapsed && <div className="pt-2 pb-2 px-3">
              <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500">Program Management</div>
            </div>}
            
            <button
              onClick={() => toggleSection('program-management')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive(['programs', 'program-detail', 'classes', 'class-detail', 'schedule', 'take-attendance'])
                  ? 'text-[#556830] dark:text-[#8fb55e]'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
              }`}
            >
              <AcademicCapIcon className="size-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="text-sm flex-1 text-left">Program Management</span>
                  <ChevronDownIcon className={`size-4 transition-transform ${expandedSections.includes('program-management') ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
            {!collapsed && expandedSections.includes('program-management') && (
              <div className="ml-4 mt-1 space-y-1 pl-3 border-l-2 border-gray-200 dark:border-[#262626]">
                <button 
                  onClick={() => onNavigate({ name: 'programs' })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive(['programs', 'program-detail'])
                      ? 'bg-[#556830]/10 dark:bg-[#556830]/20 text-[#556830] dark:text-[#8fb55e]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
                  }`}
                >
                  <RectangleStackIcon className="size-4 shrink-0" />
                  <span>Programs</span>
                </button>
                <button 
                  onClick={() => onNavigate({ name: 'classes' })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive(['classes', 'class-detail', 'take-attendance'])
                      ? 'bg-[#556830]/10 dark:bg-[#556830]/20 text-[#556830] dark:text-[#8fb55e]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
                  }`}
                >
                  <AcademicCapIcon className="size-4 shrink-0" />
                  <span>Classes</span>
                </button>
                <button 
                  onClick={() => onNavigate({ name: 'schedule' })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive('schedule')
                      ? 'bg-[#556830]/10 dark:bg-[#556830]/20 text-[#556830] dark:text-[#8fb55e]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
                  }`}
                >
                  <CalendarIcon className="size-4 shrink-0" />
                  <span>Schedule</span>
                </button>
              </div>
            )}
          </div>
  
          {/* Connected Learning Section */}
          <div>
            {!collapsed && <div className="pt-4 pb-2 px-3">
              <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500">Connected Learning</div>
            </div>}
            
            <button
              onClick={() => toggleSection('connected-learning')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive(['learning-insights', 'learning-platforms', 'course-catalog'])
                  ? 'text-[#556830] dark:text-[#8fb55e]'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
              }`}
            >
              <GlobeAltIcon className="size-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="text-sm flex-1 text-left">Connected Learning</span>
                  <ChevronDownIcon className={`size-4 transition-transform ${expandedSections.includes('connected-learning') ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
            {!collapsed && expandedSections.includes('connected-learning') && (
              <div className="ml-4 mt-1 space-y-1 pl-3 border-l-2 border-gray-200 dark:border-[#262626]">
                <button 
                  onClick={() => onNavigate({ name: 'learning-insights' })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive('learning-insights')
                      ? 'bg-[#556830]/10 dark:bg-[#556830]/20 text-[#556830] dark:text-[#8fb55e]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
                  }`}
                >
                  <LightBulbIcon className="size-4 shrink-0" />
                  <span>Learning Insights</span>
                </button>
                <button 
                  onClick={() => onNavigate({ name: 'learning-platforms' })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive('learning-platforms')
                      ? 'bg-[#556830]/10 dark:bg-[#556830]/20 text-[#556830] dark:text-[#8fb55e]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
                  }`}
                >
                  <GlobeAltIcon className="size-4 shrink-0" />
                  <span>Learning Platforms</span>
                </button>
                <button 
                  onClick={() => onNavigate({ name: 'course-catalog' })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive('course-catalog')
                      ? 'bg-[#556830]/10 dark:bg-[#556830]/20 text-[#556830] dark:text-[#8fb55e]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
                  }`}
                >
                  <BookmarkSquareIcon className="size-4 shrink-0" />
                  <span>Course Catalog</span>
                </button>
              </div>
            )}
          </div>
  
          {/* Knowledge Center Section */}
          <div>
            {!collapsed && <div className="pt-4 pb-2 px-3">
              <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500">Knowledge Center</div>
            </div>}
            
            <button
              onClick={() => toggleSection('knowledge-center')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive(['knowledge-center', 'knowledge-insights'])
                  ? 'text-[#556830] dark:text-[#8fb55e]'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
              }`}
            >
              <BookOpenIcon className="size-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="text-sm flex-1 text-left">Knowledge Center</span>
                  <ChevronDownIcon className={`size-4 transition-transform ${expandedSections.includes('knowledge-center') ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
            {!collapsed && expandedSections.includes('knowledge-center') && (
              <div className="ml-4 mt-1 space-y-1 pl-3 border-l-2 border-gray-200 dark:border-[#262626]">
                <button 
                  onClick={() => onNavigate({ name: 'knowledge-center' })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive('knowledge-center')
                      ? 'bg-[#556830]/10 dark:bg-[#556830]/20 text-[#556830] dark:text-[#8fb55e]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
                  }`}
                >
                  <BookOpenIcon className="size-4 shrink-0" />
                  <span>Knowledge Center</span>
                </button>
                <button 
                  onClick={() => onNavigate({ name: 'knowledge-insights' })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                    isActive('knowledge-insights')
                      ? 'bg-[#556830]/10 dark:bg-[#556830]/20 text-[#556830] dark:text-[#8fb55e]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
                  }`}
                >
                  <ChartBarIcon className="size-4 shrink-0" />
                  <span>Knowledge Insights</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    );
  }