import { Button } from '@/components/ui/button';

interface ClassNotFoundCardProps {
    onBack: () => void;
}

export function ClassNotFoundCard({ onBack }: ClassNotFoundCardProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-hover">
            <div className="card-block p-8 text-center max-w-md">
                <h2 className="text-xl font-semibold text-brand-dark mb-2">
                    Class Not Found
                </h2>
                <p className="text-gray-500 mb-4">
                    The class you are looking for does not exist or you do not
                    have access to it.
                </p>
                <Button
                    onClick={onBack}
                    className="bg-brand hover:bg-brand-dark"
                >
                    Back to Classes
                </Button>
            </div>
        </div>
    );
}
