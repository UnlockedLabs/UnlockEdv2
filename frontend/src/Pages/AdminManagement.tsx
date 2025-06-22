import { ForwardedRef, useRef, useState, startTransition } from 'react';
import useSWR from 'swr';
import {
    ArrowPathRoundedSquareIcon,
    LockClosedIcon,
    TrashIcon,
    PencilSquareIcon
} from '@heroicons/react/24/outline';
import {
    ServerResponseMany,
    ToastState,
    User,
    UserRole,
    ResetPasswordResponse,
    ServerResponseOne
} from '@/common';
import DropdownControl from '@/Components/inputs/DropdownControl';
import SearchBar from '@/Components/inputs/SearchBar';
import Pagination from '@/Components/Pagination';
import API from '@/api/api';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { useToast } from '@/Context/ToastCtx';
import {
    AddUserModal,
    closeModal,
    EditUserModal,
    showModal,
    TextModalType,
    TextOnlyModal,
    TargetItem,
    CRUDActions
} from '@/Components/modals';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useAuth, isSysAdmin, isDeptAdmin, isFacilityAdmin } from '@/useAuth';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import { AddButton } from '@/Components/inputs';

const canEdit = (currentUser: User, targetUser: User): boolean => {
    return (
        isSysAdmin(currentUser) ||
        (isDeptAdmin(currentUser) && isFacilityAdmin(targetUser))
    );
};

