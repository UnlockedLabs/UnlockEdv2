import { TextModalType } from '../modals';
import { CancelButton } from './CancelButton';
import { ConfirmButton } from './ConfirmButton';
import { DeleteButton } from './DeleteButton';
import { WarningButton } from './WarningButton';

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
    return (
        <form method="dialog" className="flex flex-row justify-between">
            <CancelButton onClick={onCancel} />
            {type === TextModalType.Delete ? (
                <DeleteButton onClick={onSubmit} />
            ) : type === TextModalType.Confirm ? (
                <ConfirmButton
                    onClick={onSubmit}
                    action={action ?? 'Confirm'}
                />
            ) : type === TextModalType.Warning ? (
                <WarningButton
                    onClick={onSubmit}
                    action={action ?? 'Confirm'}
                />
            ) : null}
        </form>
    );
}
