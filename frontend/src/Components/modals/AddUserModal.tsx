import { forwardRef, useState } from 'react';
import { CRUDActions, CRUDModalProps, getUserInputs } from '.';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import { NewUserResponse, ProviderPlatform, User, UserRole } from '@/common';
import API from '@/api/api';
import { useLoaderData } from 'react-router-dom';
import FormModal, { FormError } from './FormModal';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const AddUserModal = forwardRef(function (
    {
        mutate,
        onSuccess,
        userRole
    }: CRUDModalProps<User> & {
        onSuccess: (tempPassword: string) => void;
        userRole: UserRole;
    },
    addUserModal: React.ForwardedRef<HTMLDialogElement>
) {
    const { providerPlatforms } = useLoaderData() as {
        providerPlatforms: ProviderPlatform[];
    };
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: addUserModal
    });
    const [formError, setFormError] = useState<FormError>();

    const addUser: SubmitHandler<FieldValues> = async (
        data: FieldValues & { platforms?: string[] }
    ) => {
        let platformsArray: number[];
        if (!data.platforms) platformsArray = [];
        else {
            platformsArray = data.platforms.map((platform) =>
                parseInt(platform, 10)
            );
        }
        data.role = userRole;
        const response = await API.post('users', {
            user: data,
            provider_platforms: platformsArray
        });
        checkResponse(
            response.success,
            'Failed to create user',
            'User created successfully with temporary password'
        );
        if (!response.success) {
            const msg = response.message.trim();
            switch (msg) {
                case 'userexists': {
                    setFormError({
                        name: 'username',
                        error: {
                            type: 'custom',
                            message: 'Username already exists'
                        }
                    });
                    break;
                }
                case 'alphanum': {
                    setFormError({
                        name: 'username',
                        error: {
                            type: 'custom',
                            message:
                                'Username must contain only letters and numbers'
                        }
                    });
                    break;
                }
            }
        }
        onSuccess((response.data as NewUserResponse).temp_password);
    };

    return (
        <FormModal
            title={'Add User'}
            inputs={getUserInputs(userRole, CRUDActions.Add, providerPlatforms)}
            onSubmit={addUser}
            error={formError}
            ref={addUserModal}
        />
    );
});
