import { CloseX } from '../inputs';

export interface TempPasswordProps {
    tempPassword: string;
    userName: string | undefined;
    onClose: () => void;
}
export default function ShowTempPasswordForm({
    tempPassword,
    userName,
    onClose
}: TempPasswordProps) {
    return (
        <div>
            <CloseX close={() => onClose()} />
            {userName == undefined ? (
                <p className="py-4">
                    You have successfully created a new user.
                </p>
            ) : (
                <>
                    <p className="py-4">
                        You have successfully reset {userName}'s password.
                    </p>
                    <p className="text-error">
                        Copy this password now. If you lose it, you'll need to
                        regenerate it to get a new one.
                    </p>
                </>
            )}
            <div className="flex flex-row">
                <div className="stats shadow mx-auto">
                    <div className="stat">
                        <div className="stat-title">Temporary Password</div>
                        <div className="stat-value">{tempPassword}</div>
                    </div>
                </div>
            </div>
            <p className="py-4"></p>
        </div>
    );
}
