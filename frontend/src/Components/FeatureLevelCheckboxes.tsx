import CheckboxGeneric from './inputs/CheckboxGeneric';
import { FeatureAccess, ToastState, User } from '@/common';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { Dispatch, SetStateAction, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUser } from '@/useAuth';
interface FeatureCheckboxesProps {
    features: FeatureAccess[];
    setUser: Dispatch<SetStateAction<User | undefined>>;
}
export default function FeatureLevelCheckboxes({
    features,
    setUser
}: FeatureCheckboxesProps) {
    const { toaster } = useToast();
    const navigate = useNavigate();
    interface CheckboxStates {
        kind: string;
        checked: boolean;
    }
    const [checkboxStates, setCheckboxStates] = useState<CheckboxStates[]>([
        {
            kind: 'open_content',
            checked: features.includes(FeatureAccess.OpenContentAccess)
        },
        {
            kind: 'provider_platforms',
            checked: features.includes(FeatureAccess.ProviderAccess)
        },
        {
            kind: 'program_management',
            checked: features.includes(FeatureAccess.ProgramAccess)
        }
    ]);

    const getCheckboxChecked = (kind: string): boolean => {
        const checkboxState = checkboxStates.find(
            (state) => state.kind === kind
        );
        return checkboxState ? checkboxState.checked : false;
    };

    const handleFeatureToggle = async (
        checked: boolean,
        feature: string
    ): Promise<void> => {
        const resp = await API.put<null, object>(
            `auth/features/${feature}`,
            {}
        );
        if (!resp.success) {
            toaster(resp.message ?? 'error toggling feature', ToastState.error);
            return;
        }
        setCheckboxStates((prevStates) =>
            prevStates.map((state) =>
                state.kind === feature ? { ...state, checked } : state
            )
        );
        toaster(resp.message, ToastState.success);
        const user = await fetchUser();
        setUser(user);
        navigate('/authcallback');
    };

    return (
        <>
            <CheckboxGeneric
                name="open_content"
                label="Knowledge Center"
                checked={getCheckboxChecked(FeatureAccess.OpenContentAccess)}
                onChange={handleFeatureToggle}
            />
            <CheckboxGeneric
                name="provider_platforms"
                label="Connected Learning"
                checked={getCheckboxChecked(FeatureAccess.ProviderAccess)}
                onChange={handleFeatureToggle}
            />
            <CheckboxGeneric
                name="program_management"
                label="Program Hub"
                checked={getCheckboxChecked(FeatureAccess.ProgramAccess)}
                onChange={handleFeatureToggle}
            />
        </>
    );
}
