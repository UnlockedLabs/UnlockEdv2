import { forwardRef } from 'react';
import { CRUDActions, CRUDModalProps, FormModal, getUserInputs } from '.';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import { User } from '@/common';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const EditUserModal = forwardRef(function (
    { mutate, target }: CRUDModalProps<User>,
    editUserModal: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: editUserModal
    });
    if (!target) return null;
    const editUser: SubmitHandler<FieldValues> = async (data) => {
        const resp = await API.patch(`users/${target?.id}`, data);
        checkResponse(
            resp.success,
            'Unable to modify user',
            'User updated successfully'
        );
    };
    return (
        <FormModal
                title={'Edit User'}
                inputs={getUserInputs(target.role, CRUDActions.Edit)}
                defaultValues={target}
                onSubmit={editUser}
                ref={editUserModal}
                showCancel={true}
                submitText="Save Changes "
        />
    );
});
