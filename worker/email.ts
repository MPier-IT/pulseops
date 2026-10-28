export type EmailConfig={EMAIL_API_KEY?:string;EMAIL_FROM?:string;EMAIL_TO?:string};
export async function sendEmail(config:EmailConfig,incidentId:string,kind:'outage'|'recovery',name:string,fetcher:typeof fetch=fetch):Promise<{status:'sent'|'failed'|'unconfigured';detail:string|null}>{
 if(!config.EMAIL_API_KEY||!config.EMAIL_FROM||!config.EMAIL_TO)return {status:'unconfigured',detail:null};
 try{const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.EMAIL_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`pulseops-${incidentId}-${kind}`},body:JSON.stringify({from:config.EMAIL_FROM,to:[config.EMAIL_TO],subject:`PulseOps: ${name} ${kind}`,text:`${name} ${kind==='outage'?'is unavailable':'has recovered'}.`}),signal:AbortSignal.timeout(10000)});return {status:r.ok?'sent':'failed',detail:r.ok?null:`Provider HTTP ${r.status}`}}catch{return {status:'failed',detail:'Provider request failed'}}
}
