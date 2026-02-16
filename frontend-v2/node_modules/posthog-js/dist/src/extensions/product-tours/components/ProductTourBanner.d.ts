import { h } from 'preact';
import { ProductTourDisplayFrequency, ProductTourStep } from '../../../posthog-product-tours-types';
export interface ProductTourBannerProps {
    step: ProductTourStep;
    onDismiss: () => void;
    onTriggerTour?: () => void;
    displayFrequency?: ProductTourDisplayFrequency;
}
export declare function ProductTourBanner({ step, onDismiss, onTriggerTour, displayFrequency, }: ProductTourBannerProps): h.JSX.Element;
