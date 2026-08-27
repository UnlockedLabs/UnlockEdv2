import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CAPTURE_STYLE_PROPS = [
    'overflow',
    'height',
    'maxHeight',
    'minHeight'
] as const;

type CaptureStyleProp = (typeof CAPTURE_STYLE_PROPS)[number];

const MARGIN_IN = 0.5;
const PAGE_WIDTH_IN = 8.5;
const PAGE_HEIGHT_IN = 11;
const CONTENT_WIDTH_IN = PAGE_WIDTH_IN - MARGIN_IN * 2;
const CONTENT_HEIGHT_IN = PAGE_HEIGHT_IN - MARGIN_IN * 2;

function camelToKebab(value: string): string {
    return value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function collectElementsForCapture(root: HTMLElement): HTMLElement[] {
    const elements = [root];
    let parent = root.parentElement;
    while (parent && parent !== document.body) {
        elements.push(parent);
        parent = parent.parentElement;
    }
    return elements;
}

function applyCaptureStyles(
    elements: HTMLElement[]
): Map<HTMLElement, Partial<Record<CaptureStyleProp, string>>> {
    const previous = new Map<
        HTMLElement,
        Partial<Record<CaptureStyleProp, string>>
    >();

    for (const el of elements) {
        const saved: Partial<Record<CaptureStyleProp, string>> = {};
        for (const prop of CAPTURE_STYLE_PROPS) {
            saved[prop] = el.style[prop];
        }
        previous.set(el, saved);

        el.style.overflow = 'visible';
        el.style.height = 'auto';
        el.style.maxHeight = 'none';
        el.style.minHeight = '0';
    }

    return previous;
}

function restoreCaptureStyles(
    previous: Map<HTMLElement, Partial<Record<CaptureStyleProp, string>>>
) {
    for (const [el, saved] of previous) {
        for (const prop of CAPTURE_STYLE_PROPS) {
            const value = saved[prop];
            const kebab = camelToKebab(prop);
            if (value === undefined || value === '') {
                el.style.removeProperty(kebab);
            } else {
                el.style.setProperty(kebab, value);
            }
        }
    }
}

const COLOR_STYLE_PROPS = [
    'color',
    'backgroundColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor'
] as const;

const UNSUPPORTED_COLOR_RE = /oklab|oklch|color-mix|lab\(|lch\(/i;

/** html2canvas cannot parse Tailwind v4 oklab/oklch; the canvas API returns rgb/hex. */
function cssColorToRgb(color: string): string | null {
    const trimmed = color.trim();
    if (
        !trimmed ||
        trimmed === 'transparent' ||
        trimmed === 'none' ||
        trimmed === 'rgba(0, 0, 0, 0)'
    ) {
        return trimmed || null;
    }

    try {
        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) return null;
        ctx.fillStyle = '#000000';
        ctx.fillStyle = trimmed;
        const resolved = ctx.fillStyle;
        if (
            UNSUPPORTED_COLOR_RE.test(resolved) ||
            UNSUPPORTED_COLOR_RE.test(trimmed)
        ) {
            return null;
        }
        return resolved;
    } catch {
        return null;
    }
}

function fallbackColorForProp(
    prop: (typeof COLOR_STYLE_PROPS)[number]
): string {
    if (prop === 'color') return '#0a0a0a';
    if (prop === 'backgroundColor') return '#ffffff';
    return 'transparent';
}

function injectPdfSafeThemeVariables(clonedDoc: Document): void {
    const styleEl = clonedDoc.createElement('style');
    styleEl.setAttribute('data-pdf-safe-theme', 'true');
    styleEl.textContent = `
      :root, .learning-record-pdf-export, .learning-record-pdf-export * {
        --background: #ffffff !important;
        --foreground: #0a0a0a !important;
        --card: #ffffff !important;
        --card-foreground: #0a0a0a !important;
        --popover: #ffffff !important;
        --popover-foreground: #0a0a0a !important;
        --primary: #030213 !important;
        --primary-foreground: #ffffff !important;
        --secondary: #ececf0 !important;
        --secondary-foreground: #030213 !important;
        --muted: #ececf0 !important;
        --muted-foreground: #717182 !important;
        --accent: #e9ebef !important;
        --accent-foreground: #030213 !important;
        --border: rgba(0, 0, 0, 0.1) !important;
        --input-background: #f3f3f5 !important;
        --ring: #b3b3b3 !important;
        color: #0a0a0a !important;
        background-color: #ffffff !important;
        border-color: transparent !important;
        box-shadow: none !important;
        text-shadow: none !important;
        outline: none !important;
        background-image: none !important;
      }
    `;
    clonedDoc.head.appendChild(styleEl);
}

function sanitizeCloneElement(el: HTMLElement, view: Window): void {
    const computed = view.getComputedStyle(el);

    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('text-shadow', 'none', 'important');
    el.style.setProperty('outline', 'none', 'important');
    el.style.setProperty('border-color', 'transparent', 'important');
    el.style.setProperty('background-image', 'none', 'important');

    for (const prop of COLOR_STYLE_PROPS) {
        const kebab = camelToKebab(prop);
        const value = computed[prop];
        const rgb = cssColorToRgb(value);
        const safe =
            rgb ??
            (UNSUPPORTED_COLOR_RE.test(value)
                ? fallbackColorForProp(prop)
                : value);
        el.style.setProperty(kebab, safe, 'important');
    }

    const bg = cssColorToRgb(computed.backgroundColor);
    el.style.setProperty('background-color', bg ?? '#ffffff', 'important');
}

function countOklabInClone(cloneNodes: HTMLElement[], view: Window): number {
    let n = 0;
    for (const el of cloneNodes) {
        const cs = view.getComputedStyle(el);
        for (const prop of COLOR_STYLE_PROPS) {
            if (UNSUPPORTED_COLOR_RE.test(cs[prop])) n++;
        }
        if (UNSUPPORTED_COLOR_RE.test(cs.borderTopColor)) n++;
    }
    return n;
}

function prepareCloneForCapture(
    _originalRoot: HTMLElement,
    clonedRoot: HTMLElement,
    clonedDoc: Document
): { oklabAfterPrep: number; cloneNodeCount: number; bruteForcePass: boolean } {
    const view = clonedDoc.defaultView;
    if (!view) {
        return { oklabAfterPrep: -1, cloneNodeCount: 0, bruteForcePass: false };
    }

    clonedRoot.style.setProperty('clip-path', 'none', 'important');
    clonedRoot.style.setProperty('opacity', '1', 'important');
    clonedRoot.style.setProperty('visibility', 'visible', 'important');

    injectPdfSafeThemeVariables(clonedDoc);

    const cloneNodes: HTMLElement[] = [
        clonedRoot,
        ...clonedRoot.querySelectorAll<HTMLElement>('*')
    ];

    for (const el of cloneNodes) {
        sanitizeCloneElement(el, view);
    }

    let oklabAfterPrep = countOklabInClone(cloneNodes, view);
    let bruteForcePass = false;

    if (oklabAfterPrep > 0) {
        bruteForcePass = true;
        for (const el of cloneNodes) {
            el.style.setProperty('color', '#0a0a0a', 'important');
            el.style.setProperty('background-color', '#ffffff', 'important');
            el.style.setProperty('border-color', 'transparent', 'important');
            el.style.setProperty('outline-color', 'transparent', 'important');
            el.style.setProperty(
                'text-decoration-color',
                '#0a0a0a',
                'important'
            );
        }
        oklabAfterPrep = countOklabInClone(cloneNodes, view);
    }

    return {
        oklabAfterPrep,
        cloneNodeCount: cloneNodes.length,
        bruteForcePass
    };
}

function pickCanvasScale(element: HTMLElement): number {
    const maxSide = 8192;
    const height = element.scrollHeight || element.offsetHeight;
    const width = element.scrollWidth || element.offsetWidth;
    let scale = 2;
    while (Math.max(width, height) * scale > maxSide && scale > 1) {
        scale -= 0.25;
    }
    return scale;
}

/** Any channel below this counts as ink rather than page background. */
const BLANK_ROW_THRESHOLD = 245;

/**
 * Walks back from `idealCutPx` for the first fully-blank pixel row, so a page
 * break lands between lines instead of slicing through one. Returns
 * `idealCutPx` when the canvas cannot be read (a cross-origin image taints it)
 * or when nothing blank is close enough to be worth backing off to.
 */
function findBlankCutPx(
    canvas: HTMLCanvasElement,
    idealCutPx: number,
    lookBackPx: number,
    minCutPx: number
): number {
    const ideal = Math.floor(idealCutPx);
    const lowest = Math.max(
        Math.ceil(minCutPx),
        ideal - Math.floor(lookBackPx)
    );
    if (lowest >= ideal) return ideal;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return ideal;

    let block: ImageData;
    try {
        // One read for the whole look-back window: a row-at-a-time scan here is
        // thousands of getImageData calls on a full-page capture.
        block = ctx.getImageData(0, lowest, canvas.width, ideal - lowest + 1);
    } catch {
        return ideal;
    }

    const { data, width } = block;
    for (let y = block.height - 1; y >= 0; y--) {
        let blank = true;
        const rowStart = y * width * 4;
        for (let x = 0; x < width; x++) {
            const i = rowStart + x * 4;
            if (
                data[i] < BLANK_ROW_THRESHOLD ||
                data[i + 1] < BLANK_ROW_THRESHOLD ||
                data[i + 2] < BLANK_ROW_THRESHOLD
            ) {
                blank = false;
                break;
            }
        }
        if (blank) return lowest + y;
    }

    return ideal;
}

/**
 * Cuts the capture into one image per page.
 *
 * The previous approach drew the full-height image on every page at a negative
 * offset and let the page edge crop it. That crops at the paper edge, not at the
 * content box, so each page showed PAGE_HEIGHT_IN of image while the loop only
 * advanced by CONTENT_HEIGHT_IN — content ran into the margins and the extra
 * 2 * MARGIN_IN reappeared at the top of the next page. Slicing the source canvas
 * makes the advance and the visible region the same by construction.
 */
function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement) {
    const pxPerIn = canvas.width / CONTENT_WIDTH_IN;
    const pageSlicePx = CONTENT_HEIGHT_IN * pxPerIn;
    // Never back off so far that a page is mostly empty.
    const minSlicePx = pageSlicePx * 0.5;
    const lookBackPx = pxPerIn;

    const slice = document.createElement('canvas');
    const sliceCtx = slice.getContext('2d');

    let srcY = 0;
    let isFirstPage = true;

    while (srcY < canvas.height) {
        let sliceHeightPx = Math.min(pageSlicePx, canvas.height - srcY);

        if (srcY + sliceHeightPx < canvas.height) {
            const cut = findBlankCutPx(
                canvas,
                srcY + sliceHeightPx,
                lookBackPx,
                srcY + minSlicePx
            );
            if (cut > srcY) sliceHeightPx = cut - srcY;
        }

        slice.width = canvas.width;
        slice.height = Math.max(1, Math.ceil(sliceHeightPx));

        if (!sliceCtx) {
            throw new Error('PDF paging could not create a slice context');
        }
        sliceCtx.fillStyle = '#ffffff';
        sliceCtx.fillRect(0, 0, slice.width, slice.height);
        sliceCtx.drawImage(
            canvas,
            0,
            srcY,
            canvas.width,
            sliceHeightPx,
            0,
            0,
            canvas.width,
            sliceHeightPx
        );

        if (!isFirstPage) pdf.addPage();
        pdf.addImage(
            slice.toDataURL('image/jpeg', 0.92),
            'JPEG',
            MARGIN_IN,
            MARGIN_IN,
            CONTENT_WIDTH_IN,
            sliceHeightPx / pxPerIn
        );

        isFirstPage = false;
        srcY += sliceHeightPx;
    }
}

function addCanvasAsSinglePdfPage(
    pdf: jsPDF,
    canvas: HTMLCanvasElement,
    imgData: string,
    isFirstPage: boolean
) {
    if (!isFirstPage) {
        pdf.addPage();
    }

    const naturalWidth = CONTENT_WIDTH_IN;
    const naturalHeight = (canvas.height * naturalWidth) / canvas.width;
    let drawWidth = naturalWidth;
    let drawHeight = naturalHeight;

    if (drawHeight > CONTENT_HEIGHT_IN) {
        drawHeight = CONTENT_HEIGHT_IN;
        drawWidth = (canvas.width * drawHeight) / canvas.height;
    }

    const offsetX = MARGIN_IN + (CONTENT_WIDTH_IN - drawWidth) / 2;
    pdf.addImage(imgData, 'JPEG', offsetX, MARGIN_IN, drawWidth, drawHeight);
}

export interface LearningRecordCanvasCapture {
    canvas: HTMLCanvasElement;
    imgData: string;
}

export async function captureLearningRecordCanvas(
    root: HTMLElement
): Promise<LearningRecordCanvasCapture> {
    await document.fonts.ready;

    const elements = collectElementsForCapture(root);
    const previousStyles = applyCaptureStyles(elements);
    const scale = pickCanvasScale(root);

    try {
        const canvas = await html2canvas(root, {
            scale,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            scrollX: 0,
            scrollY: -window.scrollY,
            windowWidth: root.scrollWidth,
            onclone: (clonedDoc, clonedRoot) => {
                prepareCloneForCapture(root, clonedRoot, clonedDoc);
            }
        });

        if (canvas.width === 0 || canvas.height === 0) {
            throw new Error('PDF capture produced an empty canvas');
        }

        return {
            canvas,
            imgData: canvas.toDataURL('image/jpeg', 0.92)
        };
    } finally {
        restoreCaptureStyles(previousStyles);
    }
}

export function slugifyLearningRecordFilenamePart(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

export function learningRecordPdfFilename(
    residentName: string,
    date = new Date()
): string {
    const slug = slugifyLearningRecordFilenamePart(residentName) || 'resident';
    const iso = date.toISOString().slice(0, 10);
    return `learning-record-${slug}-${iso}.pdf`;
}

export async function downloadLearningRecordPdf(
    root: HTMLElement,
    filename: string
): Promise<void> {
    const { canvas } = await captureLearningRecordCanvas(root);
    const pdf = new jsPDF({
        unit: 'in',
        format: 'letter',
        orientation: 'portrait',
        compress: true
    });

    addCanvasToPdf(pdf, canvas);
    pdf.save(filename);
}

export async function downloadAllLearningRecordAchievementsPdf(
    captureEntryRoot: () => Promise<HTMLElement>,
    entryCount: number,
    filename: string
): Promise<void> {
    if (entryCount === 0) {
        return;
    }

    const pdf = new jsPDF({
        unit: 'in',
        format: 'letter',
        orientation: 'portrait',
        compress: true
    });

    for (let i = 0; i < entryCount; i++) {
        const root = await captureEntryRoot();
        const { canvas, imgData } = await captureLearningRecordCanvas(root);
        addCanvasAsSinglePdfPage(pdf, canvas, imgData, i === 0);
    }

    pdf.save(filename);
}
