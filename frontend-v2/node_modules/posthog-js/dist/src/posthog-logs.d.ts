import { PostHog } from './posthog-core';
import { RemoteConfig } from './types';
export declare class PostHogLogs {
    private readonly _instance;
    private _isLogsEnabled;
    private _isLoaded;
    constructor(_instance: PostHog);
    onRemoteConfig(response: RemoteConfig): void;
    reset(): void;
    loadIfEnabled(): void;
}
