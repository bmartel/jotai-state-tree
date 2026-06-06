/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import { clearAllRegistries, resetGlobalStore } from '../../index';
import { App } from '../../../examples/dashboard-live-telemetry/src/App';

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('System Telemetry Dashboard Example App', () => {
  it('should support dynamic metric tick updates, pausing/resuming telemetry, threshold adjustment, and alarm alerts console log', async () => {
    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // 1. Initial State Verification
    const container = screen.getByText('System Telemetry').closest('.container-dashboard') as HTMLElement;
    const metricsGrid = container.querySelector('.metrics-grid') as HTMLElement;
    const settingsPanel = screen.getByText('Telemetry Settings').closest('.panel') as HTMLElement;

    expect(within(metricsGrid).getByText('CPU Load')).toBeDefined();
    expect(within(metricsGrid).getByText('Memory Usage')).toBeDefined();
    expect(within(metricsGrid).getByText('Network Speed')).toBeDefined();
    expect(within(metricsGrid).getByText('Active DB Connections')).toBeDefined();

    // Check initial CPU value (default 25)
    const cpuCard = within(metricsGrid).getByText('CPU Load').closest('.metric-card')!;
    expect(within(cpuCard).getByText('25')).toBeDefined();

    // Verify initial console log
    const consolePanel = screen.getByText('Live Telemetry Alarms Console').closest('.panel')!;
    expect(within(consolePanel).getByText(/Telemetry monitor initialized/)).toBeDefined();

    // 2. Advance timers to trigger interval tick
    // Interval is 1000ms. Let's advance it by 1000ms.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // CPU value should have updated/changed from 25
    expect(within(cpuCard).queryByText('25')).toBeNull();

    const updatedCpuValue = cpuCard.querySelector('.metric-value')?.textContent;
    expect(updatedCpuValue).toBeDefined();
    expect(updatedCpuValue).not.toBe('25');

    // 3. Pause Telemetry
    const pauseBtn = screen.getByRole('button', { name: 'Pause Monitor' });
    fireEvent.click(pauseBtn);

    // Text should change to Resume Monitor
    expect(screen.getByRole('button', { name: 'Resume Monitor' })).toBeDefined();

    const pausedCpuValue = cpuCard.querySelector('.metric-value')?.textContent;

    // Advance timers by 2000ms
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // CPU value should remain exactly the same
    expect(cpuCard.querySelector('.metric-value')?.textContent).toBe(pausedCpuValue);

    // 4. Resume Telemetry
    const resumeBtn = screen.getByRole('button', { name: 'Resume Monitor' });
    fireEvent.click(resumeBtn);

    expect(screen.getByRole('button', { name: 'Pause Monitor' })).toBeDefined();

    // 5. Test Threshold Alarms
    // Locate the CPU threshold slider in the control panel settings
    const cpuControlField = within(settingsPanel).getByText('CPU Load').closest('.control-field')!;
    const cpuSlider = within(cpuControlField).getByRole('slider');

    // Adjust threshold down to 1% (which CPU value will definitely exceed on next tick)
    fireEvent.change(cpuSlider, { target: { value: '1' } });

    // Verify threshold is displayed as 1% in settings and CPU card
    expect(within(cpuControlField).getByText('1%')).toBeDefined();
    expect(within(cpuCard).getByText('Threshold: 1%')).toBeDefined();

    // Force Math.random to return something predictable if needed, or let tick run
    // Since CPU value is at least 15-30% and threshold is 1%, it will cross it.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Live Alarm Console should display a critical alert
    expect(within(consolePanel).getByText(/CRITICAL ALERT: CPU Load exceeded threshold/)).toBeDefined();
  });
});
