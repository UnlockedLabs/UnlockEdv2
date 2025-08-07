import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ULIComponent from './ULIComponent';

export default function WarningBanner({ text }: { text: string }) {
    return (
        <div className="card bg-pale-yellow text-body-text flex flex-row items-center gap-2 p-4">
            <ULIComponent icon={ExclamationTriangleIcon} />
            <p className="body text-body-text">{text}</p>
        </div>
    );
}
