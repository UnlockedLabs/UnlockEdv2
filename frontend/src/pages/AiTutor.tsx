export default function AiTutor() {
    return (
        <div className="w-full h-[calc(100vh-4rem)]">
            <iframe
                sandbox="allow-same-origin allow-scripts allow-forms"
                className="w-full h-full border-0"
                src="/tutor"
                title="AI Tutor"
            />
        </div>
    );
}
