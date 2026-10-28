export type CheckStatus = 'operational' | 'degraded' | 'down';
export function classifyCheck(ok:boolean,latency:number):CheckStatus {return !ok?'down':latency>=1500?'degraded':'operational'}
export function incidentTransition(status:CheckStatus,hasOpen:boolean,failures=1,threshold=1):'open'|'resolve'|'update'|'none' {
 if(status==='operational')return hasOpen?'resolve':'none';
 if(hasOpen)return 'update';
 return failures>=threshold?'open':'none';
}
