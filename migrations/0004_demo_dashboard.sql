-- One-time synthetic showcase data. All rows are explicitly marked demo.
INSERT OR IGNORE INTO services (id,name,description,url,region,status,latency,updated_at,mode,interval_minutes,failure_threshold,last_checked_at,last_success_at)
VALUES
 ('pulse-demo-v1-api','Core API','Application endpoints','https://example.com/','Demo','operational',142,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'demo',60,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('pulse-demo-v1-web','Web application','Customer-facing experience','https://example.com/','Demo','operational',89,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'demo',60,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('pulse-demo-v1-db','Database','Primary data store','https://example.com/','Demo','operational',51,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'demo',60,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('pulse-demo-v1-jobs','Background jobs','Asynchronous processing','https://example.com/','Demo','operational',205,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'demo',60,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('pulse-demo-v1-auth','Authentication','Identity and access','https://example.com/','Demo','operational',110,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'demo',60,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
WITH RECURSIVE hours(n) AS (SELECT 167 UNION ALL SELECT n-1 FROM hours WHERE n>0)
INSERT INTO checks (service_id,status,latency,checked_at,mode,failure_reason)
SELECT s.id, CASE WHEN (s.id='pulse-demo-v1-api' AND n=34) OR (s.id='pulse-demo-v1-jobs' AND n=43) THEN 'down' ELSE 'operational' END,
 CASE WHEN (s.id='pulse-demo-v1-api' AND n=34) OR (s.id='pulse-demo-v1-jobs' AND n=43) THEN 0 ELSE s.latency + ((n*17)%43)-21 END,
 strftime('%Y-%m-%dT%H:%M:%fZ','now','-' || n || ' hours'),'demo','Synthetic sample'
FROM services s CROSS JOIN hours WHERE s.id IN ('pulse-demo-v1-api','pulse-demo-v1-web','pulse-demo-v1-db','pulse-demo-v1-jobs','pulse-demo-v1-auth') AND s.mode='demo';
INSERT OR IGNORE INTO incidents (id,service_id,title,status,severity,started_at,resolved_at,mode) VALUES
 ('pulse-demo-v1-incident-api','pulse-demo-v1-api','Core API simulated outage','resolved','critical',strftime('%Y-%m-%dT%H:%M:%fZ','now','-34 hours'),strftime('%Y-%m-%dT%H:%M:%fZ','now','-33 hours'),'demo'),
 ('pulse-demo-v1-incident-jobs','pulse-demo-v1-jobs','Background jobs simulated outage','resolved','critical',strftime('%Y-%m-%dT%H:%M:%fZ','now','-43 hours'),strftime('%Y-%m-%dT%H:%M:%fZ','now','-42 hours'),'demo');
INSERT INTO incident_events (incident_id,message,created_at) VALUES
 ('pulse-demo-v1-incident-api','Simulated outage detected.',strftime('%Y-%m-%dT%H:%M:%fZ','now','-34 hours')),
 ('pulse-demo-v1-incident-api','Simulated recovery.',strftime('%Y-%m-%dT%H:%M:%fZ','now','-33 hours')),
 ('pulse-demo-v1-incident-jobs','Simulated outage detected.',strftime('%Y-%m-%dT%H:%M:%fZ','now','-43 hours')),
 ('pulse-demo-v1-incident-jobs','Simulated recovery.',strftime('%Y-%m-%dT%H:%M:%fZ','now','-42 hours'));
