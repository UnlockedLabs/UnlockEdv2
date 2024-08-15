import axios from 'axios';
import { Provider, useEffect, useState } from 'react';
import { ToastState } from '../Toast';
import { PaginatedResponse, ProviderUser } from '@/common';
import { CloseX } from '../inputs/CloseX';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import Pagination from '../Pagination';
import useSWR from 'swr';

interface Props {
    externalUser: ProviderUser;
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
    const [errorMessage, setErrorMessage] = useState('');
    const [fuzzySearchUsers, setFuzzySearchUsers] = useState<ProviderUser[]>();
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedUser, setSelectedUser] = useState(null);
    const [seeAllUsers, setSeeAllUsers] = useState(false);
    const {
        data: allUnmappedUsers,
        isLoading: isLoadingUnmapped,
        error: errorUnmappedUsers
    } = useSWR<PaginatedResponse<any>>(
        `/api/users?page=${currentPage}&per_page=5&include=only_unmapped&provider_id=${providerId}`
    );

    function cancel() {
        setSelectedUser(null);
        setCurrentPage(1);
        setSeeAllUsers(false);
        setErrorMessage('');
        onCancel;
    }

    const handleSubmit = async (userId: number) => {
        try {
            setErrorMessage('');
            const response = await axios.post(
                `/api/provider-platforms/${providerId}/map-user/${userId}`,
                externalUser
            );

            if (response.status !== 201) {
                onSubmit('', ToastState.error);
            }
            onSubmit('User successfully mapped', ToastState.success);
        } catch (error: any) {
            setErrorMessage(error.response.data.message);
            onSubmit('Failed to map user', ToastState.error);
            return;
        }
    };

    useEffect(() => {
        async function fetchFuzzyUsers() {
            try {
                const response = await axios.get(
                    `/api/users?include=only_unmapped&provider_id=${providerId}&search=${externalUser.username}&search=${externalUser.email}`
                );
                if (response.status !== 200) {
                    setErrorMessage('Failed to fetch any matching users');
                    return;
                }
                setFuzzySearchUsers(response.data.data);
            } catch (error: any) {
                setErrorMessage(error);
                return;
            }
        }
        externalUser && fetchFuzzyUsers();
    }, [externalUser]);

    const UserRadioInput = ({ user }: { user: any }) => {
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
                        {externalUser?.name_first +
                            ' ' +
                            externalUser?.name_last}
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
                        {fuzzySearchUsers?.map((user: any) => {
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
                                    setSeeAllUsers(true), setSelectedUser(null);
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
                                    setSeeAllUsers(false),
                                        setSelectedUser(null);
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
                        {allUnmappedUsers?.data.map((user) => {
                            return (
                                <UserRadioInput
                                    user={user}
                                    key={'allUsers' + user.id}
                                />
                            );
                        })}
                        <Pagination
                            meta={allUnmappedUsers?.meta}
                            setPage={setCurrentPage}
                        />
                    </>
                )}
            </div>
            {errorMessage && (
                <div className="text-error text-center pt-2">
                    {errorMessage}
                </div>
            )}
            <div className="flex flex-row justify-between mt-4">
                <button className="btn" onClick={() => onCancel()}>
                    Cancel
                </button>
                <button
                    className="btn btn-primary"
                    onClick={() => handleSubmit(selectedUser)}
                    disabled={!selectedUser}
                >
                    Map Student
                </button>
            </div>
        </div>
    );
}
