import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
    return (
        <main className="flex flex-col gap-6 p-8 w-full h-full">
            <Skeleton className="h-8 w-64" />
            <div className="flex gap-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </main>
    );
}
