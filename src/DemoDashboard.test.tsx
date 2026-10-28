import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {DemoDashboard,type DemoData} from './DemoDashboard';
const data:DemoData={simulated:true,services:[{id:'demo',name:'Core API',description:'Fictional API',status:'degraded',latency:2400,last_checked_at:null}],checks:[{service_id:'demo',status:'operational',latency:120,checked_at:'2026-01-01T00:00:00Z'},{service_id:'demo',status:'degraded',latency:2400,checked_at:'2026-01-01T01:00:00Z'}],incidents:[{id:'i',service_name:'Core API',title:'Core API simulated degradation',status:'investigating',started_at:'2026-01-01T01:00:00Z',resolved_at:null}]};
describe('demo dashboard rendering',()=>{
 it('clearly labels charts, status and history as simulated for public visitors',()=>{const html=renderToStaticMarkup(<DemoDashboard data={data} admin={false} busy={false} onSimulate={vi.fn()}/>);expect(html).toContain('Simulation only');expect(html).toContain('Simulated degradation');expect(html).toContain('simulated availability checks');expect(html).toContain('simulated response times');expect(html).toContain('Core API simulated degradation');expect(html).toContain('Read-only demonstration');expect(html).not.toContain('Simulate outage</button>')});
 it('renders administrator simulation controls without network access',()=>{const html=renderToStaticMarkup(<DemoDashboard data={data} admin busy={false} onSimulate={vi.fn()}/>);expect(html).toContain('Simulate outage</button>');expect(html).toContain('Simulate degradation</button>');expect(html).toContain('Recover</button>')});
 it('shows an actionable empty state when the demo migration is missing',()=>{const html=renderToStaticMarkup(<DemoDashboard data={{...data,services:[],checks:[],incidents:[]}} admin={false} busy={false} onSimulate={vi.fn()}/>);expect(html).toContain('Apply the local database migrations')});
});
