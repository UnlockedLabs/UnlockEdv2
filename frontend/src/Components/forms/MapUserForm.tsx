import { useEffect, useState } from 'react';
import { ProviderUser, ServerResponseMany, ToastState, User } from '@/common';
import { CloseX } from '../inputs/CloseX';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import Pagination from '../Pagination';
import useSWR from 'swr';
import API from '@/api/api';
interface Props {
    externalUser?: ProviderUser;
    providerId: number;
    onSubmit: (msg: string, err: ToastState) => void;
    onCancel: () => void;
}

export default function MapUserForm({
    externalUser,
    providerId,
    onSubmit,
    onCancel
}: Props) {
    if (!externalUser) {
        return;
    }
    const [errorMessage, setErrorMessage] = useState('');
    const [fuzzySearchUsers, setFuzzySearchUsers] = useState<User[]>();
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedUser, setSelectedUser] = useState<undefined | number>();
    const [seeAllUsers, setSeeAllUsers] = useState(false);
    const {
        data: allUnmappedUsers,
        isLoading: isLoadingUnmapped,
        error: errorUnmappedUsers
    } = useSWR<ServerResponseMany<User>, Error>(
        `/api/users?page=${currentPage}&per_page=5&include=only_unmapped&provider_id=${providerId}`
    );
    const unmappedUsers = allUnmappedUsers?.data;
    const meta = allUnmappedUsers?.meta;
    function cancel() {
        setSelectedUser(undefined);
        setCurrentPage(1);
        setSeeAllUsers(false);
        setErrorMessage('');
        onCancel();
    }

    const handleSubmit = async (userId: number) => {
        setErrorMessage('');
        const response = await API.post(
            `provider-platforms/${providerId}/map-user/${userId}`,
            externalUser
        );
        if (!response.success) {
            setErrorMessage(response.message);
            onSubmit('Failed to map user', ToastState.error);
            return;
        }
        onSubmit('User successfully mapped', ToastState.success);
    };

    useEffect(() => {
        async function fetchFuzzyUsers() {
            const response = await API.get<User>(
                `users?include=only_unmapped&provider_id=${providerId}&search=${externalUser?.username}&search=${externalUser?.email}`
            );
            if (!response.success) {
                setErrorMessage('Failed to fetch any matching users');
                return;
            }
            setFuzzySearchUsers(response.data as User[]);
        }
        void fetchFuzzyUsers();
    }, [externalUser, providerId]);

    const UserRadioInput = ({ user }: { user: User }) => {
        return (
            <div key={user.id} className="flex flex-row">
                <input
                    type="radio"
                    id={`${user.id}`}
                    name="user"
                    className="radio radio-primary my-auto"
                    value={user.id}
                    checked={selectedUser === user.id}
                    onChange={() => setSelectedUser(user.id)}
                />
                <label htmlFor={`${user.id}`} className="ml-2">
                    <h2>
                        {user.name_first} {user.name_last}
                    </h2>
                    <p className="body-small text-grey-3">
                        {user.username} • {user.email}
                    </p>
                </label>
            </div>
        );
    };

    return (
        <div>
            <CloseX close={cancel} />
            <h2>User Information from Provider Platform:</h2>
            <div className="flex flex-row gap-2 mt-4 card p-2">
                <UserCircleIcon className="h-10" />
                <div className="flex-col">
                    <h3>
                        {externalUser?.name_last +
                            ', ' +
                            externalUser?.name_first}
                    </h3>
                    <p className="body-small text-grey-3">
                        {externalUser?.username} • {externalUser?.email}
                    </p>
                </div>
            </div>
            <div className="mt-8 flex flex-col gap-2">
                <h2 className="my-auto">
                    Associate to UnlockEd User (select one):
                </h2>
                {errorUnmappedUsers || isLoadingUnmapped ? (
                    <div>Error finding users. </div>
                ) : fuzzySearchUsers?.length != 0 && !seeAllUsers ? (
                    <>
                        <p className="body-small mb-2">
                            We have found a potential match to the student you'd
                            like to map:
                        </p>
                        {fuzzySearchUsers?.map((user: User) => {
                            return (
                                <UserRadioInput
                                    user={user}
                                    key={'fuzzyUser' + user.id}
                                />
                            );
                        })}
                        <p className="body-small mt-2">
                            Not the user you are looking for?{' '}
                            <button
                                className="text-teal-3 underline"
                                onClick={() => {
                                    setSeeAllUsers(true);
                                    setSelectedUser(undefined);
                                }}
                            >
                                See all users
                            </button>
                        </p>
                    </>
                ) : (
                    <>
                        {fuzzySearchUsers?.length != 0 ? (
                            <button
                                className="body-small text-teal-3 underline text-left mb-2"
                                onClick={() => {
                                    setSeeAllUsers(false);
                                    setSelectedUser(undefined);
                                }}
                            >
                                Go back to potential matches
                            </button>
                        ) : (
                            <p className="body-small text-error">
                                It does not appear there are any users that
                                match the provided information. You may search
                                through all existing unmapped users if you
                                choose to do so.
                            </p>
                        )}
                        {unmappedUsers?.map((user: User) => {
                            return (
                                <UserRadioInput
                                    user={user}
                                    key={'allUsers' + user.id}
                                />
                            );
                        })}
                        {meta && (
                            <Pagination meta={meta} setPage={setCurrentPage} />
                        )}
                    </>
                )}
            </div>
            {errorMessage && (
                <div className="text-error text-center pt-2">
                    {errorMessage}
                </div>
            )}
            <div className="flex flex-row justify-between mt-4">
                <button className="button-grey" onClick={() => onCancel()}>
                    Cancel
                </button>
                <button
                    className="button"
                    disabled={!selectedUser}
                    onClick={() => {
                        void handleSubmit(selectedUser!);
                    }}
                >
                    Map Student
                </button>
            </div>
        </div>
    );
}
