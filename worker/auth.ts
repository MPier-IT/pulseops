export async function hash(value:string):Promise<string>{const bytes=new TextEncoder().encode(value);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('')}
export function constantEqual(a:string,b:string):boolean {let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++) diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
export function cookie(request:Request):string|undefined{return request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('pulse_session='))?.slice(14)}
export function sameOrigin(request:Request):boolean {return request.headers.get('Origin')===new URL(request.url).origin && request.headers.get('X-PulseOps-Request')==='1'}
export function sessionCookie(token:string,secure:boolean,maxAge:number):string{return `pulse_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`}
