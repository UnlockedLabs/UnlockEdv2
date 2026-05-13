import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

declare global {
    interface Window {
        figma?: {
            captureForDesign: (opts: {
                captureId: string;
                endpoint: string;
                selector: string;
            }) => void;
        };
    }
}

export default function CaptureToFigmaButton() {
    const enabled = import.meta.env.VITE_ENABLE_FIGMA_CAPTURE === 'true';
    if (!enabled) return null;

    const captureId = import.meta.env.VITE_FIGMA_CAPTURE_ID as string | undefined;
    const endpoint =
        (import.meta.env.VITE_FIGMA_CAPTURE_ENDPOINT as string | undefined) ||
        (captureId
            ? `https://mcp.figma.com/mcp/capture/${captureId}/submit`
            : undefined);
    const selector =
        (import.meta.env.VITE_FIGMA_CAPTURE_SELECTOR as string | undefined) || 'body';

    const handleClick = () => {
        if (!window.figma?.captureForDesign) {
            toast.error(
                'Open this app in Cursor’s browser with Figma MCP connected.'
            );
            return;
        }
        if (!captureId || !endpoint) {
            toast.error(
                'Set VITE_FIGMA_CAPTURE_ID (and optionally VITE_FIGMA_CAPTURE_ENDPOINT) in .env.local.'
            );
            return;
        }
        window.figma.captureForDesign({ captureId, endpoint, selector });
        toast.success('Sent capture to Figma.');
    };

    return (
        <Button
            variant="secondary"
            size="sm"
            onClick={handleClick}
            className="fixed bottom-4 right-4 z-50 shadow-lg"
            data-testid="capture-to-figma"
        >
            Capture to Figma
        </Button>
    );
}
