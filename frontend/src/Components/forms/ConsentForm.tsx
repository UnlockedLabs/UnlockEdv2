import { useLocation, useNavigate } from 'react-router-dom';
import DangerButton from '../DangerButton';
import PrimaryButton from '../PrimaryButton';
import API from '@/api/api';
import { AuthResponse } from '@/common';

export default function ConsentForm() {
    const navigate = useNavigate();
    const accept = async () => {
        const location = useLocation();
        const urlParams = new URLSearchParams(location.search);
        const consent = urlParams.get('consent_challenge');
        const resp = await API.post<AuthResponse>(`consent/accept`, {
            consent_challenge: consent
        });
        if (resp.success) {
            const location = (resp.data as AuthResponse).redirect_to;
            navigate(location);
            return;
        }
        navigate('/dashboard');
    };
    const deny = () => {
        navigate('/dashboard');
    };
    return (
        <div className="bg-base-100 shadow-lg rounded-lg p-8 mb-4 flex flex-col my-2 max-w-screen-xl mx-auto">
            <h1 className="text-3xl font-bold text-center mb-4">
                External Provider Login
            </h1>
            <p className="text-center mb-6">
                Continue to login to the Education Provider?
            </p>
            <div className="flex justify-evenly">
                <DangerButton
                    className="btn btn-warning w-24"
                    type="button"
                    onClick={deny}
                >
                    Decline
                </DangerButton>
                <PrimaryButton
                    className="btn btn-primary w-24"
                    type="button"
                    onClick={() => void accept()}
                >
                    Accept
                </PrimaryButton>
            </div>
        </div>
    );
}
