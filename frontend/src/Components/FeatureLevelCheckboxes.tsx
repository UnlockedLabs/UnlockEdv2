import { useState } from 'react';
import CheckboxGenric from './inputs/CheckboxGeneric';

export default function FeatureLevelCheckboxes() {
    const [checkboxStates, setCheckboxStates] = useState({
        open_content: false,
        provider_platform_integrations: false,
        program_management: false
    });

    const handleChange =
        (key: keyof typeof checkboxStates) => (checked: boolean) => {
            setCheckboxStates((prevState) => ({
                ...prevState,
                [key]: checked
            }));
        };

    return (
        <>
            <CheckboxGenric
                name="open_content"
                label="Open Content"
                checked={checkboxStates.open_content}
                onChange={handleChange('open_content')}
            />
            <CheckboxGenric
                name="provider_platform_integrations"
                label="Provider Platform Integrations"
                checked={checkboxStates.provider_platform_integrations}
                onChange={handleChange('provider_platform_integrations')}
            />
            <CheckboxGenric
                name="program_management"
                label="Program Management"
                checked={checkboxStates.program_management}
                onChange={handleChange('program_management')}
            />
        </>
    );
}
