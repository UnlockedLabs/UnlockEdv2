import { INIT_KRATOS_LOGIN_FLOW } from "./common";

const CHANNEL_NAME = 'unlocked_session_channel';
const SESSION_STORAGE_KEY = 'tab_session_active';
const SESSION_CHECK_TIMEOUT_MS = 100;

enum SessionMessageType {
  SESSION_CHECK = 'SESSION_CHECK',
  SESSION_ACTIVE = 'SESSION_ACTIVE',
  SESSION_ESTABLISHED = 'SESSION_ESTABLISHED',
  SESSION_ENDED = 'SESSION_ENDED'
}

interface SessionMessage {
  type: SessionMessageType;
  timestamp: number;
}

class TabSessionManager {
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.initChannel();
  }

  private initChannel(): void {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent<SessionMessage>): void {
    const { type } = event.data;

    switch (type) {
      case SessionMessageType.SESSION_CHECK:
        if (this.hasLocalSession()) {
          this.broadcast(SessionMessageType.SESSION_ACTIVE);
        }
        break;

      case SessionMessageType.SESSION_ESTABLISHED:
        this.setLocalSession();
        break;

      case SessionMessageType.SESSION_ENDED:
        this.clearLocalSession();
        window.location.href = INIT_KRATOS_LOGIN_FLOW;
        break;
    }
  }

  private broadcast(type: SessionMessageType): void {
    if (!this.channel) return;
    const message: SessionMessage = {
      type,
      timestamp: Date.now()
    };
    this.channel.postMessage(message);
  }

  hasLocalSession(): boolean {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
  }

  setLocalSession(): void {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
  }

  clearLocalSession(): void {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  onLogin(): void {
    this.setLocalSession();
    this.broadcast(SessionMessageType.SESSION_ESTABLISHED);
  }

  onLogout(): void {
    this.clearLocalSession();
    this.broadcast(SessionMessageType.SESSION_ENDED);
  }

  async validateSession(): Promise<boolean> {
    if (this.hasLocalSession()) {
      return true;
    }

    if (!this.channel) {
      return false;
    }

    const channel = this.channel;
    return new Promise((resolve) => {
      let resolved = false;

      const messageHandler = (event: MessageEvent<SessionMessage>) => {
        if (
          event.data.type === SessionMessageType.SESSION_ACTIVE &&
          !resolved
        ) {
          resolved = true;
          this.setLocalSession();
          channel.removeEventListener('message', messageHandler);
          resolve(true);
        }
      };

      channel.addEventListener('message', messageHandler);
      this.broadcast(SessionMessageType.SESSION_CHECK);

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          channel.removeEventListener('message', messageHandler);
          resolve(false);
        }
      }, SESSION_CHECK_TIMEOUT_MS);
    });
  }
}

export const tabSessionManager = new TabSessionManager();
export default tabSessionManager;
