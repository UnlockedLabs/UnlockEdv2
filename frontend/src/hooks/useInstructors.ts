import useSWR from 'swr';
import { useAuth } from '@/auth/useAuth';
import { User, UserRole, ServerResponseMany } from '@/types';

/**
 * Returns the instructors the current admin may assign at a facility.
 *
 * FacilityAdmins may assign only facility admins at their own facility;
 * department (and higher) admins may assign any department- or facility-admin
 * at the facility. The role filter mirrors that rule server-side.
 */
export function useInstructors(
    facilityId: string | number | undefined,
    enabled = true
): User[] {
    const { user } = useAuth();
    const roleParam =
        user?.role === UserRole.FacilityAdmin
            ? 'facility_admin'
            : 'department_admin';
    const { data } = useSWR<ServerResponseMany<User>>(
        enabled && user && facilityId
            ? `/api/users?role=${roleParam}&facility_id=${facilityId}&per_page=100`
            : null
    );
    return data?.data ?? [];
}
