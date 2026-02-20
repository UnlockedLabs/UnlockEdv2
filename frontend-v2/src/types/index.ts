export * from './auth';
export * from './user';
export * from './facility';
export * from './program';
export * from './attendance';
export * from './provider';
export * from './content';
export * from './insights';
export * from './events';
export * from './server';
export * from './reports';
export * from './navigation';
export * from './websocket';
export * from './ui';

export type UserRole = 'department_admin' | 'facility_admin';

export type Page = 
  | { name: 'dashboard' }
  | { name: 'residents' }
  | { name: 'admins' }
  | { name: 'facilities' }
  | { name: 'operational-insights' }
  | { name: 'programs' }
  | { name: 'program-detail'; programId: string }
  | { name: 'classes'; filter?: string }
  | { name: 'class-detail'; classId: string }
  | { name: 'schedule' }
  | { name: 'take-attendance'; classId: string; date: string }
  | { name: 'learning-insights' }
  | { name: 'learning-platforms' }
  | { name: 'course-catalog' }
  | { name: 'knowledge-center' }
  | { name: 'knowledge-insights' };