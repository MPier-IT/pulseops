import {describe,it,expect,vi} from 'vitest';
import {sendEmail} from './email';
describe('email adapter',()=>{
 it('reports missing configuration without making a request',async()=>{const f=vi.fn();expect((await sendEmail({},'i','outage','API',f as typeof fetch)).status).toBe('unconfigured');expect(f).not.toHaveBeenCalled()});
 it('sends a provider idempotency key and records acceptance',async()=>{const f=vi.fn().mockResolvedValue(new Response('{}',{status:200}));const result=await sendEmail({EMAIL_API_KEY:'key',EMAIL_FROM:'from',EMAIL_TO:'to'},'incident','recovery','API',f as typeof fetch);expect(result.status).toBe('sent');expect(f.mock.calls[0][1].headers['Idempotency-Key']).toBe('pulseops-incident-recovery')});
 it('records provider failures',async()=>{const f=vi.fn().mockResolvedValue(new Response('',{status:503}));expect(await sendEmail({EMAIL_API_KEY:'key',EMAIL_FROM:'from',EMAIL_TO:'to'},'i','outage','API',f as typeof fetch)).toEqual({status:'failed',detail:'Provider HTTP 503'})});
});
