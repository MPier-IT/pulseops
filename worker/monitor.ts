/** Live monitoring is deliberately unavailable until independently enforced egress exists. */
export type Result={status:'operational'|'degraded'|'down';latency:number;httpStatus:number|null;reason:string|null};
export class MonitoringDisabledError extends Error {
 constructor(){super('Live monitoring is disabled: no verified connection-level egress control is configured.');this.name='MonitoringDisabledError'}
}
// There is intentionally no environment-variable escape hatch or direct-fetch fallback.
export async function checkUrl(_raw:string, _fetcher?:typeof fetch):Promise<never>{throw new MonitoringDisabledError()}
export const DEMO_CATALOG = [
 {id:'example',name:'Example website',description:'Approved example.com demonstration (simulated only)',url:'https://example.com/'},
 {id:'example-org',name:'Example API',description:'Approved example.org demonstration (simulated only)',url:'https://example.org/'},
] as const;
