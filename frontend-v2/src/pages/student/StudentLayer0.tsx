import { useAuth } from '@/auth/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentLayer0() {
    const { user } = useAuth();
    return (
        <Card className="max-w-lg mx-auto mt-10">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl text-[#203622]">
                    Hi, {user?.name_first ?? 'Student'}!
                </CardTitle>
                <p className="text-xl text-[#203622]">Welcome to UnlockEd</p>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <img
                    src="/ul-logo-d.svg"
                    alt="UnlockEd Logo"
                    className="w-32 h-32"
                />
                <p className="text-center font-medium text-xl text-destructive">
                    Please contact your administrator to get access to
                    application features
                </p>
            </CardContent>
        </Card>
    );
}
