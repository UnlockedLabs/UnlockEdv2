import axios from "axios";
import { User } from "@/common";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { CloseX } from "../inputs/CloseX";

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
            <h4 className="font-bold text-error py-4">
                <p>Note: Only for non-administrator accounts.</p>
            </h4>
            <p className="py-4"></p>
            <form method="dialog" className="flex flex-row justify-between">
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
            </form>
        </div>
    );
}
