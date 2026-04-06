import { useNavigate } from 'react-router-dom';
import { useTourContext } from '@/contexts/TourContext';
import { Button } from '@/components/ui/button';

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
        <div>
            <h2 className="text-lg font-semibold text-foreground">
                Guided Tour
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
                Feeling lost? If you need a walk through of UnlockEd, start our
                tour below.
            </p>
            <Button onClick={startTour} className="mt-3">
                Start Tour
            </Button>
        </div>
    );
}
