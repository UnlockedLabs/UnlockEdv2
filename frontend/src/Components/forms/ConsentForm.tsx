import API from '@/api/api';
import { AuthResponse } from '@/common';
import { useNavigate } from 'react-router-dom';

interface ConsentForm {
    consent_challenge: string;
}

export default function ConsentForm() {
    const navigate = useNavigate();

    const accept = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const consent = urlParams.get('consent_challenge');
        if (!consent) {
            navigate('/error');
            return;
        }
        const resp = await API.post<AuthResponse, ConsentForm>(
            `consent/accept`,
            {
                consent_challenge: consent
            }
        );
        if (resp.success) {
            const location = (resp.data as AuthResponse).redirect_to;
            window.location.href = location;
            return;
        }
        window.location.href = '/authcallback';
    };
    const deny = () => {
        window.location.href = '/authcallback';
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
                <button
                    className="button !bg-error"
                    type="button"
                    onClick={deny}
                >
                    Decline
                </button>
                <button
                    className="button"
                    type="button"
                    onClick={() => void accept()}
                >
                    Accept
                </button>
            </div>
        </div>
    );
}
