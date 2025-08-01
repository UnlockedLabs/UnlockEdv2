import { forwardRef, useState } from 'react';
import { closeModal, CRUDActions, CRUDModalProps, getUserInputs } from '.';
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
            const error_msgs = {
                userexists: 'Username already exists',
                alphanum: 'Username must contain only letters and numbers',
                docexists: 'Resident ID already exists in the system'
            };
            switch (msg) {
                case 'userexists': {
                    setFormError({
                        name: 'username',
                        error: {
                            type: 'custom',
                            message: error_msgs.userexists
                        }
                    });
                    throw new Error(error_msgs.userexists);
                }
                case 'docexists': {
                    setFormError({
                        name: 'doc_id',
                        error: {
                            type: 'custom',
                            message: error_msgs.docexists
                        }
                    });
                    throw new Error(error_msgs.userexists);
                }
                case 'alphanum': {
                    setFormError({
                        name: 'username',
                        error: {
                            type: 'custom',
                            message: error_msgs.alphanum
                        }
                    });
                    throw new Error(error_msgs.alphanum);
                }
            }
        } else {
            onSuccess((response.data as NewUserResponse).temp_password);
        }
    };

    const handleClose = () => closeModal(addUserModal);
    return (
        <FormModal
            title={'Add User'}
            inputs={getUserInputs(userRole, CRUDActions.Add, providerPlatforms)}
            onSubmit={addUser}
            error={formError}
            ref={addUserModal}
            showCancel={true}
            submitText="Create User"
            onClose={handleClose}
        />
    );
});
