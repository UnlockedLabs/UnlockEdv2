import { forwardRef, useEffect, useRef, useState } from 'react';
import { CRUDModalProps, FormInputTypes, FormModal, providerInputs } from '.';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import {
    ProviderPlatform,
    ProviderResponse,
    ServerResponseOne
} from '@/common';
import API from '@/api/api';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const EditProviderModal = forwardRef(function (
    { mutate, target }: CRUDModalProps<ProviderPlatform>,
    editProviderModal: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: editProviderModal
    });
    const accessKeyRef = useRef<HTMLInputElement>(null);
    const [showAccessKey, setShowAccessKey] = useState(false);
    const [accessKey, setAccessKey] = useState<string>(
        target?.access_key ?? ''
    );

    useEffect(() => {
        setShowAccessKey(false);
        setAccessKey(target?.access_key ?? '');
    }, [target]);

    const AccessKeyInput = (): JSX.Element => {
        return (
            <label className="form-control relative">
                <div className="label">
                    <span className="label-text">Access Key</span>
                </div>
                {showAccessKey ? (
                    <>
                        <input // TextInput component cannot be used because we need to modify class
                            ref={accessKeyRef}
                            type="text"
                            className="input input-bordered w-full pr-10"
                            defaultValue={accessKey}
                            onBlur={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setAccessKey(e.target.value)
                            }
                        />
                        <EyeSlashIcon
                            className="w-4 z-10 bottom-4 right-4 absolute"
                            onClick={() => {
                                setShowAccessKey(false);
                                setAccessKey(accessKeyRef.current?.value ?? '');
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                        />
                    </>
                ) : (
                    <>
                        <input
                            type="password"
                            className="input input-bordered w-full"
                            value="**********"
                            readOnly
                        />
                        <EyeIcon
                            className="w-4 z-10 bottom-4 right-4 absolute"
                            onClick={() => setShowAccessKey(true)}
                            onMouseDown={(e) => e.preventDefault()}
                        />
                    </>
                )}
            </label>
        );
    };

    const editProvider: SubmitHandler<FieldValues> = async (data) => {
        data.access_key = accessKeyRef.current?.value;
        const resp = (await API.patch(
            `provider-platforms/${target?.id}`,
            data
        )) as ServerResponseOne<ProviderResponse>;
        checkResponse(
            resp.success,
            'Unable to modify provider platform',
            'Provider platform updated successfully'
        );
        if (resp.data.oauth2Url) {
            window.location.href = resp.data.oauth2Url;
            return;
        }
    };
    return (
        <FormModal
            title={'Edit Provider Platform'}
            inputs={[
                ...providerInputs,
                ...[
                    {
                        type: FormInputTypes.Unique,
                        label: 'Access Key',
                        interfaceRef: 'access_key',
                        required: true,
                        uniqueComponent: <AccessKeyInput />
                    }
                ]
            ]}
            defaultValues={target}
            onSubmit={editProvider}
            ref={editProviderModal}
        />
    );
});
