import { describe, expect, it } from 'vitest';
import { classifyCheck, incidentTransition } from './detection';
describe('incident detection', () => {
 it('classifies failures and slow responses', () => { expect(classifyCheck(false, 10)).toBe('down'); expect(classifyCheck(true, 1500)).toBe('degraded'); expect(classifyCheck(true, 1499)).toBe('operational'); });
 it('waits for consecutive failure threshold',()=> { expect(incidentTransition('down',false,1,2)).toBe('none'); expect(incidentTransition('down',false,2,2)).toBe('open'); });
 it('opens one incident, updates it, and resolves on recovery', () => { expect(incidentTransition('down',false)).toBe('open'); expect(incidentTransition('degraded',true)).toBe('update'); expect(incidentTransition('operational',true)).toBe('resolve'); expect(incidentTransition('operational',false)).toBe('none'); });
});
