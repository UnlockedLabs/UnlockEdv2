import axios from "axios";
import { User } from "@/common";
import { CloseX } from "../inputs";

interface ResetPasswordFormProps {
    onCancel: (message: string, is_err: boolean) => void;
    onSuccess: (psw: string) => void;
    user: User | null;
}

export default function ResetPasswordForm({
    user,
    onSuccess,
    onCancel,
}: ResetPasswordFormProps) {
    const getTempPassword = async () => {
        try {
            const response = await axios("/student-password", {
                method: "post",
                headers: { ContentType: "application/json" },
                data: { user_id: user?.id },
            });
            if (response.status !== 201) {
                onCancel("Failed to reset password", true);
                return;
            }
            onSuccess(response.data.data["password"]);
            return;
        } catch (error: any) {
            onCancel(error.response.data.message, true);
            return;
        }
    };

    return (
        <div>
            <CloseX close={() => onCancel("", false)} />
            <p>
                Are you sure you would like to reset {user?.name_first}{" "}
                {user?.name_last}'s password?
            </p>
            <p className="font-bold text-error py-4">
                Note: Only valid for non-administrator accounts.
            </p>
            <p className="py-4"></p>
            <div className="flex flex-row justify-between">
                <button className="btn" onClick={() => onCancel("", false)}>
                    Cancel
                </button>
                <button
                    className="btn btn-error"
                    onClick={() => {
                        getTempPassword();
                    }}
                >
                    Reset Password
                </button>
            </div>
        </div>
    );
}
