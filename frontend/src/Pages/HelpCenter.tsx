import Tour from '@/Components/Tour';
import FAQs from './FAQs';
import { CloseX } from '@/Components/inputs';

export default function HelpCenter({ close }: { close: () => void }) {
    return (
        <div className="flex flex-col gap-2">
            <CloseX close={close} />
            <h1>Help Center</h1>
            <Tour close={close} />
            <FAQs />
        </div>
    );
}
