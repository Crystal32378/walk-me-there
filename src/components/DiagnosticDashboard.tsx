import React from 'react';
import type { NavData } from '../types/navigation';

interface Props {
  data: NavData;
}

const StateBadge: React.FC<{ state: NavData['state'] }> = ({ state }) => {
  const badgeStyles: Record<NavData['state'], string> = {
    UNCERTAIN_GPS: 'badge-uncertain',
    STATIONARY: 'badge-stationary',
    ON_ROUTE: 'badge-on-route',
    WRONG_DIRECTION: 'badge-wrong-direction',
    OFF_ROUTE: 'badge-off-route'
  };

  return (
    <span className={`diag-badge ${badgeStyles[state]}`}>
      {state}
    </span>
  );
};

export const DiagnosticDashboard: React.FC<Props> = ({ data }) => {
  return (
    <div className="diag-dashboard-panel">
      <div className="diag-header">
        <span className="diag-title">ENGINE TELEMETRY v0.1</span>
        <StateBadge state={data.state} />
      </div>

      <div className="diag-grid">
        <div className="diag-card">
          <span className="diag-label">GPS Accuracy</span>
          <span className={`diag-value ${data.accuracy > 15 ? 'val-warning' : 'val-good'}`}>
            {data.accuracy.toFixed(1)}m
          </span>
        </div>

        <div className="diag-card">
          <span className="diag-label">Movement Speed</span>
          <span className="diag-value">{data.speed ? data.speed.toFixed(2) : '0.00'} m/s</span>
        </div>

        <div className="diag-card">
          <span className="diag-label">Current Bearing</span>
          <span className="diag-value">{data.bearing !== null ? `${data.bearing.toFixed(1)}°` : '---'}</span>
        </div>

        <div className="diag-card">
          <span className="diag-label">Expected Bearing</span>
          <span className="diag-value">{data.expectedBearing !== null ? `${data.expectedBearing.toFixed(1)}°` : '---'}</span>
        </div>

        <div className="diag-card">
          <span className="diag-label">Bearing Delta</span>
          <span className={`diag-value ${(data.bearingDelta || 0) > 45 ? 'val-alert' : 'val-good'}`}>
            {data.bearingDelta !== null ? `${data.bearingDelta.toFixed(1)}°` : '---'}
          </span>
        </div>

        <div className="diag-card">
          <span className="diag-label">Cross-Track Dist</span>
          <span className={`diag-value ${data.crossTrackDistance > 20 ? 'val-danger' : 'val-good'}`}>
            {data.crossTrackDistance.toFixed(1)}m
          </span>
        </div>

        <div className="diag-card col-span-2">
          <span className="diag-label">Dist to Waypoint</span>
          <span className="diag-value highlight-val">{data.distanceToWaypoint.toFixed(1)}m</span>
        </div>
      </div>

      <div className="diag-footer font-mono text-xs">
        <div>LAT: {data.currentCoords.lat.toFixed(6)} | LNG: {data.currentCoords.lng.toFixed(6)}</div>
        <div>TIMESTAMP: {new Date(data.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  );
};
