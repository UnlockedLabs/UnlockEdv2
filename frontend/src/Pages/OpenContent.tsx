import LibaryLayout from '@/Components/LibraryLayout';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function OpenContent() {
    return (
        <AuthenticatedLayout title="Open Content" path={['Open Content']}>
            <div className="px-8 pb-4">
                <h1>Open Content</h1>
                <LibaryLayout studentView={true} />
            </div>
        </AuthenticatedLayout>
    );
}
