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

    const getCheckboxChecked = (kind: string) => {
        const checkboxState = checkboxStates.find(
            (state) => state.kind === kind
        );
        return checkboxState ? checkboxState.checked : false;
    };

    const handleChange = (checked: boolean, which: string) => {
        console.log('Checkbox changed:', which, 'Checked:', checked);
        setCheckboxStates((prevStates) =>
            prevStates.map((state) =>
                state.kind === which ? { ...state, checked } : state
            )
        );
        void handleFeatureToggle(which);
    };
    const handleFeatureToggle = async (feature: string) => {
        const resp = await API.put<null, object>(
            `auth/features/${feature}`,
            {}
        );
        if (!resp.success) {
            console.error('error toggling feature', resp.message);
            toaster(resp.message, ToastState.error);
            return;
        }
        toaster(resp.message, ToastState.success);
        const user = await fetchUser();
        setUser(user);
        navigate('/student-activity');
    };

    return (
        <>
            <CheckboxGeneric
                name="open_content"
                label="Knowledge Center Management"
                checked={getCheckboxChecked(FeatureAccess.OpenContentAccess)}
                onChange={handleChange}
            />
            <CheckboxGeneric
                name="provider_platforms"
                label="Provider Platform Integrations"
                checked={getCheckboxChecked(FeatureAccess.ProviderAccess)}
                onChange={handleChange}
            />
            <CheckboxGeneric
                name="program_management"
                label="Program Management"
                checked={getCheckboxChecked(FeatureAccess.ProgramAccess)}
                onChange={handleChange}
            />
        </>
    );
}
