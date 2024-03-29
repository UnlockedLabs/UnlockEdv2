import { CloseX } from "../inputs";

export interface TempPasswordProps {
    tempPassword: string;
    userName: string | null;
    onClose: () => void;
}
export default function ShowTempPasswordForm({
    tempPassword,
    userName,
    onClose,
}: TempPasswordProps) {
    return (
        <div>
            <CloseX close={() => onClose()} />
            {userName == null ? (
                <p className="py-4">
                    You have successfully created a new user.
                </p>
            ) : (
                <p className="py-4">
                    You have successfully reset {userName}'s password.
                </p>
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
