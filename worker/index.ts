import {sendEmail} from './email';
import {incidentTransition} from './detection';
import {hash,constantEqual,cookie,sameOrigin,sessionCookie} from './auth';
import {validateUrl} from './safety';
import {DEMO_CATALOG, type Result} from './monitor';
interface Env { DB:D1Database; ASSETS:Fetcher; ADMIN_PASSWORD?:string; EMAIL_API_KEY?:string; EMAIL_FROM?:string; EMAIL_TO?:string }
type Service={id:string;name:string;description:string;url:string;region:string;status:string;latency:number;mode:'real'|'demo';paused:number;deleted:number;interval_minutes:number;failure_threshold:number;consecutive_failures:number;last_checked_at:string|null;last_success_at:string|null;next_check_at:string|null};
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const local=(r:Request)=>['localhost','127.0.0.1','[::1]'].includes(new URL(r.url).hostname);
const secure=(r:Request)=>!local(r);
async function authorized(r:Request,db:D1Database){const token=cookie(r);if(!token||token.length!==64)return false;return !!await db.prepare('SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at > ?').bind(await hash(token),new Date().toISOString()).first()}
async function login(r:Request,env:Env){
 if(!sameOrigin(r))return json({error:'Invalid origin'},403);
 const ip=r.headers.get('CF-Connecting-IP')||'local';const key=await hash(ip);const now=Date.now();
 await env.DB.prepare('INSERT INTO login_attempts (key,attempts,window_start) VALUES (?,0,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start < ? THEN 0 ELSE attempts END, window_start=CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END').bind(key,now,now-900000,now-900000).run();
 const attempt=await env.DB.prepare('UPDATE login_attempts SET attempts=attempts+1 WHERE key=? AND attempts<5').bind(key).run();if(!attempt.meta.changes)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
 const body=await r.json() as {password?:unknown};if(!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<16||typeof body.password!=='string'||body.password.length>1024||!constantEqual(await hash(body.password),await hash(env.ADMIN_PASSWORD)))return json({error:'Invalid credentials'},401);
 await env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');const expiry=new Date(now+8*3600000).toISOString();
 await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()),env.DB.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await hash(token),expiry,new Date().toISOString())]);
 return json({authenticated:true,expiresAt:expiry},200,{'Set-Cookie':sessionCookie(token,secure(r),28800)});
}
async function notify(env:Env,incidentId:string,kind:'outage'|'recovery',name:string){
 const id=crypto.randomUUID(),now=new Date().toISOString();const result=await env.DB.prepare('INSERT OR IGNORE INTO notifications VALUES (?,?,?,?,?,?)').bind(id,incidentId,kind,'pending',now,null).run();if(!result.meta.changes)return;
 const resultEmail=await sendEmail(env,incidentId,kind,name);await env.DB.prepare('UPDATE notifications SET status=?, detail=? WHERE id=?').bind(resultEmail.status,resultEmail.detail,id).run();
}
async function record(env:Env,s:Service,result:Result,mode:'real'|'demo'){
 const now=new Date().toISOString();const failures=result.status!=='operational'?s.consecutive_failures+1:0;const active=await env.DB.prepare("SELECT id FROM incidents WHERE service_id=? AND status!='resolved'").bind(s.id).first<{id:string}>();
 const stmts=[env.DB.prepare('INSERT INTO checks (service_id,status,latency,checked_at,http_status,failure_reason,mode,checked_url) VALUES (?,?,?,?,?,?,?,?)').bind(s.id,result.status,result.latency,now,result.httpStatus,result.reason,mode,mode==='real'?s.url:null),env.DB.prepare('UPDATE services SET status=?, latency=?, updated_at=?, last_checked_at=?, last_success_at=CASE WHEN ?=\'operational\' THEN ? ELSE last_success_at END, consecutive_failures=? WHERE id=?').bind(result.status,result.latency,now,now,result.status,now,failures,s.id)];
 let transition:'outage'|'recovery'|null=null;let incidentId=active?.id;
 if(incidentTransition(result.status,!!active,failures,s.failure_threshold)==='open'){incidentId=crypto.randomUUID();transition='outage';stmts.push(env.DB.prepare('INSERT INTO incidents (id,service_id,title,status,severity,started_at,mode) VALUES (?,?,?,?,?,?,?)').bind(incidentId,s.id,`${s.name} ${mode==='demo'?'simulated ':''}${result.status==='degraded'?'degradation':'outage'}`,'investigating',result.status==='degraded'?'major':'critical',now,mode));stmts.push(env.DB.prepare('INSERT INTO incident_events (incident_id,message,created_at) VALUES (?,?,?)').bind(incidentId,`${mode==='demo'?'Simulated ':''}incident opened after ${failures} unhealthy check(s).`,now));}
 if(active&&result.status!=='operational'&&s.status!==result.status){stmts.push(env.DB.prepare('UPDATE incidents SET severity=? WHERE id=?').bind(result.status==='down'?'critical':'major',active.id));stmts.push(env.DB.prepare('INSERT INTO incident_events (incident_id,message,created_at) VALUES (?,?,?)').bind(active.id,`${mode==='demo'?'Simulated ':''}status changed to ${result.status}.`,now));}
 if(incidentTransition(result.status,!!active,failures,s.failure_threshold)==='resolve'&&active){transition='recovery';stmts.push(env.DB.prepare("UPDATE incidents SET status='resolved',resolved_at=? WHERE id=?").bind(now,active.id));stmts.push(env.DB.prepare('INSERT INTO incident_events (incident_id,message,created_at) VALUES (?,?,?)').bind(active.id,mode==='demo'?'Simulated service recovered.':'Service recovered.',now));}
 await env.DB.batch(stmts);if(transition&&incidentId&&mode==='real')await notify(env,incidentId,transition,s.name);
}
// Scheduled checks remain disabled. Do not mark existing services down or alter history.
async function dashboard(db:D1Database,admin:boolean){
 const services=await db.prepare(admin?"SELECT * FROM services WHERE deleted=0 ORDER BY mode,name":"SELECT id,name,description,status,latency,mode,paused,last_checked_at,last_success_at FROM services WHERE deleted=0 AND mode='real' ORDER BY name").all();
 const incidents=await db.prepare(`SELECT i.id,i.service_id,i.title,i.status,i.severity,i.started_at,i.resolved_at,i.mode,s.name as service_name FROM incidents i JOIN services s ON s.id=i.service_id WHERE s.deleted=0 ${admin?'':"AND i.mode='real'"} ORDER BY i.started_at DESC LIMIT 100`).all();
 const checks=await db.prepare(`SELECT c.service_id,c.status,c.latency,c.checked_at,c.mode${admin?',c.http_status,c.failure_reason,c.checked_url':''} FROM checks c JOIN services s ON s.id=c.service_id WHERE s.deleted=0 ${admin?'':"AND c.mode='real'"} AND c.checked_at>=? ORDER BY c.checked_at`).bind(new Date(Date.now()-30*86400000).toISOString()).all();
 const events=admin?(await db.prepare('SELECT e.*,i.title FROM incident_events e JOIN incidents i ON i.id=e.incident_id ORDER BY e.created_at DESC LIMIT 100').all()).results:[];
 const notifications=admin?(await db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all()).results:[];
 return {services:services.results,incidents:incidents.results,checks:checks.results,events,notifications,liveMonitoringEnabled:false,demoCatalog:admin?DEMO_CATALOG.map(({id,name})=>({id,name})):[]};
}
async function demoDashboard(db:D1Database){
 const where="s.mode='demo' AND s.deleted=0 AND s.id IN ('pulse-demo-v1-api','pulse-demo-v1-web','pulse-demo-v1-db','pulse-demo-v1-jobs','pulse-demo-v1-auth')";
 const [services,checks,incidents]=await Promise.all([
  db.prepare(`SELECT s.id,s.name,s.description,s.status,s.latency,s.mode,s.last_checked_at FROM services s WHERE ${where} ORDER BY CASE s.id WHEN 'pulse-demo-v1-api' THEN 1 WHEN 'pulse-demo-v1-web' THEN 2 WHEN 'pulse-demo-v1-db' THEN 3 WHEN 'pulse-demo-v1-jobs' THEN 4 ELSE 5 END`).all(),
  db.prepare(`SELECT c.service_id,c.status,c.latency,c.checked_at,c.mode FROM checks c JOIN services s ON s.id=c.service_id WHERE ${where} AND c.mode='demo' ORDER BY c.checked_at DESC LIMIT 2000`).all(),
  db.prepare(`SELECT i.id,i.service_id,i.title,i.status,i.severity,i.started_at,i.resolved_at,i.mode,s.name AS service_name FROM incidents i JOIN services s ON s.id=i.service_id WHERE ${where} AND i.mode='demo' ORDER BY i.started_at DESC LIMIT 30`).all(),
 ]);
 return {services:services.results,checks:checks.results,incidents:incidents.results,simulated:true};
}
function validated(body:Record<string,unknown>){const name=String(body.name||'').trim(),description=String(body.description||'').trim();if(!name||name.length>80||description.length>200)throw new Error('Name is required (maximum 80 characters); description maximum is 200 characters');const url=validateUrl(String(body.url||'')).toString();const interval=Number(body.interval_minutes),threshold=Number(body.failure_threshold);if(!Number.isInteger(interval)||interval<5||interval>1440||!Number.isInteger(threshold)||threshold<1||threshold>10)throw new Error('Interval must be 5–1440 minutes and threshold 1–10');return {name,description,url,interval,threshold}}
export default {
 async fetch(r:Request,env:Env):Promise<Response>{const u=new URL(r.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(r);
 try{
  if(u.protocol!=='https:'&&!local(r))return json({error:'HTTPS required'},403);
  if(u.pathname==='/api/login'&&r.method==='POST')return await login(r,env);
  if(u.pathname==='/api/demo/public'&&r.method==='GET')return json(await demoDashboard(env.DB));
  if(u.pathname==='/api/public'&&r.method==='GET')return json(await dashboard(env.DB,false));
  if(u.pathname==='/api/session'&&r.method==='GET')return json({authenticated:await authorized(r,env.DB)});
  if(!await authorized(r,env.DB))return json({error:'Administrator login required'},401);
  if(r.method!=='GET'&&!sameOrigin(r))return json({error:'Invalid origin'},403);
  if(u.pathname==='/api/logout'&&r.method==='POST'){const token=cookie(r);if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();return json({ok:true},200,{'Set-Cookie':sessionCookie('',secure(r),0)});}
  if(u.pathname==='/api/dashboard'&&r.method==='GET')return json(await dashboard(env.DB,true));
  if(u.pathname==='/api/services'&&r.method==='POST')return json({error:'Live monitoring is disabled until verified egress controls are available.'},503);
  const match=u.pathname.match(/^\/api\/services\/([a-zA-Z0-9-]+)$/);if(match){const id=match[1];const s=await env.DB.prepare("SELECT * FROM services WHERE id=? AND mode='real' AND deleted=0").bind(id).first<Service>();if(!s)return json({error:'Service not found'},404);
   if(r.method==='PUT'){const body=await r.json() as Record<string,unknown>;const b=validated(body);if(b.url!==s.url)return json({error:'Changing endpoints is disabled until verified egress controls are available.'},503);await env.DB.prepare('UPDATE services SET name=?,description=?,url=?,interval_minutes=?,failure_threshold=?,paused=?,next_check_at=NULL WHERE id=?').bind(b.name,b.description,b.url,b.interval,b.threshold,body.paused?1:0,id).run();return json({ok:true})}
   if(r.method==='DELETE'){await env.DB.prepare('UPDATE services SET deleted=1,paused=1 WHERE id=?').bind(id).run();return json({ok:true})}
  }
  if(u.pathname==='/api/demo'&&r.method==='POST'){const b=await r.json() as {serviceId?:string;status?:string};if(!['operational','degraded','down'].includes(b.status||''))return json({error:'Invalid demo status'},400);const s=await env.DB.prepare("SELECT * FROM services WHERE id=? AND mode='demo' AND deleted=0").bind(b.serviceId||'').first<Service>();if(!s)return json({error:'Demo service not found'},404);await record(env,{...s,failure_threshold:1},{status:b.status as 'down'|'degraded'|'operational',latency:b.status==='down'?0:b.status==='degraded'?2400:120,httpStatus:null,reason:'Simulation'},'demo');return json({ok:true})}
  if(u.pathname==='/api/demo/reset'&&r.method==='POST'){const rows=await env.DB.prepare("SELECT * FROM services WHERE mode='demo' AND deleted=0 AND status!='operational'").all<Service>();for(const s of rows.results)await record(env,s,{status:'operational',latency:120,httpStatus:null,reason:'Simulation reset'},'demo');return json({ok:true})}
  if(u.pathname==='/api/demo/create'&&r.method==='POST'){const body=await r.json() as {catalogId?:string};const item=DEMO_CATALOG.find(x=>x.id===body.catalogId);if(!item)return json({error:'Select an approved demo endpoint'},400);const id=crypto.randomUUID(),now=new Date().toISOString();await env.DB.prepare("INSERT INTO services (id,name,description,url,region,status,latency,updated_at,mode) VALUES (?,?,?,?,'Demo','operational',0,?,'demo')").bind(id,item.name,item.description,item.url,now).run();return json({id},201)}
  return json({error:'Not found'},404);
 }catch(e){console.error(e);return json({error:e instanceof Error&&(/valid|public|maximum|Interval|threshold/.test(e.message))?e.message:'Request failed'},400)}
 },
 async scheduled(_event:ScheduledEvent,_env:Env,_ctx:ExecutionContext){ /* Fail closed: no network or database changes. */ }
};
