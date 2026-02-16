import { FAQContent } from './FAQs';

export default function HelpCenter() {
    return (
        <div className="bg-muted min-h-screen p-6">
            <div className="max-w-3xl mx-auto space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Help Center
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Find answers to common questions and get support.
                    </p>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                        Need Help?
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        If you have questions or run into issues, please reach
                        out to facility staff. They can assist you directly or
                        contact the UnlockEd team on your behalf.
                    </p>
                </div>

                <FAQContent />
            </div>
        </div>
    );
}
