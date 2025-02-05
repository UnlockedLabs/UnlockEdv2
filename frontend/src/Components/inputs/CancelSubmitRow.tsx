import { TextModalType } from '../modals';
import { CancelButton } from './CancelButton';
import { ConfirmButton } from './ConfirmButton';
import { DeleteButton } from './DeleteButton';

export function CancelSubmitRow({
    type,
    onCancel,
    onSubmit
}: {
    type: TextModalType;
    onCancel: () => void;
    onSubmit: () => void;
}) {
    return (
        <form method="dialog" className="flex flex-row justify-between">
            <CancelButton onClick={onCancel} />
            {type === TextModalType.Delete ? (
                <DeleteButton onClick={onSubmit} />
            ) : type === TextModalType.Confirm ? (
                <ConfirmButton onClick={onSubmit} />
            ) : null}
        </form>
    );
}
