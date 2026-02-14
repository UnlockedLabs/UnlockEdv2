import { useEffect, useState } from 'react';
import Brand from '@/components/Brand';
import { INIT_KRATOS_LOGIN_FLOW, User } from '@/types';
import API from '@/api/api';
import { Link } from 'react-router-dom';
import { AUTHCALLBACK } from '@/auth/useAuth';
import { tabSessionManager } from '@/session/tabSession';
import { Button } from '@/components/ui/button';

export default function Welcome() {
    const [authUser, setAuthUser] = useState<User | undefined>();
    const [hasStaleSession, setHasStaleSession] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await API.get<User>('auth');
                if (user.success) {
                    const hasValidTabSession =
                        await tabSessionManager.validateSession();
                    if (hasValidTabSession) {
                        setAuthUser(user.data as User);
                    } else {
                        setHasStaleSession(true);
                    }
                }
            } catch {
                return;
            }
        };
        void checkAuth();
    }, []);

    return (
        <div className="min-h-screen font-sans bg-[#E2E7EA]">
            <nav className="flex items-center justify-between px-6 py-4 bg-[#E2E7EA]">
                <div className="cursor-default select-none">
                    <Brand />
                </div>
                <div>
                    {!authUser ? (
                        <Button
                            asChild
                            variant="ghost"
                            className="text-[#203622] font-semibold"
                        >
                            <a
                                href={
                                    hasStaleSession
                                        ? `${INIT_KRATOS_LOGIN_FLOW}?refresh=true`
                                        : INIT_KRATOS_LOGIN_FLOW
                                }
                            >
                                Log in
                            </a>
                        </Button>
                    ) : (
                        <Button
                            asChild
                            variant="ghost"
                            className="text-[#203622] font-semibold"
                        >
                            <Link to={AUTHCALLBACK}>Dashboard</Link>
                        </Button>
                    )}
                </div>
            </nav>

            <div className="flex justify-center p-10">
                <div className="max-w-prose space-y-6 text-[#203622]">
                    <h1 className="text-4xl font-bold">
                        Built from the inside out...
                    </h1>
                    <p className="text-lg text-justify leading-relaxed">
                        Our mission is to make education accessible to all
                        justice-impacted people, and to ensure that their
                        educational progress is recorded and recognized by
                        institutions allowing for a faster and more equitable
                        re-entry process.
                    </p>
                    <div className="flex items-center h-8 border rounded-[15px] text-lg justify-center text-[#203622] bg-teal-100 overflow-hidden">
                        Now live in correctional facilities!
                    </div>
                    <div className="flex flex-col">
                        <img
                            src="/ul-logo-stacked-med-d.svg"
                            className="mb-2 w-full h-auto max-h-64 object-contain"
                            loading="lazy"
                            alt="UnlockEd"
                        />
                        <span className="italic text-sm">
                            Version 2 of UnlockEd is now in use at Mountain View
                            Correctional Facility, featuring an updated design
                            and a new self-guided learning experience.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
