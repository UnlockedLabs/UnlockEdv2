import { TextModalType } from '../modals';
import { CancelButton } from './CancelButton';
import { ConfirmButton } from './ConfirmButton';
import { DeleteButton } from './DeleteButton';

export function CancelSubmitRow({
    type,
    onCancel,
    onSubmit,
    action
}: {
    type: TextModalType;
    onCancel: () => void;
    onSubmit: () => void;
    action?: string;
}) {
    if (type === TextModalType.Confirm && action === undefined) {
        console.error('must include action type for modal');
        return;
    }
    return (
        <form method="dialog" className="flex flex-row justify-between">
            <CancelButton onClick={onCancel} />
            {type === TextModalType.Delete ? (
                <DeleteButton onClick={onSubmit} />
            ) : type === TextModalType.Confirm ? (
                <ConfirmButton onClick={onSubmit} action={action ?? ''} />
            ) : null}
        </form>
    );
}
