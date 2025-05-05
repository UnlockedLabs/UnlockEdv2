import { useNavigate } from 'react-router-dom';
import { useTourContext } from '@/Context/TourContext';

export default function Tour({ close }: { close: () => void }) {
    const navigate = useNavigate();
    const { setTourState } = useTourContext();

    const startTour = () => {
        close();
        if (window.location.pathname !== '/home') {
            navigate('/home');
        }
        setTourState({
            tourActive: true
        });
    };
    return (
        <>
            <h2>Guided Tour</h2>
            <p className="body">
                Feeling lost? If you need a walk through of UnlockEd, start our
                tour below.
            </p>
            <button className="button mx-auto" onClick={startTour}>
                Start Tour
            </button>
        </>
    );
}
