export default function AiTutor() {
    // One frame for everyone. The tutor decides what to show from the session's
    // role: residents get the tutor itself, staff get a chooser for the teacher
    // view and the curriculum builder. Nothing role-shaped belongs here — the
    // host would only be guessing at what the tutor has.
    //
    // AuthenticatedLayout renders the h-16 header on mobile but not on desktop,
    // so the h-16 is subtracted only below md.
    const heightClass = 'h-[calc(100vh-4rem)] md:h-screen';

    return (
        <div className={`w-full ${heightClass}`}>
            <iframe
                // allow-same-origin is required: without it the frame gets an
                // opaque origin, and the tutor's own client-side fetches to its
                // own /tutor/api/* routes then get CORS-blocked (opaque origin
                // sends "Origin: null", which nothing in this stack allows) —
                // confirmed live, the app breaks completely without this.
                // CodeRabbit correctly flagged that allow-same-origin +
                // allow-scripts gives same-origin content no real sandboxing;
                // that's a genuine tradeoff of this architecture (ambient
                // Kratos-cookie auth + the tutor's own API sharing an origin
                // with the host app), not something fixable by dropping a flag
                // — the real fix would be serving /tutor from a separate
                // origin, which is out of scope here.
                sandbox="allow-same-origin allow-scripts allow-forms"
                className="w-full h-full border-0"
                src="/tutor"
                title="AI Tutor"
            />
        </div>
    );
}
