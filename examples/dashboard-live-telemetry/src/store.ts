import { types, Instance } from 'jotai-state-tree';

export const Metric = types
  .model('Metric', {
    id: types.identifier,
    name: types.string,
    value: types.number,
    unit: types.string,
    threshold: types.number,
  })
  .views((self) => ({
    get isAlert() {
      return self.value > self.threshold;
    },
  }))
  .actions((self) => ({
    setValue(val: number) {
      self.value = Math.max(0, parseFloat(val.toFixed(1)));
    },
    setThreshold(val: number) {
      self.threshold = val;
    },
  }));

export const DashboardStore = types
  .model('DashboardStore', {
    metrics: types.map(Metric),
    isPaused: types.optional(types.boolean, false),
    updateIntervalMs: types.optional(types.integer, 1000),
  })
  .volatile(() => ({
    timerId: null as any,
  }))
  .actions((self) => {
    // Define actions as local functions so they can call each other in the closure
    function setTimerId(id: any) {
      self.timerId = id;
    }

    function tick() {
      if (self.isPaused) return;

      // Simulate CPU fluctuation
      const cpu = self.metrics.get('cpu');
      if (cpu) {
        let diff = (Math.random() - 0.5) * 16;
        diff += (45 - cpu.value) * 0.05; // Tend towards 45%
        cpu.setValue(Math.min(100, Math.max(0, cpu.value + diff)));
      }

      // Simulate RAM fluctuation
      const ram = self.metrics.get('ram');
      if (ram) {
        let diff = (Math.random() - 0.46) * 3;
        diff += (65 - ram.value) * 0.02; // Tend towards 65%
        ram.setValue(Math.min(100, Math.max(0, ram.value + diff)));
      }

      // Simulate Network speed
      const net = self.metrics.get('network');
      if (net) {
        let val = net.value;
        if (Math.random() > 0.85) {
          val = 100 + Math.random() * 350; // Random spike
        } else {
          val = val + (Math.random() - 0.5) * 25;
          val = val + (110 - val) * 0.08; // Tend towards 110 Mbps baseline
        }
        net.setValue(Math.max(0, val));
      }

      // Simulate DB Connection Pool
      const db = self.metrics.get('db');
      if (db) {
        let diff = Math.random() > 0.65 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        db.setValue(Math.max(1, db.value + diff));
      }
    }

    function restartTimer() {
      if (self.timerId) {
        clearInterval(self.timerId);
      }
      const id = setInterval(() => {
        tick();
      }, self.updateIntervalMs);
      setTimerId(id);
    }

    function togglePause() {
      self.isPaused = !self.isPaused;
    }

    function setUpdateIntervalMs(ms: number) {
      self.updateIntervalMs = ms;
      restartTimer();
    }

    return {
      setTimerId,
      tick,
      restartTimer,
      togglePause,
      setUpdateIntervalMs,
    };
  })
  .afterCreate((self) => {
    self.restartTimer();
  })
  .beforeDestroy((self) => {
    if (self.timerId) {
      clearInterval(self.timerId);
    }
  });

export type IDashboardStore = Instance<typeof DashboardStore>;
export type IMetric = Instance<typeof Metric>;
