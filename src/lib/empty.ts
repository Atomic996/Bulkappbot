// Empty file to stub out polyfills that try to overwrite window.fetch
export const fetch = typeof window !== 'undefined' ? window.fetch : undefined;
export const FormData = typeof window !== 'undefined' ? window.FormData : undefined;
export const Request = typeof window !== 'undefined' ? window.Request : undefined;
export const Response = typeof window !== 'undefined' ? window.Response : undefined;
export const Headers = typeof window !== 'undefined' ? window.Headers : undefined;

export default fetch;
