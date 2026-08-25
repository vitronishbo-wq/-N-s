import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  isUnread?: boolean;
  labelIds?: string[];
}

export interface GmailMessageFull extends GmailMessageSummary {
  bodyText?: string;
  bodyHtml?: string;
}

export interface GmailUserProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing'
];

const provider = new GoogleAuthProvider();
GMAIL_SCOPES.forEach(scope => {
  provider.addScope(scope);
});

// Cache the access token in memory only (never localStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGmail = async () => {
  cachedAccessToken = null;
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign out error:', err);
  }
};

export const isGmailConnected = (): boolean => {
  return !!cachedAccessToken;
};

// Helper: base64url encode UTF-8
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Gmail REST API methods
export class GmailService {
  private static instance: GmailService;

  public static getInstance(): GmailService {
    if (!GmailService.instance) {
      GmailService.instance = new GmailService();
    }
    return GmailService.instance;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('AUTH_REQUIRED');
    }

    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      cachedAccessToken = null;
      throw new Error('AUTH_EXPIRED');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Erro na API do Gmail: ${response.statusText}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  public async getProfile(): Promise<GmailUserProfile> {
    return this.fetchWithAuth('https://gmail.googleapis.com/gmail/v1/users/me/profile');
  }

  public async listMessages(params: {
    q?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  } = {}): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string; resultSizeEstimate: number }> {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    if (params.q) url.searchParams.set('q', params.q);
    if (params.maxResults) url.searchParams.set('maxResults', params.maxResults.toString());
    if (params.pageToken) url.searchParams.set('pageToken', params.pageToken);
    if (params.labelIds && params.labelIds.length > 0) {
      params.labelIds.forEach(l => url.searchParams.append('labelIds', l));
    }

    const data = await this.fetchWithAuth(url.toString());
    if (!data.messages || data.messages.length === 0) {
      return { messages: [], resultSizeEstimate: 0 };
    }

    // Fetch summaries in parallel for first 10
    const details = await Promise.all(
      data.messages.slice(0, 15).map((m: { id: string; threadId: string }) =>
        this.getMessageSummary(m.id).catch(() => null)
      )
    );

    return {
      messages: details.filter((m): m is GmailMessageSummary => m !== null),
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate || 0
    };
  }

  public async getMessageSummary(messageId: string): Promise<GmailMessageSummary> {
    const data = await this.fetchWithAuth(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`
    );

    const headers: { name: string; value: string }[] = data.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: data.id,
      threadId: data.threadId,
      snippet: data.snippet || '',
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject') || '(Sem Assunto)',
      date: getHeader('Date'),
      isUnread: data.labelIds?.includes('UNREAD'),
      labelIds: data.labelIds || []
    };
  }

  public async getMessageFull(messageId: string): Promise<GmailMessageFull> {
    const data = await this.fetchWithAuth(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
    );

    const headers: { name: string; value: string }[] = data.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    let bodyText = '';
    let bodyHtml = '';

    const parsePayloadParts = (part: any) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText += this.decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml += this.decodeBase64(part.body.data);
      }
      if (part.parts && Array.isArray(part.parts)) {
        part.parts.forEach(parsePayloadParts);
      }
    };

    if (data.payload) {
      if (data.payload.body?.data) {
        const decoded = this.decodeBase64(data.payload.body.data);
        if (data.payload.mimeType === 'text/html') {
          bodyHtml = decoded;
        } else {
          bodyText = decoded;
        }
      }
      if (data.payload.parts) {
        data.payload.parts.forEach(parsePayloadParts);
      }
    }

    return {
      id: data.id,
      threadId: data.threadId,
      snippet: data.snippet || '',
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject') || '(Sem Assunto)',
      date: getHeader('Date'),
      isUnread: data.labelIds?.includes('UNREAD'),
      labelIds: data.labelIds || [],
      bodyText: bodyText || data.snippet,
      bodyHtml: bodyHtml
    };
  }

  public async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
  }): Promise<{ id: string; threadId: string }> {
    const profile = await this.getProfile();
    const fromAddress = profile.emailAddress;

    const emailLines = [
      `From: ${fromAddress}`,
      `To: ${params.to}`,
      params.cc ? `Cc: ${params.cc}` : null,
      params.bcc ? `Bcc: ${params.bcc}` : null,
      `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      params.body
    ].filter(Boolean);

    const rawEmail = emailLines.join('\r\n');
    const encodedEmail = base64UrlEncode(rawEmail);

    return this.fetchWithAuth('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        raw: encodedEmail
      })
    });
  }

  public async trashMessage(messageId: string): Promise<any> {
    return this.fetchWithAuth(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
      method: 'POST'
    });
  }

  public async markAsRead(messageId: string): Promise<any> {
    return this.fetchWithAuth(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({
        removeLabelIds: ['UNREAD']
      })
    });
  }

  public async markAsUnread(messageId: string): Promise<any> {
    return this.fetchWithAuth(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({
        addLabelIds: ['UNREAD']
      })
    });
  }

  private decodeBase64(base64Str: string): string {
    try {
      const normalized = base64Str.replace(/-/g, '+').replace(/_/g, '/');
      const binStr = atob(normalized);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return '';
    }
  }
}
