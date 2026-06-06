import { useState, useMemo, useEffect } from 'react';
import { useSnapshot } from 'jotai-state-tree/react';
import { onPatch, destroy } from 'jotai-state-tree';
import { DashboardStore, IDashboardStore } from './store';

export function App() {
  // Initialize store with metrics
  const store = useMemo(() => {
    return DashboardStore.create({
      metrics: {
        cpu: { id: 'cpu', name: 'CPU Load', value: 25.0, unit: '%', threshold: 80 },
        ram: { id: 'ram', name: 'Memory Usage', value: 55.0, unit: '%', threshold: 85 },
        network: { id: 'network', name: 'Network Speed', value: 85.0, unit: 'Mbps', threshold: 300 },
        db: { id: 'db', name: 'Active DB Connections', value: 15, unit: 'conns', threshold: 40 },
      },
      isPaused: false,
      updateIntervalMs: 1000,
    });
  }, []);

  useSnapshot(store);

  // States
  const [logs, setLogs] = useState<Array<{ id: string; time: string; msg: string; level: 'info' | 'warn' | 'error' }>>([]);

  // Subscribes to patches to monitor threshold crossings and output terminal log events
  useEffect(() => {
    // Add initial log
    setLogs([{
      id: 'init',
      time: new Date().toLocaleTimeString(),
      msg: 'Telemetry monitor initialized. System state is nominal.',
      level: 'info',
    }]);

    const dispose = onPatch(store, (patch) => {
      // Check if patch is updating a metric value, e.g. path "/metrics/cpu/value"
      const match = patch.path.match(/^\/metrics\/([a-z]+)\/value$/);
      if (match && patch.op === 'replace') {
        const metricId = match[1];
        const val = patch.value as number;
        const metric = store.metrics.get(metricId);
        
        if (metric && val > metric.threshold) {
          const time = new Date().toLocaleTimeString();
          const msg = `CRITICAL ALERT: ${metric.name} exceeded threshold: ${val}${metric.unit} > ${metric.threshold}${metric.unit}`;
          
          setLogs((prev) => [
            { id: Math.random().toString(), time, msg, level: 'error' },
            ...prev.slice(0, 49), // Keep last 50 log lines
          ]);
        }
      }
    });

    return () => {
      dispose();
      destroy(store); // Explicit cleanup on unmount
    };
  }, [store]);

  const cpuMetric = store.metrics.get('cpu')!;
  const ramMetric = store.metrics.get('ram')!;
  const netMetric = store.metrics.get('network')!;
  const dbMetric = store.metrics.get('db')!;

  const metricsList = [cpuMetric, ramMetric, netMetric, dbMetric];

  return (
    <div className="container-dashboard">
      <header>
        <div>
          <h1>System Telemetry</h1>
          <p className="subtitle">Lifecycle hooks, asynchronous triggers, and volatile properties</p>
        </div>
        <button
          className={store.isPaused ? 'primary' : ''}
          onClick={() => store.togglePause()}
        >
          {store.isPaused ? 'Resume Monitor' : 'Pause Monitor'}
        </button>
      </header>

      {/* Metrics Cards Grid */}
      <div className="metrics-grid">
        {metricsList.map((metric) => {
          const isDanger = metric.value > metric.threshold;
          // Calculate percentage for progress bar. Normalize network/db to max scale
          let pct = metric.value;
          if (metric.id === 'network') pct = (metric.value / 500) * 100;
          if (metric.id === 'db') pct = (metric.value / 60) * 100;
          pct = Math.min(100, Math.max(0, pct));

          return (
            <div key={metric.id} className={`metric-card ${isDanger ? 'alert' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">{metric.name}</span>
                <span className={`metric-status ${isDanger ? 'danger' : ''}`}>
                  {isDanger ? 'OVER LIMIT' : 'OK'}
                </span>
              </div>
              <div className="metric-value-wrapper">
                <span className="metric-value">{metric.value}</span>
                <span className="metric-unit">{metric.unit}</span>
              </div>
              <div className="progress-container">
                <div
                  className={`progress-bar ${isDanger ? 'danger' : ''}`}
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-gray-400)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Threshold: {metric.threshold}{metric.unit}</span>
                <span>Max Capacity: {metric.id === 'network' ? '500' : metric.id === 'db' ? '60' : '100'}{metric.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Control panel and logs */}
      <div className="controls-layout">
        <div className="panel">
          <div className="panel-title">Telemetry Settings</div>
          
          <div className="control-field">
            <span className="control-label">Update Frequency (ms)</span>
            <div className="flex-row" style={{ flexGrow: 1 }}>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={store.updateIntervalMs}
                onChange={(e) => store.setUpdateIntervalMs(parseInt(e.target.value))}
              />
              <span style={{ fontSize: '13px', width: '50px', textAlign: 'right' }}>{store.updateIntervalMs}ms</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '16px 0', paddingTop: '16px' }}>
            <span className="control-label" style={{ display: 'block', marginBottom: '12px', fontWeight: 600 }}>Adjust Threshold Limits</span>
            
            {metricsList.map((metric) => (
              <div key={metric.id} className="control-field" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-gray-600)' }}>
                  <span>{metric.name}</span>
                  <strong>{metric.threshold}{metric.unit}</strong>
                </div>
                <div className="control-row">
                  <input
                    type="range"
                    min="1"
                    max={metric.id === 'network' ? '500' : metric.id === 'db' ? '60' : '100'}
                    value={metric.threshold}
                    onChange={(e) => {
                      const m = store.metrics.get(metric.id);
                      if (m) m.setThreshold(parseInt(e.target.value));
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">Live Telemetry Alarms Console</div>
          <div className="terminal-logs" style={{ flexGrow: 1 }}>
            {logs.map((log) => (
              <div key={log.id} className={`terminal-line ${log.level}`}>
                [{log.time}] {log.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
