// src/services/apiUtils.ts

////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////

export async function authHeaders(getToken: () => Promise<string | null>): Promise<HeadersInit> {
    const token = await getToken();
    if (!token) {
        throw new Error('Authentication token unavailable. Please sign in again.');
    }
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

export async function handleJsonResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const errBody = await res.json();
            if (errBody?.detail) {
                detail =
                    typeof errBody.detail === 'string'
                        ? errBody.detail
                        : JSON.stringify(errBody.detail);
            }
        } catch {
            // fallback to status text
            detail = res.statusText || detail;
        }
        throw new Error(detail);
    }
    return (await res.json()) as T;
}