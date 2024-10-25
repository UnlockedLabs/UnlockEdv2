import LibaryLayout from '@/Components/LibraryLayout';

export default function OpenContent() {
    return (
        <div className="px-8 pb-4">
            <h1>Open Content</h1>
            <LibaryLayout studentView={true} />
        </div>
    );
}
