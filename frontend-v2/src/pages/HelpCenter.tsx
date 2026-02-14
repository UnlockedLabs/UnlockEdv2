import { FAQContent } from './FAQs';

export default function HelpCenter() {
    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-3xl mx-auto space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-[#203622]">
                        Help Center
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Find answers to common questions and get support.
                    </p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-[#203622] mb-2">
                        Need Help?
                    </h2>
                    <p className="text-sm text-gray-600">
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
