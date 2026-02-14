import API from '@/api/api';
import { AuthResponse } from '@/types';
import { AUTHCALLBACK } from '@/auth/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';

interface ConsentPayload {
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
        const resp = await API.post<AuthResponse, ConsentPayload>(
            'consent/accept',
            { consent_challenge: consent }
        );
        if (resp.success) {
            const location = (resp.data as AuthResponse).redirect_to;
            window.location.href = location;
            return;
        }
        window.location.href = AUTHCALLBACK;
    };

    const deny = () => {
        window.location.href = AUTHCALLBACK;
    };

    return (
        <Card className="max-w-screen-xl mx-auto my-2">
            <CardHeader className="text-center">
                <CardTitle className="text-3xl font-bold text-[#203622]">
                    External Provider Login
                </CardTitle>
                <CardDescription className="text-base">
                    Continue to login to the Education Provider?
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-evenly">
                    <Button variant="destructive" type="button" onClick={deny}>
                        Decline
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void accept()}
                        className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90 font-semibold"
                    >
                        Accept
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
