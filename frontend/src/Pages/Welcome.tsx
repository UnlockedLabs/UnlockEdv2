import { useEffect, useState, useContext } from 'react';
import Brand from '../Components/Brand';
import { INIT_KRATOS_LOGIN_FLOW, User } from '@/common';
import API from '@/api/api';
import { Link } from 'react-router-dom';
import { AUTHCALLBACK } from '@/useAuth';
import Timeline from '@/Components/Timeline';
import { ThemeContext } from '@/Context/ThemeContext';
import { tabSessionManager } from '@/tabSession';

export default function Welcome() {
    const [authUser, setAuthUser] = useState<User | undefined>();
    const [imgSrc, setImgSrc] = useState('unlockedv2Dk.png');
    const [hasStaleSession, setHasStaleSession] = useState(false);
    const { theme } = useContext(ThemeContext);

    useEffect(() => {
        const imgPath =
            theme === 'light' ? 'unlockedv2Dk.png' : 'unlockedv2Lt.png';

        const img = new Image();
        img.src = imgPath;
        img.onload = () => {
            setImgSrc(imgPath);
        };
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
    }, [theme]);

    return (
        <div className="min-h-screen font-lato">
            <div className="navbar bg-background">
                <div className="flex-1 pl-4 cursor-default select-none">
                    <Brand />
                </div>
                <div className="flex-none">
                    <ul className="menu menu-horizontal px-1 text-primary">
                        {!authUser ? (
                            <li>
                                <a
                                    href={
                                        hasStaleSession
                                            ? `${INIT_KRATOS_LOGIN_FLOW}?refresh=true`
                                            : INIT_KRATOS_LOGIN_FLOW
                                    }
                                >
                                    Log in
                                </a>
                            </li>
                        ) : (
                            <li>
                                <Link to={AUTHCALLBACK}>Dashboard</Link>
                            </li>
                        )}
                    </ul>
                </div>
            </div>

            <div className="flex justify-center p-10 bg-background">
                <div className="prose prose-lg prose-gray text-justify">
                    <h1>Built from the inside out...</h1>

                    <p>
                        Our mission is to make education accessible to all
                        justice-impacted people, and to ensure that their
                        educational progress is recorded and recognized by
                        institutions allowing for a faster and more equitable
                        re-entry process.
                    </p>
                    <div className="flex items-center h-8 border rounded-[15px] text-lg justify-center text-black bg-teal-2 overflow-hidden">
                        <img
                            src="/emoji_image_new.png"
                            className="w-8 h-8 object-contain"
                            loading="lazy"
                            alt="Emoji"
                        />
                        Now live in correctional facilities!
                    </div>

                    <div className="flex flex-col">
                        <img
                            src={`${imgSrc}?v=1.0`}
                            className="mb-2 w-full h-auto"
                            loading="lazy"
                        />
                        <span className="italic text-sm">
                            Version 2 of UnlockEd is now in use at Mountain View
                            Correctional Facility, featuring an updated design
                            and a new self-guided learning experience.
                        </span>
                    </div>
                    <Timeline />
                </div>
            </div>
        </div>
    );
}
