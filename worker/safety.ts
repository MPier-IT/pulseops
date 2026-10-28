// DNS answers are checked immediately before fetch, but Workers cannot pin the resolved IP.
export function isPublicAddress(input:string):boolean {
 const a=input.toLowerCase().replace(/^\[|\]$/g,'');
 if (a.includes(':')) {
   if (a.startsWith('::ffff:')) return isPublicAddress(a.slice(7));
   // Reject all IPv6 answers except globally routed unicast 2000::/3. This also rejects
   // unspecified, loopback, link-local, unique-local and multicast addresses.
   const first=parseInt(a.split(':')[0]||'0',16); return first>=0x2000 && first<=0x3fff && !a.startsWith('2001:db8:');
 }
 const p=a.split('.'); if(p.length!==4 || p.some(x=>!/^\d+$/.test(x)||+x>255)) return false;
 const [x,y,z]=p.map(Number);
 return !(x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&y===168||x===100&&y>=64&&y<=127||x===192&&y===0||x===192&&y===2||x===198&&(y===18||y===19||y===51&&z===100)||x===203&&y===0&&z===113);
}
export function validateUrl(raw:string):URL {
 let u:URL; try {u=new URL(raw)} catch {throw new Error('Enter a valid URL')}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||u.hostname.toLowerCase()==='localhost'||!u.hostname.includes('.')||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||u.hostname.endsWith('.localhost')||u.hostname.startsWith('[')||/^\d+(\.\d+)*$/.test(u.hostname)) throw new Error('Use a public HTTP(S) hostname on a standard port');
 u.hash=''; return u;
}
export async function validateDns(u:URL, fetcher:typeof fetch=fetch):Promise<void> {
 // Cloudflare DNS-over-HTTPS returns A and AAAA records. Both must be public.
 let found=false;
 for(const type of ['A','AAAA']){
  const r=await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(u.hostname)}&type=${type}`,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(5000)});
  if(!r.ok) throw new Error('DNS lookup failed');
  const d=await r.json() as {Status:number;Answer?:{type:number;data:string}[]};
  if(d.Status!==0) throw new Error('DNS lookup failed');
  for(const a of d.Answer||[]) if(a.type===1||a.type===28){found=true;if(!isPublicAddress(a.data)) throw new Error('Hostname resolves to a non-public address');}
 }
 if(!found) throw new Error('Hostname has no public address');
}