const canDelete = (currentUser: User, targetUser: User): boolean => {
    return (
        (isSysAdmin(currentUser) && !isSysAdmin(targetUser)) ||
        (isDeptAdmin(currentUser) && isFacilityAdmin(targetUser))
    );
};
export default function AdminManagement() {
    const addUserModal = useRef<HTMLDialogElement>(null);
    const editUserModal = useRef<HTMLDialogElement>(null);
    const resetUserPasswordModal = useRef<HTMLDialogElement>(null);
    const deleteUserModal = useRef<HTMLDialogElement>(null);
    const showUserPassword = useRef<HTMLDialogElement>(null);

    const [targetUser, setTargetUser] = useState<TargetItem<User> | null>(null);
    const [tempPassword, setTempPassword] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const handleSetSearchTerm = (newTerm: string) => {
        startTransition(() => {
            setSearchTerm(encodeURIComponent(newTerm));
        });
    };
    const [sortQuery, setSortQuery] = useState('created_at DESC');
    const { toaster } = useToast();
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const { user } = useAuth();
    const [newAdminRole, setNewAdminRole] = useState<UserRole>(
        UserRole.FacilityAdmin
    );
    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<User>,
        Error
    >(
        `/api/users?search=${searchTerm}&page=${pageQuery}&per_page=${perPage}&order_by=${sortQuery}&role=${user?.role}`
    );
    const checkResponseForDelete = useCheckResponse({
        mutate: mutate,
        refModal: deleteUserModal
    });
    const userData = data?.data as User[] | [];
    const meta = data?.meta;

    const deleteUser = async () => {
        if (targetUser?.target.role === UserRole.SystemAdmin) {
            toaster(
                'This is the primary administrator and cannot be deleted',
                ToastState.error
            );
            return;
        }
        const response = await API.delete('users/' + targetUser?.target.id);
        checkResponseForDelete(
            response.success,
            'Failed to delete administrator',
            'Administrator deleted successfully'
        );
        handleCancelModal(deleteUserModal);
    };

    const onAddUserSuccess = (tempPassword: string) => {
        setTempPassword(tempPassword);
        closeModal(resetUserPasswordModal);
        showModal(showUserPassword);
        toaster('Password Successfully Reset', ToastState.success);
    };

    function handleCancelModal(ref: ForwardedRef<HTMLDialogElement>) {
        closeModal(ref);
        setTargetUser(null);
        setTempPassword('');
    }

    const getTempPassword = async () => {
        if (targetUser === null) return;
        const response = (await API.post<ResetPasswordResponse, object>(
            `users/${targetUser.target.id}/student-password`,
            {}
        )) as ServerResponseOne<ResetPasswordResponse>;
        if (!response.success) {
            toaster('Failed to reset password', ToastState.error);
            return;
        }
        setTempPassword(response.data.temp_password);
        closeModal(resetUserPasswordModal);
        showModal(showUserPassword);
        toaster('Password reset successfully', ToastState.success);
        return;
    };

    function getUserRoleDesc(role: UserRole): string {
        let roleDescription;
        switch (role) {
            case UserRole.SystemAdmin:
                roleDescription = 'System Admin';
                break;
            case UserRole.DepartmentAdmin:
                roleDescription = 'Department Admin';
                break;
            case UserRole.FacilityAdmin:
                roleDescription = 'Facility Admin';
                break;
            case UserRole.Student:
                roleDescription = 'Student';
                break;
            default:
                roleDescription = 'Unknown';
        }
        return roleDescription;
    }
    return (
        <div>
            <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4 px-5">
                <div className="flex justify-between">
                    <div className="flex flex-row gap-x-2">
                        <SearchBar
                            searchTerm={searchTerm}
                            changeCallback={(newTerm) => {
                                handleSetSearchTerm(newTerm);
                                setPageQuery(1);
                            }}
                        />
                        <DropdownControl
                            setState={setSortQuery}
                            enumType={{
                                'Name (A-Z)': 'name_last asc',
                                'Name (Z-A)': 'name_last desc',
                                'Account Created (Newest) ': 'created_at desc',
                                'Account Created (Oldest) ': 'created_at asc'
                            }}
                        />
                    </div>

                    {isSysAdmin(user!) ? (
                        <div className="flex gap-2">
                            <div
                                className="w-64 tooltip tooltip-bottom"
                                data-tip="Add Department-wide Admin"
                            >
                                <AddButton
                                    label={`Add Department Admin`}
                                    onClick={() => {
                                        setNewAdminRole(
                                            UserRole.DepartmentAdmin
                                        );
                                        showModal(addUserModal);
                                    }}
                                />
                            </div>
                            <div
                                className="w-64 tooltip  tooltip-bottom"
                                data-tip={`Add ${user!.facility_name} Admin`}
                            >
                                <AddButton
                                    label={`Add Facility Admin`}
                                    onClick={() => {
                                        setNewAdminRole(UserRole.FacilityAdmin);
                                        showModal(addUserModal);
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div
                            className="tooltip tooltip-left"
                            data-tip="Add Admin"
                        >
                            <AddButton
                                label={`Add Admin`}
                                onClick={() => showModal(addUserModal)}
                            />
                        </div>
                    )}
                </div>
                <div className="relative w-full" style={{ overflowX: 'clip' }}>
                    <table className="table-2 mb-4">
                        <thead>
                            <tr className="grid grid-cols-5 px-4">
                                <th className="justify-self-start">Name</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Last Updated</th>
                                <th>Created At</th>
                                <th className="justify-self-end pr-4">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading &&
                                !error &&
                                userData.map((targetUser: User) => {
                                    const updatedAt = new Date(
                                        targetUser.updated_at
                                    );
                                    const createdAt = new Date(
                                        targetUser.created_at
                                    );
                                    return (
                                        <tr
                                            key={targetUser.id}
                                            className="card p-4 w-full grid-cols-5 justify-items-center"
                                        >
                                            <td className="justify-self-start">
                                                {targetUser.name_last}
                                                {', '}
                                                {targetUser.name_first}
                                            </td>
                                            <td>{targetUser.username}</td>
                                            <td>
                                                {getUserRoleDesc(
                                                    targetUser.role
                                                )}
                                            </td>
                                            <td>
                                                <div
                                                    className="tooltip"
                                                    data-tip="User Activity"
                                                >
                                                    <a className="flex justify-start cursor-pointer">
                                                        <span>
                                                            {updatedAt.toLocaleDateString(
                                                                'en-US',
                                                                {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                }
                                                            )}
                                                        </span>
                                                    </a>
                                                </div>
                                            </td>
                                            <td>
                                                <div
                                                    className="tooltip"
                                                    data-tip="Account Creation"
                                                >
                                                    <a className="flex justify-start cursor-pointer">
                                                        <span>
                                                            {createdAt.toLocaleDateString(
                                                                'en-US',
                                                                {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                }
                                                            )}
                                                        </span>
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="justify-self-end">
                                                <div className="flex space-x-4">
                                                    {canEdit(
                                                        user!,
                                                        targetUser
                                                    ) ? (
                                                        <ULIComponent
                                                            dataTip={
                                                                'Edit Admin'
                                                            }
                                                            tooltipClassName="tooltip-left cursor-pointer"
                                                            onClick={() => {
                                                                setTargetUser({
                                                                    action: CRUDActions.Edit,
                                                                    target: targetUser
                                                                });
                                                                editUserModal.current?.showModal();
                                                            }}
                                                            icon={
                                                                PencilSquareIcon
                                                            }
                                                        />
                                                    ) : (
                                                        <ULIComponent
                                                            icon={
                                                                PencilSquareIcon
                                                            }
                                                            dataTip={
                                                                'Edit not allowed'
                                                            }
                                                            tooltipClassName="tooltip-left"
                                                            iconClassName="text-grey-2"
                                                        />
                                                    )}
                                                    {canEdit(
                                                        user!,
                                                        targetUser
                                                    ) ? (
                                                        <ULIComponent
                                                            dataTip={
                                                                'Reset Password'
                                                            }
                                                            tooltipClassName="tooltip-left cursor-pointer"
                                                            onClick={(e) => {
                                                                e?.stopPropagation();
                                                                setTargetUser({
                                                                    action: CRUDActions.Reset,
                                                                    target: targetUser
                                                                });
                                                                showModal(
                                                                    resetUserPasswordModal
                                                                );
                                                            }}
                                                            icon={
                                                                ArrowPathRoundedSquareIcon
                                                            }
                                                        />
                                                    ) : (
                                                        <ULIComponent
                                                            icon={
                                                                ArrowPathRoundedSquareIcon
                                                            }
                                                            dataTip={
                                                                'Reset password not allowed'
                                                            }
                                                            tooltipClassName="tooltip-left"
                                                            iconClassName="text-grey-2"
                                                        />
                                                    )}
                                                    {canDelete(
                                                        user!,
                                                        targetUser
                                                    ) ? (
                                                        <ULIComponent
                                                            dataTip={
                                                                'Delete Admin'
                                                            }
                                                            tooltipClassName="tooltip-left cursor-pointer"
                                                            onClick={() => {
                                                                setTargetUser({
                                                                    action: CRUDActions.Delete,
                                                                    target: targetUser
                                                                });
                                                                deleteUserModal.current?.showModal();
                                                            }}
                                                            icon={TrashIcon}
                                                        />
                                                    ) : targetUser.role ===
                                                      UserRole.SystemAdmin ? (
                                                        <ULIComponent
                                                            dataTip={
                                                                'Cannot Delete'
                                                            }
                                                            tooltipClassName="tooltip-left cursor-pointer"
                                                            icon={
                                                                LockClosedIcon
                                                            }
                                                        />
                                                    ) : (
                                                        <ULIComponent
                                                            icon={TrashIcon}
                                                            dataTip={
                                                                'Delete not allowed'
                                                            }
                                                            tooltipClassName="tooltip-left"
                                                            iconClassName="text-grey-2"
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                    <div className="flex justify-center pt-20">
                        {!isLoading &&
                            !error &&
                            meta &&
                            userData.length > 0 && (
                                <Pagination
                                    meta={meta}
                                    setPage={setPageQuery}
                                    setPerPage={setPerPage}
                                />
                            )}
                    </div>
                    {error && (
                        <span className="text-center text-error">
                            Failed to load users.
                        </span>
                    )}
                    {!isLoading && !error && userData.length === 0 && (
                        <span className="text-center text-warning">
                            No results
                        </span>
                    )}
                </div>
            </div>
            <AddUserModal
                mutate={mutate}
                onSuccess={onAddUserSuccess}
                userRole={newAdminRole}
                ref={addUserModal}
            />
            <EditUserModal
                mutate={mutate}
                target={targetUser?.target ?? undefined}
                ref={editUserModal}
            />
            <TextOnlyModal
                ref={deleteUserModal}
                type={TextModalType.Delete}
                title={'Delete Admin'}
                text={
                    'Are you sure you would like to delete this admin? This action cannot be undone.'
                }
                onSubmit={() => void deleteUser()}
                onClose={() => handleCancelModal(deleteUserModal)}
            />
            <TextOnlyModal
                ref={resetUserPasswordModal}
                type={TextModalType.Confirm}
                title={'Reset Password'}
                text={`Are you sure you would like to reset ${targetUser?.target.name_first + ' ' + targetUser?.target.name_last}'s password?`}
                onSubmit={() => void getTempPassword()}
                onClose={() => void handleCancelModal(resetUserPasswordModal)}
            />
            <TextOnlyModal
                ref={showUserPassword}
                type={TextModalType.Information}
                title={'New Password'}
                text={` Copy the password below and share it with the admin. 
                        If it's lost, you’ll need to reset it again.`}
                onSubmit={() => {}} //eslint-disable-line
                onClose={() => handleCancelModal(showUserPassword)}
            >
                <div className="stats shadow mx-auto">
                    <div className="stat">
                        <div className="stat-title">Temporary Password</div>
                        <div className="stat-value">{tempPassword}</div>
                    </div>
                </div>
            </TextOnlyModal>
        </div>
    );
}
